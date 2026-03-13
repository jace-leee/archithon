# Deep Interview Spec: Archithon - AI 이사 도우미 (3D 가구 배치 & 렌더링)

## Metadata
- Interview ID: archithon-2026-0311
- Rounds: 7
- Final Ambiguity Score: 19.5%
- Type: greenfield
- Generated: 2026-03-12
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 40% | 0.34 |
| Constraint Clarity | 0.75 | 30% | 0.225 |
| Success Criteria | 0.80 | 30% | 0.24 |
| **Total Clarity** | | | **0.805** |
| **Ambiguity** | | | **19.5%** |

## Goal

1인 2일 해커톤에서 **"사진/영상만으로 이사를 계획하는 end-to-end AI 파이프라인"**을 라이브 데모하는 것. 새 집 영상으로 평면도를 추출하고, 현재 집 가구를 3D 에셋으로 만들어, AI가 최적 배치한 뒤 포토리얼리스틱하게 렌더링하는 전체 플로우가 끊김 없이 동작해야 함.

## Demo Flow (5단계)

### Step 1: 새 집 공간 스캔 → 평면도 추출
- **Input:** 새 집 영상 (스마트폰 촬영)
- **Process:** COLMAP SfM → 3D 메쉬 재구성 → 상단 투영(Top-down projection)으로 평면도 추출
- **Output:** 2D 평면도 (벽, 문, 창문 경계선 포함)

### Step 2: 현재 집 가구 → 3D 에셋 생성 + 텍스처
- **Input:** 현재 집 가구 영상 (스마트폰 촬영)
- **Process:**
  - ShapeR로 각 가구의 3D 메쉬(.glb) 생성 (metric scale)
  - ShapeR가 분리한 객체 기반으로 SAM을 사용하여 가구 텍스처 추출
- **Output:** 텍스처가 입혀진 3D 가구 에셋 목록

### Step 3: AI 자동 가구 배치
- **Input:** 평면도 + 3D 가구 에셋 목록 (크기 정보 포함)
- **Process:** 가구 최적 배치 알고리즘 (공간 제약, 동선, 풍수/인체공학 고려)
- **Output:** 평면도 위의 가구 배치 결과 (2D top-down view + 3D 좌표)

### Step 4: 3D 시각화 + 사용자 조정 + AI 렌더링
- **Input:** 배치된 3D 장면
- **Process:**
  - Three.js 기반 3D 뷰어에서 배치 결과 시각화
  - 사용자가 드래그&드롭으로 가구 위치 수동 조정 가능
  - 원하는 각도에서 "AI 렌더링" 버튼 클릭 → 포토리얼리스틱 렌더링 생성
- **Output:** AI 렌더링된 인테리어 이미지

### Step 5: 이사 견적 산출
- **Input:** 가구 목록 (크기/무게), 이사 거리, 출발지/도착지 층수
- **Process:** 가구 크기/무게 + 거리 + 층수 기반 견적 알고리즘
- **Output:** 예상 이사 비용

## Tech Stack

### Frontend
- **React** + **Three.js** (3D 시각화, 가구 드래그&드롭)
- 2D 평면도 뷰 + 3D 장면 뷰 전환

### Backend
- **Python FastAPI** (REST API 서버)
- 각 AI 모델의 추론 엔드포인트 제공

### AI Models & Tools
| Component | Technology | Role |
|-----------|-----------|------|
| 공간 → 평면도 | COLMAP (SfM + MVS) | 영상에서 3D 메쉬 재구성, top-down 투영 |
| 가구 → 3D 에셋 | Meta ShapeR | 영상에서 가구별 3D 메쉬(.glb) 생성 |
| 가구 텍스처 추출 | SAM (Segment Anything) | ShapeR 결과 기반 가구 이미지 세그멘테이션 |
| 자동 배치 | 커스텀 알고리즘 | 공간 제약 기반 최적 배치 |
| AI 렌더링 | 생성형 AI (SD/ControlNet 등) | 3D 장면 → 포토리얼리스틱 이미지 |
| 이사 견적 | 규칙 기반 or LLM | 가구/거리/층수 기반 비용 산출 |

### Infrastructure
- **Elice Cloud** (GPU 서빙): 모든 AI 모델 추론
- A100 GPU 기반 추론 서버

## Constraints
- **기간:** 2일 (48시간)
- **인원:** 1명 (솔로)
- **데모 형식:** 전체 라이브 데모 (사전 준비 데이터 없음)
- **처리 시간:** 유연 (각 단계 처리 중 대기 허용)
- **품질:** 최종 결과물(특히 AI 렌더링)의 시각적 품질이 중요

## Non-Goals
- 모바일 네이티브 앱 개발
- 실시간(초단위) 처리 속도 최적화
- 실제 이사업체 연동
- 사용자 인증/결제 시스템
- 다중 사용자 동시 접속

## Acceptance Criteria
- [ ] 새 집 영상 업로드 → COLMAP 처리 → 평면도 이미지 출력
- [ ] 현재 집 가구 영상 업로드 → ShapeR + SAM 처리 → 3D 가구 에셋 목록 생성
- [ ] 평면도 + 가구 에셋 → AI 자동 배치 알고리즘 실행 → 배치 결과 표시
- [ ] Three.js 3D 뷰어에서 배치 결과 확인 + 가구 드래그&드롭 수동 조정
- [ ] 특정 각도에서 "AI 렌더링" 버튼 → 포토리얼리스틱 이미지 생성
- [ ] 가구 정보 + 거리 + 층수 입력 → 이사 견적 금액 표시
- [ ] 전체 Step 1~5가 웹 UI에서 끊김 없이 순차 진행
- [ ] 모든 AI 추론이 Elice Cloud GPU에서 실행

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 타겟 사용자는 이사 예정인 일반인 | 실제 사용자인지 데모용인지? | 해커톤 데모 프로젝트 (기술 시연 목적) |
| 모든 단계가 라이브로 동작해야 함 | 1인 2일로 8개 컴포넌트가 가능한가? | 전체 라이브 데모가 목표. 처리 시간은 유연하게 허용 |
| 고품질 렌더링이 필요 | 속도 vs 품질 트레이드오프 | 품질 우선. 처리 대기는 허용 |
| 웹 앱으로 구현 | 모바일 앱이 더 자연스럽지 않나? | React + Three.js 웹 앱으로 확정 |

## Technical Risks
1. **ShapeR 추론 시간**: 단일 가구당 수 분 소요 가능 → 여러 가구면 총 처리 시간 길어짐
2. **COLMAP 처리 시간**: 영상 길이에 따라 10분+ 소요 가능
3. **COLMAP → 평면도 변환**: 3D 메쉬에서 clean한 평면도를 추출하는 후처리가 비자명
4. **3D 가구 배치 알고리즘**: 공간 제약 만족 + 미적 배치를 동시에 달성하는 알고리즘 구현 난이도
5. **AI 렌더링 품질**: ControlNet 등으로 3D 뷰포트를 포토리얼리스틱하게 변환하는 품질 보장

## Ontology (Key Entities)
| Entity | Fields | Relationships |
|--------|--------|---------------|
| Space (새 집) | video, 3d_mesh, floor_plan, dimensions | has many FurniturePlacements |
| Furniture (가구) | video, 3d_asset(.glb), texture, dimensions, weight | placed in Space |
| FloorPlan (평면도) | image, walls, doors, windows, dimensions | derived from Space |
| Placement (배치) | furniture_id, position(x,y,z), rotation | belongs to Space, references Furniture |
| Rendering (렌더링) | camera_angle, output_image, quality | snapshot of Placement state |
| Estimate (견적) | furniture_list, distance, floors, total_cost | aggregates Furniture data |

## Interview Transcript
<details>
<summary>Full Q&A (7 rounds)</summary>

### Round 1
**Q:** 이 서비스의 최종 사용자는 누구이며, 핵심 시나리오는 무엇인가요?
**A:** 해커톤/데모 프로젝트
**Ambiguity:** 74.5% (Goal: 0.45, Constraints: 0.15, Criteria: 0.10)

### Round 2
**Q:** 해커톤 데모에서 심사위원/관객에게 보여줄 핵심 'wow point'는 무엇인가요?
**A:** End-to-end 파이프라인 (사진 촬영부터 최종 렌더링까지 전체 흐름이 끊김 없이 동작)
**Ambiguity:** 61.5% (Goal: 0.70, Constraints: 0.15, Criteria: 0.20)

### Round 3
**Q:** 해커톤의 시간/인원/기술 제약 조건은?
**A:** 혼자서 2일 (솔로 해커톤, 48시간)
**Ambiguity:** 49.5% (Goal: 0.70, Constraints: 0.55, Criteria: 0.20)

### Round 4 (Contrarian Mode)
**Q:** 1인 2일로 8개 컴포넌트를 모두 구현하는 것이 현실적인가? 데모 범위는?
**A:** 전체 라이브 데모 (모든 단계가 실시간 동작)
**Ambiguity:** 41.5% (Goal: 0.75, Constraints: 0.55, Criteria: 0.40)

### Round 5
**Q:** 데모 시나리오의 구체적 흐름을 확인
**A:** 5단계 흐름 확정 — 새집 스캔→가구 3D화→자동배치→3D시각화+수동조정+AI렌더링→이사견적
**Ambiguity:** 30.0% (Goal: 0.85, Constraints: 0.55, Criteria: 0.65)

### Round 6 (Simplifier Mode)
**Q:** 기술 스택과 플랫폼은?
**A:** Web (React + Three.js) 프론트엔드 + Python FastAPI 백엔드
**Ambiguity:** 24.0% (Goal: 0.85, Constraints: 0.75, Criteria: 0.65)

### Round 7
**Q:** 데모 성공의 최소 기준은? 속도 vs 품질?
**A:** 시간은 유연하되 품질이 중요 (처리 대기 허용, 최종 결과물 품질이 핵심)
**Ambiguity:** 19.5% (Goal: 0.85, Constraints: 0.75, Criteria: 0.80)

</details>
