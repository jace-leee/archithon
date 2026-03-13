# Archithon - AI 이사 도우미 구현 계획

**작성일:** 2026-03-11
**최종 수정:** 2026-03-11 (RALPLAN-DR Iteration 2 - Architect 리뷰 반영)
**모드:** RALPLAN-DR Consensus (Deliberate - 해커톤 고위험)
**범위:** 1인 48시간 해커톤, 풀스택 AI 파이프라인 데모

---

## RALPLAN-DR 요약

### 원칙 (Principles)

1. **데모 퍼스트**: 완벽한 구현보다 end-to-end 흐름이 동작하는 것이 최우선. 각 스테이지가 "동작하는 데모"로 연결되어야 한다.
2. **기존 도구 최대 활용**: 커스텀 코드 최소화. COLMAP CLI, ShapeR infer_shape.py, 사전학습 모델을 그대로 사용.
3. **점진적 통합**: 각 스테이지를 독립 모듈로 먼저 동작시킨 후 연결. 한 스테이지 실패가 전체를 블로킹하지 않도록 폴백 준비.
4. **처리 시간 허용, 품질 우선**: 사용자가 기다리는 것은 OK. 결과물의 시각적 품질이 데모 임팩트를 결정.
5. **GPU 자원 효율적 분배**: A100 단일 GPU에서 COLMAP, ShapeR, ControlNet이 순차적으로 실행되므로 메모리 관리 필수.

### 의사결정 동인 (Decision Drivers)

1. **시간 제약 (48시간)**: 모든 아키텍처 결정의 최우선 기준. 학습 곡선이 낮고 즉시 동작하는 솔루션 선택.
2. **라이브 데모 요구사항**: 사전 준비 데이터 불가 - 실시간 파이프라인이 실제로 동작해야 함.
3. **시각적 품질**: 해커톤 심사에서 최종 렌더링 품질이 차별화 요소.

### 실행 가능 옵션 (Viable Options)

#### 옵션 A: COLMAP + ShapeR 풀 파이프라인 (권장)

| 항목 | 내용 |
|---|---|
| 설명 | COLMAP으로 floor plan 추출, ShapeR로 가구 3D 생성, ControlNet으로 렌더링 |
| 장점 | 스펙 완전 충족, 기술적 인상적, 모든 AI가 실제 동작 |
| 단점 | COLMAP 처리 10분+, ShapeR 가구당 수분, 총 처리시간 길음 |
| 위험 | COLMAP->floor plan 변환이 가장 불확실한 구간 |
| 완화 | floor plan 변환에 OpenCV 후처리 파이프라인 + LLM 보조 사용 |

#### 옵션 B: DUSt3R/MASt3R 대체 + ShapeR 경량 파이프라인

| 항목 | 내용 |
|---|---|
| 설명 | COLMAP 대신 DUSt3R/MASt3R로 빠른 3D 재구성, 나머지는 동일 |
| 장점 | COLMAP보다 빠를 수 있음, 학습 기반이라 더 깔끔한 결과 가능 |
| 단점 | DUSt3R 셋업 복잡도 높음, floor plan 추출 파이프라인 검증 안됨 |
| 위험 | 48시간 내 DUSt3R 셋업+디버깅 시간 부족 가능성 |
| 완화 | COLMAP 폴백 준비 |

#### 옵션 C: 단순화 파이프라인 (Floor plan 수동 입력)

| 항목 | 내용 |
|---|---|
| 설명 | Stage 1을 간소화 - 사용자가 floor plan 이미지 직접 업로드하는 옵션도 제공 |
| 장점 | 가장 안전, Stage 2-5에 시간 집중 가능 |
| 단점 | "비디오 -> floor plan" 자동 파이프라인이 스펙의 핵심 차별화 |
| **판정** | **폴백으로만 유지** - 주 경로는 아님 |

**선택: 옵션 A (COLMAP 풀 파이프라인) + 옵션 C를 비상 폴백으로**

**옵션 B 무효화 근거:** DUSt3R/MASt3R는 COLMAP 대비 셋업 복잡도가 높고, floor plan 추출까지의 파이프라인이 검증되지 않음. 48시간 제약에서 검증된 COLMAP CLI + PyCOLMAP이 더 안전한 선택.

---

## Pre-Mortem (Deliberate 모드)

### 실패 시나리오 1: COLMAP -> Floor Plan 변환 실패
- **증상:** COLMAP 점군에서 바닥 평면을 분리하지 못하거나, 벽 경계가 불명확
- **발생 확률:** 높음 (가장 큰 기술 위험)
- **대응:** 이중 경로(Dual-Track) 전략으로 완화. Track A(COLMAP)와 Track B(LLM 비전) 병행 실행. 6시간 시점 Go/No-Go 게이트에서 COLMAP 경로의 성공 여부 판정. 최악의 경우 사용자가 floor plan 이미지를 직접 업로드하는 UI 제공 (옵션 C 폴백).

### 실패 시나리오 2: ShapeR 추론 시간 초과 / 메모리 부족
- **증상:** A100 80GB에서도 큰 가구 메쉬 생성 시 OOM 또는 10분+ 소요
- **발생 확률:** 중간
- **대응:** ShapeR speed 프리셋(10 스텝) 사용, 가구 수를 3-5개로 제한, 비동기 처리 + 프로그레스 바 UI. Phase 0에서 ShapeR 실제 추론 테스트로 SLAM 점군 의존성 여부 조기 확인. 필요 시 TripoSR 폴백 즉시 격상.

### 실패 시나리오 3: ControlNet 렌더링 품질 저하
- **증상:** 3D 뷰 -> 렌더링 결과가 부자연스럽거나 가구가 왜곡됨
- **발생 확률:** 중간
- **대응:** ControlNet depth + canny 이중 컨디셔닝, 프롬프트 엔지니어링 최적화, 여러 시드로 생성 후 최선 선택 UI.

---

## 좌표계 통합 스펙

> **[Architect 필수 변경 #3]** 모든 스테이지 간 좌표/단위를 명시적으로 정의하여 통합 시 혼란 방지.

| 항목 | 스펙 |
|---|---|
| **Floor plan 좌표** | 픽셀 좌표계 (원점: 이미지 좌상단). 메타데이터에 `pixels_per_meter` 스케일 팩터 포함. |
| **Floor plan 원점** | 이미지 좌상단 (0,0). Three.js 변환 시 중심 정렬. |
| **가구 dimensions 단위** | 미터 (m). `{width, height, depth}` 모두 미터 단위. |
| **Three.js 씬 스케일** | **1 unit = 1 meter**. 모든 3D 오브젝트는 미터 스케일로 통일. |
| **Floor plan -> Three.js 변환** | `world_x = (pixel_x - center_x) / pixels_per_meter`, `world_z = (pixel_y - center_y) / pixels_per_meter` |
| **가구 배치 좌표** | Three.js 월드 좌표 (미터). `{x, y, z}` 여기서 y는 높이(바닥=0). |

### Stage 3 API 가구 크기 전달 경로
```
Stage 2 출력: furniture[].dimensions = {width: m, height: m, depth: m}
    ↓
Stage 3 입력: POST /api/placement/auto
    Input.furniture_items = [{id, dimensions: {w,h,d}, type}]  ← dimensions 필수 포함
    ↓
Stage 3 내부: 배치 알고리즘이 dimensions으로 바운딩 박스 생성, 충돌 검사
    ↓
Stage 3 출력: placements[].furniture_id + position + rotation (Three.js 좌표)
    ↓
Three.js: 가구 .glb 로드 → dimensions 기반 스케일 조정 → position/rotation 적용
```

---

## 파일 저장소 관리 전략

> **[Architect 추가 권장]** job_id 기반 격리된 파일 구조로 동시 처리 및 정리 용이하게.

```
/tmp/archithon/{job_id}/
├── frames/              # ffmpeg 추출 프레임
├── colmap/              # COLMAP 작업 디렉토리
│   ├── sparse/          # 희소 재구성 결과
│   └── dense/           # 밀집 재구성 결과 (선택)
├── floorplan/           # floor plan 이미지 + JSON
│   ├── floorplan.png
│   ├── floorplan.svg    # Track B (LLM 비전) 결과
│   └── metadata.json    # walls, rooms, pixels_per_meter
├── furniture/           # 가구별 3D 에셋
│   ├── {furniture_id}/
│   │   ├── input.jpg    # 크롭된 입력 이미지
│   │   ├── mask.png     # SAM 마스크
│   │   ├── model.glb    # ShapeR/TripoSR 출력
│   │   └── meta.json    # dimensions, weight, type
│   └── ...
├── placement/           # 배치 결과
│   └── placement.json
├── render/              # AI 렌더링
│   ├── scene_capture.png
│   ├── depth_map.png
│   └── rendered.png
└── cost/                # 비용 견적
    └── estimate.json
```

- **정리 정책:** 24시간 후 자동 삭제 (cron 또는 백그라운드 태스크)
- **동시 실행:** job_id 격리로 복수 요청 안전 처리
- **백엔드 설정:** `ARCHITHON_STORAGE_ROOT` 환경변수로 루트 경로 지정 (기본값: `/tmp/archithon/`)

---

## 시간 배분 계획 (48시간)

```
[Phase 0] 환경 셋업 + 의존성 검증              : 0h  ~ 6h   (6시간) ← 4h→6h 조정
[Phase 1] 백엔드 코어 파이프라인 (Stage 1-2)   : 6h  ~ 18h  (12시간, Dual-Track)
[Phase 2] 백엔드 AI 기능 (Stage 3, 5)         : 18h ~ 26h  (8시간)
[Phase 3] 프론트엔드 + Three.js (Stage 4)      : 26h ~ 36h  (10시간)
[Phase 4] 통합 + AI 렌더링 (Stage 4 완성)      : 36h ~ 42h  (6시간)
[Phase 5] 폴리싱 + 데모 준비                    : 42h ~ 48h  (6시간)
```

---

## 프로젝트 구조

```
archithon/
├── frontend/                    # React + Vite + Three.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoUpload.tsx       # 비디오 업로드 UI
│   │   │   ├── FloorPlanViewer.tsx   # Floor plan 표시
│   │   │   ├── FurnitureList.tsx     # 3D 가구 에셋 목록
│   │   │   ├── ThreeScene.tsx        # Three.js 3D 뷰어 (핵심)
│   │   │   ├── RenderResult.tsx      # AI 렌더링 결과
│   │   │   └── CostEstimate.tsx      # 이사 비용 견적
│   │   ├── hooks/
│   │   │   └── useApi.ts             # API 호출 훅
│   │   ├── stores/
│   │   │   └── appStore.ts           # Zustand 상태 관리
│   │   ├── App.tsx                   # 메인 앱 (스텝 위저드)
│   │   └── main.tsx
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI 앱
│   │   ├── routers/
│   │   │   ├── floorplan.py          # Stage 1: 비디오 -> floor plan
│   │   │   ├── furniture.py          # Stage 2: 비디오 -> 3D 에셋
│   │   │   ├── placement.py          # Stage 3: AI 자동 배치
│   │   │   ├── render.py             # Stage 4: AI 렌더링
│   │   │   └── cost.py               # Stage 5: 이사 비용
│   │   ├── services/
│   │   │   ├── colmap_service.py     # COLMAP 파이프라인 (Track A)
│   │   │   ├── llm_floorplan.py      # LLM 비전 floor plan (Track B)
│   │   │   ├── floorplan_extract.py  # 점군 -> floor plan 변환
│   │   │   ├── shaper_service.py     # ShapeR 추론
│   │   │   ├── triposr_service.py    # TripoSR 폴백
│   │   │   ├── sam_service.py        # SAM 텍스처 추출
│   │   │   ├── placement_service.py  # 가구 배치 알고리즘
│   │   │   ├── render_service.py     # ControlNet 렌더링
│   │   │   └── cost_service.py       # 비용 계산
│   │   ├── models/
│   │   │   └── schemas.py            # Pydantic 스키마
│   │   └── utils/
│   │       ├── video.py              # 비디오 프레임 추출
│   │       ├── gpu.py                # GPU 메모리 관리
│   │       ├── coordinates.py        # 좌표계 변환 유틸리티
│   │       └── storage.py            # job_id 기반 파일 저장소 관리
│   └── requirements.txt
├── docker-compose.yml                # 로컬 개발용
└── README.md
```

---

## Phase 0: 환경 셋업 + 의존성 검증 (0h ~ 6h)

> **[Architect 변경 반영]** 4h -> 6h로 확대. ShapeR 실제 추론 테스트(Task 0.4) 추가. 의존성 충돌 해결 시간 반영.

### Task 0.1: 프로젝트 스캐폴딩
**수행 내용:**
- `create-vite` + React + TypeScript로 프론트엔드 초기화
- FastAPI + uvicorn 백엔드 초기화
- CORS 설정, 파일 업로드 엔드포인트 뼈대
- job_id 기반 파일 저장소 유틸리티 (`utils/storage.py`) 구현

**수용 기준:**
- [ ] `npm run dev`로 프론트엔드 실행, localhost:5173에서 빈 페이지 확인
- [ ] `uvicorn app.main:app --reload`로 백엔드 실행, /docs에서 Swagger UI 확인
- [ ] 프론트엔드 -> 백엔드 API 호출 성공 (health check)
- [ ] `storage.get_job_dir(job_id)` 호출 시 `/tmp/archithon/{job_id}/` 디렉토리 생성 확인

### Task 0.2: Elice Cloud GPU 환경 설정
**수행 내용:**
- Elice Cloud On-Demand로 A100 80GB 인스턴스 생성
- COLMAP, PyCOLMAP, PyTorch, ShapeR 의존성 설치
- SSH 터널 또는 포트 포워딩으로 백엔드 서비스 노출

**수용 기준:**
- [ ] `nvidia-smi`로 A100 GPU 확인
- [ ] `python -c "import pycolmap; print(pycolmap.__version__)"` 성공
- [ ] ShapeR `python infer_shape.py --help` 성공
- [ ] 외부에서 FastAPI 엔드포인트 접근 가능

### Task 0.3: 핵심 의존성 설치 목록

**백엔드 (Python):**
```
fastapi==0.115.*
uvicorn[standard]
python-multipart          # 파일 업로드
pycolmap                  # COLMAP Python API
opencv-python-headless    # floor plan 추출 후처리
numpy
scipy
trimesh                   # 3D 메쉬 조작
open3d                    # 점군 처리
torch torchvision         # PyTorch (CUDA)
segment-anything-2        # SAM2 텍스처 추출
diffusers                 # ControlNet 렌더링
transformers accelerate
pillow
anthropic                 # Claude API (Track B LLM 비전)
openai                    # GPT-4o 폴백 (Track B)
tsr                       # TripoSR 폴백
```

**프론트엔드 (Node.js):**
```
react react-dom
@react-three/fiber        # React Three.js 바인딩
@react-three/drei         # Three.js 유틸리티
three
zustand                   # 상태 관리
axios                     # API 호출
@radix-ui/react-*         # UI 컴포넌트 (또는 shadcn/ui)
tailwindcss               # 스타일링
```

### Task 0.4: ShapeR 실제 추론 테스트 [신규 - Architect 필수 변경 #2]

> **목적:** ShapeR가 SLAM 점군을 필수 입력으로 요구하는지 조기에 확인. 의존성 구조에 따라 Stage 1-2 설계가 달라짐.

**수행 내용:**
- ShapeR `infer_shape.py`를 **실제 테스트 이미지**(가구 사진 1장)로 1회 추론 실행
- 입력 인자 분석: 이미지만으로 동작하는지, SLAM 점군(point cloud)이 필수인지 확인
- 출력 .glb 파일 검증: Three.js에서 로드 가능한지, 스케일이 합리적인지 확인
- 추론 시간 및 GPU 메모리 사용량 기록

**분기 로직:**
```
ShapeR 테스트 결과
├── 이미지만으로 동작 → 현행 계획 유지 (Stage 1, 2 독립)
├── SLAM 점군 필수 → 두 가지 대응 중 선택:
│   ├── 대응 A: Stage 1 COLMAP 점군을 Stage 2에 전달하도록 의존성 재설계
│   └── 대응 B: TripoSR를 주 경로로 격상 (ShapeR는 보너스)
└── 추론 실패 / OOM → TripoSR를 주 경로로 즉시 전환
```

**수용 기준:**
- [ ] ShapeR `infer_shape.py`가 테스트 이미지로 1회 이상 성공적으로 추론 완료
- [ ] 필수 입력 요구사항 문서화 (이미지만 / 이미지+점군 / 이미지+마스크 등)
- [ ] 출력 .glb 파일이 유효한 3D 메쉬인지 확인 (trimesh 또는 Three.js로 검증)
- [ ] 추론 시간 및 GPU VRAM 사용량 기록 (A100 80GB 기준)
- [ ] 결과에 따른 Stage 1-2 의존성 결정 사항 명문화

---

## Phase 1: 백엔드 코어 파이프라인 - Dual-Track (6h ~ 18h)

> **[Architect 필수 변경 #1]** Phase 1을 이중 경로(Dual-Track)로 재구성. Track A(COLMAP, 인상적 경로)와 Track B(LLM 비전, 보장된 기본 경로)를 병행 실행. 12시간 시점(=Phase 1 종료)에 Go/No-Go 게이트.

### Stage 1 이중 경로 전략 개요

```
                    ┌─── Track A (인상적 경로) ───┐
비디오 업로드 ──→   │  COLMAP → 점군 → Floor Plan  │  ──→ 결과 비교 → 최선 선택
                    │                              │
                    ├─── Track B (보장 경로) ──────┤
                    │  키프레임 10장 → LLM 비전    │
                    │  → Floor Plan SVG (5분 이내) │
                    └──────────────────────────────┘
                              │
                         Go/No-Go 게이트
                         (6h 시점 = 12h 절대시간)
```

**Go/No-Go 게이트 판정 기준 (절대시간 12h = Phase 1 시작 후 6시간):**
- Track A가 테스트 비디오로 floor plan 생성에 성공했는가?
- 결과 품질이 Track B보다 명확히 우수한가?
- 남은 6시간 내 안정화 가능한가?

| 판정 | 조치 |
|---|---|
| Track A 성공 + 품질 우수 | Track A를 주 경로, Track B를 폴백으로 유지 |
| Track A 부분 성공 | Track B를 주 경로, Track A를 보너스 기능으로 |
| Track A 실패 | Track A 중단, Track B로 전환, 절약된 시간을 Stage 2-5에 투입 |

### Task 1.1a: Track A - COLMAP -> Floor Plan (6h ~ 14h) [인상적 경로]

#### API 엔드포인트
```
POST /api/floorplan/upload
  Input: video file (MP4, 30초~2분)
  Output: { job_id: string }

GET /api/floorplan/status/{job_id}
  Output: { status: "processing"|"done"|"error", progress: number, track: "A"|"B" }

GET /api/floorplan/result/{job_id}
  Output: {
    floorplan_image: base64,
    floorplan_svg: string,
    walls: [{x1,y1,x2,y2}],
    rooms: [{polygon, label}],
    metadata: { pixels_per_meter: number, origin: "top-left", unit: "pixel" },
    source_track: "A"|"B"
  }
```

#### 데이터 플로우
```
비디오 파일
  → ffmpeg으로 1fps 프레임 추출 (30초 영상 = ~30프레임)
  → 저장: /tmp/archithon/{job_id}/frames/
  → COLMAP automatic_reconstructor (Sequential Matching)
    → 희소 점군 + 카메라 포즈
    → 저장: /tmp/archithon/{job_id}/colmap/sparse/
  → Dense reconstruction (선택, 시간 허용 시)
  → 점군에서 바닥 평면 추출 (RANSAC plane fitting)
  → 바닥 평면에 점군 프로젝션 → 2D 이미지
  → OpenCV 후처리: 이진화 → 윤곽선 검출 → 벽 선분 추출
  → Floor plan 이미지 + 벽 좌표 JSON + pixels_per_meter 메타데이터
```

#### 핵심 구현: `floorplan_extract.py`
```
1. Open3D로 점군 로드
2. RANSAC으로 바닥 평면 (가장 큰 수평면) 검출
3. 바닥에서 0.5m~2.5m 높이의 점들만 필터링 (벽 영역)
4. 바닥 평면에 프로젝션 → 2D 점 분포
5. cv2.threshold → cv2.findContours → cv2.approxPolyDP
6. 선분 추출 → 벽 좌표 생성
7. pixels_per_meter 계산 (점군 실제 스케일 기반)
8. 깔끔한 floor plan 이미지 렌더링
```

**수용 기준:**
- [ ] 30초 실내 비디오 업로드 -> 10~15분 내 floor plan 이미지 출력
- [ ] floor plan에 벽 경계가 식별 가능한 수준으로 표현됨
- [ ] 방 영역이 최소 1개 이상 검출됨
- [ ] `metadata.pixels_per_meter` 값이 포함되어 좌표 변환 가능

### Task 1.1b: Track B - LLM 비전 Floor Plan (6h ~ 8h) [보장된 기본 경로]

> **[Architect 필수 변경 #1 핵심]** 5분 이내에 floor plan을 생성하는 보장된 경로. Track A가 실패해도 데모가 동작함을 보증.

#### 데이터 플로우
```
비디오 파일
  → ffmpeg으로 균등 간격 키프레임 10장 추출
  → 저장: /tmp/archithon/{job_id}/frames/keyframes/
  → Claude API (claude-3-5-sonnet) 또는 GPT-4o에 전달:
    프롬프트: "이 10장의 실내 사진을 분석하여 floor plan을 SVG로 생성하세요.
              벽, 문, 창문 위치를 포함하고, 방 라벨을 추가하세요.
              실제 크기를 미터 단위로 추정하세요."
  → SVG 파싱 → walls/rooms JSON 추출
  → pixels_per_meter 메타데이터 생성 (LLM 추정 치수 기반)
  → 저장: /tmp/archithon/{job_id}/floorplan/floorplan.svg
```

#### 핵심 구현: `llm_floorplan.py`
```
1. 비디오에서 균등 간격 키프레임 10장 추출 (ffmpeg -vf "select=not(mod(n\,N))")
2. 이미지를 base64로 인코딩
3. Claude API 멀티모달 호출 (이미지 10장 + floor plan 생성 프롬프트)
4. 응답에서 SVG 코드 추출
5. SVG 파싱 → 벽 좌표, 방 폴리곤, 라벨 추출
6. pixels_per_meter 계산 (LLM이 추정한 미터 치수 / SVG 픽셀 크기)
7. PNG 렌더링 (cairosvg 또는 Pillow)
```

**수용 기준:**
- [ ] 비디오 입력 -> **5분 이내** floor plan SVG 생성
- [ ] SVG에 벽 경계, 방 라벨 포함
- [ ] JSON으로 walls/rooms 파싱 가능
- [ ] Track A와 동일한 출력 형식 (`floorplan_image`, `walls`, `rooms`, `metadata`)

### Task 1.2: Stage 2 - 가구 비디오 -> 3D 에셋 (10h ~ 18h)

#### API 엔드포인트
```
POST /api/furniture/upload
  Input: video file (가구 촬영 영상)
  Output: { job_id: string }

GET /api/furniture/status/{job_id}
  Output: { status, progress, detected_items: [{name, thumbnail}] }

GET /api/furniture/result/{job_id}
  Output: { furniture: [{id, name, glb_url, thumbnail, dimensions:{w,h,d}, weight_estimate}] }
```

> **dimensions 단위:** 미터 (m). 좌표계 통합 스펙 참조.

#### 데이터 플로우
```
가구 비디오
  → ffmpeg으로 프레임 추출
  → 저장: /tmp/archithon/{job_id}/frames/
  → SAM2로 각 가구 객체 세그멘테이션 + 마스크 추출
  → 각 가구별:
    → 저장: /tmp/archithon/{job_id}/furniture/{furniture_id}/
    → ShapeR infer_shape.py (speed 프리셋, 10 스텝)
      → .glb 3D 메쉬 출력
    → SAM2 마스크로 텍스처 영역 크롭
    → 메쉬에 텍스처 매핑 (간단한 프로젝션)
  → 가구 목록 + 3D 에셋 반환 (dimensions 미터 단위 포함)
```

#### 핵심 구현: `shaper_service.py`
```
1. 비디오에서 대표 프레임 선택 (모션 블러 최소 프레임)
2. SAM2 auto mask generation으로 객체 감지
3. CLIP으로 각 마스크 영역 분류 ("sofa", "table", "chair" 등)
4. 각 객체별 크롭 이미지 + 마스크를 ShapeR에 전달
5. ShapeR speed 프리셋으로 .glb 생성
6. metric scale로 실제 크기 추정 (미터 단위)
7. dimensions = {width: m, height: m, depth: m} 형태로 출력
8. 크기 기반 무게 추정 (가구 유형별 밀도 테이블)
```

#### 폴백 전략
- **폴백 A:** ShapeR 대신 TripoSR (더 빠르지만 품질 낮음) 사용 -- Phase 0 Task 0.4 결과에 따라 주 경로로 격상 가능
- **폴백 B:** 3D 생성 실패 시 미리 준비한 기본 가구 메쉬 (cube, cylinder) + 텍스처로 대체
- **폴백 C:** 가구 수를 최대 3개로 제한하여 처리 시간 단축

**수용 기준:**
- [ ] 가구 비디오에서 최소 2개 이상 객체 자동 검출
- [ ] 각 객체의 .glb 3D 메쉬 파일 생성
- [ ] Three.js에서 .glb 파일 로드 및 렌더링 가능
- [ ] 각 가구의 `dimensions` (미터 단위) 포함 -- `{width, height, depth}` 형태
- [ ] 각 가구의 `weight_estimate` (kg 단위) 포함

---

## Phase 2: 백엔드 AI 기능 (18h ~ 26h)

### Task 2.1: Stage 3 - AI 자동 가구 배치 (18h ~ 22h)

#### API 엔드포인트
```
POST /api/placement/auto
  Input: {
    floorplan_id: string,
    furniture_items: [
      {
        furniture_id: string,
        dimensions: {w: number, h: number, d: number},  ← 미터 단위, 필수
        type: string  ← "sofa", "table", "chair" 등
      }
    ]
  }
  Output: {
    placements: [
      {
        furniture_id: string,
        position: {x: number, y: number, z: number},  ← Three.js 월드 좌표 (미터)
        rotation: {y: number},  ← 라디안
        scale: number  ← 기본값 1.0
      }
    ]
  }

POST /api/placement/update
  Input: { furniture_id, position, rotation }
  Output: { updated: true }
```

> **[Architect 필수 변경 #3 반영]** `furniture_items`에 `dimensions`를 필수 필드로 추가. 배치 알고리즘이 실제 가구 크기 기반으로 충돌 검사 및 공간 배치 수행.

#### 배치 알고리즘 (실용적 접근)
```
1. Floor plan metadata에서 pixels_per_meter로 실제 방 크기(미터) 계산
2. 벽 좌표를 Three.js 월드 좌표(미터)로 변환 (coordinates.py 활용)
3. 규칙 기반 배치 (dimensions 기반):
   - 큰 가구 (소파, 침대): 벽에 붙여서 배치, 가구 depth만큼 벽에서 오프셋
   - 테이블: 방 중앙 또는 소파 앞
   - 의자: 테이블 주변, 의자 width 간격으로 배치
   - 수납장: 벽면 빈 공간
4. 충돌 검사: 가구 바운딩 박스(dimensions 기반) 겹침 방지
5. 최소 통행 거리 확보 (0.6m)
6. (보너스) LLM에게 배치 검증 요청
```

#### 폴백 전략
- **폴백 A:** 규칙 기반이 실패하면 모든 가구를 방 중앙에 격자 배치
- **폴백 B:** Claude API에게 floor plan 이미지 + 가구 목록(dimensions 포함)을 주고 좌표를 JSON으로 받기

**수용 기준:**
- [ ] floor plan + 가구 목록(dimensions 포함) 입력 -> 겹치지 않는 배치 좌표 출력
- [ ] 모든 가구가 방 폴리곤 내부에 위치
- [ ] 가구 바운딩 박스가 dimensions 기반으로 정확히 계산됨
- [ ] 출력 좌표가 Three.js 월드 좌표(미터) 형식
- [ ] 0.5초 이내 배치 완료

### Task 2.2: Stage 5 - 이사 비용 추정 (22h ~ 26h)

#### API 엔드포인트
```
POST /api/cost/estimate
  Input: {
    furniture: [{name, dimensions: {w,h,d}, weight}],  ← dimensions 미터 단위
    from_address: string,
    to_address: string,
    from_floor: number,
    to_floor: number,
    has_elevator: {from: boolean, to: boolean}
  }
  Output: {
    base_cost: number,
    distance_cost: number,
    floor_cost: number,
    furniture_cost: number,
    total: number,
    breakdown: [...]
  }
```

#### 비용 계산 로직
```
1. 기본 비용: 300,000원 (1톤 트럭 기준)
2. 가구 비용: sum(각 가구 부피(w*h*d 미터) * 단가) + 특수 가구 할증
3. 거리 비용: 카카오 맵 API 또는 직선거리 * 1,000원/km
4. 층수 비용: (엘리베이터 없으면) 층당 30,000원
5. 총 비용 = 기본 + 가구 + 거리 + 층수
```

#### 폴백 전략
- **폴백:** 주소 -> 거리 변환 실패 시 사용자에게 직접 거리(km) 입력 받기

**수용 기준:**
- [ ] 가구 정보(dimensions 포함) + 주소 + 층수 입력 -> 비용 견적 JSON 출력
- [ ] 비용 항목별 상세 내역 포함
- [ ] 한국 이사 비용 시세와 대략 일치 (30~100만원 범위)

---

## Phase 3: 프론트엔드 + Three.js (26h ~ 36h)

### Task 3.1: UI 레이아웃 + 스텝 위저드 (26h ~ 29h)

**수행 내용:**
- 5단계 스텝 위저드 네비게이션
- 각 스텝 컴포넌트 뼈대
- 비디오 업로드 + 프로그레스 표시 UI
- API 폴링 훅 (처리 상태 확인)
- Track A/B 상태 표시 (어느 경로로 floor plan이 생성되었는지)

**기술 선택:**
- shadcn/ui + Tailwind CSS (빠른 UI 구축)
- Zustand (가벼운 상태 관리)
- react-dropzone (파일 업로드)

**수용 기준:**
- [ ] 5단계 탭/스텝 네비게이션 동작
- [ ] 비디오 업로드 -> 프로그레스 바 -> 결과 표시 플로우 동작
- [ ] 반응형 레이아웃 (데모용 데스크톱 기준)

### Task 3.2: Three.js 3D 뷰어 + 드래그앤드롭 (29h ~ 35h) [핵심 UI]

**수행 내용:**
- @react-three/fiber로 3D 씬 구성
- Floor plan을 바닥 평면 메쉬로 렌더링 (pixels_per_meter 기반 스케일링)
- .glb 가구 에셋 로드 및 배치 (1 unit = 1 meter)
- 가구 드래그앤드롭 이동
- 가구 회전 (Y축)
- 카메라 컨트롤 (OrbitControls)
- 가구 선택 하이라이트
- "AI 렌더" 버튼 + 현재 카메라 앵글 캡처

**핵심 구현:**
```
ThreeScene.tsx:
- Canvas + OrbitControls
- Floor plan 텍스처 -> PlaneGeometry (크기 = 이미지크기 / pixels_per_meter)
- 각 가구: useGLTF 로드 -> dimensions 기반 스케일 검증 -> DragControls
- raycaster로 바닥면 클릭 위치 계산 (좌표는 미터 단위)
- TransformControls로 선택된 가구 이동/회전

coordinates.ts (프론트엔드 좌표 유틸리티):
- floorplanPixelToWorld(px, py, metadata) → {x, z} (미터)
- worldToFloorplanPixel(x, z, metadata) → {px, py}
```

**수용 기준:**
- [ ] Floor plan이 바닥 평면으로 올바른 스케일(미터)에 렌더링됨
- [ ] .glb 가구가 올바른 위치에 올바른 크기로 렌더링됨
- [ ] 마우스 드래그로 가구 이동 가능
- [ ] 가구 회전 가능
- [ ] 카메라 자유 회전/줌 가능
- [ ] "AI 렌더" 버튼 클릭 시 현재 뷰 캡처

### Task 3.3: 결과 표시 UI (35h ~ 36h)

**수행 내용:**
- AI 렌더링 결과 이미지 표시 (before/after)
- 이사 비용 견적 카드 UI
- 전체 파이프라인 요약 페이지

**수용 기준:**
- [ ] 렌더링 결과 이미지가 전체 화면으로 표시됨
- [ ] 비용 견적이 항목별로 깔끔하게 표시됨

---

## Phase 4: 통합 + AI 렌더링 (36h ~ 42h)

### Task 4.1: Stage 4 완성 - AI 렌더링 (36h ~ 40h)

#### API 엔드포인트
```
POST /api/render/generate
  Input: {
    scene_image: base64 (Three.js 캡처),
    depth_map: base64 (Three.js depth buffer),
    prompt: string (예: "modern living room, photorealistic")
  }
  Output: { job_id: string }

GET /api/render/result/{job_id}
  Output: { rendered_image: base64 }
```

#### 렌더링 파이프라인
```
Three.js 씬 캡처 (RGB + Depth)
  → 저장: /tmp/archithon/{job_id}/render/
  → ControlNet depth + canny 조건
  → Stable Diffusion XL + ControlNet
  → 프롬프트: "photorealistic interior, {room_type}, modern furniture, natural lighting"
  → 20~30 스텝 추론
  → 고해상도 렌더링 이미지 출력
```

**모델 선택:**
- `stabilityai/stable-diffusion-xl-base-1.0` + `controlnet-depth-sdxl-1.0`
- 또는 `diffusers` 파이프라인에서 ControlNet multi-conditioning

**수용 기준:**
- [ ] Three.js 캡처 이미지 -> 30초 이내 포토리얼리스틱 렌더링 출력
- [ ] 가구 배치가 원본과 대략 일치
- [ ] 방 구조가 유지됨

### Task 4.2: End-to-End 통합 (40h ~ 42h)

**수행 내용:**
- 모든 스테이지를 순차적으로 연결
- 에러 핸들링 + 사용자 친화적 에러 메시지
- 로딩 상태 + 프로그레스 표시 통일
- 비동기 처리 폴링 안정화
- Track A/B 자동 전환 로직 통합

**수용 기준:**
- [ ] Stage 1 -> 2 -> 3 -> 4 -> 5 전체 플로우가 끊김 없이 동작
- [ ] 각 스테이지 에러 시 사용자에게 명확한 피드백
- [ ] 새로고침 후에도 진행 상태 유지 (job_id 기반)
- [ ] Track A 실패 시 Track B로 자동 전환

---

## Phase 5: 폴리싱 + 데모 준비 (42h ~ 48h)

### Task 5.1: UI 폴리싱 (42h ~ 45h)
- 로딩 애니메이션 추가
- 색상 테마 통일 (다크 모드 기반 추천 - AI/3D 데모에 적합)
- 각 스테이지 간 전환 애니메이션
- 에러 상태 UI 개선

### Task 5.2: 데모 시나리오 준비 + 하이브리드 전략 (45h ~ 47h)

> **[Architect 추가 권장 반영]** 하이브리드 데모 전략 적용.

**하이브리드 데모 전략:**
```
데모 발표 시:
1. [사전 실행] 미리 완성된 결과물을 먼저 보여줌 (처리 대기 없이 즉시 인상적인 결과 시연)
2. [라이브 시연] 새로운 비디오 입력으로 파이프라인 시작 (Track B가 5분 내 결과 생성)
3. [동시 진행] Track A가 백그라운드에서 진행 중임을 보여주며 기술적 깊이 설명
4. [비교] 사전 실행된 Track A 결과와 Track B 결과를 나란히 비교
```

**수행 내용:**
- 데모용 테스트 비디오 촬영 (실내 30초, 가구 20초)
- 사전 실행: 테스트 비디오로 Track A + Track B 모두 완료된 결과물 캐시
- 전체 플로우 3회 이상 리허설
- 실패 시나리오별 폴백 동작 확인
- 처리 시간 측정 및 기록

### Task 5.3: 발표 준비 (47h ~ 48h)
- 데모 스크립트 작성 (하이브리드 전략 포함)
- 주요 기술 포인트 정리
- 백업 플랜 확인 (사전 생성된 결과물 캐시)

**수용 기준:**
- [ ] 전체 데모 플로우 3회 연속 성공
- [ ] 하이브리드 데모 시나리오 (사전 실행 + 라이브) 리허설 완료
- [ ] 총 처리 시간 20분 이내 (Track A) / 5분 이내 (Track B)
- [ ] 폴백 시나리오 각 1회 이상 테스트 완료

---

## 위험 완화 전략 요약

| 위험 | 확률 | 영향 | 완화 전략 |
|---|---|---|---|
| COLMAP -> floor plan 변환 실패 | 높음 | ~~높음~~ **중간** | **Dual-Track: Track B(LLM 비전)가 보장된 폴백** |
| ShapeR SLAM 점군 필수 의존성 | 중간 | 높음 | **Phase 0 Task 0.4에서 조기 검증, TripoSR 폴백 준비** |
| ShapeR 추론 시간 초과 | 중간 | 중간 | speed 프리셋, 가구 수 제한, 비동기 처리 |
| COLMAP 처리 10분+ | 높음 | ~~낮음~~ **낮음** | Track B가 5분 내 결과 보장, 프로그레스 UI |
| 좌표계 불일치 (스테이지 간) | 중간 | 높음 | **좌표계 통합 스펙 명시, coordinates.py 유틸리티** |
| 배치 알고리즘 품질 | 낮음 | 중간 | 규칙 기반 단순화, dimensions 기반 충돌 검사, LLM 보조 배치 |
| ControlNet 렌더링 품질 | 중간 | 중간 | depth+canny 이중 조건, 다중 시드, 프롬프트 튜닝 |
| GPU 메모리 부족 | 낮음 | 높음 | 모델 순차 로드/언로드, torch.cuda.empty_cache() |
| Elice Cloud 접속 불안정 | 낮음 | 높음 | 로컬 CPU 폴백 (느리지만 동작), 결과 캐싱 |
| 의존성 충돌 (Python 패키지) | 중간 | 중간 | **Phase 0을 6시간으로 확대, 충돌 해결 시간 확보** |

---

## 테스트 계획 (Deliberate 모드 확장)

### 단위 테스트
- [ ] 비디오 프레임 추출: 30초 MP4 -> 30개 프레임 JPG
- [ ] 점군 바닥 평면 검출: 합성 점군 데이터로 RANSAC 정확도 확인
- [ ] 가구 배치 충돌 검사: 겹치는 배치 거부, 벽 밖 배치 거부, **dimensions 기반 바운딩 박스 정확도**
- [ ] 비용 계산: 알려진 입력으로 예상 비용 범위 확인
- [ ] **좌표 변환: pixel <-> world 좌표 왕복 변환 정확도 (coordinates.py)**
- [ ] **LLM floor plan SVG 파싱: 다양한 SVG 형식에 대한 파서 정확도**

### 통합 테스트
- [ ] Stage 1 Track A: 비디오 업로드 -> COLMAP -> floor plan 이미지 출력
- [ ] Stage 1 Track B: 비디오 업로드 -> LLM 비전 -> floor plan SVG 출력
- [ ] Stage 1 Dual-Track: Track A 실패 시 Track B 자동 전환
- [ ] Stage 2 전체: 비디오 업로드 -> .glb 파일 목록 출력 **(dimensions 포함)**
- [ ] Stage 1+2+3: floor plan + 가구(dimensions) -> 배치 결과 **(좌표 단위 검증)**
- [ ] Stage 4: Three.js 캡처 -> 렌더링 이미지

### E2E 테스트
- [ ] 전체 5단계 플로우 (Track A): 비디오 2개 업로드 -> 최종 렌더링 + 비용 견적
- [ ] 전체 5단계 플로우 (Track B): 비디오 2개 업로드 -> LLM floor plan -> 최종 렌더링 + 비용 견적
- [ ] 폴백 시나리오: COLMAP 실패 -> Track B 자동 전환 -> 이후 스테이지 정상 동작
- [ ] **하이브리드 데모 시나리오: 사전 캐시 결과 + 라이브 Track B 동시 실행**

### 관찰 가능성 (Observability)
- [ ] 각 스테이지 처리 시간 로그 (백엔드 로거)
- [ ] GPU 메모리 사용량 모니터링 (nvidia-smi 출력 로그)
- [ ] API 응답 시간 기록
- [ ] **Track A/B 선택 로그 및 전환 이벤트 기록**
- [ ] **job_id별 파일 저장소 사용량 모니터링**

---

## ADR (Architecture Decision Record)

### 결정: Dual-Track Floor Plan + ShapeR/TripoSR + ControlNet 파이프라인 + React Three Fiber 프론트엔드

**동인:**
1. 48시간 내 end-to-end 라이브 데모 구현 가능성
2. 각 AI 모델의 검증된 성능과 쉬운 셋업
3. 시각적 임팩트 극대화
4. **데모 실패 방지를 위한 이중 경로 보장**

**고려한 대안:**
- DUSt3R/MASt3R 기반 (셋업 복잡도로 기각)
- TripoSR 대체 (품질 부족으로 폴백으로만 유지, 단 ShapeR SLAM 의존성 확인 시 주 경로 격상)
- Babylon.js 프론트엔드 (Three.js 생태계가 더 넓어 기각)
- **단일 경로 COLMAP only (실패 시 데모 불가 위험으로 Dual-Track 채택)**

**선택 이유:**
- COLMAP은 PyCOLMAP + CLI로 즉시 사용 가능, 문서화 풍부 → Track A
- **LLM 비전(Claude/GPT-4o)은 5분 내 floor plan 생성 보장** → Track B
- ShapeR는 CC-BY-NC 라이선스로 해커톤 사용 가능, .glb 직접 출력
- ControlNet은 diffusers 라이브러리에서 3줄로 파이프라인 구성 가능
- React Three Fiber는 React 생태계와 자연스럽게 통합, 드래그앤드롭 구현 용이
- **좌표계 통합 스펙(1 unit = 1 meter)으로 스테이지 간 데이터 호환성 보장**

**결과:**
- 처리 시간이 길어질 수 있음 (Track A: 총 15~25분, Track B: 5분 이내) -> 프로그레스 UI + 하이브리드 데모 전략으로 대응
- A100 단일 GPU에서 모델 순차 실행 필요 -> GPU 메모리 관리 코드 필요
- ShapeR CC-BY-NC 라이선스로 상업화 불가 -> 해커톤에는 문제 없음
- **LLM API 비용 발생 (Track B) -> 해커톤 기간 한정이므로 수용 가능**

**후속 조치:**
- 데모 후 상업화 검토 시 ShapeR 대체 모델 탐색 필요
- COLMAP -> floor plan 변환 품질 개선 연구 (학습 기반 접근 검토)
- 실시간 처리를 위한 경량 모델 파이프라인 연구
- **Track B LLM 비전 floor plan의 정확도 개선 (fine-tuning 또는 few-shot 예시 추가)**

---

## 성공 기준 (최종)

1. **필수:** 5개 스테이지 모두 라이브 데모에서 동작 (최소 Track B 경로)
2. **필수:** 비디오 입력 -> 최종 렌더링 + 비용 견적까지 전체 플로우 완성
3. **필수:** Three.js 3D 뷰어에서 가구 드래그앤드롭 동작
4. **필수:** 좌표계 일관성 -- 모든 스테이지 간 미터 단위 통일
5. **목표:** Track A(COLMAP) 경로도 동작하여 기술적 깊이 시연
6. **목표:** 전체 처리 시간 20분 이내 (Track A) / 5분 이내 (Track B)
7. **목표:** AI 렌더링 결과가 시각적으로 인상적
8. **보너스:** 여러 방이 있는 floor plan에서 방별 가구 배치

---

## Revision Changelog

### Iteration 2 (2026-03-11) - Architect 리뷰 반영

#### 필수 변경 #1: Phase 1 이중 경로(Dual-Track) 재구성
- Phase 1을 Track A(COLMAP, 인상적 경로)와 Track B(LLM 비전, 보장된 기본 경로)로 분리
- Task 1.1a (Track A): 기존 COLMAP 파이프라인 유지
- Task 1.1b (Track B): 신규 추가 -- 비디오 키프레임 10장을 Claude/GPT-4o에 전달하여 5분 이내 floor plan SVG 생성
- 6시간 시점(절대시간 12h) Go/No-Go 게이트 삽입 -- Track A 성공 여부에 따라 주 경로 결정
- `llm_floorplan.py` 서비스 신규 추가 (프로젝트 구조에 반영)
- API 응답에 `source_track` 필드 추가
- Pre-Mortem 시나리오 1 대응 전략을 Dual-Track 기반으로 업데이트
- 위험 완화 테이블에서 COLMAP 실패 영향도를 높음→중간으로 하향 (Track B 보장)

#### 필수 변경 #2: Phase 0에 ShapeR 실제 추론 테스트 추가
- Task 0.4 신규 추가: ShapeR `infer_shape.py`를 실제 테스트 이미지로 1회 추론 실행
- SLAM 점군 필수 입력 여부 확인 → 분기 로직 명시 (현행 유지 / 의존성 재설계 / TripoSR 격상)
- 추론 시간 및 GPU VRAM 사용량 기록 수용 기준 추가
- `triposr_service.py` 폴백 서비스를 프로젝트 구조에 추가
- Pre-Mortem 시나리오 2에 Phase 0 조기 검증 대응 추가

#### 필수 변경 #3: 좌표계 통합 스펙 명시
- 신규 섹션 "좌표계 통합 스펙" 추가: floor plan 좌표(픽셀, 원점 좌상단), 가구 dimensions(미터), Three.js 스케일(1 unit = 1 meter)
- Stage 3 API에 가구 dimensions 전달 경로 명확화 (Stage 2 출력 → Stage 3 입력 → Three.js)
- Stage 3 API `furniture_items`에 `dimensions` 필수 필드 추가
- `coordinates.py` 유틸리티 및 프론트엔드 `coordinates.ts` 추가 (프로젝트 구조 반영)
- 배치 알고리즘이 dimensions 기반 바운딩 박스로 충돌 검사하도록 업데이트
- 단위 테스트에 좌표 변환 테스트 항목 추가

#### 추가 권장사항 반영
- **파일 저장소 관리 전략:** 신규 섹션 추가 -- job_id 기반 `/tmp/archithon/{job_id}/` 격리 구조, 24시간 정리 정책
- **데모 하이브리드 전략:** Phase 5 Task 5.2에 하이브리드 데모 전략 추가 (사전 실행 결과 + 라이브 Track B 동시 시연)
- **Stage 3 API 가구 dimensions 추가:** 좌표계 통합 스펙 내 전달 경로 명시 (필수 변경 #3과 통합)
- **Phase 0 시간 확대:** 4h → 6h 조정, 의존성 충돌 해결 시간 반영. 전체 타임라인 2시간 후행 이동 (Phase 3에서 2시간 흡수)
- **`utils/storage.py`** 신규 추가 (프로젝트 구조 반영)
- 위험 완화 테이블에 "좌표계 불일치" 및 "의존성 충돌" 항목 추가
- 테스트 계획에 Track A/B 통합 테스트, 좌표 변환 테스트, 하이브리드 데모 시나리오 추가
- ADR 업데이트: Dual-Track 선택 이유, LLM API 비용 결과, Track B 정확도 후속 조치 추가
- 성공 기준에 좌표계 일관성 항목 및 Track A/B 목표 분리 추가
