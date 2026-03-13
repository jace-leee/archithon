"""Cost calculation service for Korean moving estimates."""

from __future__ import annotations

import math
from typing import Any

from app.models.schemas import CostBreakdown, CostInput, CostResult


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_COST_KRW = 300_000          # 1-ton truck base fee
VOLUME_RATE_KRW = 500_000        # KRW per cubic meter
HEAVY_ITEM_THRESHOLD_KG = 80     # kg — items heavier than this get a surcharge
HEAVY_SURCHARGE_KRW = 50_000     # per heavy item
DISTANCE_RATE_KRW = 1_000        # KRW per km
FLOOR_RATE_KRW = 30_000          # KRW per floor when no elevator


# ---------------------------------------------------------------------------
# Distance estimation (mock — no real geocoding for hackathon)
# ---------------------------------------------------------------------------

def _estimate_distance_km(from_address: str, to_address: str) -> float:
    """Estimate driving distance between two Korean addresses.

    Uses a simple heuristic: same district (~3 km), same city (~15 km),
    different city (~80 km). Real implementation would call a Maps API.
    """
    from_lower = from_address.lower()
    to_lower = to_address.lower()

    # Extract district/city keywords
    districts = ["강남", "강서", "마포", "종로", "서초", "송파", "용산", "성동", "동작", "관악"]
    cities = ["서울", "부산", "인천", "대구", "대전", "광주", "울산", "수원", "성남", "고양"]

    from_district = next((d for d in districts if d in from_lower), None)
    to_district = next((d for d in districts if d in to_lower), None)
    from_city = next((c for c in cities if c in from_lower), None)
    to_city = next((c for c in cities if c in to_lower), None)

    if from_district and to_district and from_district == to_district:
        return 3.0
    if from_city and to_city and from_city == to_city:
        return 15.0
    if from_city and to_city:
        return 80.0
    # Default: same general area
    return 20.0


# ---------------------------------------------------------------------------
# Floor cost
# ---------------------------------------------------------------------------

def _calculate_floor_cost(
    from_floor: int,
    to_floor: int,
    has_elevator_from: bool,
    has_elevator_to: bool,
) -> tuple[int, list[CostBreakdown]]:
    """Return total floor surcharge and breakdown items."""
    breakdown: list[CostBreakdown] = []
    total = 0

    if not has_elevator_from and from_floor > 1:
        floors = from_floor - 1
        cost = floors * FLOOR_RATE_KRW
        total += cost
        breakdown.append(CostBreakdown(
            item="출발지 계단 작업비",
            amount=cost,
            description=f"엘리베이터 없음, {floors}층 계단 ({FLOOR_RATE_KRW:,}원 × {floors}층)",
        ))

    if not has_elevator_to and to_floor > 1:
        floors = to_floor - 1
        cost = floors * FLOOR_RATE_KRW
        total += cost
        breakdown.append(CostBreakdown(
            item="도착지 계단 작업비",
            amount=cost,
            description=f"엘리베이터 없음, {floors}층 계단 ({FLOOR_RATE_KRW:,}원 × {floors}층)",
        ))

    return total, breakdown


# ---------------------------------------------------------------------------
# Furniture cost
# ---------------------------------------------------------------------------

def _calculate_furniture_cost(
    furniture: list[dict[str, Any]],
) -> tuple[int, list[CostBreakdown]]:
    """Return total furniture cost and breakdown items."""
    breakdown: list[CostBreakdown] = []
    volume_total = 0
    heavy_count = 0

    for item in furniture:
        dims = item.get("dimensions", {})
        w = float(dims.get("w", 0.5))
        h = float(dims.get("h", 0.5))
        d = float(dims.get("d", 0.5))
        weight = float(item.get("weight_estimate", item.get("weight", 0)))
        volume = w * h * d
        volume_total += volume
        if weight > HEAVY_ITEM_THRESHOLD_KG:
            heavy_count += 1

    volume_cost = int(volume_total * VOLUME_RATE_KRW)
    heavy_cost = heavy_count * HEAVY_SURCHARGE_KRW
    total = volume_cost + heavy_cost

    if volume_cost > 0:
        breakdown.append(CostBreakdown(
            item="가구 부피 기본료",
            amount=volume_cost,
            description=f"총 부피 {volume_total:.2f}㎥ × {VOLUME_RATE_KRW:,}원/㎥",
        ))

    if heavy_cost > 0:
        breakdown.append(CostBreakdown(
            item="중량 가구 추가료",
            amount=heavy_cost,
            description=f"{heavy_count}개 중량 가구 ({HEAVY_ITEM_THRESHOLD_KG}kg 초과) × {HEAVY_SURCHARGE_KRW:,}원",
        ))

    return total, breakdown


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_cost(data: CostInput) -> CostResult:
    """Compute a complete moving cost estimate and return a CostResult."""
    breakdown: list[CostBreakdown] = []

    # 1. Base cost
    breakdown.append(CostBreakdown(
        item="기본 운송료 (1톤 트럭)",
        amount=BASE_COST_KRW,
        description="1톤 트럭 기본 운임",
    ))

    # 2. Distance cost
    distance_km = _estimate_distance_km(data.from_address, data.to_address)
    distance_cost = int(math.ceil(distance_km) * DISTANCE_RATE_KRW)
    breakdown.append(CostBreakdown(
        item="거리 운송료",
        amount=distance_cost,
        description=f"예상 거리 {distance_km:.0f}km × {DISTANCE_RATE_KRW:,}원/km",
    ))

    # 3. Floor cost
    floor_cost, floor_breakdown = _calculate_floor_cost(
        data.from_floor,
        data.to_floor,
        data.from_elevator,
        data.to_elevator,
    )
    breakdown.extend(floor_breakdown)

    # 4. Furniture cost
    furniture_cost, furniture_breakdown = _calculate_furniture_cost(data.furniture_items)
    breakdown.extend(furniture_breakdown)

    total = BASE_COST_KRW + distance_cost + floor_cost + furniture_cost

    return CostResult(
        base_cost=BASE_COST_KRW,
        distance_cost=distance_cost,
        floor_cost=floor_cost,
        furniture_cost=furniture_cost,
        total=total,
        breakdown=breakdown,
    )
