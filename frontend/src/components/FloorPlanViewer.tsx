import { useState } from 'react';
import type { FloorPlanResult } from '../types';
import { downloadBase64, downloadJSON, downloadText } from '../utils/download';

interface FloorPlanViewerProps {
  floorplan: FloorPlanResult;
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export default function FloorPlanViewer({ floorplan }: FloorPlanViewerProps) {
  const [scale, setScale] = useState(1);

  const trackLabel = floorplan.source_track === 'A' ? 'COLMAP' : 'AI 비전';
  const trackColor = floorplan.source_track === 'A'
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';

  const imgSrc = floorplan.floorplan_image.startsWith('data:')
    ? floorplan.floorplan_image
    : `data:image/png;base64,${floorplan.floorplan_image}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">평면도</h3>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${trackColor}`}>
            {trackLabel}
          </span>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1"
              onClick={() => setScale(1)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl overflow-auto max-h-96 flex items-center justify-center p-4">
        <img
          src={imgSrc}
          alt="Floor Plan"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
          className="max-w-none"
        />
      </div>

      {/* Download buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          onClick={() => downloadBase64(floorplan.floorplan_image, 'floorplan.png', 'image/png')}
        >
          <DownloadIcon />
          PNG 이미지
        </button>
        {floorplan.floorplan_svg && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            onClick={() => downloadText(floorplan.floorplan_svg!, 'floorplan.svg', 'image/svg+xml')}
          >
            <DownloadIcon />
            SVG
          </button>
        )}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          onClick={() => downloadJSON({ walls: floorplan.walls, rooms: floorplan.rooms, metadata: floorplan.metadata }, 'floorplan-structure.json')}
        >
          <DownloadIcon />
          구조 JSON
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">방 개수</p>
          <p className="text-white font-semibold">{floorplan.rooms.length}개</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">벽 세그먼트</p>
          <p className="text-white font-semibold">{floorplan.walls.length}개</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">해상도</p>
          <p className="text-white font-semibold">{floorplan.metadata.pixels_per_meter} px/m</p>
        </div>
      </div>
    </div>
  );
}
