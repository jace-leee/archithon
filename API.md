# SAM3 Inference Server API

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
  "model": "SAM3",
  "gpu": "NVIDIA A100 80GB PCIe MIG 3g.40gb",
  "gpu_memory_allocated_gb": 3.46
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | 서버 상태 (`"healthy"`) |
| `model` | string | 로드된 모델명 |
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
  "masks": [[[0, 0, 1, 1, ...], ...]],
  "boxes": [[x1, y1, x2, y2], ...],
  "scores": [0.95, 0.87, ...],
  "prompt": "person",
  "inference_time_sec": 0.234
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `masks` | array | 세그멘테이션 마스크 (이진 배열) |
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
      "masks": [[[0, 0, 1, ...], ...]],
      "boxes": [[x1, y1, x2, y2], ...],
      "scores": [0.95, ...]
    },
    {
      "prompt": "car",
      "masks": [[[0, 1, 1, ...], ...]],
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
| `results[].masks` | array | 세그멘테이션 마스크 |
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
  "masks": [[[0, 0, 1, 1, ...], ...]],
  "boxes": [[100, 200, 400, 500]],
  "scores": [0.97],
  "box": [100, 200, 400, 500],
  "inference_time_sec": 0.189
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `masks` | array | 세그멘테이션 마스크 |
| `boxes` | array | 바운딩 박스 좌표 |
| `scores` | array | 신뢰도 점수 |
| `box` | array | 입력된 바운딩 박스 좌표 |
| `inference_time_sec` | float | 추론 소요 시간 (초) |

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

---

## 서버 실행

```bash
cd ~/archithon
bash run.sh
```

서버는 `0.0.0.0:7777`에서 시작됩니다.
