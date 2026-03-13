"""Stage 4: AI Rendering (ControlNet)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.models.schemas import RenderInput, RenderResult
from app.services.render_service import render_scene
from app.utils.storage import create_job, get_job_dir

router = APIRouter(prefix="/render", tags=["render"])

_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _process_render(job_id: str, scene_b64: str, depth_b64: str, prompt: str) -> None:
    try:
        _jobs[job_id]["status"] = "processing"
        job_dir = get_job_dir(job_id)
        render_dir = job_dir / "render"

        result = render_scene(
            scene_image_b64=scene_b64,
            depth_map_b64=depth_b64,
            prompt=prompt,
            output_dir=str(render_dir),
        )

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = result["rendered_image_b64"]
    except Exception as exc:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error_message"] = str(exc)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/submit")
async def submit_render(body: RenderInput, background_tasks: BackgroundTasks) -> dict:
    """Submit a rendering job.

    Returns a job_id that can be polled at GET /render/{job_id}/status.
    """
    job_id = str(uuid.uuid4())
    create_job(job_id)
    _jobs[job_id] = {"status": "processing"}

    background_tasks.add_task(
        _process_render,
        job_id,
        body.scene_image,
        body.depth_map,
        body.prompt,
    )
    return {"job_id": job_id}


@router.get("/{job_id}/status")
async def get_status(job_id: str) -> dict:
    """Poll rendering job status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    response = {"status": job["status"]}
    if job.get("error_message"):
        response["error_message"] = job["error_message"]
    return response


@router.get("/{job_id}/result", response_model=RenderResult)
async def get_result(job_id: str) -> RenderResult:
    """Retrieve the rendered image (base64 JPEG)."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail=f"Job status: {job['status']}")
    return RenderResult(rendered_image=job["result"])


@router.post("/sync", response_model=RenderResult)
async def render_sync(body: RenderInput) -> RenderResult:
    """Synchronous render endpoint (blocks until complete, for small images)."""
    result = render_scene(
        scene_image_b64=body.scene_image,
        depth_map_b64=body.depth_map,
        prompt=body.prompt,
    )
    return RenderResult(rendered_image=result["rendered_image_b64"])
