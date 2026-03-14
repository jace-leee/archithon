#!/bin/bash
# ~/archithon/run.sh

# SAM 3 리포지토리가 PYTHONPATH에 포함되어야 함
export PYTHONPATH="$HOME/sam3:$PYTHONPATH"

# 서버 시작
cd ~/archithon
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 7777 \
    --workers 1 \
    --timeout-keep-alive 120 \
    --log-level info
