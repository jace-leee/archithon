"""LLM vision floor plan service (Track B).

Uses a multimodal LLM (e.g., GPT-4o or Claude) to analyse video frames and
produce a structured floor-plan description, which is then rendered as an
SVG/PNG with wall segments and room polygons.

GPU is not required for this track — only an API key.
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from typing import Any

from app.models.schemas import FloorPlanMetadata, FloorPlanResult, Room, WallSegment


# ---------------------------------------------------------------------------
# Mock floor-plan geometry (realistic 2-bedroom apartment, ~60 m²)
# ---------------------------------------------------------------------------

_MOCK_WALLS = [
    # Outer boundary (clockwise, 800 × 600 pixel canvas, 50 px/m → 16m × 12m)
    WallSegment(x1=50, y1=50, x2=750, y2=50),    # top
    WallSegment(x1=750, y1=50, x2=750, y2=550),  # right
    WallSegment(x1=750, y1=550, x2=50, y2=550),  # bottom
    WallSegment(x1=50, y1=550, x2=50, y2=50),    # left
    # Interior wall dividing living room and bedroom
    WallSegment(x1=400, y1=50, x2=400, y2=350),
    # Kitchen partition
    WallSegment(x1=50, y1=350, x2=400, y2=350),
]

_MOCK_ROOMS = [
    Room(
        polygon=[[50, 50], [400, 50], [400, 350], [50, 350]],
        label="거실 / Living Room",
    ),
    Room(
        polygon=[[400, 50], [750, 50], [750, 350], [400, 350]],
        label="침실 / Bedroom",
    ),
    Room(
        polygon=[[50, 350], [400, 350], [400, 550], [50, 550]],
        label="주방 / Kitchen",
    ),
    Room(
        polygon=[[400, 350], [750, 350], [750, 550], [400, 550]],
        label="욕실 / Bathroom",
    ),
]

MOCK_PIXELS_PER_METER = 50.0


# ---------------------------------------------------------------------------
# SVG generation
# ---------------------------------------------------------------------------

def _generate_svg(
    walls: list[WallSegment],
    rooms: list[Room],
    width: int = 800,
    height: int = 600,
) -> str:
    """Render walls and room labels as an SVG string."""
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
             f'viewBox="0 0 {width} {height}" style="background:#f9f9f9">']

    # Room fills
    colors = ["#e8f4e8", "#e8e8f4", "#f4f4e8", "#f4e8e8", "#e8f4f4"]
    for i, room in enumerate(rooms):
        pts = " ".join(f"{p[0]},{p[1]}" for p in room.polygon)
        fill = colors[i % len(colors)]
        lines.append(f'  <polygon points="{pts}" fill="{fill}" stroke="none"/>')

    # Room labels
    for room in rooms:
        if not room.polygon:
            continue
        cx = sum(p[0] for p in room.polygon) / len(room.polygon)
        cy = sum(p[1] for p in room.polygon) / len(room.polygon)
        lines.append(
            f'  <text x="{cx:.0f}" y="{cy:.0f}" text-anchor="middle" '
            f'font-family="sans-serif" font-size="14" fill="#333">{room.label}</text>'
        )

    # Walls
    for w in walls:
        lines.append(
            f'  <line x1="{w.x1}" y1="{w.y1}" x2="{w.x2}" y2="{w.y2}" '
            f'stroke="#222" stroke-width="3"/>'
        )

    lines.append("</svg>")
    return "\n".join(lines)


def _generate_png_base64(
    walls: list[WallSegment],
    rooms: list[Room],
    width: int = 800,
    height: int = 600,
) -> str:
    """Render a simple PNG floor plan and return as base64. Uses Pillow."""
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore

        img = Image.new("RGB", (width, height), color=(249, 249, 249))
        draw = ImageDraw.Draw(img)

        fill_colors = [
            (232, 244, 232), (232, 232, 244), (244, 244, 232),
            (244, 232, 232), (232, 244, 244),
        ]
        for i, room in enumerate(rooms):
            if room.polygon:
                pts = [(int(p[0]), int(p[1])) for p in room.polygon]
                draw.polygon(pts, fill=fill_colors[i % len(fill_colors)])

        for w in walls:
            draw.line(
                [(int(w.x1), int(w.y1)), (int(w.x2), int(w.y2))],
                fill=(34, 34, 34),
                width=3,
            )

        for room in rooms:
            if room.polygon:
                cx = int(sum(p[0] for p in room.polygon) / len(room.polygon))
                cy = int(sum(p[1] for p in room.polygon) / len(room.polygon))
                draw.text((cx, cy), room.label, fill=(51, 51, 51), anchor="mm")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()

    except ImportError:
        # Return a 1×1 transparent PNG
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyse_frames_with_llm(
    frame_paths: list[str | Path],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Send sampled frames to a multimodal LLM and get a floor-plan description.

    TODO: Replace with real API call to GPT-4o / Claude 3 vision:
      1. Base64-encode up to 5 representative frames.
      2. Send with a prompt asking for room dimensions, wall layout, and labels.
      3. Parse the JSON response into wall segments and room polygons.
    """
    # Mock: return a structured floor-plan description
    return {
        "rooms": [
            {"label": "거실", "width_m": 7.0, "depth_m": 6.0},
            {"label": "침실", "width_m": 7.0, "depth_m": 6.0},
            {"label": "주방", "width_m": 7.0, "depth_m": 4.0},
            {"label": "욕실", "width_m": 7.0, "depth_m": 4.0},
        ],
        "total_area_m2": 60.0,
        "mock": True,
    }


def generate_floorplan_from_frames(
    frame_paths: list[str | Path],
    job_dir: str | Path,
    api_key: str | None = None,
) -> FloorPlanResult:
    """Generate a floor plan using the LLM vision track (Track B).

    Parameters
    ----------
    frame_paths: Paths to extracted video frames.
    job_dir:     Job working directory where outputs are saved.
    api_key:     Optional LLM API key (falls back to env var).

    Returns
    -------
    FloorPlanResult with base64 PNG, SVG, walls, rooms, and metadata.
    """
    # TODO: call analyse_frames_with_llm() and convert LLM output to wall geometry
    walls = _MOCK_WALLS
    rooms = _MOCK_ROOMS

    svg = _generate_svg(walls, rooms)
    png_b64 = _generate_png_base64(walls, rooms)

    # Save SVG to job dir
    job_dir = Path(job_dir)
    floorplan_dir = job_dir / "floorplan"
    floorplan_dir.mkdir(parents=True, exist_ok=True)
    (floorplan_dir / "floorplan.svg").write_text(svg, encoding="utf-8")

    return FloorPlanResult(
        floorplan_image=png_b64,
        floorplan_svg=svg,
        walls=walls,
        rooms=rooms,
        metadata=FloorPlanMetadata(pixels_per_meter=MOCK_PIXELS_PER_METER),
        source_track="B",
    )
