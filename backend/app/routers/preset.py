"""Preset management — save, load, list, download project results."""

from __future__ import annotations

import json
import shutil
import uuid
import base64
import zipfile
import io
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/presets", tags=["presets"])

PRESETS_DIR = Path(__file__).resolve().parents[3] / "presets"
PRESETS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PresetMeta(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: str
    has_floorplan: bool = False
    has_furniture: bool = False
    has_placements: bool = False
    has_render: bool = False
    has_cost: bool = False
    furniture_count: int = 0
    file_list: list[str] = []


class SavePresetRequest(BaseModel):
    name: str
    description: str = ""
    floorplan: Optional[dict] = None
    furniture: list[dict] = []
    placements: list[dict] = []
    rendered_image: Optional[str] = None  # base64
    cost_result: Optional[dict] = None


class PresetData(BaseModel):
    meta: PresetMeta
    floorplan: Optional[dict] = None
    furniture: list[dict] = []
    placements: list[dict] = []
    rendered_image: Optional[str] = None
    cost_result: Optional[dict] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_preset_dir(preset_id: str) -> Path:
    p = PRESETS_DIR / preset_id
    if not p.exists():
        raise HTTPException(status_code=404, detail="Preset not found")
    return p


def _read_meta(preset_dir: Path) -> PresetMeta:
    meta_file = preset_dir / "meta.json"
    if not meta_file.exists():
        raise HTTPException(status_code=404, detail="Preset metadata not found")
    return PresetMeta(**json.loads(meta_file.read_text(encoding="utf-8")))


def _save_base64_file(data: str, dest: Path) -> None:
    """Save a base64-encoded string as a binary file."""
    # Strip data URI prefix if present
    if "," in data and data.startswith("data:"):
        data = data.split(",", 1)[1]
    dest.write_bytes(base64.b64decode(data))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/save", response_model=PresetMeta)
async def save_preset(req: SavePresetRequest):
    """Save current project state as a named preset."""
    preset_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    preset_dir = PRESETS_DIR / preset_id
    preset_dir.mkdir(parents=True, exist_ok=True)

    file_list: list[str] = []

    # Save floorplan
    if req.floorplan:
        fp_dir = preset_dir / "floorplan"
        fp_dir.mkdir(exist_ok=True)
        # Save image as PNG
        if req.floorplan.get("floorplan_image"):
            _save_base64_file(req.floorplan["floorplan_image"], fp_dir / "floorplan.png")
            file_list.append("floorplan/floorplan.png")
        # Save SVG if present
        if req.floorplan.get("floorplan_svg"):
            (fp_dir / "floorplan.svg").write_text(req.floorplan["floorplan_svg"], encoding="utf-8")
            file_list.append("floorplan/floorplan.svg")
        # Save structure data (walls, rooms, metadata) as JSON
        structure = {
            "walls": req.floorplan.get("walls", []),
            "rooms": req.floorplan.get("rooms", []),
            "metadata": req.floorplan.get("metadata", {}),
            "source_track": req.floorplan.get("source_track", "A"),
        }
        (fp_dir / "structure.json").write_text(
            json.dumps(structure, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        file_list.append("floorplan/structure.json")

    # Save furniture
    if req.furniture:
        furn_dir = preset_dir / "furniture"
        furn_dir.mkdir(exist_ok=True)
        for item in req.furniture:
            item_dir = furn_dir / item["id"]
            item_dir.mkdir(exist_ok=True)
            # Save thumbnail as PNG
            if item.get("thumbnail"):
                _save_base64_file(item["thumbnail"], item_dir / "thumbnail.png")
                file_list.append(f"furniture/{item['id']}/thumbnail.png")
            # Save item metadata
            item_meta = {
                "id": item["id"],
                "name": item["name"],
                "dimensions": item.get("dimensions", {}),
                "weight_estimate": item.get("weight_estimate", 0),
                "glb_url": item.get("glb_url", ""),
            }
            (item_dir / "info.json").write_text(
                json.dumps(item_meta, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            file_list.append(f"furniture/{item['id']}/info.json")

    # Save placements
    if req.placements:
        (preset_dir / "placements.json").write_text(
            json.dumps(req.placements, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        file_list.append("placements.json")

    # Save rendered image
    if req.rendered_image:
        _save_base64_file(req.rendered_image, preset_dir / "render.png")
        file_list.append("render.png")

    # Save cost result
    if req.cost_result:
        (preset_dir / "cost.json").write_text(
            json.dumps(req.cost_result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        file_list.append("cost.json")

    # Write meta
    meta = PresetMeta(
        id=preset_id,
        name=req.name,
        description=req.description,
        created_at=datetime.now().isoformat(),
        has_floorplan=req.floorplan is not None,
        has_furniture=len(req.furniture) > 0,
        has_placements=len(req.placements) > 0,
        has_render=req.rendered_image is not None,
        has_cost=req.cost_result is not None,
        furniture_count=len(req.furniture),
        file_list=file_list,
    )
    (preset_dir / "meta.json").write_text(
        meta.model_dump_json(indent=2), encoding="utf-8"
    )

    return meta


@router.get("/list", response_model=list[PresetMeta])
async def list_presets():
    """List all saved presets."""
    presets: list[PresetMeta] = []
    if not PRESETS_DIR.exists():
        return presets
    for child in sorted(PRESETS_DIR.iterdir(), reverse=True):
        if child.is_dir():
            meta_file = child / "meta.json"
            if meta_file.exists():
                try:
                    presets.append(PresetMeta(**json.loads(meta_file.read_text(encoding="utf-8"))))
                except Exception:
                    pass
    return presets


@router.get("/{preset_id}", response_model=PresetData)
async def load_preset(preset_id: str):
    """Load a preset with all data for restoring project state."""
    preset_dir = _get_preset_dir(preset_id)
    meta = _read_meta(preset_dir)

    data: dict = {"meta": meta.model_dump()}

    # Load floorplan
    fp_dir = preset_dir / "floorplan"
    if fp_dir.exists():
        floorplan: dict = {}
        png = fp_dir / "floorplan.png"
        if png.exists():
            floorplan["floorplan_image"] = base64.b64encode(png.read_bytes()).decode()
        svg = fp_dir / "floorplan.svg"
        if svg.exists():
            floorplan["floorplan_svg"] = svg.read_text(encoding="utf-8")
        structure_file = fp_dir / "structure.json"
        if structure_file.exists():
            structure = json.loads(structure_file.read_text(encoding="utf-8"))
            floorplan.update(structure)
        data["floorplan"] = floorplan

    # Load furniture
    furn_dir = preset_dir / "furniture"
    if furn_dir.exists():
        items = []
        for item_dir in sorted(furn_dir.iterdir()):
            if item_dir.is_dir():
                info_file = item_dir / "info.json"
                if info_file.exists():
                    item = json.loads(info_file.read_text(encoding="utf-8"))
                    thumb = item_dir / "thumbnail.png"
                    if thumb.exists():
                        item["thumbnail"] = base64.b64encode(thumb.read_bytes()).decode()
                    items.append(item)
        data["furniture"] = items

    # Load placements
    placements_file = preset_dir / "placements.json"
    if placements_file.exists():
        data["placements"] = json.loads(placements_file.read_text(encoding="utf-8"))

    # Load rendered image
    render_file = preset_dir / "render.png"
    if render_file.exists():
        data["rendered_image"] = base64.b64encode(render_file.read_bytes()).decode()

    # Load cost
    cost_file = preset_dir / "cost.json"
    if cost_file.exists():
        data["cost_result"] = json.loads(cost_file.read_text(encoding="utf-8"))

    return PresetData(**data)


@router.delete("/{preset_id}")
async def delete_preset(preset_id: str):
    """Delete a preset."""
    preset_dir = _get_preset_dir(preset_id)
    shutil.rmtree(preset_dir, ignore_errors=True)
    return {"status": "deleted", "id": preset_id}


# ---------------------------------------------------------------------------
# Download endpoints
# ---------------------------------------------------------------------------

@router.get("/{preset_id}/download/zip")
async def download_preset_zip(preset_id: str):
    """Download entire preset as a ZIP file."""
    preset_dir = _get_preset_dir(preset_id)
    meta = _read_meta(preset_dir)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in preset_dir.rglob("*"):
            if file_path.is_file():
                arcname = f"{meta.name}/{file_path.relative_to(preset_dir)}"
                zf.write(file_path, arcname)
    buf.seek(0)

    safe_name = meta.name.replace(" ", "_").replace("/", "_")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.get("/{preset_id}/download/{file_path:path}")
async def download_preset_file(preset_id: str, file_path: str):
    """Download a specific file from a preset."""
    preset_dir = _get_preset_dir(preset_id)
    target = (preset_dir / file_path).resolve()

    # Security: ensure path is within preset dir
    if not str(target).startswith(str(preset_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(target),
        filename=target.name,
        media_type="application/octet-stream",
    )
