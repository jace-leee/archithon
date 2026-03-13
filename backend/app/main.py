"""Archithon backend — FastAPI application entry point."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import floorplan, furniture, placement, render, cost

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Archithon API",
    description=(
        "AI-powered moving helper: room scanning, furniture reconstruction, "
        "auto placement, photorealistic rendering, and Korean moving cost estimation."
    ),
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS (allow all origins for hackathon)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static file serving for generated assets
# ---------------------------------------------------------------------------

STATIC_ROOT = Path("/tmp/archithon")
STATIC_ROOT.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_ROOT), html=False), name="static")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(floorplan.router, prefix="/api")
app.include_router(furniture.router, prefix="/api")
app.include_router(placement.router, prefix="/api")
app.include_router(render.router, prefix="/api")
app.include_router(cost.router, prefix="/api")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "archithon-backend"}


@app.get("/", tags=["meta"])
async def root() -> dict:
    """Root endpoint with API overview."""
    return {
        "service": "Archithon API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "stages": {
            "1_floorplan": "/api/floorplan",
            "2_furniture": "/api/furniture",
            "3_placement": "/api/placement",
            "4_render": "/api/render",
            "5_cost": "/api/cost",
        },
    }
