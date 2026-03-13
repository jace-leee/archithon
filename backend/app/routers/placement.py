"""Stage 3: AI Auto Furniture Placement."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import PlacementInput, PlacementResult
from app.services.placement_service import compute_placements

router = APIRouter(prefix="/placement", tags=["placement"])

# Cache placement results keyed by floorplan_id
_placement_cache: dict[str, PlacementResult] = {}

# We import the floorplan job store lazily to avoid circular imports
def _get_floorplan_result(floorplan_id: str) -> dict | None:
    """Try to retrieve a completed floor-plan result dict."""
    try:
        from app.routers.floorplan import _jobs  # lazy import
        job = _jobs.get(floorplan_id)
        if job and job.get("status") == "done":
            return job.get("result")
    except ImportError:
        pass
    return None


@router.post("/compute", response_model=PlacementResult)
async def compute(body: PlacementInput) -> PlacementResult:
    """Compute optimal furniture placements for a given floor plan.

    Retrieves the floor-plan wall data from the completed floorplan job and
    runs the rule-based placement algorithm.
    """
    floorplan_result = _get_floorplan_result(body.floorplan_id)

    walls: list[dict] = []
    pixels_per_meter = 50.0

    if floorplan_result:
        walls = floorplan_result.get("walls", [])
        meta = floorplan_result.get("metadata", {})
        pixels_per_meter = float(meta.get("pixels_per_meter", 50.0))
    else:
        # Allow placement even without a floor plan (use default room size)
        pass

    result = compute_placements(walls, body.furniture_items, pixels_per_meter)
    _placement_cache[body.floorplan_id] = result
    return result


@router.get("/{floorplan_id}", response_model=PlacementResult)
async def get_placement(floorplan_id: str) -> PlacementResult:
    """Retrieve cached placement result for a floor plan."""
    result = _placement_cache.get(floorplan_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No placement result found for floorplan_id '{floorplan_id}'. "
                   "Call POST /placement/compute first.",
        )
    return result


@router.post("/mock", response_model=PlacementResult)
async def mock_placement(body: PlacementInput | None = None) -> PlacementResult:
    """Compute placement using mock floor-plan walls and optionally mock furniture."""
    from app.services.llm_floorplan import _MOCK_WALLS
    from app.services.sam_service import detect_furniture_items

    walls = [w.model_dump() for w in _MOCK_WALLS]

    if body and body.furniture_items:
        furniture_items = body.furniture_items
    else:
        # Use mock furniture when no body provided
        detected = detect_furniture_items([], "/tmp/archithon/mock/furniture")
        furniture_items = [
            {
                "furniture_id": item["id"],
                "dimensions": item["dimensions"],
                "type": item["name"],
            }
            for item in detected
        ]

    return compute_placements(walls, furniture_items, pixels_per_meter=50.0)
