"""Stage 2: Video -> 3D Furniture Assets."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.models.schemas import (
    FurnitureDimensions,
    FurnitureItem,
    FurnitureResult,
    FurnitureStatus,
    FurnitureUploadResponse,
)
from app.services import sam_service, shaper_service, triposr_service
from app.utils.storage import create_job, get_job_dir, furniture_item_dir
from app.utils.video import extract_keyframes

router = APIRouter(prefix="/furniture", tags=["furniture"])

_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _process_furniture(job_id: str, video_path: Path) -> None:
    """Background task: detect furniture items and reconstruct 3-D assets."""
    try:
        _jobs[job_id]["status"] = "processing"
        _jobs[job_id]["progress"] = 5.0

        job_dir = get_job_dir(job_id)
        frames_dir = job_dir / "frames"

        # Step 1: Extract frames
        frame_paths = extract_keyframes(str(video_path), str(frames_dir), count=12)
        _jobs[job_id]["progress"] = 20.0

        # Step 2: SAM detection
        furniture_dir = job_dir / "furniture"
        detected_items = sam_service.detect_furniture_items(
            frame_paths, str(furniture_dir)
        )
        _jobs[job_id]["progress"] = 50.0

        # Step 3: 3-D reconstruction per item
        result_items: list[FurnitureItem] = []
        total = len(detected_items) or 1

        for i, item in enumerate(detected_items):
            item_dir = furniture_item_dir(job_id, item["id"])
            crops = item.get("masked_crops", [])

            try:
                if len(crops) >= 2:
                    recon = shaper_service.reconstruct_with_shaper(
                        crops, str(item_dir), item_id=item["id"]
                    )
                else:
                    img_path = crops[0] if crops else str(frames_dir / "frame_00001.png")
                    recon = triposr_service.reconstruct_with_triposr(
                        img_path, str(item_dir), item_id=item["id"]
                    )
            except Exception:
                # Fallback to triposr mock
                recon = triposr_service.reconstruct_with_triposr(
                    "", str(item_dir), item_id=item["id"]
                )

            dims = recon.get("dimensions", item.get("dimensions", {"w": 1.0, "h": 0.8, "d": 0.6}))
            glb_url = f"/static/{job_id}/furniture/{item['id']}/{item['id']}.glb"

            result_items.append(FurnitureItem(
                id=item["id"],
                name=item["name"],
                glb_url=glb_url,
                thumbnail=recon.get("thumbnail_b64", item.get("thumbnail_b64", "")),
                dimensions=FurnitureDimensions(**dims),
                weight_estimate=recon.get(
                    "weight_estimate_kg", item.get("weight_kg", 30.0)
                ),
            ))

            _jobs[job_id]["progress"] = 50.0 + 50.0 * (i + 1) / total

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["progress"] = 100.0
        _jobs[job_id]["result"] = FurnitureResult(furniture=result_items).model_dump()

    except Exception as exc:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error_message"] = str(exc)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=FurnitureUploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    video: Annotated[UploadFile, File(description="Video of furniture items")],
) -> FurnitureUploadResponse:
    """Upload a furniture video and start 3-D asset extraction."""
    job_id = str(uuid.uuid4())
    job_dir = create_job(job_id)

    video_path = job_dir / "video_input.mp4"
    content = await video.read()
    video_path.write_bytes(content)

    _jobs[job_id] = {"status": "processing", "progress": 0.0}
    background_tasks.add_task(_process_furniture, job_id, video_path)

    return FurnitureUploadResponse(job_id=job_id)


@router.get("/{job_id}/status", response_model=FurnitureStatus)
async def get_status(job_id: str) -> FurnitureStatus:
    """Poll the processing status of a furniture extraction job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return FurnitureStatus(
        status=job["status"],
        progress=job.get("progress", 0.0),
        error_message=job.get("error_message"),
    )


@router.get("/{job_id}/result", response_model=FurnitureResult)
async def get_result(job_id: str) -> FurnitureResult:
    """Retrieve the completed furniture asset list."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail=f"Job status: {job['status']}")
    return FurnitureResult(**job["result"])


@router.post("/mock", response_model=FurnitureResult)
async def get_mock_result() -> FurnitureResult:
    """Return mock furniture items immediately (no video required)."""
    detected = sam_service.detect_furniture_items([], "/tmp/archithon/mock/furniture")
    items: list[FurnitureItem] = []
    for item in detected:
        dims = item["dimensions"]
        items.append(FurnitureItem(
            id=item["id"],
            name=item["name"],
            glb_url=f"/static/mock/furniture/{item['id']}/{item['id']}.glb",
            thumbnail=item.get("thumbnail_b64", ""),
            dimensions=FurnitureDimensions(**dims),
            weight_estimate=float(item.get("weight_kg", 30.0)),
        ))
    return FurnitureResult(furniture=items)
