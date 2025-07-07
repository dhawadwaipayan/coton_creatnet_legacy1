import React, { useState } from 'react';

interface DrawSubBarProps {
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
}

export const DrawSubBar: React.FC<DrawSubBarProps> = ({ brushColor, setBrushColor, brushSize, setBrushSize }) => {
  // For color picker, use a simple input[type=color] for now
  return (
    <div className="fixed left-[70px] top-1/2 -translate-y-1/2 z-50 w-[45px] h-[240px] bg-[#1a1a1a] border border-[#373737] rounded-xl flex flex-col items-center justify-between py-6 shadow-lg">
      {/* Brush thickness slider */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <input
          type="range"
          min={1}
          max={40}
          value={brushSize}
          onChange={e => setBrushSize(Number(e.target.value))}
          className="slider-thumb-vertical"
          style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical', height: 120, width: 30 }}
        />
        <div className="mt-2 text-xs text-neutral-400">{brushSize}px</div>
      </div>
      {/* Color picker */}
      <label className="mb-2 cursor-pointer">
        <input
          type="color"
          value={brushColor}
          onChange={e => setBrushColor(e.target.value)}
          className="opacity-0 w-0 h-0"
        />
        <div
          className="rounded-full border border-neutral-700"
          style={{ width: 40, height: 40, background: brushColor }}
        />
      </label>
    </div>
  );
}; 