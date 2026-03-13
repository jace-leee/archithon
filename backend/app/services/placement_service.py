"""Rule-based furniture placement algorithm.

Algorithm overview
------------------
1. Derive a usable room polygon from wall segments (or use a default rectangle).
2. Classify furniture by type (bed, sofa, table, chair, etc.).
3. Place large items (bed, sofa) against the longest wall with clearance.
4. Place tables in the center or in front of the sofa.
5. Place chairs around tables.
6. All remaining items are placed in remaining free space.
7. Collision detection uses axis-aligned bounding boxes; minimum 0.6 m walkway.
"""

from __future__ import annotations

import math
from typing import Any

from app.models.schemas import PlacementItem, PlacementResult, Position, Rotation


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WALKWAY_CLEARANCE = 0.6   # meters
WALL_GAP = 0.05           # gap between furniture and wall (meters)

# Furniture type classification keywords (English + Korean)
LARGE_TYPES = {"bed", "sofa", "couch", "wardrobe", "cabinet", "bookshelf", "dresser"}
LARGE_KO = {"침대": "bed", "소파": "sofa", "옷장": "wardrobe", "책장": "bookshelf", "장롱": "wardrobe"}
TABLE_TYPES = {"table", "desk", "dining"}
TABLE_KO = {"식탁": "table", "책상": "desk", "테이블": "table"}
CHAIR_TYPES = {"chair", "stool", "bench"}
CHAIR_KO = {"의자": "chair", "스툴": "stool"}


# ---------------------------------------------------------------------------
# Bounding-box helpers
# ---------------------------------------------------------------------------

class BBox:
    """Axis-aligned bounding box in the XZ plane (meters)."""

    def __init__(self, cx: float, cz: float, w: float, d: float) -> None:
        self.cx = cx
        self.cz = cz
        self.w = w   # X extent
        self.d = d   # Z extent

    @property
    def xmin(self) -> float:
        return self.cx - self.w / 2

    @property
    def xmax(self) -> float:
        return self.cx + self.w / 2

    @property
    def zmin(self) -> float:
        return self.cz - self.d / 2

    @property
    def zmax(self) -> float:
        return self.cz + self.d / 2

    def overlaps(self, other: "BBox", clearance: float = 0.0) -> bool:
        """Return True if this box overlaps other (with optional clearance gap)."""
        return (
            self.xmin - clearance < other.xmax
            and self.xmax + clearance > other.xmin
            and self.zmin - clearance < other.zmax
            and self.zmax + clearance > other.zmin
        )


# ---------------------------------------------------------------------------
# Room geometry
# ---------------------------------------------------------------------------

def _room_bounds(walls: list[dict]) -> tuple[float, float, float, float]:
    """Return (xmin, xmax, zmin, zmax) in meters from pre-scaled wall data."""
    if not walls:
        # Default 5m × 5m room
        return -2.5, 2.5, -2.5, 2.5

    xs: list[float] = []
    zs: list[float] = []

    for w in walls:
        xs += [w.get("x1", 0), w.get("x2", 0)]
        zs += [w.get("y1", 0), w.get("y2", 0)]

    if not xs:
        return -2.5, 2.5, -2.5, 2.5

    return min(xs), max(xs), min(zs), max(zs)


def _classify(item: dict[str, Any]) -> str:
    """Return a normalised furniture type string."""
    item_type = str(item.get("type", item.get("name", ""))).lower()

    # Check Korean keywords first
    for ko, en in LARGE_KO.items():
        if ko in item_type:
            return en
    for ko in TABLE_KO:
        if ko in item_type:
            return "table"
    for ko in CHAIR_KO:
        if ko in item_type:
            return "chair"

    # English keywords
    for t in LARGE_TYPES:
        if t in item_type:
            return t
    for t in TABLE_TYPES:
        if t in item_type:
            return "table"
    for t in CHAIR_TYPES:
        if t in item_type:
            return "chair"
    return "misc"


# ---------------------------------------------------------------------------
# Placement logic
# ---------------------------------------------------------------------------

def _place_against_wall(
    fw: float,
    fd: float,
    wall: str,
    room_xmin: float,
    room_xmax: float,
    room_zmin: float,
    room_zmax: float,
    existing: list[BBox],
    step: float = 0.3,
) -> tuple[float, float, float] | None:
    """Try to place a (fw × fd) item against a given wall.

    Returns (cx, cz, rotation_y) or None if no space found.
    wall: 'north' | 'south' | 'east' | 'west'
    """
    if wall == "north":
        cz = room_zmin + fd / 2 + WALL_GAP
        rotation = 0.0
        x_range = (room_xmin + fw / 2, room_xmax - fw / 2)
        for cx in _frange(x_range[0], x_range[1], step):
            box = BBox(cx, cz, fw, fd)
            if not any(box.overlaps(e, WALKWAY_CLEARANCE) for e in existing):
                return cx, cz, rotation
    elif wall == "south":
        cz = room_zmax - fd / 2 - WALL_GAP
        rotation = math.pi
        x_range = (room_xmin + fw / 2, room_xmax - fw / 2)
        for cx in _frange(x_range[0], x_range[1], step):
            box = BBox(cx, cz, fw, fd)
            if not any(box.overlaps(e, WALKWAY_CLEARANCE) for e in existing):
                return cx, cz, rotation
    elif wall == "west":
        cx = room_xmin + fw / 2 + WALL_GAP
        rotation = -math.pi / 2
        z_range = (room_zmin + fd / 2, room_zmax - fd / 2)
        for cz in _frange(z_range[0], z_range[1], step):
            box = BBox(cx, cz, fw, fd)
            if not any(box.overlaps(e, WALKWAY_CLEARANCE) for e in existing):
                return cx, cz, rotation
    elif wall == "east":
        cx = room_xmax - fw / 2 - WALL_GAP
        rotation = math.pi / 2
        z_range = (room_zmin + fd / 2, room_zmax - fd / 2)
        for cz in _frange(z_range[0], z_range[1], step):
            box = BBox(cx, cz, fw, fd)
            if not any(box.overlaps(e, WALKWAY_CLEARANCE) for e in existing):
                return cx, cz, rotation

    return None


def _frange(start: float, stop: float, step: float):
    """Float range generator."""
    v = start
    while v <= stop + 1e-9:
        yield v
        v += step


def _place_center(
    fw: float,
    fd: float,
    room_xmin: float,
    room_xmax: float,
    room_zmin: float,
    room_zmax: float,
    existing: list[BBox],
    step: float = 0.3,
) -> tuple[float, float, float] | None:
    """Try to place item near the room center, spiralling outward."""
    center_x = (room_xmin + room_xmax) / 2
    center_z = (room_zmin + room_zmax) / 2

    for radius in _frange(0, 3.0, step):
        angles = [0, math.pi / 2, math.pi, 3 * math.pi / 2] if radius > 0 else [0]
        for angle in angles:
            cx = center_x + radius * math.cos(angle)
            cz = center_z + radius * math.sin(angle)
            if (
                cx - fw / 2 < room_xmin or cx + fw / 2 > room_xmax
                or cz - fd / 2 < room_zmin or cz + fd / 2 > room_zmax
            ):
                continue
            box = BBox(cx, cz, fw, fd)
            if not any(box.overlaps(e, WALKWAY_CLEARANCE) for e in existing):
                return cx, cz, 0.0

    return None


def compute_placements(
    walls: list[dict],
    furniture_items: list[dict[str, Any]],
    pixels_per_meter: float = 50.0,
) -> PlacementResult:
    """Compute non-overlapping furniture placements.

    Parameters
    ----------
    walls:            List of WallSegment dicts from the floor plan result.
    furniture_items:  List of dicts with keys: furniture_id, dimensions (w,h,d), type.
    pixels_per_meter: Scale used when converting wall pixel coords to meters.
    """
    # Scale walls to meters
    scaled_walls = []
    for w in walls:
        scaled_walls.append({
            "x1": w.get("x1", 0) / pixels_per_meter,
            "y1": w.get("y1", 0) / pixels_per_meter,
            "x2": w.get("x2", 0) / pixels_per_meter,
            "y2": w.get("y2", 0) / pixels_per_meter,
        })

    room_xmin, room_xmax, room_zmin, room_zmax = _room_bounds(scaled_walls)

    # Compute room dimensions for wall selection
    room_w = room_xmax - room_xmin
    room_d = room_zmax - room_zmin

    # Determine longest wall sides
    if room_w >= room_d:
        primary_walls = ["north", "south", "east", "west"]
    else:
        primary_walls = ["east", "west", "north", "south"]

    placed_boxes: list[BBox] = []
    placements: list[PlacementItem] = []

    # Separate furniture by category
    large_items = [f for f in furniture_items if _classify(f) in LARGE_TYPES]
    table_items = [f for f in furniture_items if _classify(f) == "table"]
    chair_items = [f for f in furniture_items if _classify(f) == "chair"]
    misc_items = [
        f for f in furniture_items
        if _classify(f) not in LARGE_TYPES and _classify(f) not in ("table", "chair")
    ]

    def _try_place(item: dict, prefer_wall: bool = True) -> tuple[float, float, float] | None:
        dims = item.get("dimensions", {})
        fw = float(dims.get("w", 1.0))
        fd = float(dims.get("d", 0.8))

        if prefer_wall:
            for wall in primary_walls:
                result = _place_against_wall(
                    fw, fd, wall,
                    room_xmin, room_xmax, room_zmin, room_zmax,
                    placed_boxes,
                )
                if result:
                    return result

        return _place_center(
            fw, fd,
            room_xmin, room_xmax, room_zmin, room_zmax,
            placed_boxes,
        )

    def _record(item: dict, cx: float, cz: float, rot: float) -> None:
        dims = item.get("dimensions", {})
        fw = float(dims.get("w", 1.0))
        fd = float(dims.get("d", 0.8))
        height = float(dims.get("h", 0.8))
        placed_boxes.append(BBox(cx, cz, fw, fd))
        placements.append(PlacementItem(
            furniture_id=str(item.get("furniture_id", item.get("id", "unknown"))),
            position=Position(x=cx, y=height / 2, z=cz),
            rotation=Rotation(y=rot),
            scale=1.0,
        ))

    # Place large items against walls
    for item in large_items:
        result = _try_place(item, prefer_wall=True)
        if result:
            _record(item, *result)
        else:
            # Fallback: place at room edge ignoring clearance
            dims = item.get("dimensions", {})
            _record(item, room_xmin + 0.5, room_zmin + 0.5, 0.0)

    # Place tables near center
    for item in table_items:
        result = _try_place(item, prefer_wall=False)
        if result:
            _record(item, *result)

    # Place chairs around tables (or center if no tables)
    for item in chair_items:
        result = _try_place(item, prefer_wall=False)
        if result:
            _record(item, *result)

    # Place misc items
    for item in misc_items:
        result = _try_place(item, prefer_wall=True)
        if result:
            _record(item, *result)

    # Center all placements around origin for Three.js (room center → 0,0)
    center_x = (room_xmin + room_xmax) / 2
    center_z = (room_zmin + room_zmax) / 2
    for p in placements:
        p.position.x -= center_x
        p.position.z -= center_z

    return PlacementResult(placements=placements)
