import React, { useState, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { GenerationPanel } from '@/components/GenerationPanel';
import { ModePanel } from '@/components/ModePanel';
import { Canvas, CanvasHandle } from '@/components/Canvas';
import { TopBar } from '@/components/TopBar';
import ZoomBar from '@/components/ZoomBar';
import UserBar from '@/components/UserBar';

const Index = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>('select');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [sketchBarOpen, setSketchBarOpen] = useState(false);
  const [boundingBoxCreated, setBoundingBoxCreated] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const canvasRef = useRef<CanvasHandle>(null);
  
  // Zoom state for demo
  const [zoom, setZoom] = useState(100);
  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 500));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 10));

  // Brush state for draw tool (lifted up)
  const [brushColor, setBrushColor] = useState('#e5e5e5');
  const [brushSize, setBrushSize] = useState(16);

  const handleToolSelect = (toolId: string) => {
    if (sketchBarOpen && !boundingBoxCreated) {
      setSketchBarOpen(false);
      setSelectedTool(toolId);
      setSelectedMode('');
      return;
    }
    setSelectedTool(toolId);
    setSelectedMode(toolId);
    console.log(`Tool selected: ${toolId}`);
  };

  // Handler to be called when Sketch mode is activated
  const handleSketchModeActivated = () => {
    setSketchBarOpen(true);
    setBoundingBoxCreated(false);
    setSelectedTool(null); // No tool active while bounding box is being created
  };

  // Handler to be called when bounding box is created
  const handleBoundingBoxCreated = () => {
    setBoundingBoxCreated(true);
    setSelectedTool('select'); // Activate move/select tool
  };

  // Handler to close Sketch bar
  const handleCloseSketchBar = () => {
    setSketchBarOpen(false);
    setBoundingBoxCreated(false);
    setSelectedTool('select');
  };

  return (
    <main className="bg-[rgba(33,33,33,1)] flex flex-col overflow-hidden min-h-screen relative">
      {/* Canvas Background - behind everything */}
      <Canvas
        ref={canvasRef}
        selectedTool={selectedTool || 'select'}
        onSelectedImageSrcChange={setSelectedImageSrc}
        brushColor={brushColor}
        brushSize={brushSize}
      />
      
      {/* Sidebar - positioned center left */}
      <Sidebar onToolSelect={handleToolSelect} selectedImageSrc={selectedImageSrc} selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
      
      {/* UI Overlay - above canvas */}
      <div className="relative z-10 flex flex-col pl-[37px] pr-20 py-[34px] min-h-screen max-md:px-5 pointer-events-none">
        {/* Top Bar - positioned top left */}
        <div className="absolute top-[34px] left-6 pointer-events-auto">
          <TopBar />
        </div>
        
        {/* User Bar - positioned top right */}
        <div className="absolute top-[34px] right-6 z-30 pointer-events-auto">
          <UserBar />
        </div>
        
        <div className="flex flex-1 relative">
          <div className="flex-1" />
          
          {/* Restore original bottom bar position: centered at bottom */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-auto">
            <GenerationPanel />
            <ModePanel
              canvasRef={canvasRef}
              onSketchModeActivated={handleSketchModeActivated}
              onBoundingBoxCreated={handleBoundingBoxCreated}
              showSketchSubBar={sketchBarOpen}
              closeSketchBar={handleCloseSketchBar}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
            />
          </div>
        </div>
        {/* ZoomBar: bottom right, inside the same container as TopBar, right-6 for perfect gap */}
        <div className="pointer-events-auto absolute right-6 bottom-0 z-20 mb-[34px]">
          <ZoomBar zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
        </div>
      </div>
    </main>
  );
};

export default Index;
