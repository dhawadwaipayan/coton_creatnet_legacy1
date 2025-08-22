import React, { useState } from 'react';

interface ZoomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const ZoomBar: React.FC<ZoomBarProps> = ({ zoom, onZoomIn, onZoomOut }) => {
  // For interaction state
  const [activeBtn, setActiveBtn] = useState<'in' | 'out' | null>(null);

  const iconBase = 'w-[32px] h-[32px] flex items-center justify-center rounded-lg transition-colors duration-75';
  const iconColor = (btn: 'in' | 'out') =>
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
      <div className="flex-1 flex items-center">
        <div className="w-px h-8 bg-[#232323] mx-0 flex-shrink-0" />
      </div>
      <span className="text-white text-sm font-gilroy font-medium select-none text-right" style={{ minWidth: 48 }}>{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomBar; 