import { useMemo } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export interface PresetMeta {
  id: string;
  name: string;
  description: string;
  created_at: string;
  has_floorplan: boolean;
  has_furniture: boolean;
  has_placements: boolean;
  has_render: boolean;
  has_cost: boolean;
  furniture_count: number;
  file_list: string[];
}

export interface PresetData {
  meta: PresetMeta;
  floorplan: Record<string, any> | null;
  furniture: Record<string, any>[];
  placements: Record<string, any>[];
  rendered_image: string | null;
  cost_result: Record<string, any> | null;
}

export interface SavePresetRequest {
  name: string;
  description?: string;
  floorplan?: Record<string, any> | null;
  furniture?: Record<string, any>[];
  placements?: Record<string, any>[];
  rendered_image?: string | null;
  cost_result?: Record<string, any> | null;
}

export const usePresetApi = () => useMemo(() => {
  const savePreset = async (req: SavePresetRequest): Promise<PresetMeta> => {
    const res = await axios.post<PresetMeta>(`${API_BASE}/presets/save`, req);
    return res.data;
  };

  const listPresets = async (): Promise<PresetMeta[]> => {
    const res = await axios.get<PresetMeta[]>(`${API_BASE}/presets/list`);
    return res.data;
  };

  const loadPreset = async (presetId: string): Promise<PresetData> => {
    const res = await axios.get<PresetData>(`${API_BASE}/presets/${presetId}`);
    return res.data;
  };

  const deletePreset = async (presetId: string): Promise<void> => {
    await axios.delete(`${API_BASE}/presets/${presetId}`);
  };

  const getDownloadZipUrl = (presetId: string): string => {
    return `${API_BASE}/presets/${presetId}/download/zip`;
  };

  const getDownloadFileUrl = (presetId: string, filePath: string): string => {
    return `${API_BASE}/presets/${presetId}/download/${filePath}`;
  };

  return {
    savePreset,
    listPresets,
    loadPreset,
    deletePreset,
    getDownloadZipUrl,
    getDownloadFileUrl,
  };
}, []);
