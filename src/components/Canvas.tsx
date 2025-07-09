import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';

// Helper to generate grid lines for a 5000x5000 board
function generateGridLines(size = 5000, gridSize = 20) {
  const lines = [];
  // Vertical lines
  for (let x = 0; x <= size; x += gridSize) {
    lines.push({ points: [x, 0, x, size] });
  }
  // Horizontal lines
  for (let y = 0; y <= size; y += gridSize) {
    lines.push({ points: [0, y, size, y] });
  }
  return lines;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export const Canvas = forwardRef(function CanvasStub(props: any, ref) {
  useImperativeHandle(ref, () => ({
    getFabricCanvas: () => null
  }), []);

  const stageRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const boardWidth = 5000;
  const boardHeight = 5000;
  const gridLines = generateGridLines(boardWidth, 20);

  // Get viewport size
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  React.useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hand tool state
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{x: number, y: number} | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Clamp stage position so you can't pan outside the board
  function clampStagePos(pos: {x: number, y: number}) {
    const minX = Math.min(0, viewport.width - boardWidth);
    const minY = Math.min(0, viewport.height - boardHeight);
    const maxX = 0;
    const maxY = 0;
    return {
      x: clamp(pos.x, minX, maxX),
      y: clamp(pos.y, minY, maxY)
    };
  }

  // Mouse down: start dragging
  const handleMouseDown = (e: any) => {
    setIsDragging(true);
    setLastPos({
      x: e.evt.clientX,
      y: e.evt.clientY
    });
  };

  // Mouse move: update stage position
  const handleMouseMove = (e: any) => {
    if (!isDragging || !lastPos) return;
    const dx = e.evt.clientX - lastPos.x;
    const dy = e.evt.clientY - lastPos.y;
    setStagePos(prev => clampStagePos({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.evt.clientX, y: e.evt.clientY });
  };

  // Mouse up: stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
    setLastPos(null);
  };

  return (
    <div className={`fixed inset-0 z-0 overflow-hidden ${props.className || ''}`} style={{ background: '#1E1E1E' }}>
      <Stage
        width={viewport.width}
        height={viewport.height}
        ref={stageRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, cursor: isDragging ? 'grabbing' : 'grab' }}
        x={stagePos.x}
        y={stagePos.y}
        draggable={false}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
      >
        <Layer ref={layerRef} width={boardWidth} height={boardHeight}>
          {/* Draw grid lines */}
          {gridLines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="#333"
              strokeWidth={0.5}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
});
