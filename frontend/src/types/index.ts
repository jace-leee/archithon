export interface FurnitureDimensions {
  w: number;
  h: number;
  d: number; // meters
}

export interface FurnitureItem {
  id: string;
  name: string;
  glb_url: string;
  thumbnail: string;
  dimensions: FurnitureDimensions;
  weight_estimate: number;
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Room {
  polygon: number[][];
  label: string;
}

export interface FloorPlanMetadata {
  pixels_per_meter: number;
  origin: string;
  unit: string;
}

export interface FloorPlanResult {
  floorplan_image: string; // base64
  floorplan_svg?: string;
  walls: WallSegment[];
  rooms: Room[];
  metadata: FloorPlanMetadata;
  source_track: 'A' | 'B';
}

export interface PlacementItem {
  furniture_id: string;
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  scale: number;
}

export interface CostBreakdown {
  item: string;
  amount: number;
  description: string;
}

export interface CostResult {
  base_cost: number;
  distance_cost: number;
  floor_cost: number;
  furniture_cost: number;
  total: number;
  breakdown: CostBreakdown[];
}

export type Step = 1 | 2 | 3 | 4 | 5;
export type JobStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
