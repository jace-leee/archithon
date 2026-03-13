"""Stage 1: Video -> Floor Plan (Dual-Track A/B)."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.models.schemas import (
    FloorPlanResult,
    FloorPlanStatus,
    FloorPlanUploadResponse,
)
from app.services import llm_floorplan, floorplan_extract, colmap_service
from app.utils.storage import create_job, get_job_dir
from app.utils.video import extract_keyframes

router = APIRouter(prefix="/floorplan", tags=["floorplan"])

# In-memory job store: {job_id: {"status": ..., "progress": ..., "track": ..., "result": ...}}
_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _process_floorplan(job_id: str, video_path: Path, track: str) -> None:
    """Background task: run floor-plan extraction pipeline."""
    try:
        _jobs[job_id]["status"] = "processing"
        _jobs[job_id]["progress"] = 5.0

        job_dir = get_job_dir(job_id)
        frames_dir = job_dir / "frames"

        # Extract frames
        frame_paths = extract_keyframes(str(video_path), str(frames_dir), count=10)
        _jobs[job_id]["progress"] = 30.0

        if track == "A":
            # Track A: COLMAP -> point cloud -> floor plan
            colmap_out = job_dir / "colmap"
            colmap_result = colmap_service.run_colmap_pipeline(
                str(frames_dir), str(colmap_out)
            )
            _jobs[job_id]["progress"] = 65.0
            floor_height = colmap_service.extract_floor_height(colmap_result)
            result = floorplan_extract.extract_floorplan_from_pointcloud(
                colmap_result.get("point_cloud_path", ""),
                str(job_dir / "floorplan"),
                floor_height=floor_height,
            )
        else:
            # Track B: LLM vision
            result = llm_floorplan.generate_floorplan_from_frames(
                frame_paths, str(job_dir)
            )

        _jobs[job_id]["progress"] = 100.0
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = result.model_dump()

    except Exception as exc:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error_message"] = str(exc)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=FloorPlanUploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    video: Annotated[UploadFile, File(description="Room video file")],
    track: Annotated[str, Form(description="Processing track: A (COLMAP) or B (LLM)")] = "B",
) -> FloorPlanUploadResponse:
    """Upload a room video and start floor-plan extraction.

    - **Track A**: COLMAP sparse reconstruction -> point cloud -> floor plan
    - **Track B**: LLM vision analysis -> structured floor plan
    """
    if track not in ("A", "B"):
        raise HTTPException(status_code=400, detail="track must be 'A' or 'B'")

    job_id = str(uuid.uuid4())
    job_dir = create_job(job_id)

    # Save uploaded video
    video_path = job_dir / "video_input.mp4"
    content = await video.read()
    video_path.write_bytes(content)

    _jobs[job_id] = {"status": "processing", "progress": 0.0, "track": track}
    background_tasks.add_task(_process_floorplan, job_id, video_path, track)

    return FloorPlanUploadResponse(job_id=job_id)


@router.get("/{job_id}/status", response_model=FloorPlanStatus)
async def get_status(job_id: str) -> FloorPlanStatus:
    """Poll the processing status of a floor-plan job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return FloorPlanStatus(
        status=job["status"],
        progress=job.get("progress", 0.0),
        track=job.get("track", "B"),
        error_message=job.get("error_message"),
    )


@router.get("/{job_id}/result", response_model=FloorPlanResult)
async def get_result(job_id: str) -> FloorPlanResult:
    """Retrieve the completed floor-plan result."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail=f"Job status: {job['status']}")
    return FloorPlanResult(**job["result"])


@router.post("/mock", response_model=FloorPlanResult)
async def get_mock_result() -> FloorPlanResult:
    """Return a mock floor-plan result immediately (no video required).

    Useful for frontend development without a GPU.
    """
    return llm_floorplan.generate_floorplan_from_frames([], "/tmp/archithon/mock")
