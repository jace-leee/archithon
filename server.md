# SAM 3 모델 서버 구축 설명서

> **Meta Segment Anything Model 3 — Inference Server Deployment Guide**
> 대상 환경: GPU 클라우드 인스턴스 (`a100-3g.40gb` · 8 vCPU · 96 GiB RAM)
> 버전 1.0 | 2026년 3월

---

## 목차

1. [SAM 3 개요](#1-sam-3-개요)
2. [인스턴스 환경 확인](#2-인스턴스-환경-확인)
3. [환경 설정 및 설치](#3-환경-설정-및-설치)
4. [모델 체크포인트 다운로드](#4-모델-체크포인트-다운로드)
5. [설치 검증](#5-설치-검증)
6. [추론 서버 구축 (FastAPI)](#6-추론-서버-구축-fastapi)
7. [서버 실행 및 테스트](#7-서버-실행-및-테스트)
8. [성능 최적화](#8-성능-최적화)
9. [비디오 추론 엔드포인트](#9-비디오-추론-엔드포인트)
10. [프로덕션 운영 — systemd 서비스 등록](#10-프로덕션-운영--systemd-서비스-등록)
11. [트러블슈팅](#11-트러블슈팅)
12. [참고 자료](#12-참고-자료)

---

## 1. SAM 3 개요

### 1.1 SAM 3란?

SAM 3(Segment Anything Model 3)는 Meta Superintelligence Labs에서 2025년 11월 19일에 공개한 차세대 비전 파운데이션 모델입니다. 이미지와 비디오에서 객체를 탐지(detection), 분할(segmentation), 추적(tracking)하는 통합 모델로, 텍스트 프롬프트, 예시 이미지(exemplar), 시각적 프롬프트(포인트/박스/마스크) 등 다양한 방식으로 프롬프팅할 수 있습니다.

이전 버전인 SAM 1, SAM 2와 달리 **Promptable Concept Segmentation(PCS)** 기능을 도입하여, 자연어 텍스트로 객체를 설명하면 해당 객체의 모든 인스턴스를 자동으로 찾아 분할합니다. 400만 개 이상의 고유 개념 레이블로 학습되어, 기존 시스템 대비 정확도가 2배 향상되었습니다.

### 1.2 핵심 특징

| 특징 | 설명 |
|------|------|
| 텍스트 프롬프트 (Open-Vocabulary) | `"노란 스쿨버스"`와 같은 자연어 구문으로 객체 분할 |
| 예시 프롬프트 (Exemplar) | 바운딩 박스로 예시 지정 → 유사 객체 자동 분할 |
| 시각적 프롬프트 | 포인트 클릭, 바운딩 박스, 마스크 등 SAM 1/2 호환 |
| 비디오 추적 | 프레임 간 객체 아이덴티티 유지 및 추적 |
| 통합 아키텍처 | 탐지 + 분할 + 추적을 단일 모델에서 처리 |
| Presence Head | 객체 존재 여부를 먼저 판단하여 정확도 향상 |

### 1.3 모델 사양

| 항목 | 사양 |
|------|------|
| 파라미터 수 | 848M (8억 4천 8백만) |
| 아키텍처 | DETR 기반 탐지기 + SAM 2 기반 트래커 (비전 인코더 공유) |
| 모델 가중치 크기 | ~3.4 GB |
| 학습 데이터 | 400만+ 고유 개념 레이블 (SA-Co 데이터셋) |
| 입력 | 이미지, 비디오, 텍스트/박스/포인트 프롬프트 |
| 출력 | 세그멘테이션 마스크, 바운딩 박스, 신뢰도 점수 |
| 라이선스 | SAM License (연구 및 상업적 사용 허용, 조건 있음) |

---

## 2. 인스턴스 환경 확인

### 2.1 대상 인스턴스 사양

```
인스턴스 타입: a100-3g.40gb
GPU:          NVIDIA A100 40GB (MIG 3g.40gb 파티션)
vCPU:         8
RAM:          96 GiB
```

> **A100 40GB는 SAM 3 운영에 충분한 사양입니다.** 모델 가중치 ~3.4GB + 추론 시 중간 텐서를 포함해도 약 8~12GB VRAM이면 BF16 추론이 가능하며, 40GB VRAM으로 넉넉한 여유가 있습니다.

### 2.2 인스턴스 접속 후 환경 확인

```bash
# GPU 확인
nvidia-smi

# CUDA 버전 확인
nvcc --version

# 사용 가능한 디스크 공간 확인 (최소 50GB 필요)
df -h

# Python 버전 확인
python3 --version
```

예상 출력 예시:
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 5xx.xx       Driver Version: 5xx.xx       CUDA Version: 12.x    |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
|   0  NVIDIA A100          On  | 00000000:00:04.0 Off |                    0 |
|                               |                      |                      |
+-------------------------------+----------------------+----------------------+
```

---

## 3. 환경 설정 및 설치

### 3.1 시스템 패키지 설치

```bash
sudo apt-get update && sudo apt-get install -y \
    git \
    wget \
    curl \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg
```

### 3.2 Conda 환경 생성

```bash
# Miniconda 설치 (이미 설치된 경우 건너뛰기)
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
eval "$($HOME/miniconda3/bin/conda shell.bash hook)"
conda init

# 새 환경 생성
conda create -n sam3 python=3.12 -y
conda activate sam3
```

### 3.3 PyTorch 설치 (CUDA 12.6)

```bash
pip install torch==2.7.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu126
```

> **참고:** 인스턴스의 CUDA 드라이버 버전이 12.6 이상인지 확인하세요. `nvidia-smi` 우측 상단의 "CUDA Version"이 12.6 이상이어야 합니다. 드라이버가 낮은 경우 `cu124` 등 호환되는 버전으로 대체합니다.

### 3.4 SAM 3 소스코드 클론 및 설치

```bash
# 리포지토리 클론
git clone https://github.com/facebookresearch/sam3.git
cd sam3

# 기본 설치
pip install -e .

# 예제 노트북 의존성 포함 설치 (선택)
pip install -e ".[notebooks]"
```

### 3.5 추론 서버 의존성 설치

```bash
pip install \
    fastapi>=0.115.0 \
    "uvicorn[standard]>=0.30.0" \
    python-multipart>=0.0.9 \
    Pillow>=10.0.0 \
    numpy
```

---

## 4. 모델 체크포인트 다운로드

> ⚠️ **SAM 3 체크포인트는 Hugging Face에서 접근 권한을 신청해야 합니다.**
> 승인까지 보통 24~48시간이 소요되므로, 서버 구축 전에 미리 신청해두세요.

### 4.1 접근 권한 신청

1. Hugging Face 모델 페이지 방문: https://huggingface.co/facebook/sam3
2. `Request access` 버튼 클릭
3. 승인 이메일 수신 대기

### 4.2 CLI 인증 및 다운로드

```bash
# Hugging Face CLI 설치
pip install huggingface_hub

# 로그인 (Access Token 필요)
# 토큰 생성: https://huggingface.co/settings/tokens
huggingface-cli login
```

토큰 입력 후 인증이 완료되면, SAM 3 코드 실행 시 체크포인트가 자동으로 다운로드됩니다. 첫 실행 시 **~3.4GB**가 `~/.cache/huggingface/` 경로에 캐시됩니다.

---

## 5. 설치 검증

```bash
# conda 환경 활성화 확인
conda activate sam3

# 1) PyTorch + CUDA 검증
python -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available:  {torch.cuda.is_available()}')
print(f'CUDA version:    {torch.version.cuda}')
print(f'GPU device:      {torch.cuda.get_device_name(0)}')
print(f'GPU memory:      {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB')
"

# 2) SAM 3 모듈 검증
python -c "
from sam3.model_builder import build_sam3_image_model
print('SAM 3 import successful!')
"

# 3) 모델 로드 검증 (첫 실행 시 체크포인트 자동 다운로드)
python -c "
import torch
from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor

torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

model = build_sam3_image_model()
processor = Sam3Processor(model)
print('Model loaded successfully!')
print(f'GPU memory allocated: {torch.cuda.memory_allocated(0) / 1e9:.2f} GB')
"
```

모든 단계에서 오류 없이 출력되면 설치가 완료된 것입니다.

---

## 6. 추론 서버 구축 (FastAPI)

### 6.1 프로젝트 구조

```
~/sam3-server/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI 애플리케이션
│   └── model.py           # SAM 3 모델 싱글톤
└── run.sh                 # 서버 실행 스크립트
```

```bash
mkdir -p ~/sam3-server/app
touch ~/sam3-server/app/__init__.py
```

### 6.2 모델 모듈 — `app/model.py`

서버 시작 시 모델을 한 번만 로드하고, 모든 요청에서 재사용하는 싱글톤 패턴입니다. A100에서 BF16 반정밀도를 사용하여 메모리와 속도를 최적화합니다.

```python
# ~/sam3-server/app/model.py

import torch
from PIL import Image
from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor


class SAM3Model:
    """SAM 3 모델 싱글톤 래퍼"""

    _instance = None

    @classmethod
    def get_instance(cls) -> "SAM3Model":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        # A100 TF32 가속 활성화
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

        print("[SAM3] Loading model...")
        self.model = build_sam3_image_model()
        self.processor = Sam3Processor(self.model)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        mem = torch.cuda.memory_allocated(0) / 1e9
        print(f"[SAM3] Model loaded. GPU memory: {mem:.2f} GB")

    def predict_text(self, image: Image.Image, prompt: str) -> dict:
        """텍스트 프롬프트 기반 세그멘테이션 (PCS)"""
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            output = self.processor.set_text_prompt(
                state=state, prompt=prompt
            )

        result = {
            "masks": output["masks"].cpu().numpy().tolist(),
            "boxes": output["boxes"].cpu().numpy().tolist(),
            "scores": output["scores"].cpu().numpy().tolist(),
        }
        torch.cuda.empty_cache()
        return result

    def predict_box(self, image: Image.Image, box: list[float]) -> dict:
        """바운딩 박스 프롬프트 기반 세그멘테이션 (PVS)"""
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            output = self.processor.set_box_prompt(
                state=state, box=box
            )

        result = {
            "masks": output["masks"].cpu().numpy().tolist(),
            "boxes": output["boxes"].cpu().numpy().tolist(),
            "scores": output["scores"].cpu().numpy().tolist(),
        }
        torch.cuda.empty_cache()
        return result

    def predict_multi_text(self, image: Image.Image, prompts: list[str]) -> dict:
        """다중 텍스트 프롬프트 세그멘테이션"""
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            results = []
            for prompt in prompts:
                output = self.processor.set_text_prompt(
                    state=state, prompt=prompt
                )
                results.append({
                    "prompt": prompt,
                    "masks": output["masks"].cpu().numpy().tolist(),
                    "boxes": output["boxes"].cpu().numpy().tolist(),
                    "scores": output["scores"].cpu().numpy().tolist(),
                })

        torch.cuda.empty_cache()
        return {"results": results}
```

### 6.3 API 엔드포인트 — `app/main.py`

```python
# ~/sam3-server/app/main.py

import io
import json
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.model import SAM3Model

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
    logger.info("SAM 3 model ready.")
    yield
    logger.info("Shutting down.")


# ── FastAPI 앱 ─────────────────────────────────────────────
app = FastAPI(
    title="SAM 3 Inference Server",
    description="Meta Segment Anything Model 3 — Text & Visual Prompt Segmentation API",
    version="1.0.0",
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
        "model": "SAM3",
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
```

### 6.4 서버 실행 스크립트 — `run.sh`

```bash
#!/bin/bash
# ~/sam3-server/run.sh

# conda 환경 활성화
source ~/miniconda3/etc/profile.d/conda.sh
conda activate sam3

# SAM 3 리포지토리가 PYTHONPATH에 포함되어야 함
export PYTHONPATH="$HOME/sam3:$PYTHONPATH"

# 서버 시작
cd ~/sam3-server
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 7777 \
    --workers 1 \
    --timeout-keep-alive 120 \
    --log-level info
```

```bash
chmod +x ~/sam3-server/run.sh
```

> **`--workers 1`인 이유:** SAM 3 모델은 GPU 메모리를 많이 사용하므로, 단일 워커에서 GPU를 독점하는 것이 안정적입니다. 동시 요청 처리가 필요하면 `asyncio` 기반 큐를 도입하세요.

---

## 7. 서버 실행 및 테스트

### 7.1 서버 시작

```bash
cd ~/sam3-server
bash run.sh
```

첫 실행 시 모델 체크포인트 다운로드에 수 분이 소요됩니다. 이후 실행은 즉시 시작됩니다.

정상 시작 시 로그:
```
[SAM3] Loading model...
[SAM3] Model loaded. GPU memory: X.XX GB
INFO:     SAM 3 model ready.
INFO:     Uvicorn running on http://0.0.0.0:7777
```

### 7.2 API 테스트

```bash
# 1) 헬스체크
curl http://localhost:7777/health

# 2) 텍스트 프롬프트 세그멘테이션
curl -X POST http://localhost:7777/predict/text \
  -F "file=@test_image.jpg" \
  -F "prompt=person"

# 3) 다중 텍스트 프롬프트
curl -X POST http://localhost:7777/predict/multi-text \
  -F "file=@test_image.jpg" \
  -F 'prompts=["person", "car", "dog"]'

# 4) 바운딩 박스 프롬프트
curl -X POST http://localhost:7777/predict/box \
  -F "file=@test_image.jpg" \
  -F "box=[100, 100, 400, 400]"
```

### 7.3 Swagger UI

브라우저에서 `http://<인스턴스IP>:7777/docs`에 접속하면 인터랙티브 API 문서를 확인하고 직접 테스트할 수 있습니다.

### 7.4 Python 클라이언트 예시

```python
import requests

url = "http://<서버IP>:7777/predict/text"

with open("test_image.jpg", "rb") as f:
    response = requests.post(
        url,
        files={"file": ("image.jpg", f, "image/jpeg")},
        data={"prompt": "person"},
    )

result = response.json()
print(f"탐지된 객체 수: {len(result['scores'])}")
print(f"추론 시간: {result['inference_time_sec']}s")

for i, score in enumerate(result["scores"]):
    print(f"  객체 {i}: score={score:.3f}, box={result['boxes'][i]}")
```

---

## 8. 성능 최적화

### 8.1 A100 최적화 설정

A100은 Ampere 아키텍처로, 다음 최적화가 자동 적용됩니다:

| 최적화 | 효과 | 코드 |
|--------|------|------|
| BF16 반정밀도 | 메모리 ~50% 절감, 속도 향상 | `torch.autocast("cuda", dtype=torch.bfloat16)` |
| TF32 활성화 | FP32 대비 8배 행렬 연산 가속 | `torch.backends.cuda.matmul.allow_tf32 = True` |
| Gradient 비활성화 | 추론 시 메모리 절감 | `torch.no_grad()` 컨텍스트 |
| GPU 캐시 정리 | 메모리 누수 방지 | `torch.cuda.empty_cache()` |
| cuDNN TF32 | 컨볼루션 가속 | `torch.backends.cudnn.allow_tf32 = True` |

> 위 최적화는 `model.py`에 이미 적용되어 있습니다.

### 8.2 배치 추론 (대량 이미지 처리)

대량 이미지를 처리할 경우, 공식 배치 추론 예제를 참고하세요:

```python
# sam3/examples/sam3_image_batched_inference.ipynb 참고

from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor
import torch
from PIL import Image

model = build_sam3_image_model()
processor = Sam3Processor(model)

images = [Image.open(f"image_{i}.jpg") for i in range(10)]
prompts = ["person"] * 10

results = []
with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
    for image, prompt in zip(images, prompts):
        state = processor.set_image(image)
        output = processor.set_text_prompt(state=state, prompt=prompt)
        results.append(output)
    torch.cuda.empty_cache()
```

### 8.3 VRAM 모니터링

```bash
# 실시간 GPU 상태 (1초 간격)
watch -n 1 nvidia-smi

# Python에서 상세 모니터링
python -c "
import torch
props = torch.cuda.get_device_properties(0)
print(f'Total:     {props.total_mem / 1e9:.1f} GB')
print(f'Allocated: {torch.cuda.memory_allocated(0) / 1e9:.2f} GB')
print(f'Cached:    {torch.cuda.memory_reserved(0) / 1e9:.2f} GB')
print(f'Free:      {(props.total_mem - torch.cuda.memory_reserved(0)) / 1e9:.2f} GB')
"
```

---

## 9. 비디오 추론 엔드포인트

SAM 3는 비디오에서 객체 추적도 지원합니다. 비디오 입력은 MP4 파일 또는 JPEG 프레임 디렉토리 형식을 사용합니다.

### 9.1 비디오 추론 기본 코드

```python
from sam3.model_builder import build_sam3_video_predictor

video_predictor = build_sam3_video_predictor()

# 세션 시작
response = video_predictor.handle_request(
    request=dict(
        type="start_session",
        resource_path="/path/to/video.mp4",  # 또는 JPEG 폴더 경로
    )
)

# 텍스트 프롬프트로 객체 지정
response = video_predictor.handle_request(
    request=dict(
        type="add_prompt",
        session_id=response["session_id"],
        frame_index=0,             # 프롬프트를 적용할 프레임
        text="person in red shirt", # 텍스트 프롬프트
    )
)

# 결과 확인
output = response["outputs"]
```

### 9.2 JPEG 프레임 변환

비디오를 JPEG 프레임 디렉토리로 변환하는 방법:

```bash
# MP4 → JPEG 프레임 (00000.jpg, 00001.jpg, ...)
mkdir -p /tmp/frames
ffmpeg -i input.mp4 -q:v 2 -start_number 0 /tmp/frames/%05d.jpg
```

> **비디오 추론 시 메모리 사용량이 크게 증가할 수 있습니다.** 긴 비디오는 세그먼트 단위로 나누어 처리하는 것을 권장합니다.

---

## 10. 프로덕션 운영 — systemd 서비스 등록

인스턴스 재시작 시 자동으로 서버가 기동되도록 systemd 서비스를 등록합니다.

```bash
sudo tee /etc/systemd/system/sam3.service << 'EOF'
[Unit]
Description=SAM 3 Inference Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/sam3-server
ExecStart=/bin/bash /home/ubuntu/sam3-server/run.sh
Restart=on-failure
RestartSec=10
Environment=HOME=/home/ubuntu

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sam3
sudo systemctl start sam3

# 상태 확인
sudo systemctl status sam3

# 로그 확인
journalctl -u sam3 -f
```

---

## 11. 트러블슈팅

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| `CUDA out of memory` | GPU 메모리 부족 | BF16 사용 확인, `empty_cache()` 호출, 입력 이미지 해상도 축소 |
| 모델 로드 실패 (403) | HuggingFace 인증 오류 | `huggingface-cli login` 재실행, 토큰 및 접근 권한 확인 |
| `SimpleTokenizer not callable` | 잘못된 clip 패키지 | `pip uninstall clip -y && pip install git+https://github.com/ultralytics/CLIP.git` |
| 추론 속도 느림 | CPU 폴백 또는 미최적화 | `torch.cuda.is_available()` 확인, TF32/BF16 활성화 |
| `Connection refused` | 서버 미시작 또는 포트 충돌 | 프로세스 확인 `lsof -i :7777`, 로그 확인 |
| 타임아웃 오류 | 대용량 이미지 처리 지연 | `--timeout-keep-alive` 값 증가, 이미지 리사이즈 |
| `torch.OutOfMemoryError` 간헐 발생 | 장시간 운영 시 메모리 누수 | `empty_cache()` 주기적 호출, 서버 주기적 재시작 |
| CUDA 버전 불일치 | 드라이버 vs PyTorch CUDA 버전 | `nvidia-smi` CUDA 버전 확인 후 호환되는 PyTorch 재설치 |

---

## 12. 참고 자료

| 리소스 | URL |
|--------|-----|
| 공식 GitHub 리포지토리 | https://github.com/facebookresearch/sam3 |
| Meta AI 블로그 | https://ai.meta.com/blog/segment-anything-model-3/ |
| 논문 (arXiv) | https://arxiv.org/abs/2511.16719 |
| Hugging Face 모델 | https://huggingface.co/facebook/sam3 |
| SA-Co 벤치마크 (Gold) | https://huggingface.co/datasets/facebook/SACo-Gold |
| Segment Anything Playground | https://segment-anything.com/ |
| Ultralytics 통합 문서 | https://docs.ultralytics.com/models/sam-3/ |
| TensorRT 최적화 (trt-sam3) | https://github.com/leon0514/trt-sam3 |
| Roboflow SAM 3 가이드 | https://blog.roboflow.com/what-is-sam3/ |

---

> **문서 끝** | SAM 3 Server Deployment Guide v1.0