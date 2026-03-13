# Open Questions

## archithon-implementation - 2026-03-11

- [ ] Elice Cloud GPU 인스턴스 사양 확정 (A100 40GB vs 80GB) -- ShapeR + COLMAP + ControlNet 동시 로드 시 80GB 필요할 수 있음
- [ ] Elice Cloud에서 외부 포트 노출 방식 (SSH 터널 vs 공개 IP vs ngrok) -- 프론트엔드 -> GPU 백엔드 통신 방식 결정 필요
- [ ] ShapeR 모델 가중치 사전 다운로드 필요 여부 -- HuggingFace에서 대용량 다운로드 시 해커톤 네트워크에서 시간 소요 가능
- [ ] COLMAP -> floor plan 변환에서 "벽"의 정의 기준 -- 높이 0.5~2.5m 필터링이 모든 실내에 적용 가능한지 검증 필요
- [ ] 데모 발표 시 처리 대기 시간 핸들링 전략 -- 사전 캐시된 결과를 보여줄지, 실시간 처리를 기다릴지
- [ ] 가구 텍스처 매핑 품질 목표 -- ShapeR .glb 출력이 텍스처를 포함하는지, SAM 크롭 텍스처를 별도로 입혀야 하는지
- [ ] 이사 비용 계산에서 거리 API 사용 여부 -- 카카오 맵 API 키 필요, 무료 쿼터 확인 필요 (또는 직선거리로 단순화)
