"""COLMAP pipeline service (Track A: Structure-from-Motion).

This service orchestrates COLMAP to reconstruct a 3-D point cloud from a set
of video frames, then produces camera poses and a sparse point cloud that can
be consumed by the floor-plan extraction step.

GPU-dependent code is stubbed out with mock returns so the rest of the
pipeline can run without a GPU / COLMAP installation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

ColmapResult = dict[str, Any]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_colmap_pipeline(
    frames_dir: str | Path,
    output_dir: str | Path,
    use_gpu: bool = True,
) -> ColmapResult:
    """Run the full COLMAP sparse reconstruction pipeline.

    Parameters
    ----------
    frames_dir:  Directory containing input frame images (JPEG/PNG).
    output_dir:  Directory where COLMAP workspace files will be written.
    use_gpu:     Whether to enable GPU-accelerated feature extraction.

    Returns
    -------
    A dict containing:
      - sparse_model_path: path to the sparse model directory
      - num_images: number of registered images
      - num_points: number of 3-D points
      - cameras: list of camera intrinsics dicts
      - point_cloud_path: path to the exported PLY file (if available)

    TODO: Replace mock implementation with real COLMAP subprocess calls:
      1. colmap feature_extractor
      2. colmap exhaustive_matcher (or sequential_matcher for video)
      3. colmap mapper
      4. colmap model_converter (to TXT)
      5. colmap point_cloud_converter (to PLY)
    """
    frames_dir = Path(frames_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frames = sorted(frames_dir.glob("*.png")) + sorted(frames_dir.glob("*.jpg"))
    num_frames = len(frames)

    # --- MOCK IMPLEMENTATION ---
    mock_result: ColmapResult = {
        "sparse_model_path": str(output_dir / "sparse" / "0"),
        "num_images": num_frames,
        "num_points": num_frames * 200,
        "cameras": [
            {
                "id": 1,
                "model": "PINHOLE",
                "width": 1920,
                "height": 1080,
                "fx": 1200.0,
                "fy": 1200.0,
                "cx": 960.0,
                "cy": 540.0,
            }
        ],
        "point_cloud_path": str(output_dir / "points.ply"),
        "mock": True,
    }

    # Write a placeholder result file
    (output_dir / "colmap_result.json").write_text(
        json.dumps(mock_result, indent=2), encoding="utf-8"
    )

    return mock_result


def extract_floor_height(colmap_result: ColmapResult) -> float:
    """Estimate the floor height (Y coordinate) from COLMAP camera poses.

    TODO: Implement by finding the median minimum Y across all registered
    camera translations, or by fitting a plane to low-Y point cloud points.
    """
    # Mock: assume floor is at Y = 0
    return 0.0
