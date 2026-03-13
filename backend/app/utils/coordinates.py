"""Coordinate conversion utilities between floor-plan pixels and Three.js world space.

Conventions
-----------
Floor plan:
    - Unit: pixels
    - Origin: top-left corner
    - Axes: x -> right, y -> down

Three.js world:
    - Unit: meters  (1 Three.js unit = 1 meter)
    - Origin: center of the floor plan
    - Axes: x -> right (East), z -> towards viewer (South), y -> up
"""

from __future__ import annotations


def pixel_to_world(
    px: float,
    py: float,
    pixels_per_meter: float,
    image_width: int,
    image_height: int,
) -> tuple[float, float]:
    """Convert floor-plan pixel coordinates to Three.js world (x, z).

    Parameters
    ----------
    px, py:           Pixel coordinates (origin top-left).
    pixels_per_meter: Scale factor.
    image_width/height: Pixel dimensions of the floor-plan image.

    Returns
    -------
    (x, z) in meters, origin at center of the floor plan.
    """
    cx = image_width / 2.0
    cy = image_height / 2.0
    x = (px - cx) / pixels_per_meter
    z = (py - cy) / pixels_per_meter
    return x, z


def world_to_pixel(
    x: float,
    z: float,
    pixels_per_meter: float,
    image_width: int,
    image_height: int,
) -> tuple[float, float]:
    """Convert Three.js world (x, z) coordinates to floor-plan pixels.

    Parameters
    ----------
    x, z:             World coordinates in meters.
    pixels_per_meter: Scale factor.
    image_width/height: Pixel dimensions of the floor-plan image.

    Returns
    -------
    (px, py) pixel coordinates (origin top-left).
    """
    cx = image_width / 2.0
    cy = image_height / 2.0
    px = x * pixels_per_meter + cx
    py = z * pixels_per_meter + cy
    return px, py


def meters_to_pixels(meters: float, pixels_per_meter: float) -> float:
    """Convert a distance in meters to pixels."""
    return meters * pixels_per_meter


def pixels_to_meters(pixels: float, pixels_per_meter: float) -> float:
    """Convert a distance in pixels to meters."""
    return pixels / pixels_per_meter
