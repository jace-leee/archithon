import { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useTexture } from '@react-three/drei';
import type { FloorPlanResult, FurnitureItem, PlacementItem } from '../types';
import FurnitureObject from './FurnitureObject';
import type { ToolMode } from './FurnitureObject';
import { downloadJSON } from '../utils/download';

interface ThreeSceneProps {
  floorplan: FloorPlanResult | null;
  furniture: FurnitureItem[];
  placements: PlacementItem[];
  onUpdatePlacement: (id: string, position: PlacementItem['position'], rotation: PlacementItem['rotation']) => void;
  onCapture: (dataUrl: string) => void;
}

// Floor with optional texture
function FloorPlane({ floorplan }: { floorplan: FloorPlanResult | null }) {
  if (!floorplan) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
    );
  }

  const imgSrc = floorplan.floorplan_image.startsWith('data:')
    ? floorplan.floorplan_image
    : `data:image/png;base64,${floorplan.floorplan_image}`;

  return <FloorWithTexture imgSrc={imgSrc} pixelsPerMeter={floorplan.metadata.pixels_per_meter} />;
}

function FloorWithTexture({ imgSrc, pixelsPerMeter }: { imgSrc: string; pixelsPerMeter: number }) {
  const texture = useTexture(imgSrc);
  const imgWidth = texture.image?.width || 800;
  const imgHeight = texture.image?.height || 600;
  const worldW = imgWidth / pixelsPerMeter;
  const worldH = imgHeight / pixelsPerMeter;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[worldW, worldH]} />
      <meshStandardMaterial map={texture} roughness={0.8} />
    </mesh>
  );
}

// Scene content
function SceneContent({
  floorplan,
  furniture,
  placements,
  selectedId,
  toolMode,
  isDragging,
  onSelect,
  onMove,
  onRotate,
  onDragStart,
  onDragEnd,
}: {
  floorplan: FloorPlanResult | null;
  furniture: FurnitureItem[];
  placements: PlacementItem[];
  selectedId: string | null;
  toolMode: ToolMode;
  isDragging: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, pos: PlacementItem['position']) => void;
  onRotate: (id: string, rotation: PlacementItem['rotation']) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  // OrbitControls enabled only in camera mode, and disabled during furniture drag
  const orbitEnabled = toolMode === 'camera' && !isDragging;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 10, -5]} intensity={0.4} />

      <Suspense fallback={null}>
        <FloorPlane floorplan={floorplan} />
      </Suspense>

      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a4a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a5a"
        fadeDistance={30}
        infiniteGrid
      />

      {placements.map(placement => {
        const item = furniture.find(f => f.id === placement.furniture_id);
        if (!item) return null;
        return (
          <FurnitureObject
            key={placement.furniture_id}
            placement={placement}
            furniture={item}
            isSelected={selectedId === placement.furniture_id}
            toolMode={toolMode}
            onSelect={onSelect}
            onMove={onMove}
            onRotate={onRotate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        );
      })}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.001, 0]}
        onPointerDown={() => onSelect(null)}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.05}
      />

      <Environment preset="city" />
    </>
  );
}

const TOOLS: { mode: ToolMode; label: string; icon: string; shortcut: string }[] = [
  { mode: 'camera', label: '카메라', icon: '🎥', shortcut: 'Q' },
  { mode: 'move', label: '이동', icon: '✋', shortcut: 'W' },
  { mode: 'rotate', label: '회전', icon: '🔄', shortcut: 'E' },
];

export default function ThreeScene({
  floorplan,
  furniture,
  placements,
  onUpdatePlacement,
  onCapture,
}: ThreeSceneProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>('camera');
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (id: string, position: PlacementItem['position']) => {
      const placement = placements.find(p => p.furniture_id === id);
      if (placement) {
        onUpdatePlacement(id, position, placement.rotation);
      }
    },
    [placements, onUpdatePlacement]
  );

  const handleRotate = useCallback(
    (id: string, rotation: PlacementItem['rotation']) => {
      const placement = placements.find(p => p.furniture_id === id);
      if (placement) {
        onUpdatePlacement(id, placement.position, rotation);
      }
    },
    [placements, onUpdatePlacement]
  );

  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'q' || e.key === 'Q') setToolMode('camera');
    if (e.key === 'w' || e.key === 'W') setToolMode('move');
    if (e.key === 'e' || e.key === 'E') setToolMode('rotate');
  }, []);

  return (
    <div
      className="w-full h-full relative"
      ref={canvasRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
        style={{ background: '#0f0f1a' }}
      >
        <SceneContent
          floorplan={floorplan}
          furniture={furniture}
          placements={placements}
          selectedId={selectedId}
          toolMode={toolMode}
          isDragging={isDragging}
          onSelect={setSelectedId}
          onMove={handleMove}
          onRotate={handleRotate}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
        <CaptureInner onCapture={onCapture} />
      </Canvas>

      {/* Tool Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <div className="flex gap-1 p-1 bg-black/70 rounded-lg backdrop-blur-sm">
          {TOOLS.map(tool => (
            <button
              key={tool.mode}
              onClick={() => setToolMode(tool.mode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all
                ${toolMode === tool.mode
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <span className="text-sm">{tool.icon}</span>
              {tool.label}
              <kbd className={`ml-1 text-[10px] px-1 py-0.5 rounded ${
                toolMode === tool.mode ? 'bg-blue-600' : 'bg-white/10'
              }`}>
                {tool.shortcut}
              </kbd>
            </button>
          ))}
        </div>

        {selectedId && (
          <div className="px-2.5 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-xs text-blue-300 backdrop-blur-sm">
            선택됨: {furniture.find(f => f.id === selectedId)?.name}
          </div>
        )}
      </div>

      {/* Download toolbar */}
      {placements.length > 0 && (
        <div className="absolute top-3 right-3 z-10 flex gap-1 p-1 bg-black/70 rounded-lg backdrop-blur-sm">
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            title="배치 데이터 다운로드"
            onClick={() => {
              const data = placements.map(p => {
                const item = furniture.find(f => f.id === p.furniture_id);
                return { ...p, furniture_name: item?.name };
              });
              downloadJSON(data, 'placements.json');
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            배치 JSON
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            title="씬 스크린샷 다운로드"
            onClick={() => {
              const canvas = canvasRef.current?.querySelector('canvas');
              if (canvas) {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'scene-screenshot.png';
                link.click();
              }
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            스크린샷
          </button>
        </div>
      )}

      <CaptureTrigger onCapture={onCapture} containerRef={canvasRef} />
    </div>
  );
}

// Render-to-canvas capture via button inside Canvas
function CaptureInner({ onCapture: _onCapture }: { onCapture: (dataUrl: string) => void }) {
  void _onCapture;
  return null;
}

// The real capture button rendered outside Canvas
function CaptureTrigger({ onCapture, containerRef }: { onCapture: (dataUrl: string) => void; containerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="absolute bottom-4 right-4 z-10">
      <button
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-lg transition-colors flex items-center gap-2"
        onClick={() => {
          const canvas = containerRef.current?.querySelector('canvas');
          if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            onCapture(dataUrl);
          }
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        AI 렌더링
      </button>
    </div>
  );
}
