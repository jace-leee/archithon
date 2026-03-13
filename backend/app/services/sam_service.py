"""SAM (Segment Anything Model) texture and mask extraction service.

Uses SAM to:
  1. Detect and segment individual furniture items in a video frame.
  2. Extract masked RGBA crops for ShapeR multi-view input.
  3. Extract texture patches for 3-D mesh UV mapping.

GPU-dependent: real inference requires CUDA + SAM checkpoint (~2.5 GB).
Mock returns bounding-box segmentations and cropped regions.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

_MOCK_FURNITURE_CATEGORIES = [
    {"name": "소파", "type": "sofa", "dimensions": {"w": 2.1, "h": 0.85, "d": 0.9}, "weight_kg": 55},
    {"name": "침대", "type": "bed", "dimensions": {"w": 1.6, "h": 0.5, "d": 2.0}, "weight_kg": 80},
    {"name": "식탁", "type": "table", "dimensions": {"w": 1.2, "h": 0.75, "d": 0.8}, "weight_kg": 35},
    {"name": "의자", "type": "chair", "dimensions": {"w": 0.5, "h": 0.9, "d": 0.5}, "weight_kg": 8},
    {"name": "옷장", "type": "wardrobe", "dimensions": {"w": 1.2, "h": 1.9, "d": 0.6}, "weight_kg": 95},
    {"name": "책상", "type": "desk", "dimensions": {"w": 1.4, "h": 0.75, "d": 0.7}, "weight_kg": 30},
    {"name": "책장", "type": "bookshelf", "dimensions": {"w": 0.9, "h": 1.8, "d": 0.3}, "weight_kg": 45},
    {"name": "커피 테이블", "type": "table", "dimensions": {"w": 1.1, "h": 0.45, "d": 0.6}, "weight_kg": 18},
]


def _placeholder_crop_b64(width: int = 128, height: int = 128, color=(170, 170, 190)) -> str:
    """Return a solid-color PNG crop as base64."""
    try:
        from PIL import Image  # type: ignore

        img = Image.new("RGBA", (width, height), color + (220,))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_furniture_items(
    frame_paths: list[str | Path],
    output_dir: str | Path,
) -> list[dict[str, Any]]:
    """Detect and segment furniture items across video frames using SAM.

    Parameters
    ----------
    frame_paths: Paths to extracted video frames.
    output_dir:  Directory to store masked crops.

    Returns
    -------
    List of detected item dicts, each with:
      - id: unique item identifier
      - name: furniture name (Korean)
      - type: furniture category
      - dimensions: {w, h, d} in metres
      - weight_kg: estimated weight
      - masked_crops: list of paths to RGBA PNG crops
      - thumbnail_b64: base64 thumbnail image
      - mock: True for mock data

    TODO: Replace mock with real SAM inference:
      1. Load SAM: sam = sam_model_registry["vit_h"](checkpoint="sam_vit_h.pth")
      2. predictor = SamPredictor(sam); predictor.set_image(frame_rgb)
      3. masks, _, _ = predictor.predict(...)  # or automatic mask generator
      4. Filter masks by area / class label (use CLIP or GroundingDINO for labels).
      5. For each mask: crop RGBA region, save to output_dir.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    detected: list[dict[str, Any]] = []
    colors = [(200, 180, 160), (160, 180, 200), (180, 200, 160), (200, 160, 180)]

    for idx, category in enumerate(_MOCK_FURNITURE_CATEGORIES):
        item_id = f"item_{idx:03d}"
        crop_dir = output_dir / item_id
        crop_dir.mkdir(exist_ok=True)

        thumbnail = _placeholder_crop_b64(128, 128, colors[idx % len(colors)])

        detected.append({
            "id": item_id,
            "name": category["name"],
            "type": category["type"],
            "dimensions": category["dimensions"],
            "weight_kg": category["weight_kg"],
            "masked_crops": [],   # TODO: fill with actual crop paths
            "thumbnail_b64": thumbnail,
            "mock": True,
        })

    return detected


def extract_texture(
    image_path: str | Path,
    mask_path: str | Path,
    output_path: str | Path,
) -> str:
    """Extract a texture patch from an image using a binary mask.

    Parameters
    ----------
    image_path:  Source RGB image.
    mask_path:   Binary mask (white = keep).
    output_path: Where to save the RGBA texture PNG.

    Returns
    -------
    Path to the saved texture file.

    TODO: Implement with Pillow + numpy: apply mask as alpha channel.
    """
    # Mock: just copy a placeholder
    output_path = Path(output_path)
    output_path.write_bytes(
        base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
    )
    return str(output_path)
