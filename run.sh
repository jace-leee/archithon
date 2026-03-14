#!/bin/bash
# ~/archithon/run.sh

# SAM 3 + SAM 3D Objects 리포지토리가 PYTHONPATH에 포함되어야 함
export PYTHONPATH="$HOME/sam3:$HOME/sam-3d-objects:$PYTHONPATH"

# SAM 3D Objects 환경변수
export CUDA_HOME=/usr/local/cuda
export CONDA_PREFIX=/usr/local/cuda
export LIDRA_SKIP_INIT=true

# 서버 시작
cd ~/archithon
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 7777 \
    --workers 1 \
    --timeout-keep-alive 120 \
    --log-level info
