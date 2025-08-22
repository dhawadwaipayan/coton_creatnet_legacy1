import React, { useState } from 'react';

interface ZoomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
}

const ZoomBar: React.FC<ZoomBarProps> = ({ zoom, onZoomIn, onZoomOut, onZoomReset, onZoomFit }) => {
  // For interaction state
  const [activeBtn, setActiveBtn] = useState<'in' | 'out' | 'reset' | 'fit' | null>(null);

  const iconBase = 'w-[32px] h-[32px] flex items-center justify-center rounded-lg transition-colors duration-75';
  const iconColor = (btn: 'in' | 'out' | 'reset' | 'fit') =>
    activeBtn === btn
      ? 'text-[#E1FF00]'
      : 'hover:text-white text-neutral-400';

  return (
    <div className="flex items-center bg-[#1a1a1a] border border-[#373737] rounded-xl h-[45px] pl-[16px] pr-[24px] gap-2" style={{ minWidth: 180 }}>
      <button
        onClick={onZoomIn}
        onMouseDown={() => setActiveBtn('in')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        className={`${iconBase} ${iconColor('in')}`}
        aria-label="Zoom in"
        type="button"
        style={{ width: 32, height: 32, padding: 0 }}
      >
        <span className="flex items-center justify-center w-[15px] h-[15px] text-[20px] font-bold select-none">+</span>
      </button>
      <button
        onClick={onZoomOut}
        onMouseDown={() => setActiveBtn('out')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        className={`${iconBase} ${iconColor('out')}`}
        aria-label="Zoom out"
        type="button"
        style={{ width: 32, height: 32, padding: 0 }}
      >
        <span className="flex items-center justify-center w-[15px] h-[15px] text-[20px] font-bold select-none">–</span>
      </button>
      <button
        onClick={onZoomReset}
        onMouseDown={() => setActiveBtn('reset')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        className={`${iconBase} ${iconColor('reset')}`}
        aria-label="Reset zoom"
        type="button"
        style={{ width: 32, height: 32, padding: 0 }}
        title="Reset to 100%"
      >
        <span className="flex items-center justify-center w-[15px] h-[15px] text-[12px] font-bold select-none">100%</span>
      </button>
      <button
        onClick={onZoomFit}
        onMouseDown={() => setActiveBtn('fit')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        className={`${iconBase} ${iconColor('fit')}`}
        aria-label="Fit to viewport"
        type="button"
        style={{ width: 32, height: 32, padding: 0 }}
        title="Fit to viewport"
      >
        <span className="flex items-center justify-center w-[15px] h-[15px] text-[12px] font-bold select-none">Fit</span>
      </button>
      <div className="flex-1 flex items-center">
        <div className="w-px h-8 bg-[#232323] mx-0 flex-shrink-0" />
      </div>
      <span className="text-white text-sm font-gilroy font-medium select-none text-right" style={{ minWidth: 48 }}>{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomBar; 