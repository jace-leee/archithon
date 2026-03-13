"""Video frame extraction utilities using ffmpeg subprocess."""

from __future__ import annotations

import subprocess
from pathlib import Path


def extract_frames(
    video_path: str | Path,
    output_dir: str | Path,
    fps: float = 1,
) -> list[str]:
    """Extract frames from a video at the given FPS rate.

    Parameters
    ----------
    video_path: Path to the input video file.
    output_dir: Directory to save extracted frames (created if absent).
    fps:        Frames per second to extract (default 1).

    Returns
    -------
    Sorted list of absolute paths to the extracted frame images (PNG).
    """
    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pattern = str(output_dir / "frame_%05d.png")
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-q:v", "2",
        pattern,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")

    frames = sorted(output_dir.glob("frame_*.png"))
    return [str(f) for f in frames]


def extract_keyframes(
    video_path: str | Path,
    output_dir: str | Path,
    count: int = 10,
) -> list[str]:
    """Extract approximately `count` evenly-spaced keyframes from a video.

    Parameters
    ----------
    video_path: Path to the input video file.
    output_dir: Directory to save frames (created if absent).
    count:      Target number of frames to extract.

    Returns
    -------
    Sorted list of absolute paths to the extracted frame images (PNG).
    """
    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # First, probe video duration
    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
    try:
        duration = float(probe_result.stdout.strip())
    except ValueError:
        duration = 60.0  # fallback

    fps = max(count / duration, 0.1)
    return extract_frames(video_path, output_dir, fps=fps)


def get_video_duration(video_path: str | Path) -> float:
    """Return the duration of a video in seconds."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0
