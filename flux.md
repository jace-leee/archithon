# FLUX.2 [klein] 구축 가이드

> **최종 업데이트:** 2026-03-15  
> **대상 환경:** A100 MIG 3g.40GB (Ubuntu 24.04, CUDA 12.x)  
> **모델:** FLUX.2 [klein] 4B Distilled (Apache 2.0)

---

## 1. 개요

FLUX.2 [klein]은 Black Forest Labs가 2026년 1월 15일 공개한 초고속 이미지 생성/편집 모델이다.
4B 파라미터의 정류 흐름 트랜스포머(Rectified Flow Transformer) 아키텍처 기반으로,
텍스트→이미지(T2I), 이미지→이미지(I2I), 멀티 레퍼런스 편집을 단일 체크포인트에서 지원한다.

**핵심 스펙:**

| 항목 | 4B Distilled | 4B Base | 9B Distilled |
|------|-------------|---------|-------------|
| 파라미터 | 4B | 4B | 9B |
| 추론 스텝 | 4 (고정) | 50 (조절 가능) | 4 (고정) |
| VRAM 요구량 | ~8–13GB | ~9GB | ~29GB |
| 추론 속도 (RTX 4090) | ~1.2초 | ~17초 | ~0.5초 |
| 라이선스 | Apache 2.0 | Apache 2.0 | 비상업 |
| guidance_scale | 1.0 (고정) | 4.0 (조절 가능) | 1.0 (고정) |
| 최대 해상도 | 4MP (2048×2048) | 4MP | 4MP |

---

## 2. 사전 요구사항

### 2.1 하드웨어

```
GPU: NVIDIA A100 MIG 3g.40GB (40GB VRAM) ✅
     - 4B 모델: 여유 넉넉 (~13GB 사용)
     - 9B 모델: 가능하나 빡빡함 (FP8 권장)
vCPU: 8개 이상
RAM: 32GB 이상 (96GB 권장)
디스크: 최소 30GB 여유 공간
```

### 2.2 소프트웨어

```
OS: Ubuntu 22.04 / 24.04
Python: 3.10 ~ 3.12
CUDA: 12.1 이상
NVIDIA Driver: 535+ (A100 MIG 지원)
```

---

## 3. 환경 설정

### 3.1 Python 가상환경 생성

```bash
# Python 3.12 가상환경
python3.12 -m venv /opt/flux2-klein
source /opt/flux2-klein/bin/activate

# pip 업그레이드
pip install --upgrade pip setuptools wheel
```

### 3.2 PyTorch + 의존성 설치

```bash
# PyTorch (CUDA 12.1)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Diffusers (최신 버전 필수 - FLUX.2 klein 지원)
pip install git+https://github.com/huggingface/diffusers.git

# 기타 의존성
pip install transformers accelerate sentencepiece protobuf
pip install fastapi uvicorn python-multipart Pillow
```

### 3.3 Hugging Face 인증 (선택)

```bash
pip install huggingface_hub
huggingface-cli login
# 토큰 입력 (https://huggingface.co/settings/tokens)
```

---

## 4. 모델 다운로드

### 4.1 Diffusers 형식 (권장)

```bash
# 4B Distilled (Apache 2.0, 상업 이용 가능)
# 첫 실행 시 자동 다운로드되며, 캐시 경로: ~/.cache/huggingface/
python -c "
from diffusers import Flux2KleinPipeline
pipe = Flux2KleinPipeline.from_pretrained('black-forest-labs/FLUX.2-klein-4B')
print('모델 다운로드 완료')
"
```

### 4.2 수동 다운로드 (오프라인 환경)

```bash
# Hugging Face CLI로 다운로드
huggingface-cli download black-forest-labs/FLUX.2-klein-4B \
    --local-dir /opt/models/flux2-klein-4b

# FP8 양자화 버전 (VRAM 절약, ~55% 감소)
huggingface-cli download black-forest-labs/FLUX.2-klein-4B-fp8 \
    --local-dir /opt/models/flux2-klein-4b-fp8
```

### 4.3 공식 CLI 방식

```bash
git clone https://github.com/black-forest-labs/flux2.git
cd flux2

python3.12 -m venv .venv
source .venv/bin/activate
pip install -e . --extra-index-url https://download.pytorch.org/whl/cu121 --no-cache-dir

# 환경변수 설정 (선택, 미설정 시 자동 다운로드)
export KLEIN_4B_MODEL_PATH="/opt/models/flux2-klein-4b"
export AE_MODEL_PATH="/opt/models/flux2-ae"
```

---

## 5. 추론 코드

### 5.1 텍스트 → 이미지 (T2I)

```python
import torch
from diffusers import Flux2KleinPipeline

device = "cuda"
dtype = torch.bfloat16

pipe = Flux2KleinPipeline.from_pretrained(
    "black-forest-labs/FLUX.2-klein-4B",
    torch_dtype=dtype
).to(device)

# 프롬프트 작성 팁: 키워드 나열보다 서술형이 효과적
prompt = (
    "A weathered fisherman mends his nets on a wooden dock at golden hour. "
    "His calloused hands work methodically while seagulls circle overhead. "
    "Warm light catches the spray of the nearby waves. Photorealistic, 8K detail."
)

image = pipe(
    prompt=prompt,
    height=1024,
    width=1024,
    guidance_scale=1.0,       # Distilled 모델은 1.0 고정
    num_inference_steps=4,    # Distilled 모델은 4스텝 고정
    generator=torch.Generator(device=device).manual_seed(42)
).images[0]

image.save("output_t2i.png")
```

### 5.2 이미지 → 이미지 (I2I) — "realistic" 변환

```python
import torch
from diffusers import Flux2KleinPipeline
from diffusers.utils import load_image

device = "cuda"
dtype = torch.bfloat16

pipe = Flux2KleinPipeline.from_pretrained(
    "black-forest-labs/FLUX.2-klein-4B",
    torch_dtype=dtype
).to(device)

# 입력 이미지 로드
input_image = load_image("input.png").resize((1024, 1024))

# 시스템 프롬프트 (realistic 변환)
prompt = (
    "Photorealistic rendering with natural lighting, detailed textures, "
    "accurate shadows and reflections. 8K resolution, cinematic quality."
)

image = pipe(
    prompt=prompt,
    image=input_image,
    strength=0.6,             # 0.2=원본 유지 / 0.8=크게 변환
    guidance_scale=1.0,
    num_inference_steps=4,
    generator=torch.Generator(device=device).manual_seed(42)
).images[0]

image.save("output_i2i_realistic.png")
```

### 5.3 멀티 레퍼런스 편집

```python
from diffusers.utils import load_image

img_character = load_image("character.png").resize((1024, 1024))
img_style = load_image("style_ref.png").resize((1024, 1024))

prompt = "The character from image 1 rendered in the artistic style of image 2"

image = pipe(
    prompt=prompt,
    image=[img_character, img_style],   # 리스트로 전달
    strength=0.8,
    guidance_scale=1.0,
    num_inference_steps=4,
).images[0]

image.save("output_multiref.png")
```

---

## 6. 성능 최적화

### 6.1 torch.compile (첫 실행만 느림, 이후 2배 빠름)

```python
pipe.transformer = torch.compile(
    pipe.transformer,
    mode="max-autotune",
    fullgraph=True
)

pipe.vae.decode = torch.compile(
    pipe.vae.decode,
    mode="max-autotune",
    fullgraph=True
)
```

### 6.2 Fused QKV Projections

```python
pipe.fuse_qkv_projections()
```

### 6.3 메모리 최적화 (VRAM 부족 시)

```python
# CPU 오프로딩 (VRAM ~6GB까지 절약)
pipe.enable_model_cpu_offload()

# VAE 타일링 (고해상도 생성 시)
pipe.vae.enable_tiling()

# Channels-last 메모리 포맷
pipe.vae.to(memory_format=torch.channels_last)
```

### 6.4 FP8 양자화 모델 사용

```python
pipe = Flux2KleinPipeline.from_pretrained(
    "black-forest-labs/FLUX.2-klein-4B-fp8",
    torch_dtype=torch.bfloat16
).to("cuda")
# VRAM ~55% 감소, 추론 속도 최대 2.7x 향상 (Ampere+ GPU)
```

---

## 7. FastAPI 서버 구축

### 7.1 서버 코드 (`server.py`)

```python
import io
import base64
import torch
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response
from PIL import Image
from diffusers import Flux2KleinPipeline

# ─── 모델 로드 ───
app = FastAPI(title="FLUX.2 Klein API")
pipe = None

@app.on_event("startup")
async def load_model():
    global pipe
    pipe = Flux2KleinPipeline.from_pretrained(
        "black-forest-labs/FLUX.2-klein-4B",
        torch_dtype=torch.bfloat16
    ).to("cuda")
    # 최적화
    pipe.fuse_qkv_projections()
    print("✅ 모델 로드 완료")


# ─── T2I 엔드포인트 ───
@app.post("/generate")
async def generate_image(
    prompt: str = Form(...),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
):
    generator = None
    if seed >= 0:
        generator = torch.Generator(device="cuda").manual_seed(seed)

    image = pipe(
        prompt=prompt,
        height=height,
        width=width,
        guidance_scale=1.0,
        num_inference_steps=4,
        generator=generator,
    ).images[0]

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


# ─── I2I 엔드포인트 (realistic 변환) ───
@app.post("/edit")
async def edit_image(
    prompt: str = Form("Photorealistic, natural lighting, 8K detail"),
    strength: float = Form(0.6),
    image_file: UploadFile = File(...),
    seed: int = Form(-1),
):
    input_bytes = await image_file.read()
    input_image = Image.open(io.BytesIO(input_bytes)).convert("RGB")
    input_image = input_image.resize((1024, 1024))

    generator = None
    if seed >= 0:
        generator = torch.Generator(device="cuda").manual_seed(seed)

    output = pipe(
        prompt=prompt,
        image=input_image,
        strength=strength,
        guidance_scale=1.0,
        num_inference_steps=4,
        generator=generator,
    ).images[0]

    buf = io.BytesIO()
    output.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


# ─── 헬스체크 ───
@app.get("/health")
async def health():
    return {"status": "ok", "model": "FLUX.2-klein-4B", "device": "cuda"}
```

### 7.2 서버 실행

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1
```

### 7.3 API 테스트

```bash
# T2I 테스트
curl -X POST http://localhost:8000/generate \
  -F "prompt=A futuristic cyberpunk city at night, neon lights, 8K" \
  -F "width=1024" \
  -F "height=1024" \
  -F "seed=42" \
  --output result_t2i.png

# I2I 테스트 (이미지 + realistic 프롬프트 → 이미지)
curl -X POST http://localhost:8000/edit \
  -F "prompt=Photorealistic rendering, cinematic lighting, detailed textures" \
  -F "strength=0.6" \
  -F "image_file=@input.png" \
  -F "seed=42" \
  --output result_i2i.png
```

---

## 8. Docker 배포

### 8.1 Dockerfile

```dockerfile
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# 시스템 패키지
RUN apt-get update && apt-get install -y \
    python3.12 python3.12-venv python3-pip git wget \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리
WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN python3.12 -m pip install --no-cache-dir -r requirements.txt

# 앱 복사
COPY server.py .

# 모델 사전 다운로드 (빌드 시 캐시)
RUN python3.12 -c "
from diffusers import Flux2KleinPipeline
Flux2KleinPipeline.from_pretrained('black-forest-labs/FLUX.2-klein-4B')
print('모델 캐시 완료')
"

EXPOSE 8000
CMD ["python3.12", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 requirements.txt

```
torch>=2.2.0
torchvision
diffusers @ git+https://github.com/huggingface/diffusers.git
transformers
accelerate
sentencepiece
protobuf
fastapi
uvicorn
python-multipart
Pillow
```

### 8.3 docker-compose.yml

```yaml
services:
  flux2-klein:
    build: .
    ports:
      - "8000:8000"
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - model-cache:/root/.cache/huggingface
    environment:
      - NVIDIA_VISIBLE_DEVICES=all

volumes:
  model-cache:
```

### 8.4 빌드 및 실행

```bash
docker compose build
docker compose up -d

# 로그 확인
docker compose logs -f flux2-klein
```

---

## 9. A100 MIG 3g.40GB 환경 주의사항

### 9.1 MIG 디바이스 확인

```bash
nvidia-smi -L
# 출력 예: GPU 0: NVIDIA A100 ... (MIG 3g.40gb Device 0)

# MIG UUID 확인
nvidia-smi -i 0 --query-gpu=gpu_uuid --format=csv,noheader
```

### 9.2 성능 예측

```
┌──────────────────────────────────────────────────────┐
│           A100 MIG 3g.40GB 성능 예측                  │
├───────────────────┬──────────────────────────────────┤
│ 항목              │ 예상치                            │
├───────────────────┼──────────────────────────────────┤
│ SM 유닛           │ 풀 A100의 ~43% (42/108 SMs)      │
│ VRAM              │ 40GB (4B 모델에 충분)             │
│ 메모리 대역폭     │ ~1TB/s (풀 A100의 ~60%)          │
│ T2I 1024×1024    │ ~1.5–2.5초 (4스텝)               │
│ I2I 1024×1024    │ ~1.5–2.5초 (4스텝)               │
│ torch.compile 후  │ ~1.0–1.5초                       │
│ 배치 2장 동시     │ ~2.5–3.5초                       │
└───────────────────┴──────────────────────────────────┘
```

### 9.3 권장 설정

```python
# A100 MIG에 최적화된 설정
pipe = Flux2KleinPipeline.from_pretrained(
    "black-forest-labs/FLUX.2-klein-4B",
    torch_dtype=torch.bfloat16        # A100은 bfloat16 네이티브 지원
).to("cuda")

pipe.fuse_qkv_projections()           # 필수 최적화

# torch.compile은 A100 MIG에서도 유효
pipe.transformer = torch.compile(
    pipe.transformer,
    mode="max-autotune",
    fullgraph=True
)
```

---

## 10. 프롬프트 가이드

FLUX.2 [klein]은 프롬프트 업샘플링을 지원하지 않는다. 서술형 프롬프트가 키워드 나열보다 효과적이다.

### 10.1 좋은 프롬프트 예시

```
# ✅ 서술형 (효과적)
"A weathered fisherman mends his nets on a wooden dock at golden hour.
His calloused hands work methodically while seagulls circle overhead.
Warm light catches the spray of the nearby waves."

# ❌ 키워드 나열 (비효과적)
"fisherman, dock, golden hour, nets, seagulls, realistic, 8K, HDR"
```

### 10.2 I2I "realistic" 변환용 프롬프트 템플릿

```
# 포토리얼리스틱 변환
"Photorealistic photograph with natural studio lighting,
accurate skin textures, detailed material surfaces,
proper depth of field. Professional photography, 8K resolution."

# 시네마틱 변환
"Cinematic still frame, anamorphic lens, shallow depth of field,
volumetric lighting, color graded with teal and orange tones.
Shot on ARRI ALEXA, film grain."

# 제품 사진 변환
"Professional product photography on clean white background,
soft diffused lighting, accurate reflections and shadows,
commercial catalog quality, high detail."
```

---

## 11. 트러블슈팅

### CUDA Out of Memory

```python
# 해결 1: CPU 오프로딩
pipe.enable_model_cpu_offload()

# 해결 2: FP8 양자화 모델 사용
pipe = Flux2KleinPipeline.from_pretrained(
    "black-forest-labs/FLUX.2-klein-4B-fp8", torch_dtype=torch.bfloat16
).to("cuda")

# 해결 3: 해상도 낮추기 (512×512부터 시작)
image = pipe(prompt=prompt, height=512, width=512, ...).images[0]
```

### MIG 환경에서 torch.compile 오류

```bash
# CUDA_VISIBLE_DEVICES를 MIG 디바이스로 명시
export CUDA_VISIBLE_DEVICES=MIG-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 또는 MIG 인덱스 사용
export CUDA_VISIBLE_DEVICES=0
export CUDA_MPS_PIPE_DIRECTORY=/tmp/nvidia-mps
```

### Diffusers 버전 관련 오류

```bash
# Flux2KleinPipeline이 없으면 최신 diffusers 설치
pip install git+https://github.com/huggingface/diffusers.git

# 특정 커밋 고정 (재현성)
pip install git+https://github.com/huggingface/diffusers.git@main
```

### 해상도 관련

```
- width, height는 반드시 16의 배수
- 최대 4MP (예: 2048×2048, 1536×2560 등)
- A100 MIG에서 안정적 운영: 1024×1024 권장
```

---

## 12. 참고 자료

| 리소스 | URL |
|--------|-----|
| 공식 GitHub | https://github.com/black-forest-labs/flux2 |
| HuggingFace 4B | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B |
| HuggingFace 9B | https://huggingface.co/black-forest-labs/FLUX.2-klein-9B |
| BFL 블로그 | https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence |
| BFL 공식 가이드 | https://help.bfl.ai/articles/8642316687-flux-2-klein-fast-generation-guide |
| Diffusers 문서 | https://huggingface.co/docs/diffusers |
| ComfyUI 가이드 | https://docs.comfy.org/tutorials/flux/flux-2-klein |
| DeepWiki 문서 | https://deepwiki.com/black-forest-labs/flux2 |