from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# FloorPlan models
# ---------------------------------------------------------------------------

class FloorPlanUploadResponse(BaseModel):
    job_id: str


class FloorPlanStatus(BaseModel):
    status: Literal["processing", "done", "error"]
    progress: float  # 0-100
    track: Literal["A", "B"]
    error_message: Optional[str] = None


class WallSegment(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Room(BaseModel):
    polygon: list[list[float]]  # [[x, y], ...]
    label: str


class FloorPlanMetadata(BaseModel):
    pixels_per_meter: float
    origin: str = "top-left"
    unit: str = "pixel"


class FloorPlanResult(BaseModel):
    floorplan_image: str  # base64
    floorplan_svg: Optional[str] = None
    walls: list[WallSegment]
    rooms: list[Room]
    metadata: FloorPlanMetadata
    source_track: Literal["A", "B"]


# ---------------------------------------------------------------------------
# Furniture models
# ---------------------------------------------------------------------------

class FurnitureDimensions(BaseModel):
    w: float  # meters
    h: float  # meters
    d: float  # meters


class FurnitureItem(BaseModel):
    id: str
    name: str
    glb_url: str
    thumbnail: str  # base64
    dimensions: FurnitureDimensions
    weight_estimate: float  # kg


class FurnitureResult(BaseModel):
    furniture: list[FurnitureItem]


class FurnitureUploadResponse(BaseModel):
    job_id: str


class FurnitureStatus(BaseModel):
    status: Literal["processing", "done", "error"]
    progress: float  # 0-100
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# Placement models
# ---------------------------------------------------------------------------

class PlacementInput(BaseModel):
    floorplan_id: str
    furniture_items: list[dict]  # [{furniture_id, dimensions:{w,h,d}, type}]


class Position(BaseModel):
    x: float
    y: float
    z: float


class Rotation(BaseModel):
    y: float  # radians


class PlacementItem(BaseModel):
    furniture_id: str
    position: Position
    rotation: Rotation
    scale: float = 1.0


class PlacementResult(BaseModel):
    placements: list[PlacementItem]


# ---------------------------------------------------------------------------
# Render models
# ---------------------------------------------------------------------------

class RenderInput(BaseModel):
    scene_image: str  # base64
    depth_map: str    # base64
    prompt: str


class RenderResult(BaseModel):
    rendered_image: str  # base64


# ---------------------------------------------------------------------------
# Cost models
# ---------------------------------------------------------------------------

class ElevatorInfo(BaseModel):
    from_has: bool
    to_has: bool


class CostInput(BaseModel):
    furniture_items: list[dict] = []  # [{name, dimensions:{w,h,d}, weight_estimate}]
    from_address: str = ""
    to_address: str = ""
    from_floor: int = 1
    to_floor: int = 1
    from_elevator: bool = False
    to_elevator: bool = False


class CostBreakdown(BaseModel):
    item: str
    amount: int
    description: str


class CostResult(BaseModel):
    base_cost: int
    distance_cost: int
    floor_cost: int
    furniture_cost: int
    total: int
    breakdown: list[CostBreakdown]
