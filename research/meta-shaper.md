# Meta ShapeR 리서치

## 1. ShapeR란 무엇인가?

**정식 명칭:** ShapeR: Robust Conditional 3D Shape Generation from Casual Captures

**개발 기관:** Meta Reality Labs Research + Simon Fraser University (SFU)

ShapeR는 스마트폰이나 AR 글래스 등으로 "아무렇게나" 촬영한 일상적인 영상 시퀀스로부터 개별 객체들의 3D 메쉬를 자동으로 생성하는 생성형 AI 시스템입니다. 기존 3D 재구성 방법들이 깔끔하고 이상적인 입력 조건을 요구하는 것과 달리, ShapeR는 폐색(occlusion), 배경 잡음, 저해상도, 불규칙한 시점 등 현실 세계의 까다로운 조건에서도 강건하게 동작하도록 설계되었습니다.

**핵심 목표:** 사용자 개입 없이, 복잡한 실내 환경에서도 각 객체를 metric scale(실제 크기 기준)로 정확하게 3D 재구성

**논문 정보:**
| 항목 | 내용 |
|---|---|
| arXiv ID | 2601.11514 |
| 제출일 | 2026년 1월 16일 |
| 카테고리 | cs.CV (Computer Vision and Pattern Recognition) |
| 저자 | Yawar Siddiqui, Duncan Frost, Samir Aroudj 외 9명 |

## 2. 기술적 접근 방식 및 방법론

ShapeR의 파이프라인은 크게 **전처리 → 조건부 생성 모델 → 후처리** 세 단계로 구성됩니다.

### 전처리: 멀티모달 입력 추출

입력 영상 시퀀스에서 다음 4가지 조건 정보를 자동으로 추출합니다:

1. **SLAM 포인트 클라우드**: 비주얼-이너셜 SLAM으로 추출한 희소(sparse) 3D 포인트
2. **포즈 추정된 멀티뷰 이미지**: 카메라 포즈와 함께 선별된 다시점 이미지
3. **2D 프로젝션 마스크**: 객체 탐지 및 세그멘테이션 정보
4. **VLM 캡션**: 비전-언어 모델(Vision-Language Model)이 자동 생성한 객체 설명 텍스트

### 핵심 생성 모델: Rectified Flow Transformer

- **3D VAE (Dora 변형):** VecSet 표현(잠재 차원 256~4096)을 사용, 객체 형상을 연속적인 잠재 공간으로 인코딩
- **노이즈 제거 트랜스포머:** FLUX.1 아키텍처 기반의 듀얼-단일 스트림 설계, 크로스-어텐션 레이어를 통해 4가지 조건에 모두 conditioning
- **조건 인코더 구성:**
  - SLAM 포인트: 3D ResNet 희소 합성곱 인코더
  - 이미지: 동결된 DINOv2 백본 + Plücker 포즈 인코딩
  - 텍스트: 동결된 T5 + CLIP 인코더
  - 프로젝션 마스크: 2D 합성곱 네트워크
- **최종 출력:** Marching Cubes를 통해 SDF(Signed Distance Field) 예측을 메쉬로 변환 후 metric 스케일 보정

### 강건성 확보를 위한 훈련 전략

1. **On-the-fly 구성적 증강(Compositional Augmentation):** 배경 합성, 폐색 오버레이, 가시성 안개, 해상도 저하, 광도 왜곡 등을 실시간으로 적용하여 현실 세계의 노이즈를 시뮬레이션
2. **커리큘럼 훈련 방식:**
   - **1단계(사전훈련):** 600,000개 이상의 다양한 단일 객체 3D 메쉬(3D 아티스트 제작)
   - **2단계(파인튜닝):** Aria Synthetic Environments 데이터셋의 장면 수준 객체 크롭

## 3. 주요 기능 및 활용 사례

**기능:**
- 일상적인 비디오 시퀀스에서 개별 객체의 완전한 3D 메쉬 자동 생성
- Metric scale 정확도 유지 (실제 크기와 일치하는 재구성)
- 폐색된 부분의 형상 완성(amodal 재구성)
- 복잡한 배경과 여러 객체가 있는 장면 처리
- 수동 조작 없이 완전 자동 처리
- 훈련 데이터에 없는 새로운 환경(ScanNet++, iPhone 단안 캡처)으로 재훈련 없이 일반화

**활용 분야:**
- AR/VR 콘텐츠 제작 (Meta의 AR 글래스 생태계와 직결)
- 디지털 트윈(Digital Twin) 구축
- 로보틱스용 3D 장면 이해
- 가구/인테리어 디자인 시각화
- e-커머스 3D 상품 이미지 자동 생성

## 4. 다른 3D 재구성/생성 방법과의 비교

### 기존 다시점 3D 재구성 방법 대비

| 방법 | Chamfer Distance (낮을수록 우수) |
|---|---|
| EFM3D | 13.82 |
| DP-Recon | 8.364 |
| LIRM | 8.047 |
| FoundationStereo | 6.483 |
| **ShapeR** | **2.375** |

ShapeR는 기존 SOTA 대비 **Chamfer Distance 기준 2.7배 이상** 향상된 성능을 보였습니다.

### 파운데이션 이미지-to-3D 모델 대비

- 기존 모델들(TripoSG, Hunyuan3D-2.0, Direct3DS2, Amodal3R)은 깔끔하고 이상적인 단일/소수 이미지 입력에 최적화
- 수동으로 선별된 시점, SAM2 기반 인터랙티브 세그멘테이션 등 사용자 조작이 필요
- ShapeR는 사용자 조작 없이 자동화, **사용자 선호도 연구에서 81~88% 승률** 기록

## 5. 오픈 소스 공개 여부

**공개 상태: 부분 공개 (비상업적 연구 목적)**

| 리소스 | 내용 | 링크 |
|---|---|---|
| 코드 및 모델 | GitHub 공개 | [facebookresearch/ShapeR](https://github.com/facebookresearch/ShapeR) |
| 평가 데이터셋 | Aria 글래스로 촬영한 실제 환경 178개 객체, 7개 장면 | [facebook/ShapeR-Evaluation (HuggingFace)](https://huggingface.co/datasets/facebook/ShapeR-Evaluation) |
| 라이선스 | CC-BY-NC (Creative Commons 비상업적) | — |

**사용 방법:** `python infer_shape.py`로 추론 실행 가능. 품질(50 스텝), 균형(25 스텝), 속도(10 스텝) 3가지 프리셋 제공. 출력 포맷은 `.glb` 3D 메쉬.

## 참고 자료

- [ShapeR 공식 프로젝트 페이지](https://facebookresearch.github.io/ShapeR/)
- [arXiv:2601.11514 - ShapeR 논문](https://arxiv.org/abs/2601.11514)
- [GitHub - facebookresearch/ShapeR](https://github.com/facebookresearch/ShapeR)
- [HuggingFace - ShapeR Paper Page](https://huggingface.co/papers/2601.11514)
- [HuggingFace - ShapeR Evaluation Dataset](https://huggingface.co/datasets/facebook/ShapeR-Evaluation)
