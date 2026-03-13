import { useMemo } from 'react';
import axios from 'axios';
import type { FloorPlanResult, FurnitureItem, PlacementItem, CostResult } from '../types';

const API_BASE = 'http://localhost:8000/api';

export interface JobResponse {
  job_id: string;
}

export interface StatusResponse {
  status: 'pending' | 'processing' | 'done' | 'error';
  progress?: number;
  message?: string;
}

export interface FurnitureResult {
  furniture: FurnitureItem[];
}

export interface PlacementResult {
  placements: PlacementItem[];
}

export interface RenderJobResponse {
  job_id: string;
}

export interface RenderResult {
  rendered_image: string; // base64
}

export interface CostInput {
  from_address: string;
  to_address: string;
  from_floor: number;
  to_floor: number;
  from_elevator: boolean;
  to_elevator: boolean;
  furniture_items: FurnitureItem[];
}

export const useApi = () => useMemo(() => {
  const uploadFloorplanVideo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('video', file);
    const res = await axios.post<JobResponse>(`${API_BASE}/floorplan/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.job_id;
  };

  const getFloorplanStatus = async (jobId: string): Promise<StatusResponse> => {
    const res = await axios.get<StatusResponse>(`${API_BASE}/floorplan/${jobId}/status`);
    return res.data;
  };

  const getFloorplanResult = async (jobId: string): Promise<FloorPlanResult> => {
    const res = await axios.get<FloorPlanResult>(`${API_BASE}/floorplan/${jobId}/result`);
    return res.data;
  };

  const uploadFurnitureVideo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('video', file);
    const res = await axios.post<JobResponse>(`${API_BASE}/furniture/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.job_id;
  };

  const getFurnitureStatus = async (jobId: string): Promise<StatusResponse> => {
    const res = await axios.get<StatusResponse>(`${API_BASE}/furniture/${jobId}/status`);
    return res.data;
  };

  const getFurnitureResult = async (jobId: string): Promise<FurnitureResult> => {
    const res = await axios.get<FurnitureResult>(`${API_BASE}/furniture/${jobId}/result`);
    return res.data;
  };

  const autoPlace = async (
    floorplanId: string,
    furnitureItems: FurnitureItem[]
  ): Promise<PlacementResult> => {
    const res = await axios.post<PlacementResult>(`${API_BASE}/placement/compute`, {
      floorplan_id: floorplanId,
      furniture_items: furnitureItems,
    });
    return res.data;
  };

  const updatePlacement = async (
    furnitureId: string,
    position: PlacementItem['position'],
    rotation: PlacementItem['rotation']
  ): Promise<void> => {
    await axios.put(`${API_BASE}/placement/${furnitureId}`, { position, rotation });
  };

  const generateRender = async (
    sceneImage: string,
    depthMap: string,
    prompt: string
  ): Promise<string> => {
    const res = await axios.post<RenderJobResponse>(`${API_BASE}/render/submit`, {
      scene_image: sceneImage,
      depth_map: depthMap,
      prompt,
    });
    return res.data.job_id;
  };

  const getRenderResult = async (jobId: string): Promise<RenderResult> => {
    const res = await axios.get<RenderResult>(`${API_BASE}/render/${jobId}/result`);
    return res.data;
  };

  const estimateCost = async (input: CostInput): Promise<CostResult> => {
    const res = await axios.post<CostResult>(`${API_BASE}/cost/estimate`, input);
    return res.data;
  };

  return {
    uploadFloorplanVideo,
    getFloorplanStatus,
    getFloorplanResult,
    uploadFurnitureVideo,
    getFurnitureStatus,
    getFurnitureResult,
    autoPlace,
    updatePlacement,
    generateRender,
    getRenderResult,
    estimateCost,
  };
}, []);
