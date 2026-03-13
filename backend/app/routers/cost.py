"""Stage 5: Moving Cost Estimation."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.schemas import CostInput, CostResult
from app.services.cost_service import calculate_cost

router = APIRouter(prefix="/cost", tags=["cost"])


@router.post("/estimate", response_model=CostResult)
async def estimate_cost(body: CostInput) -> CostResult:
    """Calculate a moving cost estimate for a Korean household move.

    Cost breakdown:
    - **기본 운송료**: 300,000 KRW (1-ton truck)
    - **거리 운송료**: distance_km × 1,000 KRW
    - **계단 작업비**: 30,000 KRW per floor (when no elevator)
    - **가구 부피료**: volume_m³ × 500,000 KRW + heavy-item surcharge
    """
    return calculate_cost(body)


@router.post("/estimate/mock", response_model=CostResult)
async def estimate_cost_mock(body: CostInput | None = None) -> CostResult:
    """Return a cost estimate using provided data or sample data."""
    if body and body.furniture_items:
        return calculate_cost(body)
    sample = CostInput(
        furniture_items=[
            {"name": "소파", "dimensions": {"w": 2.1, "h": 0.85, "d": 0.9}, "weight": 55},
            {"name": "침대", "dimensions": {"w": 1.6, "h": 0.5, "d": 2.0}, "weight": 80},
            {"name": "식탁", "dimensions": {"w": 1.2, "h": 0.75, "d": 0.8}, "weight": 35},
            {"name": "의자 ×4", "dimensions": {"w": 0.5, "h": 0.9, "d": 0.5}, "weight": 8},
            {"name": "옷장", "dimensions": {"w": 1.2, "h": 1.9, "d": 0.6}, "weight": 95},
        ],
        from_address="서울 강남구 역삼동 123",
        to_address="서울 마포구 합정동 456",
        from_floor=3,
        to_floor=5,
        from_elevator=True,
        to_elevator=False,
    )
    return calculate_cost(sample)
