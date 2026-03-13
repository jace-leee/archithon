#!/usr/bin/env bash
set -e

# Archithon - AI 이사 도우미
# Backend (FastAPI) + Frontend (Vite) 동시 실행

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT=8000
FRONTEND_PORT=5173

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# Backend
echo "Starting backend on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!

# Frontend
echo "Starting frontend on port $FRONTEND_PORT..."
cd "$FRONTEND_DIR"
npx vite --port $FRONTEND_PORT &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  Archithon AI 이사 도우미"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  API Docs: http://localhost:$BACKEND_PORT/docs"
echo "========================================="
echo "Press Ctrl+C to stop"
echo ""

wait
