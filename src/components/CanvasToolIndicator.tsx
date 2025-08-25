import React from 'react';

interface CanvasToolIndicatorProps {
  selectedTool: string;
}

export const CanvasToolIndicator: React.FC<CanvasToolIndicatorProps> = ({ selectedTool }) => {
  const getToolMessage = () => {
    switch (selectedTool) {
      case 'draw':
        return 'Drawing mode active';
      case 'frame':
        return 'Frame creation mode';
      case 'select':
        return 'Select/Move mode';
      case 'hand':
        return 'Pan & Zoom mode - Drag to pan, wheel to zoom';
      case 'shape':
        return 'Shape mode';
      case 'text':
        return 'Text mode - Click anywhere to add text, double-click existing text to edit';
      default:
        return '';
    }
  };

  if (!selectedTool) return null;

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-[rgba(0,0,0,0.8)] text-[#E1FF00] text-xs px-3 py-2 rounded-md pointer-events-none border border-[rgba(255,255,255,0.1)]">
      {getToolMessage()}
    </div>
  );
};