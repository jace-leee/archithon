# COLMAP 리서치

## 1. COLMAP이란 무엇인가?

**COLMAP**은 이미지 컬렉션으로부터 3D 구조를 복원하는 범용 오픈소스 소프트웨어입니다. 핵심 기능은 두 가지 컴퓨터 비전 기술에 기반합니다:

- **SfM (Structure-from-Motion)**: 복수의 이미지에서 카메라 자세(pose)와 희소 3D 점군(sparse point cloud)을 동시에 추정
- **MVS (Multi-View Stereo)**: SfM 결과를 입력으로 받아 밀집 3D 점군(dense point cloud)과 메쉬(mesh)를 생성

Johannes Schönberger와 Jan-Michael Frahm이 개발했으며, BSD 라이선스 하에 공개되어 있습니다. 순서가 있는(ordered) 이미지 시퀀스와 순서가 없는(unordered) 이미지 컬렉션 모두를 처리할 수 있습니다. 현재 최신 개발 버전은 **3.14.0.dev0** (2026년 2월 기준)입니다.

## 2. 기술 파이프라인

### Stage 1: 특징 추출 (Feature Extraction)
각 이미지에서 **SIFT(Scale-Invariant Feature Transform)** 키포인트를 검출하고, 128차원 디스크립터로 수치화합니다. GPU 가속을 권장하며, 외부에서 사전 계산된 특징점을 텍스트 파일로 가져올 수도 있습니다.

### Stage 2: 특징 매칭 및 기하학적 검증 (Feature Matching & Geometric Verification)
이미지 간 대응점을 확립합니다. 5가지 매칭 전략을 지원합니다:

| 전략 | 적합한 상황 |
|---|---|
| **Exhaustive Matching** | 수백 장 이하의 소규모 데이터셋 (모든 쌍을 비교) |
| **Sequential Matching** | 비디오 시퀀스 (루프 검출 내장) |
| **Vocabulary Tree Matching** | 수천 장 이상의 대규모 데이터셋 |
| **Spatial Matching** | GPS 좌표 정보가 있는 경우 |
| **Transitive Matching** | 기존 매치를 활용하여 추가 대응점 탐색 |

### Stage 3: 희소 재건 (Sparse Reconstruction / SfM)
증분 방식(incremental)으로 초기 이미지 쌍에서 시작하여 카메라를 하나씩 등록하고 3D 점을 삼각측량합니다. 실시간 시각화를 지원합니다.

### Stage 4: 밀집 재건 (Dense Reconstruction / MVS)
1. 이미지 언디스토션(undistortion)
2. 각 이미지에 대한 깊이/법선 맵(depth/normal map) 계산
3. 깊이 맵 융합(fusion)으로 밀집 점군 생성
4. (선택사항) Poisson 또는 Delaunay 알고리즘으로 표면 메쉬 생성

## 3. 주요 특징 및 기능

### 인터페이스
- **GUI (Graphical User Interface)**: 재건 과정을 실시간으로 시각화하며 대부분의 기능에 접근 가능
- **CLI (Command-line Interface)**: 자동화 스크립팅을 위해 모든 기능에 접근 가능
- **Python API (PyCOLMAP)**: 프로그래밍 방식으로 파이프라인을 제어하는 파이썬 바인딩

### PyCOLMAP 주요 API

```python
import pycolmap

# 1. 특징 추출
pycolmap.extract_features(database_path, image_path)

# 2. 특징 매칭 (소규모: exhaustive, 대규모: vocabulary tree)
pycolmap.match_exhaustive(database_path)

# 3. 증분 매핑 (SfM)
maps = pycolmap.incremental_mapping(database_path, image_path, output_path)

# 4. 번들 조정 (정밀화)
pycolmap.bundle_adjustment(reconstruction)
```

### CLI 자동 재건 (가장 간단한 사용법)

```bash
colmap automatic_reconstructor \
    --workspace_path $DATASET_PATH \
    --image_path $DATASET_PATH/images
```

## 4. 주요 활용 사례

### NeRF 전처리 (가장 널리 알려진 활용)
NeRF(Neural Radiance Fields)를 학습하기 위해서는 각 입력 이미지의 카메라 내·외부 파라미터(pose)가 필요합니다. COLMAP이 사실상 표준 전처리 도구로 사용되며, Instant-NGP, Nerfstudio, 3D Gaussian Splatting(3DGS) 등 거의 모든 NeRF 계열 프레임워크가 COLMAP 출력 포맷을 기본 입력으로 지원합니다.

### 3D Gaussian Splatting (3DGS)
3DGS도 COLMAP을 이용해 초기 희소 점군과 카메라 포즈를 획득합니다. 최근에는 COLMAP 없이 동작하는 COLMAP-Free 3DGS 연구도 등장했으나, 복잡한 장면에서는 여전히 COLMAP 기반이 더 안정적입니다.

### 포토그래메트리 및 측량
- 항공 드론 이미지를 이용한 지형 모델(DEM) 생성
- 건축 구조물 3D 문서화
- 고고학 유적지 디지털 보존 (문화재 기록)

### 로보틱스 및 SLAM
COLMAP-SLAM이라는 확장 프레임워크를 통해 실시간 Visual Odometry 및 SLAM으로 활용됩니다.

### 영화/VFX/메타버스
대규모 실제 장면(예: 로마 중심부 21,000장 사진 재건)을 3D 모델로 변환하는 데 활용됩니다.

## 5. 장점 (Strengths)

| 장점 | 설명 |
|---|---|
| **정확도** | 학술 연구 수준의 높은 재건 정확도 (측정 기준 0.15mm) |
| **범용성** | 순서 없는 이미지, GPS 정보, 멀티카메라 리그 등 다양한 입력 지원 |
| **완전 파이프라인** | SfM부터 Dense MVS, 메쉬 생성까지 end-to-end 제공 |
| **활발한 개발** | 2026년까지 지속 업데이트, 대형 커뮤니티 |
| **생태계 통합** | NeRF, 3DGS, OpenMVS 등과 표준 인터페이스로 연동 |
| **세 가지 인터페이스** | GUI, CLI, Python API 모두 지원 |
| **오픈소스** | BSD 라이선스, 상업적 이용 가능 |

## 6. 한계 (Limitations)

| 한계 | 설명 |
|---|---|
| **텍스처 없는 표면** | 반복 패턴, 단색 벽면, 반사 표면에서 특징점 검출 실패 |
| **속도** | 대규모 데이터셋에서 증분 SfM은 느릴 수 있음 (GLOMAP으로 해결) |
| **실시간 불가** | 기본적으로 오프라인 처리 방식 |
| **움직이는 객체** | 동적 장면 처리에 취약 |
| **카메라 자가 캘리브레이션** | 복잡한 왜곡 모델에서 파라미터가 발산할 수 있음 |
| **이미지 품질 의존성** | 모션 블러, 낮은 오버랩, 극단적인 조명 변화에서 실패 |
| **실내 MVS 품질** | 실내 밀집 재건에서 OpenMVS나 MVE보다 품질이 낮을 수 있음 |

## 7. 최근 업데이트 (2024~2026)

### COLMAP 3.13.0 (2025년 11월)
- 센서 리그 모델링 개선 (멀티카메라, 파노라마 지원)
- **FLANN 제거, faiss로 교체** → 최근접 이웃 탐색 대폭 가속
- PoseLib minimal solver 도입
- LLA/UTM 좌표 변환 지원
- **CUDA 기반 번들 조정** (실험적)
- Qt6 공식 지원

### COLMAP 3.11.0 (2024년 11월)
- **GPS 측정값 활용 포즈 프라이어 기반 증분 매퍼** 추가
- 번들 조정 공분산 추정 (Ceres보다 대폭 빠름)
- Meta Project Aria 기기용 피쉬아이 카메라 모델 추가
- C++17 표준으로 업그레이드

### GLOMAP 통합 (2024 ECCV)
GLOMAP(Global SfM) 연구가 ECCV 2024에 발표된 후 COLMAP 메인 레포지토리에 통합되었습니다. 기존 증분 방식 대비 **1~2 오더(10~100배) 빠른 재건** 속도를 제공하며 품질은 동등하거나 우수합니다.

## 8. 3D 재건 생태계에서 COLMAP의 위치

```
[입력 이미지]
      │
      ▼
  COLMAP (SfM)
  ─ 희소 점군 + 카메라 포즈 생성
      │
      ├──────────────────────────────────────┐
      │                                      │
      ▼                                      ▼
  COLMAP (MVS)                    NeRF / 3DGS 계열
  ─ 밀집 점군, 메쉬 생성           ─ Nerfstudio, Instant-NGP,
                                    3D Gaussian Splatting 등
                                    (COLMAP 포즈를 입력으로 사용)
      │
      ▼
  OpenMVS (대안 MVS)
  ─ 텍스처 품질이 더 중요한 경우
```

### 주요 관련 도구 비교

| 도구 | 역할 | COLMAP과 관계 |
|---|---|---|
| **OpenMVG** | SfM (희소) | COLMAP의 경쟁/대안, 느리지만 학술적 |
| **OpenMVS** | MVS (밀집, 메쉬, 텍스처) | COLMAP SfM과 조합하여 사용 가능 |
| **OpenSfM** | 비디오 기반 SfM | Mapillary에서 개발, 특정 도메인에 강점 |
| **Nerfstudio** | NeRF 학습 프레임워크 | COLMAP 출력을 표준 입력으로 사용 |
| **GLOMAP** | 글로벌 SfM | COLMAP에 통합된 더 빠른 SfM 모드 |
| **MASt3R/DUSt3R** | 학습 기반 SfM 대안 | COLMAP-Free 접근의 새 경쟁자 |

## 참고 자료

- [COLMAP 공식 문서](https://colmap.github.io/)
- [COLMAP GitHub 레포지토리](https://github.com/colmap/colmap)
- [COLMAP Tutorial](https://colmap.github.io/tutorial.html)
- [PyCOLMAP 문서](https://colmap.github.io/pycolmap/index.html)
- [COLMAP Changelog](https://colmap.github.io/changelog.html)
- [GLOMAP GitHub](https://github.com/colmap/glomap)
- [COLMAP-Free 3D Gaussian Splatting (arXiv, CVPR 2024)](https://arxiv.org/abs/2312.07504)
