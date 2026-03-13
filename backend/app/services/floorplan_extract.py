"""Floor-plan extraction from COLMAP point cloud (Track A continuation).

Takes the sparse 3-D point cloud produced by COLMAP and extracts a 2-D
floor plan by:
  1. Slicing the point cloud at floor + ~1.2 m to get wall cross-sections.
  2. Projecting the slice onto the XZ plane.
  3. Running a Hough-line / alpha-shape / occupancy-grid approach to find walls.
  4. Fitting wall segments and inferring room polygons.
"""

from __future__ import annotations

import io
import base64
from pathlib import Path
from typing import Any

from app.models.schemas import FloorPlanMetadata, FloorPlanResult, Room, WallSegment


# ---------------------------------------------------------------------------
# Default constants
# ---------------------------------------------------------------------------

DEFAULT_PIXELS_PER_METER = 50   # 50 px = 1 m
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600


# ---------------------------------------------------------------------------
# Mock implementation
# ---------------------------------------------------------------------------

def _mock_walls() -> list[WallSegment]:
    """Return a realistic mock set of wall segments in pixel space."""
    return [
        WallSegment(x1=50, y1=50, x2=750, y2=50),
        WallSegment(x1=750, y1=50, x2=750, y2=550),
        WallSegment(x1=750, y1=550, x2=50, y2=550),
        WallSegment(x1=50, y1=550, x2=50, y2=50),
        WallSegment(x1=420, y1=50, x2=420, y2=380),
        WallSegment(x1=50, y1=380, x2=420, y2=380),
    ]


def _mock_rooms() -> list[Room]:
    return [
        Room(polygon=[[50, 50], [420, 50], [420, 380], [50, 380]], label="거실"),
        Room(polygon=[[420, 50], [750, 50], [750, 380], [420, 380]], label="침실"),
        Room(polygon=[[50, 380], [420, 380], [420, 550], [50, 550]], label="주방"),
        Room(polygon=[[420, 380], [750, 380], [750, 550], [420, 550]], label="욕실"),
    ]


def _mock_png_b64() -> str:
    """Return a tiny placeholder PNG in base64."""
    try:
        from PIL import Image, ImageDraw  # type: ignore

        img = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), (249, 249, 249))
        draw = ImageDraw.Draw(img)
        for wall in _mock_walls():
            draw.line(
                [(int(wall.x1), int(wall.y1)), (int(wall.x2), int(wall.y2))],
                fill=(34, 34, 34),
                width=4,
            )
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_floorplan_from_pointcloud(
    point_cloud_path: str | Path,
    output_dir: str | Path,
    floor_height: float = 0.0,
    slice_height: float = 1.2,
    pixels_per_meter: int = DEFAULT_PIXELS_PER_METER,
) -> FloorPlanResult:
    """Extract a 2-D floor plan from a PLY point cloud.

    Parameters
    ----------
    point_cloud_path: Path to the .ply file from COLMAP.
    output_dir:       Directory for output images and data.
    floor_height:     Y coordinate of the floor plane (metres).
    slice_height:     Height above floor to slice for wall detection (metres).
    pixels_per_meter: Rendering scale.

    Returns
    -------
    FloorPlanResult with pixel-space wall segments and room polygons.

    TODO: Replace mock with real implementation:
      1. Load PLY with open3d or numpy-plyfile.
      2. Slice points in [floor_height, floor_height + slice_height].
      3. Project to XZ, build occupancy grid.
      4. Run Hough transform or alpha-shape to find wall segments.
      5. Fit rooms using connected-component analysis.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    walls = _mock_walls()
    rooms = _mock_rooms()
    png_b64 = _mock_png_b64()

    return FloorPlanResult(
        floorplan_image=png_b64,
        floorplan_svg=None,
        walls=walls,
        rooms=rooms,
        metadata=FloorPlanMetadata(pixels_per_meter=float(pixels_per_meter)),
        source_track="A",
    )
