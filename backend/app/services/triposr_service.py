"""TripoSR fallback service for single-image 3-D reconstruction.

TripoSR generates a 3-D mesh from a single RGB image using a transformer-based
model. It serves as the fallback when ShapeR multi-view reconstruction fails or
when only a single frame is available for a furniture item.

GPU-dependent: real inference requires CUDA. Mock returns placeholder data.
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Mock helpers (shared pattern with shaper_service)
# ---------------------------------------------------------------------------

def _placeholder_glb(output_path: Path) -> None:
    gltf = {
        "asset": {"version": "2.0", "generator": "archithon-triposr-mock"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "furniture_triposr"}],
        "meshes": [{"name": "furniture_triposr", "primitives": [{"attributes": {"POSITION": 0}}]}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"}],
        "bufferViews": [{"buffer": 0, "byteLength": 36}],
        "buffers": [{"byteLength": 36, "uri": "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="}],
    }
    output_path.write_text(json.dumps(gltf), encoding="utf-8")


def _placeholder_thumbnail_b64() -> str:
    try:
        from PIL import Image  # type: ignore

        img = Image.new("RGB", (64, 64), color=(160, 190, 200))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def reconstruct_with_triposr(
    image_path: str | Path,
    output_dir: str | Path,
    item_id: str = "furniture",
) -> dict[str, Any]:
    """Run TripoSR single-image 3-D reconstruction.

    Parameters
    ----------
    image_path: Path to a single RGB/RGBA image of the furniture item.
    output_dir: Directory where the .glb and thumbnail will be saved.
    item_id:    Identifier used for output filenames.

    Returns
    -------
    Dict with keys:
      - glb_path: absolute path to the generated .glb file
      - thumbnail_b64: base64-encoded PNG thumbnail
      - dimensions: estimated {w, h, d} in metres
      - weight_estimate_kg: rough weight estimate
      - mock: True when running without real GPU inference

    TODO: Replace mock with real TripoSR inference:
      1. from tsr.system import TSR  (https://github.com/VAST-AI-Research/TripoSR)
      2. model = TSR.from_pretrained("stabilityai/TripoSR")
      3. model.renderer.set_chunk_size(8192)
      4. model.to("cuda")
      5. image = Image.open(image_path).convert("RGBA")
      6. with torch.no_grad():
             scene_codes = model([image], device="cuda")
             meshes = model.extract_mesh(scene_codes, resolution=256)
      7. Export mesh[0] to GLB.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    glb_path = output_dir / f"{item_id}_triposr.glb"
    _placeholder_glb(glb_path)

    return {
        "glb_path": str(glb_path),
        "thumbnail_b64": _placeholder_thumbnail_b64(),
        "dimensions": {"w": 1.0, "h": 0.75, "d": 0.5},
        "weight_estimate_kg": 20.0,
        "mock": True,
    }
