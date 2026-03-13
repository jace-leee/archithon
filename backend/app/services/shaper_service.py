"""ShapeR inference service for 3-D furniture reconstruction.

ShapeR takes a set of masked RGB images of a furniture item and produces a
textured 3-D mesh (.glb). This service wraps the inference call and returns
the path to the generated GLB file.

GPU-dependent: real inference requires a CUDA-capable GPU with ~8 GB VRAM.
Mock implementation returns a placeholder GLB path so the pipeline runs
without GPU hardware.
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _placeholder_glb(output_path: Path) -> None:
    """Write a minimal valid-looking GLB placeholder (JSON-only glTF)."""
    gltf = {
        "asset": {"version": "2.0", "generator": "archithon-mock"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "furniture"}],
        "meshes": [{"name": "furniture", "primitives": [{"attributes": {"POSITION": 0}}]}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"}],
        "bufferViews": [{"buffer": 0, "byteLength": 36}],
        "buffers": [{"byteLength": 36, "uri": "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="}],
    }
    output_path.write_text(json.dumps(gltf), encoding="utf-8")


def _placeholder_thumbnail_b64() -> str:
    """Return a 64×64 grey PNG as base64."""
    try:
        from PIL import Image  # type: ignore

        img = Image.new("RGB", (64, 64), color=(180, 180, 180))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def reconstruct_with_shaper(
    masked_images: list[str | Path],
    output_dir: str | Path,
    item_id: str = "furniture",
) -> dict[str, Any]:
    """Run ShapeR inference to reconstruct a furniture item as a GLB mesh.

    Parameters
    ----------
    masked_images: List of paths to SAM-masked RGBA/RGB images of the item.
    output_dir:    Directory where the .glb and thumbnail will be saved.
    item_id:       Identifier used for output filenames.

    Returns
    -------
    Dict with keys:
      - glb_path: absolute path to the generated .glb file
      - thumbnail_b64: base64-encoded PNG thumbnail
      - dimensions: estimated {w, h, d} in metres
      - mock: True when running without real GPU inference

    TODO: Replace mock with real ShapeR inference:
      1. Load ShapeR model from checkpoint (requires GPU).
      2. Preprocess masked_images (resize, normalise).
      3. Run model.infer(images) -> mesh.
      4. Export mesh to GLB with texture.
      5. Estimate bounding-box dimensions from mesh vertices.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    glb_path = output_dir / f"{item_id}.glb"
    _placeholder_glb(glb_path)

    return {
        "glb_path": str(glb_path),
        "thumbnail_b64": _placeholder_thumbnail_b64(),
        "dimensions": {"w": 1.2, "h": 0.8, "d": 0.6},
        "weight_estimate_kg": 30.0,
        "mock": True,
    }
