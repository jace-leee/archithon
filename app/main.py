# ~/sam3-server/app/main.py

import io
import json
import time
import logging
from contextlib import asynccontextmanager

import base64

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.model import SAM3Model
from app.model_3d import SAM3DModel
from app.model_flux import FluxModel

# ── 로깅 설정 ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("sam3-server")


# ── Lifespan: 서버 시작/종료 시 모델 관리 ─────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    SAM3Model.get_instance()
    logger.info("SAM 3 segmentation model ready.")
    SAM3DModel.get_instance()
    logger.info("SAM 3D Objects model ready.")
    FluxModel.get_instance()
    logger.info("FLUX.2 Klein model ready.")
    yield
    logger.info("Shutting down.")


# ── FastAPI 앱 ─────────────────────────────────────────────
app = FastAPI(
    title="Archithon Vision Server",
    description="SAM3 Segmentation + SAM3D 3D Generation + FLUX.2 Image Generation API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 엔드포인트 ─────────────────────────────────────────────

@app.get("/health")
async def health():
    """서버 상태 확인"""
    import torch
    return {
        "status": "healthy",
        "models": ["SAM3", "SAM3D", "FLUX"],
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
        "gpu_memory_allocated_gb": round(
            torch.cuda.memory_allocated(0) / 1e9, 2
        ) if torch.cuda.is_available() else 0,
    }


@app.post("/predict/text")
async def predict_text(
    file: UploadFile = File(..., description="이미지 파일 (JPEG/PNG)"),
    prompt: str = Form(..., description="텍스트 프롬프트 (예: 'person', '노란 버스')"),
):
    """
    텍스트 프롬프트 기반 세그멘테이션 (PCS)

    이미지와 텍스트를 전송하면 해당 개념에 매칭되는 모든 객체의
    세그멘테이션 마스크, 바운딩 박스, 신뢰도 점수를 반환합니다.
    """
    start = time.time()
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    model = SAM3Model.get_instance()
    result = model.predict_text(image, prompt)

    elapsed = round(time.time() - start, 3)
    logger.info(f"predict/text  prompt=\"{prompt}\"  {elapsed}s  objects={len(result['scores'])}")

    return JSONResponse(content={
        **result,
        "prompt": prompt,
        "inference_time_sec": elapsed,
    })


@app.post("/predict/multi-text")
async def predict_multi_text(
    file: UploadFile = File(..., description="이미지 파일"),
    prompts: str = Form(..., description="텍스트 프롬프트 목록 (JSON 배열, 예: [\"person\", \"car\"])"),
):
    """
    다중 텍스트 프롬프트 세그멘테이션

    하나의 이미지에 여러 텍스트 프롬프트를 한번에 전송합니다.
    이미지 인코딩은 한 번만 수행되어 효율적입니다.
    """
    start = time.time()
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    try:
        prompt_list = json.loads(prompts)
        if not isinstance(prompt_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="prompts는 JSON 배열 형식이어야 합니다. 예: [\"person\", \"car\"]",
        )

    model = SAM3Model.get_instance()
    result = model.predict_multi_text(image, prompt_list)

    elapsed = round(time.time() - start, 3)
    logger.info(f"predict/multi-text  prompts={prompt_list}  {elapsed}s")

    return JSONResponse(content={
        **result,
        "inference_time_sec": elapsed,
    })


@app.post("/predict/box")
async def predict_box(
    file: UploadFile = File(..., description="이미지 파일"),
    box: str = Form(..., description="바운딩 박스 [x1, y1, x2, y2]"),
):
    """
    바운딩 박스 프롬프트 기반 세그멘테이션 (PVS)

    이미지와 바운딩 박스 좌표를 전송하면 해당 영역의
    세그멘테이션 마스크를 반환합니다.
    """
    start = time.time()
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    try:
        box_coords = json.loads(box)
        if not isinstance(box_coords, list) or len(box_coords) != 4:
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="box는 [x1, y1, x2, y2] 형식이어야 합니다.",
        )

    model = SAM3Model.get_instance()
    result = model.predict_box(image, box_coords)

    elapsed = round(time.time() - start, 3)
    logger.info(f"predict/box  box={box_coords}  {elapsed}s")

    return JSONResponse(content={
        **result,
        "box": box_coords,
        "inference_time_sec": elapsed,
    })


@app.post("/predict/3d")
async def predict_3d(
    file: UploadFile = File(..., description="이미지 파일 (JPEG/PNG)"),
    mask: UploadFile = File(None, description="마스크 파일 (PNG, 흰색=객체). 없으면 prompt로 자동 생성"),
    prompt: str = Form(None, description="텍스트 프롬프트 (mask 없을 때 SAM3로 자동 세그멘테이션)"),
    mask_index: int = Form(0, description="자동 세그멘테이션 시 사용할 마스크 인덱스"),
    seed: int = Form(42, description="3D 생성 시드"),
):
    """
    이미지 → 3D Gaussian Splat (PLY) 변환

    mask 파일을 직접 제공하거나, prompt를 지정하면 SAM3로 자동 세그멘테이션 후
    해당 마스크를 사용하여 3D 모델을 생성합니다.

    반환: PLY 파일 (application/octet-stream)
    """
    start = time.time()

    # 이미지 로드
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image_np = np.array(image)
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    # 마스크 결정
    if mask is not None:
        # 직접 제공된 마스크
        try:
            mask_contents = await mask.read()
            mask_img = Image.open(io.BytesIO(mask_contents)).convert("L")
            mask_np = np.array(mask_img) > 128
        except Exception:
            raise HTTPException(status_code=400, detail="마스크를 읽을 수 없습니다.")
    elif prompt is not None:
        # SAM3로 자동 세그멘테이션
        sam3 = SAM3Model.get_instance()
        result = sam3.predict_text(image, prompt)
        if not result["masks"]:
            raise HTTPException(
                status_code=404,
                detail=f"'{prompt}'에 해당하는 객체를 찾을 수 없습니다.",
            )
        idx = min(mask_index, len(result["masks"]) - 1)
        # base64 PNG 마스크 디코딩
        mask_bytes = base64.b64decode(result["masks"][idx])
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")
        mask_np = np.array(mask_img) > 128
    else:
        raise HTTPException(
            status_code=400,
            detail="mask 파일 또는 prompt 중 하나를 제공해야 합니다.",
        )

    # 3D 생성
    sam3d = SAM3DModel.get_instance()
    glb_bytes = sam3d.generate_3d(image_np, mask_np, seed=seed)

    elapsed = round(time.time() - start, 3)
    logger.info(f"predict/3d  seed={seed}  {elapsed}s  glb_size={len(glb_bytes)}")

    return Response(
        content=glb_bytes,
        media_type="model/gltf-binary",
        headers={
            "Content-Disposition": "attachment; filename=output.glb",
            "X-Inference-Time-Sec": str(elapsed),
        },
    )


# ── FLUX.2 Klein 엔드포인트 ────────────────────────────────

@app.post("/generate")
async def generate_image(
    prompt: str = Form(..., description="이미지 생성 프롬프트 (서술형 권장)"),
    width: int = Form(1024, description="이미지 너비 (16의 배수, 최대 2048)"),
    height: int = Form(1024, description="이미지 높이 (16의 배수, 최대 2048)"),
    seed: int = Form(-1, description="시드 (-1이면 랜덤)"),
):
    """
    텍스트 → 이미지 생성 (FLUX.2 Klein T2I)

    프롬프트를 기반으로 고품질 이미지를 생성합니다.
    4스텝 추론으로 ~1.5초 내에 1024x1024 이미지를 생성합니다.
    """
    start = time.time()

    flux = FluxModel.get_instance()
    png_bytes = flux.generate(prompt, width=width, height=height, seed=seed)

    elapsed = round(time.time() - start, 3)
    logger.info(f"generate  prompt=\"{prompt[:50]}\"  {width}x{height}  {elapsed}s")

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"X-Inference-Time-Sec": str(elapsed)},
    )


@app.post("/edit")
async def edit_image(
    image_file: UploadFile = File(..., description="입력 이미지 (JPEG/PNG)"),
    prompt: str = Form(
        "Photorealistic, natural lighting, 8K detail",
        description="변환 프롬프트",
    ),
    seed: int = Form(-1, description="시드 (-1이면 랜덤)"),
):
    """
    이미지 → 이미지 변환 (FLUX.2 Klein I2I)

    입력 이미지를 프롬프트 기반으로 변환합니다.
    """
    start = time.time()

    try:
        contents = await image_file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 읽을 수 없습니다.")

    flux = FluxModel.get_instance()
    png_bytes = flux.edit(image, prompt=prompt, seed=seed)

    elapsed = round(time.time() - start, 3)
    logger.info(f"edit  prompt=\"{prompt[:50]}\"  {elapsed}s")

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"X-Inference-Time-Sec": str(elapsed)},
    )
