import { useEffect, useState } from 'react';

import { Canvas as FabricCanvas, Pattern, PencilBrush } from 'fabric';

export const useCanvasInitialization = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('Initializing canvas with dimensions:', {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 5000,
      height: 5000,
      backgroundColor: '#1E1E1E',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
    });

    // Create grid pattern using Fabric.js Pattern
    const createGridPattern = () => {
      const patternCanvas = document.createElement('canvas');
      const patternCtx = patternCanvas.getContext('2d');
      const gridSize = 20;
      
      patternCanvas.width = gridSize;
      patternCanvas.height = gridSize;
      
      if (patternCtx) {
        patternCtx.fillStyle = '#1E1E1E';
        patternCtx.fillRect(0, 0, gridSize, gridSize);
        patternCtx.strokeStyle = '#333333';
        patternCtx.lineWidth = 0.5;
        patternCtx.beginPath();
        patternCtx.moveTo(0, gridSize);
        patternCtx.lineTo(gridSize, gridSize);
        patternCtx.lineTo(gridSize, 0);
        patternCtx.stroke();
      }
      
      return patternCanvas;
    };

    // Set grid background using Fabric.js Pattern
    const gridCanvas = createGridPattern();
    const pattern = new Pattern({
      source: gridCanvas,
      repeat: 'repeat'
    });
    canvas.backgroundColor = pattern;

    // Initialize the freeDrawingBrush properly with PencilBrush
    const brush = new PencilBrush(canvas);
    brush.color = '#00FF00'; // Bright green for visibility
    brush.width = 5;
    canvas.freeDrawingBrush = brush;
    
    console.log('Canvas initialized with drawing brush:', {
      brush: brush,
      brushColor: brush.color,
      brushWidth: brush.width,
      canvasDimensions: {
        width: canvas.width,
        height: canvas.height,
        getWidth: canvas.getWidth(),
        getHeight: canvas.getHeight()
      }
    });

    setFabricCanvas(canvas);

    // No window resize: keep canvas fixed at 5000x5000
    return () => {
      canvas.dispose();
    };
  }, [canvasRef]);

  return fabricCanvas;
};