import React from 'react';

interface DrawSubBarProps {
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
}

export const DrawSubBar: React.FC<DrawSubBarProps> = ({ brushColor, setBrushColor, brushSize, setBrushSize }) => {
  return (
    <div
      className="fixed z-50"
      style={{
        left: 70, // Sidebar is left:6 (24px) + width:45px + gap:1px (approx)
        top: 'calc(50% + 48px)', // Sidebar is centered, brush icon is 3rd (2*45px + gaps), adjust as needed
        transform: 'translateY(-50%)',
      }}
    >
      <div
        className="w-[56px] h-[220px] bg-[#1a1a1a] border border-[#373737] rounded-xl flex flex-col items-center justify-between shadow-lg"
        style={{ padding: '18px 0' }}
      >
        {/* Brush thickness slider */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <input
            type="range"
            min={1}
            max={40}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="appearance-none h-[140px] w-[24px] bg-transparent slider-vertical"
            style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
          />
        </div>
        {/* Color picker */}
        <label className="mb-0 cursor-pointer flex items-center justify-center">
          <input
            type="color"
            value={brushColor}
            onChange={e => setBrushColor(e.target.value)}
            className="opacity-0 w-0 h-0"
          />
          <div
            className="rounded-full border border-neutral-700"
            style={{ width: 20, height: 20, background: brushColor }}
          />
        </label>
      </div>
      <style>{`
        .slider-vertical::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 12px;
          border-radius: 6px;
          background: #232323;
          border: 2px solid #373737;
          box-shadow: 0 0 0 2px #232323;
        }
        .slider-vertical::-webkit-slider-runnable-track {
          width: 6px;
          height: 140px;
          background: #232323;
          border-radius: 3px;
        }
        .slider-vertical:focus::-webkit-slider-thumb {
          outline: none;
          border-color: #E1FF00;
        }
        .slider-vertical::-moz-range-thumb {
          width: 24px;
          height: 12px;
          border-radius: 6px;
          background: #232323;
          border: 2px solid #373737;
        }
        .slider-vertical::-moz-range-track {
          width: 6px;
          height: 140px;
          background: #232323;
          border-radius: 3px;
        }
        .slider-vertical:focus::-moz-range-thumb {
          outline: none;
          border-color: #E1FF00;
        }
        .slider-vertical::-ms-thumb {
          width: 24px;
          height: 12px;
          border-radius: 6px;
          background: #232323;
          border: 2px solid #373737;
        }
        .slider-vertical::-ms-fill-lower,
        .slider-vertical::-ms-fill-upper {
          background: #232323;
          border-radius: 3px;
        }
        .slider-vertical:focus::-ms-thumb {
          outline: none;
          border-color: #E1FF00;
        }
        .slider-vertical {
          outline: none;
        }
      `}</style>
    </div>
  );
}; 