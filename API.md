# SAM3 + SAM3D Inference Server API

Base URL: `http://localhost:7777`

Swagger UI: `http://localhost:7777/docs`

---

## GET /health

서버 상태 및 GPU 정보를 반환합니다.

**Request**

```bash
curl http://localhost:7777/health
```

**Response**

```json
{
  "status": "healthy",
  "models": ["SAM3", "SAM3D"],
  "gpu": "NVIDIA A100 80GB PCIe MIG 3g.40gb",
  "gpu_memory_allocated_gb": 17.16
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | 서버 상태 (`"healthy"`) |
| `models` | array | 로드된 모델 목록 |
| `gpu` | string | GPU 디바이스명 |
| `gpu_memory_allocated_gb` | float | GPU 메모리 사용량 (GB) |

---

## POST /predict/text

텍스트 프롬프트 기반 세그멘테이션 (PCS). 이미지에서 텍스트에 매칭되는 모든 객체의 마스크를 반환합니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | file | O | 이미지 파일 (JPEG/PNG) |
| `prompt` | string | O | 텍스트 프롬프트 (예: `"person"`, `"노란 버스"`) |

```bash
curl -X POST http://localhost:7777/predict/text \
  -F "file=@photo.jpg" \
  -F "prompt=person"
```

**Response**

```json
{
  "masks": ["iVBORw0KGgo...(base64 PNG)..."],
  "boxes": [[x1, y1, x2, y2], ...],
  "scores": [0.95, 0.87, ...],
  "prompt": "person",
  "inference_time_sec": 0.234
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `masks` | array[string] | 세그멘테이션 마스크 (base64 인코딩된 PNG) |
| `boxes` | array | 바운딩 박스 좌표 `[x1, y1, x2, y2]` |
| `scores` | array | 각 객체의 신뢰도 점수 (0~1) |
| `prompt` | string | 입력된 텍스트 프롬프트 |
| `inference_time_sec` | float | 추론 소요 시간 (초) |

---

## POST /predict/multi-text

다중 텍스트 프롬프트 세그멘테이션. 하나의 이미지에 여러 프롬프트를 한번에 전송합니다. 이미지 인코딩은 한 번만 수행되어 효율적입니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | file | O | 이미지 파일 (JPEG/PNG) |
| `prompts` | string | O | 텍스트 프롬프트 JSON 배열 (예: `'["person", "car"]'`) |

```bash
curl -X POST http://localhost:7777/predict/multi-text \
  -F "file=@photo.jpg" \
  -F 'prompts=["person", "car", "dog"]'
```

**Response**

```json
{
  "results": [
    {
      "prompt": "person",
      "masks": ["iVBORw0KGgo...(base64 PNG)..."],
      "boxes": [[x1, y1, x2, y2], ...],
      "scores": [0.95, ...]
    },
    {
      "prompt": "car",
      "masks": ["iVBORw0KGgo...(base64 PNG)..."],
      "boxes": [[x1, y1, x2, y2], ...],
      "scores": [0.91, ...]
    }
  ],
  "inference_time_sec": 0.512
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `results` | array | 각 프롬프트별 세그멘테이션 결과 |
| `results[].prompt` | string | 해당 프롬프트 텍스트 |
| `results[].masks` | array[string] | 세그멘테이션 마스크 (base64 PNG) |
| `results[].boxes` | array | 바운딩 박스 좌표 |
| `results[].scores` | array | 신뢰도 점수 |
| `inference_time_sec` | float | 전체 추론 소요 시간 (초) |

---

## POST /predict/box

바운딩 박스 프롬프트 기반 세그멘테이션 (PVS). 지정한 박스 영역의 세그멘테이션 마스크를 반환합니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | file | O | 이미지 파일 (JPEG/PNG) |
| `box` | string | O | 바운딩 박스 좌표 JSON (예: `"[100, 200, 400, 500]"`) |

```bash
curl -X POST http://localhost:7777/predict/box \
  -F "file=@photo.jpg" \
  -F "box=[100, 200, 400, 500]"
```

**Response**

```json
{
  "masks": ["iVBORw0KGgo...(base64 PNG)..."],
  "boxes": [[100, 200, 400, 500]],
  "scores": [0.97],
  "box": [100, 200, 400, 500],
  "inference_time_sec": 0.189
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `masks` | array[string] | 세그멘테이션 마스크 (base64 PNG) |
| `boxes` | array | 바운딩 박스 좌표 |
| `scores` | array | 신뢰도 점수 |
| `box` | array | 입력된 바운딩 박스 좌표 |
| `inference_time_sec` | float | 추론 소요 시간 (초) |

---

## POST /predict/3d

이미지의 객체를 3D Gaussian Splat (PLY)으로 변환합니다. 마스크를 직접 제공하거나, 텍스트 프롬프트로 SAM3가 자동 세그멘테이션합니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | file | O | 이미지 파일 (JPEG/PNG) |
| `mask` | file | - | 마스크 파일 (PNG, 흰색=객체). prompt와 택1 |
| `prompt` | string | - | 텍스트 프롬프트. mask와 택1 (SAM3로 자동 세그멘테이션) |
| `mask_index` | int | - | 자동 세그멘테이션 시 사용할 마스크 인덱스 (기본: 0) |
| `seed` | int | - | 3D 생성 시드 (기본: 42) |

**방법 1: 텍스트 프롬프트로 자동 마스크 생성**

```bash
curl --max-time 600 -o output.glb -X POST http://localhost:7777/predict/3d \
  -F "file=@photo.jpg" \
  -F "prompt=chair" \
  -F "seed=42"
```

**방법 2: 직접 마스크 제공**

```bash
curl --max-time 600 -o output.glb -X POST http://localhost:7777/predict/3d \
  -F "file=@photo.jpg" \
  -F "mask=@mask.png" \
  -F "seed=42"
```

**Response**

GLB 파일 (glTF 2.0 binary, `model/gltf-binary`)

| 헤더 | 설명 |
|------|------|
| `Content-Disposition` | `attachment; filename=output.glb` |
| `X-Inference-Time-Sec` | 추론 소요 시간 (초) |

> **참고:** 3D 생성은 ~60~120초 소요됩니다. 클라이언트 timeout을 충분히 설정하세요.

---

## 에러 응답

모든 엔드포인트는 입력 오류 시 HTTP 400을 반환합니다.

```json
{
  "detail": "이미지를 읽을 수 없습니다."
}
```

| 상황 | 에러 메시지 |
|------|-------------|
| 잘못된 이미지 파일 | `"이미지를 읽을 수 없습니다."` |
| 잘못된 prompts 형식 | `"prompts는 JSON 배열 형식이어야 합니다."` |
| 잘못된 box 형식 | `"box는 [x1, y1, x2, y2] 형식이어야 합니다."` |
| mask와 prompt 둘 다 없음 | `"mask 파일 또는 prompt 중 하나를 제공해야 합니다."` |
| 객체 미발견 | `"'{prompt}'에 해당하는 객체를 찾을 수 없습니다."` |

---

## POST /generate

텍스트 → 이미지 생성 (FLUX.2 Klein T2I). 4스텝 추론으로 ~2초 내에 1024x1024 이미지를 생성합니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `prompt` | string | O | 이미지 생성 프롬프트 (서술형 권장) |
| `width` | int | - | 이미지 너비 (16의 배수, 기본: 1024, 최대: 2048) |
| `height` | int | - | 이미지 높이 (16의 배수, 기본: 1024, 최대: 2048) |
| `seed` | int | - | 시드 (-1이면 랜덤, 기본: -1) |

```bash
curl -o output.png -X POST http://localhost:7777/generate \
  -F "prompt=A futuristic cyberpunk city at night, neon lights, 8K" \
  -F "width=1024" \
  -F "height=1024" \
  -F "seed=42"
```

**Response**

PNG 이미지 (`image/png`)

| 헤더 | 설명 |
|------|------|
| `X-Inference-Time-Sec` | 추론 소요 시간 (초) |

---

## POST /edit

이미지 → 이미지 변환 (FLUX.2 Klein I2I). 입력 이미지를 프롬프트 기반으로 변환합니다.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `image_file` | file | O | 입력 이미지 (JPEG/PNG) |
| `prompt` | string | - | 변환 프롬프트 (기본: "Photorealistic, natural lighting, 8K detail") |
| `seed` | int | - | 시드 (-1이면 랜덤, 기본: -1) |

```bash
curl -o output.png -X POST http://localhost:7777/edit \
  -F "image_file=@input.jpg" \
  -F "prompt=Photorealistic rendering, cinematic lighting, detailed textures" \
  -F "seed=42"
```

**Response**

PNG 이미지 (`image/png`, 1024x1024)

| 헤더 | 설명 |
|------|------|
| `X-Inference-Time-Sec` | 추론 소요 시간 (초) |

---

## 서버 실행

```bash
cd ~/archithon
bash run.sh
```

서버는 `0.0.0.0:7777`에서 시작됩니다. 3개 모델 로드에 약 3분 소요됩니다.

## 모델 정보

| 모델 | 용도 | GPU 메모리 |
|------|------|-----------|
| SAM3 (Segment Anything 3) | 이미지 세그멘테이션 | ~3.5 GB |
| SAM3D (SAM 3D Objects) | 이미지 → 3D GLB | ~13.7 GB |
| FLUX.2 Klein 4B | 이미지 생성/편집 (T2I, I2I) | ~16.0 GB |
| **합계** | | **~33.2 GB / 40 GB** |
