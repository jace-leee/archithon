import type { FurnitureItem } from '../types';
import { downloadFromUrl, downloadJSON } from '../utils/download';

interface FurnitureListProps {
  items: FurnitureItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

export default function FurnitureList({ items, selectedIds, onToggle, onSelectAll }: FurnitureListProps) {
  const allSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">감지된 가구 ({items.length}개)</h3>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 font-medium transition-colors"
              onClick={() => downloadJSON(items.map(i => ({ id: i.id, name: i.name, dimensions: i.dimensions, weight_estimate: i.weight_estimate, glb_url: i.glb_url })), 'furniture-list.json')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON
            </button>
          )}
          <button
            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
            onClick={onSelectAll}
          >
            {allSelected ? '모두 해제' : '모두 선택'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-10 text-center">
          <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-400">가구가 감지되지 않았습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(item => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`relative bg-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border-2
                  ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-gray-600'}
                `}
                onClick={() => onToggle(item.id)}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-10">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                <div className="aspect-square bg-gray-700 flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail.startsWith('data:') ? item.thumbnail : `data:image/png;base64,${item.thumbnail}`}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="text-gray-500 text-xs">미리보기 없음</span>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {item.dimensions.w.toFixed(1)}×{item.dimensions.h.toFixed(1)}×{item.dimensions.d.toFixed(1)}m
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-gray-500 text-xs">{item.weight_estimate}kg</p>
                    {item.glb_url && (
                      <button
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="3D 모델 다운로드 (GLB)"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFromUrl(item.glb_url, `${item.name}.glb`);
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
