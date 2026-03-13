import { create } from 'zustand';
import type { Step, FloorPlanResult, FurnitureItem, PlacementItem, CostResult } from '../types';

interface AppState {
  currentStep: Step;
  floorplanJobId: string | null;
  furnitureJobId: string | null;
  floorplan: FloorPlanResult | null;
  furniture: FurnitureItem[];
  placements: PlacementItem[];
  renderedImage: string | null;
  costResult: CostResult | null;
  isProcessing: boolean;

  setStep: (step: Step) => void;
  setFloorplanJobId: (id: string | null) => void;
  setFurnitureJobId: (id: string | null) => void;
  setFloorplan: (fp: FloorPlanResult | null) => void;
  setFurniture: (items: FurnitureItem[]) => void;
  setPlacements: (placements: PlacementItem[]) => void;
  updatePlacement: (
    furnitureId: string,
    position: PlacementItem['position'],
    rotation: PlacementItem['rotation']
  ) => void;
  setRenderedImage: (img: string | null) => void;
  setCostResult: (result: CostResult | null) => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as Step,
  floorplanJobId: null,
  furnitureJobId: null,
  floorplan: null,
  furniture: [],
  placements: [],
  renderedImage: null,
  costResult: null,
  isProcessing: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setFloorplanJobId: (id) => set({ floorplanJobId: id }),
  setFurnitureJobId: (id) => set({ furnitureJobId: id }),
  setFloorplan: (fp) => set({ floorplan: fp }),
  setFurniture: (items) => set({ furniture: items }),
  setPlacements: (placements) => set({ placements }),
  updatePlacement: (furnitureId, position, rotation) =>
    set((state) => ({
      placements: state.placements.map((p) =>
        p.furniture_id === furnitureId ? { ...p, position, rotation } : p
      ),
    })),
  setRenderedImage: (img) => set({ renderedImage: img }),
  setCostResult: (result) => set({ costResult: result }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () => set(initialState),
}));
