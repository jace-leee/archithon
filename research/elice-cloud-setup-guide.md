# Elice Cloud GPU 환경 구축 가이드 (Archithon)

**작성일:** 2026-03-12
**환경:** Elice Cloud On-Demand 런박스 (SSH-Only 또는 VS Code CUDA)
**대상 GPU:** NVIDIA A100 40GB
**예상 비용:** ~1,380원/시간, 48시간 기준 ~66,240원

---

## 환경 선택 근거

Elice Cloud는 서비스 티어별로 Docker 지원이 다릅니다:

| 티어 | Docker 사용 | 사전 구성 환경 | 비고 |
|---|---|---|---|
| **On-Demand 런박스** | X (플랫폼 내부만) | O (PyTorch, CUDA 등) | **채택** |
| ECI VM | O (root 접근) | X (빈 OS) | VM 셋업 오버헤드 |
| Bare Metal | O | X (빈 OS) | 과도한 스펙 |
| Elice Project | X | O (관리형) | GPU 선택 제한 |

**On-Demand 런박스를 선택하는 이유:**
- PyTorch + CUDA가 **미리 설치**되어 있어 환경 셋업 시간 최소화
- Docker는 못 쓰지만, 해커톤에서는 추가 의존성만 `pip install` / `apt install`로 충분
- 48시간 제약에서 VM 셋업 + Docker 빌드 시간을 아낄 수 있음

---

## 1단계: 런박스 인스턴스 생성

1. [Elice Cloud](https://elice.io/en/products/cloud/info) 접속 → 회원가입/로그인
2. **Elice Cloud On-Demand** → **런박스** 선택
3. 런타임 환경 선택:
   - **VS Code (CUDA)** — GUI 개발이 필요한 경우 (웹 브라우저에서 VS Code 사용)
   - **SSH-Only** — 터미널만 사용하는 경우 (권장: 더 가볍고 리소스 낭비 적음)
4. GPU 사양: **NVIDIA A100 40GB** 선택 (~1,380원/시간)
   - 모델 순차 실행 구조이므로 40GB로 충분
   - 피크 VRAM ~16GB (ControlNet + SD 1.5 기준)
5. 인스턴스 생성 완료 후 SSH 접속 정보 확인

> 참고: 중소기업이면 **클라우드 바우처 지원사업** 연계로 정부 보조금 활용 가능

---

## 2단계: 접속 및 사전 구성 환경 확인

```bash
# SSH 접속 (런박스에서 제공하는 접속 정보 사용)
ssh -i your_key.pem user@<elice-instance-ip>
# 또는 VS Code (CUDA) 선택 시 웹 브라우저에서 바로 접속

# SSH 끊김 방지 — 이후 모든 작업은 tmux 안에서 진행
tmux new -s archithon
```

### 사전 구성 환경 확인

런박스(VS Code CUDA / SSH-Only)는 PyTorch + CUDA가 미리 설치되어 있을 가능성이 높지만,
**어떤 도구가 있는지 먼저 확인**합니다:

```bash
# ── GPU 확인 ──
nvidia-smi
# → A100 40GB가 보여야 함

# ── 기본 도구 확인 ──
python3 --version        # 3.10+ 필요
pip --version            # pip 필요
git --version            # git 필요
node --version           # (선택) 런박스에서 프론트엔드도 돌릴 경우
npm --version            # (선택)
```

### 없는 도구가 있으면 설치

```bash
# sudo 가능한 경우
sudo apt-get update

# Python 3 없으면
sudo apt-get install -y python3 python3-venv python3-pip

# Git 없으면
sudo apt-get install -y git

# Node.js 없으면 (런박스에서 프론트엔드도 실행할 경우만)
sudo apt-get install -y nodejs npm
# 또는 nvm으로 설치:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22

# tmux 없으면
sudo apt-get install -y tmux
```

> **sudo가 안 되는 경우:** 런박스는 컨테이너 환경이라 `sudo`가 제한될 수 있습니다.
> Python/Git은 거의 확실히 사전 설치되어 있지만, 만약 없고 sudo도 없다면
> Elice 지원팀에 문의하거나 conda로 우회 설치합니다:
> ```bash
> # conda로 Python/Git 설치 (conda가 있는 경우)
> conda install -c conda-forge python=3.11 git nodejs
> ```

### PyTorch + CUDA 확인

```bash
# 사전 설치된 PyTorch 확인
python3 -c "import torch; print(torch.__version__)"
python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"

# CUDA 툴킷 버전 확인 (PyTorch wheel 선택에 필요)
nvcc --version
# 또는 nvidia-smi 우측 상단의 CUDA Version 확인
```

> **중요:** `nvidia-smi`에 표시되는 CUDA Version은 드라이버가 지원하는 최대 버전이고,
> 실제 설치된 CUDA 툴킷 버전은 `nvcc --version`으로 확인해야 합니다.
>
> PyTorch가 사전 설치되어 있지 않으면 3단계에서 직접 설치합니다.

---

## 3단계: 추가 의존성 설치

런박스에 PyTorch가 이미 있으므로, **나머지 패키지만 추가 설치**합니다.

```bash
# 프로젝트 클론
git clone <your-archithon-repo> ~/archithon
cd ~/archithon

# 가상환경 생성 (런박스 기본 환경과 격리)
python3 -m venv .venv --system-site-packages
# --system-site-packages: 런박스에 미리 깔린 PyTorch를 상속받음
source .venv/bin/activate

# PyTorch가 상속되었는지 확인
python -c "import torch; print(torch.cuda.is_available())"
# → True여야 함. False면 아래 수동 설치 필요:
# pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

### 3-1: Python 패키지 설치

```bash
# FastAPI + 서버
pip install fastapi uvicorn[standard] python-multipart

# 3D / Computer Vision
pip install pycolmap opencv-python-headless numpy scipy trimesh open3d

# AI 모델
pip install segment-anything-2 diffusers transformers accelerate

# 유틸리티
pip install pillow anthropic openai
```

### 3-2: COLMAP CLI 설치

```bash
# apt로 설치 시도 (런박스에 sudo 권한이 있는 경우)
sudo apt-get update && sudo apt-get install -y colmap

# sudo 권한이 없거나 apt 버전이 오래된 경우 → conda로 설치
# (런박스에 conda가 있으면)
conda install -c conda-forge colmap

# 검증
colmap -h
```

> **sudo가 안 되는 경우:** 런박스는 컨테이너 환경이라 `sudo apt-get`이 제한될 수 있습니다.
> 이 경우 `conda install`을 시도하거나, PyCOLMAP만으로 진행합니다.
> PyCOLMAP은 `pip install pycolmap`으로 이미 설치되어 있고, Python API로 COLMAP 파이프라인을 실행할 수 있습니다.

### 3-3: 설치 검증

```bash
# 전체 의존성 확인 스크립트
python -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA: {torch.cuda.is_available()} ({torch.cuda.get_device_name(0)})')

import pycolmap
print(f'PyCOLMAP: {pycolmap.__version__}')

import cv2
print(f'OpenCV: {cv2.__version__}')

import diffusers
print(f'Diffusers: {diffusers.__version__}')

import open3d
print(f'Open3D: {open3d.__version__}')

print('All dependencies OK')
"
```

---

## 4단계: ShapeR 설치 + 추론 테스트 (Go/No-Go 게이트)

```bash
# ShapeR 클론 및 설치
git clone https://github.com/mcc-cgp/Shaper.git ~/Shaper
cd ~/Shaper
pip install -r requirements.txt

# 테스트 추론 (가구 사진 1장으로)
python infer_shape.py --image test_furniture.jpg --output output.glb

# 결과 검증
python -c "import trimesh; m = trimesh.load('output.glb'); print(m.bounds)"
```

### 분기 판단

| 결과 | 조치 |
|---|---|
| 이미지만으로 동작 | 현행 계획 유지 (Stage 1, 2 독립) |
| SLAM 점군 필수 | TripoSR를 주 경로로 격상 |
| 추론 실패 / OOM | TripoSR로 즉시 전환 |

---

## 5단계: 백엔드 서비스 실행 + 외부 노출

```bash
# tmux 세션에서 백엔드 실행 (이미 tmux 안이면 새 윈도우 생성)
# tmux 안이 아니면: tmux new -s archithon
cd ~/archithon/backend
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Ctrl+B, D 로 세션 분리 (백그라운드 유지)
```

### 프론트엔드 연결 방법

**방법 1: SSH 포트 포워딩 (권장)**

로컬 머신에서 실행:

```bash
ssh -L 8000:localhost:8000 -i your_key.pem user@<elice-instance-ip>
```

프론트엔드의 `API_BASE`를 `http://localhost:8000/api`로 유지.

**방법 2: Elice 런박스 포트 노출**

런박스가 특정 포트를 외부에 노출하는 기능을 제공하면 (대시보드에서 확인), 프론트엔드의 `API_BASE`를 수정:

```typescript
// frontend/src/App.tsx
const API_BASE = 'http://<elice-exposed-url>/api';
```

**방법 3: VS Code (CUDA) 런타임에서 프론트엔드도 실행**

VS Code (CUDA) 런타임을 선택한 경우, 런박스 안에서 프론트엔드도 함께 실행 가능:

```bash
# 런박스 안에서 (Node.js가 설치되어 있다면)
cd ~/archithon/frontend
npm install
npm run dev -- --host 0.0.0.0
# → 런박스의 포트 노출 기능으로 5173 포트 접근
```

---

## 6단계: 프론트엔드 실행 (로컬 — 방법 1 사용 시)

```bash
# 로컬 머신에서
cd archithon/frontend
npm install
npm run dev
# → http://localhost:5173 접속
# → SSH 터널로 localhost:8000이 Elice GPU 백엔드에 연결됨
```

---

## 검증 체크리스트

- [ ] `nvidia-smi`로 A100 40GB GPU 확인
- [ ] 사전 설치된 PyTorch + CUDA 동작 확인
- [ ] `python -c "import pycolmap"` 성공
- [ ] COLMAP CLI 또는 PyCOLMAP API 사용 가능
- [ ] ShapeR `python infer_shape.py --help` 성공 (또는 TripoSR 폴백 확인)
- [ ] 로컬 프론트엔드 → Elice 백엔드 `/health` API 호출 성공

---

## A100 40GB 메모리 관리

### 모델별 VRAM 사용량 (fp16 기준)

| 모델 | 예상 VRAM | 40GB 여유 |
|---|---|---|
| COLMAP (GPU feature extraction) | ~2-4 GB | 여유 |
| SAM2 (ViT-H) | ~2.5 GB | 여유 |
| ShapeR (speed 프리셋) | ~8-16 GB | 가능 |
| TripoSR (폴백) | ~6-8 GB | 여유 |
| ControlNet + SD 1.5 (fp16) | ~6-8 GB | 여유 |
| ControlNet + SDXL (fp16) | ~12-15 GB | 가능하나 타이트 |

### 필수 규칙

1. **모델 순차 실행 필수** — 두 모델을 동시에 올리면 OOM 발생. `gpu.py`의 `model_context()` 반드시 사용
2. **SD 1.5 기반 ControlNet 권장** — SDXL은 ~15GB로 타이트함. SD 1.5 + ControlNet이면 ~7GB로 여유
3. **ShapeR OOM 시** → TripoSR로 전환 (6-8GB로 안전, 코드에 폴백 구현됨)
4. **batch size 1 고정** — 가구 3D 생성이나 렌더링 모두 단건 처리

### GPU 메모리 관리 코드

```python
# backend/app/utils/gpu.py의 model_context() 사용 예시
from app.utils.gpu import model_context

with model_context("colmap"):
    # COLMAP 실행 — 완료 후 자동으로 GPU 메모리 해제
    run_colmap_pipeline(...)

with model_context("shaper"):
    # ShapeR 추론 — 완료 후 자동으로 GPU 메모리 해제
    reconstruct_with_shaper(...)

with model_context("controlnet"):
    # ControlNet 렌더링 — 완료 후 자동으로 GPU 메모리 해제
    render_scene(...)
```

---

## 런박스 환경 제약사항 및 대응

| 제약 | 영향 | 대응 |
|---|---|---|
| Docker 사용 불가 | 커스텀 컨테이너 실행 불가 | `pip install` + `apt install`(또는 conda)로 직접 설치 |
| sudo 제한 가능 | `apt-get install colmap` 실패 가능 | PyCOLMAP Python API 사용 또는 conda 설치 |
| 인스턴스 재시작 시 `/tmp/` 소실 | 데모 캐시 데이터 소실 | 중요 결과물은 홈 디렉토리(`~/`)에 저장 |
| 사전 설치 패키지 버전 고정 | PyTorch 버전이 최신이 아닐 수 있음 | `--system-site-packages`로 상속 후 호환성 확인 |
| 포트 노출 정책 미확인 | 외부에서 백엔드 접근 불가능할 수 있음 | SSH 포트 포워딩으로 우회 |

---

## 비용 비교

| 항목 | A100 40GB | A100 80GB | AWS p4d (A100 40GB) |
|---|---|---|---|
| 시간당 | 1,380원 | 2,000원 | ~6,000원+ |
| 48시간 | **66,240원** | 96,000원 | ~288,000원+ |
| 글로벌 대비 | **77%+ 저렴** | 67% 저렴 | 기준가 |

---

## 트러블슈팅

### COLMAP CLI 설치 실패 (sudo 없음)

```bash
# 방법 1: conda 사용
conda install -c conda-forge colmap

# 방법 2: PyCOLMAP만 사용 (CLI 없이 Python API로 실행)
python -c "
import pycolmap
# PyCOLMAP으로 COLMAP 파이프라인 실행 가능
# colmap CLI 없이도 동작함
print('PyCOLMAP available:', pycolmap.__version__)
"

# 방법 3: 소스 빌드 (sudo 가능한 경우)
sudo apt-get install -y cmake libboost-all-dev libeigen3-dev \
  libflann-dev libfreeimage-dev libgoogle-glog-dev libgtest-dev \
  libsqlite3-dev libglew-dev qtbase5-dev libqt5opengl5-dev libcgal-dev
git clone https://github.com/colmap/colmap.git
cd colmap && mkdir build && cd build
cmake .. -DCUDA_ENABLED=ON
make -j$(nproc) && sudo make install
```

### PyTorch CUDA 버전 불일치

```bash
# 런박스 사전 설치 CUDA 버전 확인
nvcc --version
nvidia-smi  # 우측 상단 CUDA Version

# 맞는 PyTorch wheel 재설치
# CUDA 12.1인 경우:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
# CUDA 12.4인 경우:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

### pip install 충돌 (사전 설치 패키지와 버전 충돌)

```bash
# 가상환경을 시스템 상속 없이 깨끗하게 재생성
deactivate
rm -rf .venv
python3 -m venv .venv  # --system-site-packages 빼고 생성
source .venv/bin/activate

# PyTorch부터 다시 설치
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
# 이후 나머지 패키지 설치
```

### GPU OOM 발생

```bash
# 현재 GPU 메모리 확인
python -c "from app.utils.gpu import get_gpu_memory; print(get_gpu_memory())"

# 수동 메모리 해제
python -c "from app.utils.gpu import clear_gpu_memory; clear_gpu_memory()"

# 좀비 프로세스 확인 및 정리
nvidia-smi  # Processes 섹션에서 불필요한 PID 확인
kill -9 <PID>
```

---

## 데모 준비 팁

1. **사전 실행 결과 캐싱**: 데모 전에 테스트 비디오로 전체 파이프라인을 한 번 돌려서 `~/archithon/demo-cache/`에 결과를 저장해두면 라이브 데모 시 즉시 시연 가능 (`/tmp/`는 재시작 시 소실되므로 홈 디렉토리 사용)
2. **tmux 세션 분리**: `tmux new -s archithon`에서 백엔드를 실행하면 SSH 끊겨도 서비스 유지. `tmux attach -t archithon`으로 재접속
3. **비용 절감**: 코딩은 로컬에서 하고, GPU 테스트할 때만 런박스 인스턴스를 켜서 사용. 사용하지 않을 때 반드시 인스턴스 중지
4. **환경 백업**: 의존성 설치 완료 후 `pip freeze > requirements-frozen.txt`로 스냅샷 저장. 인스턴스 재생성 시 `pip install -r requirements-frozen.txt`로 빠르게 복원
