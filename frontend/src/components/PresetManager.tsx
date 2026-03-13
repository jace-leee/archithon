import { useState, useEffect, useCallback } from 'react';
import { usePresetApi } from '../hooks/usePresetApi';
import type { PresetMeta } from '../hooks/usePresetApi';
import { useAppStore } from '../stores/appStore';
import type { FloorPlanResult, FurnitureItem, PlacementItem, CostResult } from '../types';

interface PresetManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PresetManager({ isOpen, onClose }: PresetManagerProps) {
  const presetApi = usePresetApi();
  const {
    floorplan,
    furniture,
    placements,
    renderedImage,
    costResult,
    setFloorplan,
    setFurniture,
    setPlacements,
    setRenderedImage,
    setCostResult,
    setStep,
  } = useAppStore();

  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('load');
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await presetApi.listPresets();
      setPresets(list);
    } catch (err) {
      console.error('Failed to fetch presets', err);
    } finally {
      setIsLoading(false);
    }
  }, [presetApi]);

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      setSaveSuccess(false);
    }
  }, [isOpen, fetchPresets]);

  const handleSave = async () => {
    if (!presetName.trim()) return;
    setIsSaving(true);
    try {
      await presetApi.savePreset({
        name: presetName.trim(),
        description: presetDesc.trim(),
        floorplan: floorplan as Record<string, any> | null,
        furniture: furniture as unknown as Record<string, any>[],
        placements: placements as unknown as Record<string, any>[],
        rendered_image: renderedImage,
        cost_result: costResult as unknown as Record<string, any> | null,
      });
      setPresetName('');
      setPresetDesc('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchPresets();
    } catch (err) {
      console.error('Save preset failed', err);
      alert('프리셋 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (presetId: string) => {
    setIsLoading(true);
    try {
      const data = await presetApi.loadPreset(presetId);
      if (data.floorplan) setFloorplan(data.floorplan as unknown as FloorPlanResult);
      if (data.furniture.length > 0) setFurniture(data.furniture as unknown as FurnitureItem[]);
      if (data.placements.length > 0) setPlacements(data.placements as unknown as PlacementItem[]);
      if (data.rendered_image) setRenderedImage(data.rendered_image);
      if (data.cost_result) setCostResult(data.cost_result as unknown as CostResult);

      // Navigate to the most advanced step that has data
      if (data.cost_result) setStep(5);
      else if (data.rendered_image) setStep(4);
      else if (data.placements.length > 0) setStep(4);
      else if (data.furniture.length > 0) setStep(3);
      else if (data.floorplan) setStep(2);
      else setStep(1);

      onClose();
    } catch (err) {
      console.error('Load preset failed', err);
      alert('프리셋 불러오기에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;
    try {
      await presetApi.deletePreset(presetId);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
    } catch (err) {
      console.error('Delete preset failed', err);
    }
  };

  const handleDownloadZip = (presetId: string) => {
    window.open(presetApi.getDownloadZipUrl(presetId), '_blank');
  };

  const handleDownloadFile = (presetId: string, filePath: string) => {
    window.open(presetApi.getDownloadFileUrl(presetId, filePath), '_blank');
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.png') || path.endsWith('.jpg')) return '🖼';
    if (path.endsWith('.svg')) return '📐';
    if (path.endsWith('.json')) return '📋';
    if (path.endsWith('.glb') || path.endsWith('.gltf')) return '🧊';
    return '📄';
  };

  const getFileLabel = (path: string) => {
    if (path.includes('floorplan/floorplan.png')) return '평면도 이미지';
    if (path.includes('floorplan/floorplan.svg')) return '평면도 SVG';
    if (path.includes('floorplan/structure.json')) return '평면도 구조 데이터';
    if (path.includes('thumbnail.png')) return `가구 썸네일 (${path.split('/')[1]})`;
    if (path.includes('info.json') && path.includes('furniture')) return `가구 정보 (${path.split('/')[1]})`;
    if (path === 'placements.json') return '배치 데이터';
    if (path === 'render.png') return 'AI 렌더링 이미지';
    if (path === 'cost.json') return '견적 데이터';
    return path;
  };

  if (!isOpen) return null;

  const hasData = floorplan || furniture.length > 0 || placements.length > 0 || renderedImage || costResult;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">프리셋 관리</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('load')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'load'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            불러오기 / 다운로드
          </button>
          <button
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'save'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            현재 결과 저장
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'save' && (
            <div className="space-y-4">
              {!hasData && (
                <div className="bg-gray-800/50 rounded-xl p-6 text-center">
                  <p className="text-gray-400">저장할 데이터가 없습니다. 먼저 프로젝트를 진행해주세요.</p>
                </div>
              )}

              {hasData && (
                <>
                  {/* Data summary */}
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-3">저장될 데이터:</p>
                    <div className="flex flex-wrap gap-2">
                      {floorplan && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-medium">평면도</span>
                      )}
                      {furniture.length > 0 && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">
                          가구 {furniture.length}개
                        </span>
                      )}
                      {placements.length > 0 && (
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">배치 데이터</span>
                      )}
                      {renderedImage && (
                        <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-xs font-medium">렌더링 이미지</span>
                      )}
                      {costResult && (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-medium">견적 데이터</span>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="프리셋 이름 (필수)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <textarea
                    placeholder="설명 (선택)"
                    value={presetDesc}
                    onChange={(e) => setPresetDesc(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />

                  {saveSuccess && (
                    <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-3 text-center">
                      <p className="text-green-400 text-sm font-medium">프리셋이 저장되었습니다!</p>
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={!presetName.trim() || isSaving}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-semibold transition-colors"
                  >
                    {isSaving ? '저장 중...' : '프리셋 저장'}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'load' && (
            <div className="space-y-3">
              {isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">불러오는 중...</p>
                </div>
              )}

              {!isLoading && presets.length === 0 && (
                <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                  <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <p className="text-gray-400">저장된 프리셋이 없습니다</p>
                  <p className="text-gray-500 text-sm mt-1">프로젝트 결과를 저장하면 여기에 표시됩니다</p>
                </div>
              )}

              {!isLoading && presets.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">{preset.name}</h3>
                        {preset.description && (
                          <p className="text-gray-400 text-sm mt-0.5 truncate">{preset.description}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">{formatDate(preset.created_at)}</p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {preset.has_floorplan && (
                        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded text-xs">평면도</span>
                      )}
                      {preset.has_furniture && (
                        <span className="px-2 py-0.5 bg-green-500/15 text-green-400 rounded text-xs">
                          가구 {preset.furniture_count}개
                        </span>
                      )}
                      {preset.has_placements && (
                        <span className="px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded text-xs">배치</span>
                      )}
                      {preset.has_render && (
                        <span className="px-2 py-0.5 bg-pink-500/15 text-pink-400 rounded text-xs">렌더링</span>
                      )}
                      {preset.has_cost && (
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded text-xs">견적</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleLoad(preset.id)}
                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        불러오기
                      </button>
                      <button
                        onClick={() => handleDownloadZip(preset.id)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                        title="ZIP 다운로드"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setExpandedPreset(expandedPreset === preset.id ? null : preset.id)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                        title="개별 파일"
                      >
                        <svg className={`w-4 h-4 transition-transform ${expandedPreset === preset.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        className="px-3 py-2 bg-gray-700 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded-lg text-sm transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded file list */}
                  {expandedPreset === preset.id && preset.file_list.length > 0 && (
                    <div className="border-t border-gray-700 bg-gray-850 px-4 py-3">
                      <p className="text-xs text-gray-500 mb-2 font-medium">개별 파일 다운로드</p>
                      <div className="space-y-1">
                        {preset.file_list.map((filePath) => (
                          <button
                            key={filePath}
                            onClick={() => handleDownloadFile(preset.id, filePath)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors group"
                          >
                            <span className="text-sm">{getFileIcon(filePath)}</span>
                            <span className="flex-1 text-sm text-gray-300 group-hover:text-white truncate">
                              {getFileLabel(filePath)}
                            </span>
                            <span className="text-xs text-gray-600 group-hover:text-gray-400 shrink-0">
                              {filePath.split('.').pop()?.toUpperCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
