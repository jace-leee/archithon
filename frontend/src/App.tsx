import { useState, useCallback } from 'react';
import axios from 'axios';

import { useAppStore } from './stores/appStore';
import { useApi } from './hooks/useApi';
import { useJobPolling } from './hooks/useJobPolling';

import StepWizard from './components/StepWizard';
import VideoUpload from './components/VideoUpload';
import ProcessingStatus from './components/ProcessingStatus';
import FloorPlanViewer from './components/FloorPlanViewer';
import FurnitureList from './components/FurnitureList';
import ThreeScene from './components/ThreeScene';
import RenderResult from './components/RenderResult';
import CostEstimate from './components/CostEstimate';

import type { Step, FloorPlanResult, PlacementItem } from './types';
import type { FurnitureResult, PlacementResult, CostInput } from './hooks/useApi';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  // Global store
  const {
    currentStep,
    floorplanJobId,
    furnitureJobId,
    floorplan,
    furniture,
    placements,
    renderedImage,
    costResult,
    setStep,
    setFloorplanJobId,
    setFurnitureJobId,
    setFloorplan,
    setFurniture,
    setPlacements,
    updatePlacement,
    setRenderedImage,
    setCostResult,
  } = useAppStore();

  const api = useApi();

  // Local UI state
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isFloorplanUploading, setIsFloorplanUploading] = useState(false);
  const [isFurnitureUploading, setIsFurnitureUploading] = useState(false);
  const [isPlacementProcessing, setIsPlacementProcessing] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState<Set<string>>(new Set());
  const [isCostLoading, setIsCostLoading] = useState(false);

  // Job polling for floorplan
  const floorplanPolling = useJobPolling<FloorPlanResult>(
    floorplanJobId,
    api.getFloorplanStatus,
    api.getFloorplanResult,
    (result) => {
      setFloorplan(result);
    }
  );

  // Job polling for furniture
  const furniturePolling = useJobPolling<FurnitureResult>(
    furnitureJobId,
    api.getFurnitureStatus,
    api.getFurnitureResult,
    (result) => {
      setFurniture(result.furniture);
      setSelectedFurnitureIds(new Set(result.furniture.map((f) => f.id)));
    }
  );

  // Step navigation helpers
  const completeStepAndAdvance = useCallback(
    (step: Step) => {
      setCompletedSteps((prev) => new Set([...prev, step]));
      if (step < 5) setStep((step + 1) as Step);
    },
    [setStep]
  );

  const handleStepClick = useCallback(
    (step: Step) => {
      setStep(step);
    },
    [setStep]
  );

  // ── Step 1: Floorplan ────────────────────────────────────────────────────────

  const handleFloorplanUpload = useCallback(
    async (file: File) => {
      if (isDemoMode) return;
      try {
        setIsFloorplanUploading(true);
        const jobId = await api.uploadFloorplanVideo(file);
        setFloorplanJobId(jobId);
      } catch (err) {
        console.error('Floorplan upload failed', err);
        alert('영상 업로드에 실패했습니다. 다시 시도해 주세요.');
      } finally {
        setIsFloorplanUploading(false);
      }
    },
    [isDemoMode, api, setFloorplanJobId]
  );

  const handleDemoFloorplan = useCallback(async () => {
    try {
      setIsFloorplanUploading(true);
      const res = await axios.post<FloorPlanResult>(`${API_BASE}/floorplan/mock`);
      setFloorplan(res.data);
    } catch (err) {
      console.error('Demo floorplan failed', err);
    } finally {
      setIsFloorplanUploading(false);
    }
  }, [setFloorplan]);

  // ── Step 2: Furniture ────────────────────────────────────────────────────────

  const handleFurnitureUpload = useCallback(
    async (file: File) => {
      if (isDemoMode) return;
      try {
        setIsFurnitureUploading(true);
        const jobId = await api.uploadFurnitureVideo(file);
        setFurnitureJobId(jobId);
      } catch (err) {
        console.error('Furniture upload failed', err);
        alert('영상 업로드에 실패했습니다. 다시 시도해 주세요.');
      } finally {
        setIsFurnitureUploading(false);
      }
    },
    [isDemoMode, api, setFurnitureJobId]
  );

  const handleDemoFurniture = useCallback(async () => {
    try {
      setIsFurnitureUploading(true);
      const res = await axios.post<FurnitureResult>(`${API_BASE}/furniture/mock`);
      setFurniture(res.data.furniture);
      setSelectedFurnitureIds(new Set(res.data.furniture.map((f) => f.id)));
    } catch (err) {
      console.error('Demo furniture failed', err);
    } finally {
      setIsFurnitureUploading(false);
    }
  }, [setFurniture]);

  const handleFurnitureToggle = useCallback((id: string) => {
    setSelectedFurnitureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFurnitureSelectAll = useCallback(() => {
    if (selectedFurnitureIds.size === furniture.length) {
      setSelectedFurnitureIds(new Set());
    } else {
      setSelectedFurnitureIds(new Set(furniture.map((f) => f.id)));
    }
  }, [selectedFurnitureIds.size, furniture]);

  // ── Step 3: AI Placement ─────────────────────────────────────────────────────

  const selectedFurniture = furniture.filter((f) => selectedFurnitureIds.has(f.id));

  const handleAutoPlace = useCallback(async () => {
    if (!isDemoMode && !floorplanJobId) {
      setPlacementError('평면도 작업 ID가 없습니다.');
      return;
    }
    setPlacementError(null);
    setIsPlacementProcessing(true);
    try {
      if (isDemoMode) {
        const res = await axios.post<PlacementResult>(`${API_BASE}/placement/mock`);
        setPlacements(res.data.placements);
      } else {
        const result = await api.autoPlace(floorplanJobId!, selectedFurniture);
        setPlacements(result.placements);
      }
    } catch (err) {
      console.error('Auto placement failed', err);
      setPlacementError('자동 배치에 실패했습니다.');
    } finally {
      setIsPlacementProcessing(false);
    }
  }, [isDemoMode, floorplanJobId, selectedFurniture, api, setPlacements]);

  // ── Step 4: Render ───────────────────────────────────────────────────────────

  const handleCapture = useCallback(
    async (dataUrl: string) => {
      setCapturedImage(dataUrl);
      setIsRendering(true);
      try {
        const jobId = await api.generateRender(dataUrl, '', '인테리어 사진');
        // Poll with bounded retries (max 30 attempts = 60s)
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const result = await api.getRenderResult(jobId);
            if (result.rendered_image) {
              setRenderedImage(result.rendered_image);
              setIsRendering(false);
              return;
            }
          } catch {
            // 202 or error - continue polling
          }
        }
        console.error('Render timed out after 60s');
        setIsRendering(false);
      } catch (err) {
        console.error('Render failed', err);
        setIsRendering(false);
      }
    },
    [api, setRenderedImage]
  );

  const handleRerender = useCallback(() => {
    if (capturedImage) handleCapture(capturedImage);
  }, [capturedImage, handleCapture]);

  const handleUpdatePlacement = useCallback(
    (id: string, position: PlacementItem['position'], rotation: PlacementItem['rotation']) => {
      updatePlacement(id, position, rotation);
    },
    [updatePlacement]
  );

  // ── Step 5: Cost ─────────────────────────────────────────────────────────────

  const handleEstimate = useCallback(
    async (input: Omit<CostInput, 'furniture_items'>) => {
      setIsCostLoading(true);
      try {
        if (isDemoMode) {
          const res = await axios.post(`${API_BASE}/cost/estimate/mock`, {
            ...input,
            furniture_items: selectedFurniture,
          });
          setCostResult(res.data);
        } else {
          const result = await api.estimateCost({
            ...input,
            furniture_items: selectedFurniture,
          });
          setCostResult(result);
        }
      } catch (err) {
        console.error('Cost estimate failed', err);
      } finally {
        setIsCostLoading(false);
      }
    },
    [isDemoMode, selectedFurniture, api, setCostResult]
  );

  // ── Derived display flags ────────────────────────────────────────────────────

  const floorplanIsProcessing =
    floorplanPolling.status === 'processing' || isFloorplanUploading;
  const floorplanIsDone = !!floorplan;
  const floorplanError = floorplanPolling.error;

  const furnitureIsProcessing =
    furniturePolling.status === 'processing' || isFurnitureUploading;
  const furnitureIsDone = furniture.length > 0;
  const furnitureError = furniturePolling.error;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Archithon</h1>
            <p className="text-sm text-gray-400">AI 이사 도우미</p>
          </div>
          <button
            onClick={() => setIsDemoMode((v) => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border
              ${isDemoMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
          >
            {isDemoMode ? '데모 모드 ON' : '데모 모드'}
          </button>
        </div>
      </header>

      {/* Step Wizard */}
      <div className="max-w-6xl mx-auto px-4">
        <StepWizard
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 pb-16">

        {/* ── Step 1: 공간 스캔 ── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">공간 스캔</h2>
              <p className="text-gray-400">방 전체를 촬영한 영상을 업로드하면 AI가 평면도를 생성합니다</p>
            </div>

            {!floorplanIsProcessing && !floorplanIsDone && (
              <div className="space-y-4">
                {isDemoMode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center max-w-lg w-full">
                      <p className="text-amber-300 text-sm font-medium">데모 모드</p>
                      <p className="text-gray-400 text-xs mt-1">실제 영상 없이 샘플 평면도를 불러옵니다</p>
                    </div>
                    <button
                      onClick={handleDemoFloorplan}
                      disabled={isFloorplanUploading}
                      className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                      {isFloorplanUploading ? '불러오는 중...' : '샘플 평면도 불러오기'}
                    </button>
                  </div>
                ) : (
                  <VideoUpload
                    onUpload={handleFloorplanUpload}
                    step={1}
                    isLoading={isFloorplanUploading}
                  />
                )}
              </div>
            )}

            {floorplanIsProcessing && (
              <ProcessingStatus
                progress={floorplanPolling.progress}
                status="평면도를 생성하고 있습니다..."
                track={floorplan?.source_track ?? null}
                error={floorplanError}
              />
            )}

            {floorplanError && !floorplanIsProcessing && (
              <ProcessingStatus
                progress={0}
                status=""
                error={floorplanError}
              />
            )}

            {floorplanIsDone && floorplan && (
              <div className="space-y-6">
                <FloorPlanViewer floorplan={floorplan} />
                <div className="flex justify-end">
                  <button
                    onClick={() => completeStepAndAdvance(1)}
                    className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
                  >
                    다음 단계 →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: 가구 스캔 ── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">가구 스캔</h2>
              <p className="text-gray-400">가구를 360도 촬영한 영상을 업로드하면 AI가 가구를 인식합니다</p>
            </div>

            {!furnitureIsProcessing && !furnitureIsDone && (
              <div className="space-y-4">
                {isDemoMode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center max-w-lg w-full">
                      <p className="text-amber-300 text-sm font-medium">데모 모드</p>
                      <p className="text-gray-400 text-xs mt-1">실제 영상 없이 샘플 가구 목록을 불러옵니다</p>
                    </div>
                    <button
                      onClick={handleDemoFurniture}
                      disabled={isFurnitureUploading}
                      className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                      {isFurnitureUploading ? '불러오는 중...' : '샘플 가구 불러오기'}
                    </button>
                  </div>
                ) : (
                  <VideoUpload
                    onUpload={handleFurnitureUpload}
                    step={2}
                    isLoading={isFurnitureUploading}
                  />
                )}
              </div>
            )}

            {furnitureIsProcessing && (
              <ProcessingStatus
                progress={furniturePolling.progress}
                status="가구를 인식하고 있습니다..."
                error={furnitureError}
              />
            )}

            {furnitureError && !furnitureIsProcessing && (
              <ProcessingStatus
                progress={0}
                status=""
                error={furnitureError}
              />
            )}

            {furnitureIsDone && (
              <div className="space-y-6">
                <FurnitureList
                  items={furniture}
                  selectedIds={selectedFurnitureIds}
                  onToggle={handleFurnitureToggle}
                  onSelectAll={handleFurnitureSelectAll}
                />
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm">
                    {selectedFurnitureIds.size}개 선택됨
                  </p>
                  <button
                    onClick={() => completeStepAndAdvance(2)}
                    disabled={selectedFurnitureIds.size === 0}
                    className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음 단계 →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: AI 배치 ── */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">AI 배치</h2>
              <p className="text-gray-400">AI가 평면도에 맞게 가구를 최적으로 배치합니다</p>
            </div>

            {!isPlacementProcessing && placements.length === 0 && (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full text-center">
                  <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-1">배치할 가구</p>
                  <p className="text-blue-400 text-2xl font-bold">{selectedFurniture.length}개</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {selectedFurniture.map((f) => f.name).join(', ')}
                  </p>
                </div>

                {placementError && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 max-w-md w-full text-center">
                    <p className="text-red-400 text-sm">{placementError}</p>
                  </div>
                )}

                <button
                  onClick={handleAutoPlace}
                  disabled={selectedFurniture.length === 0}
                  className="px-10 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  자동 배치 시작
                </button>
              </div>
            )}

            {isPlacementProcessing && (
              <ProcessingStatus
                progress={50}
                status="AI가 최적 배치를 계산하고 있습니다..."
              />
            )}

            {!isPlacementProcessing && placements.length > 0 && (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full text-center">
                  <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-1">배치 완료</p>
                  <p className="text-green-400 text-2xl font-bold">{placements.length}개</p>
                  <p className="text-gray-400 text-sm mt-1">가구가 배치되었습니다</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setPlacements([]); setPlacementError(null); }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors"
                  >
                    다시 배치
                  </button>
                  <button
                    onClick={() => completeStepAndAdvance(3)}
                    className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
                  >
                    다음 단계 →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: 3D 시각화 ── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">3D 시각화</h2>
              <p className="text-gray-400">배치된 가구를 3D로 확인하고 AI 렌더링을 생성하세요</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl overflow-hidden" style={{ height: '480px' }}>
                <ThreeScene
                  floorplan={floorplan}
                  furniture={furniture.filter((f) => selectedFurnitureIds.has(f.id))}
                  placements={placements}
                  onUpdatePlacement={handleUpdatePlacement}
                  onCapture={handleCapture}
                />
              </div>

              <div className="space-y-4">
                <RenderResult
                  beforeImage={capturedImage}
                  afterImage={renderedImage}
                  onRerender={handleRerender}
                  isRendering={isRendering}
                  isDemoMode={isDemoMode}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => completeStepAndAdvance(4)}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
              >
                다음 단계 →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: 이사 견적 ── */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">이사 견적</h2>
              <p className="text-gray-400">이사 정보를 입력하면 AI가 예상 비용을 산출합니다</p>
            </div>

            <CostEstimate
              furniture={selectedFurniture}
              onEstimate={handleEstimate}
              result={costResult}
              isLoading={isCostLoading}
            />
          </div>
        )}

      </main>
    </div>
  );
}
