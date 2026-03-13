import { useState, useRef, useCallback } from 'react';

interface RenderResultProps {
  beforeImage: string | null;
  afterImage: string | null;
  onRerender: () => void;
  isRendering?: boolean;
  isDemoMode?: boolean;
}

export default function RenderResult({ beforeImage, afterImage, onRerender, isRendering, isDemoMode }: RenderResultProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [showBefore, setShowBefore] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, x)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleDownload = () => {
    if (!afterImage) return;
    const link = document.createElement('a');
    link.href = afterImage.startsWith('data:') ? afterImage : `data:image/png;base64,${afterImage}`;
    link.download = 'archithon-render.png';
    link.click();
  };

  if (!beforeImage && !afterImage) {
    return (
      <div className="bg-gray-800 rounded-xl p-10 text-center">
        <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-400">3D 씬을 캡처한 후 AI 렌더링을 실행하세요</p>
      </div>
    );
  }

  const beforeSrc = beforeImage
    ? (beforeImage.startsWith('data:') ? beforeImage : `data:image/png;base64,${beforeImage}`)
    : null;
  const afterSrc = afterImage
    ? (afterImage.startsWith('data:') ? afterImage : `data:image/png;base64,${afterImage}`)
    : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">AI 렌더링 결과</h3>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            onClick={() => setShowBefore(!showBefore)}
          >
            {showBefore ? '렌더링 보기' : '원본 보기'}
          </button>
          {afterImage && (
            <button
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              onClick={handleDownload}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              다운로드
            </button>
          )}
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${isRendering ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}
            `}
            onClick={onRerender}
            disabled={isRendering}
          >
            {isRendering ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                렌더링 중...
              </>
            ) : '다시 렌더링'}
          </button>
        </div>
      </div>

      {beforeSrc && afterSrc ? (
        <div
          ref={containerRef}
          className="relative w-full aspect-video rounded-xl overflow-hidden cursor-col-resize select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* After image (full width, bottom layer) */}
          <img
            src={afterSrc}
            alt="After"
            className="absolute inset-0 w-full h-full object-cover"
            style={isDemoMode ? { filter: 'sepia(0.3) saturate(1.4) hue-rotate(180deg) brightness(1.05)' } : undefined}
            draggable={false}
          />

          {/* Before image (full width, clipped by slider) */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src={beforeSrc}
              alt="Before"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Slider handle */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" style={{ left: `${sliderPos}%` }}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium pointer-events-none">Before</div>
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium pointer-events-none">
            After (AI){isDemoMode && ' - Demo'}
          </div>
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-800">
          {(showBefore ? beforeSrc : afterSrc) && (
            <img
              src={(showBefore ? beforeSrc : afterSrc)!}
              alt={showBefore ? 'Before' : 'After'}
              className="w-full h-full object-cover"
            />
          )}
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <svg className="animate-spin w-10 h-10 text-blue-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-white font-medium">AI 렌더링 중...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
