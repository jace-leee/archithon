import { useRef, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlacementItem, FurnitureItem } from '../types';

export type ToolMode = 'camera' | 'move' | 'rotate';

interface FurnitureObjectProps {
  placement: PlacementItem;
  furniture: FurnitureItem;
  isSelected: boolean;
  toolMode: ToolMode;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: PlacementItem['position']) => void;
  onRotate: (id: string, rotation: PlacementItem['rotation']) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const COLORS = [
  '#4A90D9', '#E07B54', '#5BAD6F', '#A07BC4',
  '#D4A843', '#4ABFBF', '#D45E8A', '#7BA07B',
];

function getColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function FurnitureObject({
  placement,
  furniture,
  isSelected,
  toolMode,
  onSelect,
  onMove,
  onRotate,
  onDragStart,
  onDragEnd,
}: FurnitureObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { gl, camera } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());
  const rotateStart = useRef<{ x: number; startAngle: number } | null>(null);

  const { w, h, d } = furniture.dimensions;
  const color = getColor(furniture.id);
  const emissive = isSelected ? color : '#000000';
  const emissiveIntensity = isSelected ? 0.3 : 0;

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();

    // In camera mode, don't intercept — let OrbitControls handle it
    if (toolMode === 'camera') return;

    onSelect(placement.furniture_id);

    if (toolMode === 'move') {
      setIsDragging(true);
      onDragStart();
      gl.domElement.style.cursor = 'grabbing';
      dragPlane.current.set(new THREE.Vector3(0, 1, 0), -placement.position.y);
      const pos = new THREE.Vector3(placement.position.x, placement.position.y, placement.position.z);
      dragOffset.current.copy(pos).sub(e.point);
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    }

    if (toolMode === 'rotate') {
      setIsDragging(true);
      onDragStart();
      gl.domElement.style.cursor = 'ew-resize';
      const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
      rotateStart.current = { x: clientX, startAngle: placement.rotation.y };
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    }
  }, [placement, toolMode, onSelect, onDragStart, gl]);

  const handlePointerUp = useCallback((e: any) => {
    if (!isDragging) return;
    setIsDragging(false);
    onDragEnd();
    gl.domElement.style.cursor = 'auto';
    rotateStart.current = null;
    (e?.target as HTMLElement)?.releasePointerCapture?.(e?.pointerId);
  }, [isDragging, onDragEnd, gl]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging) return;

    if (toolMode === 'move') {
      const target = new THREE.Vector3();
      e.ray.intersectPlane(dragPlane.current, target);
      if (target) {
        onMove(placement.furniture_id, {
          x: target.x + dragOffset.current.x,
          y: placement.position.y,
          z: target.z + dragOffset.current.z,
        });
      }
    }

    if (toolMode === 'rotate' && rotateStart.current) {
      const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
      const dx = clientX - rotateStart.current.x;
      // 200px of drag = π/2 rotation
      const angle = rotateStart.current.startAngle + (dx / 200) * (Math.PI / 2);
      onRotate(placement.furniture_id, { y: angle });
    }
  }, [isDragging, toolMode, placement, onMove, onRotate]);

  // Determine cursor based on tool mode
  const getCursor = () => {
    if (toolMode === 'move') return 'grab';
    if (toolMode === 'rotate') return 'ew-resize';
    return 'default';
  };

  return (
    <group
      position={[placement.position.x, placement.position.y, placement.position.z]}
      rotation={[0, placement.rotation.y, 0]}
    >
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        onPointerOver={() => {
          if (toolMode !== 'camera') gl.domElement.style.cursor = getCursor();
        }}
        onPointerOut={() => {
          if (!isDragging) gl.domElement.style.cursor = 'auto';
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(w + 0.02, h + 0.02, d + 0.02)]} />
          <lineBasicMaterial color="#60a5fa" linewidth={2} />
        </lineSegments>
      )}

      <Html
        position={[0, h / 2 + 0.2, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex flex-col items-center">
          <div
            className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
            style={{
              background: isSelected ? 'rgba(59,130,246,0.9)' : 'rgba(0,0,0,0.7)',
              color: 'white',
              border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {furniture.name}
          </div>
        </div>
      </Html>
    </group>
  );
}
