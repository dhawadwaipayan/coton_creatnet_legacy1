import React from "react";

interface BrushSubBarProps {
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  className?: string;
}

export const BrushSubBar: React.FC<BrushSubBarProps> = ({ brushColor, setBrushColor, brushSize, setBrushSize, className = "" }) => {
  return (
    <div
      className={`box-border inline-flex gap-2.5 items-center px-2.5 py-3 rounded-xl border border-solid bg-zinc-900 border-white border-opacity-10 h-[105px] w-[42px] max-md:px-2.5 max-md:py-2.5 max-md:h-[95px] max-md:w-[38px] max-sm:px-2 max-sm:py-2.5 max-sm:h-[85px] max-sm:w-[34px] ${className}`}
    >
      <div className="flex relative flex-col gap-2.5 items-center w-[22px] max-md:gap-2 max-md:w-5 max-sm:gap-2 max-sm:w-[18px]">
        <div className="flex relative flex-col gap-0 justify-end items-center self-stretch h-[55px] max-md:h-[50px] max-sm:h-[45px]">
          <input
            type="range"
            min={1}
            max={40}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="absolute left-1/2 -translate-x-1/2 slider-vertical appearance-none h-[55px] w-[22px] bg-transparent"
            style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical', zIndex: 2 }}
          />
          <div className="box-border flex relative flex-col shrink-0 gap-3.5 justify-center items-center px-0 py-3 rounded-lg border-solid rotate-90 bg-neutral-800 border-[0.475px] border-white border-opacity-10 h-[3.8px] w-[54px] max-md:h-[3.4px] max-md:w-[49px] max-sm:w-11 max-sm:h-[3px] pointer-events-none" />
          <div className="box-border flex relative flex-col shrink-0 gap-3.5 justify-center items-center px-0 py-3 rounded-xl border-solid bg-neutral-800 border-[0.475px] border-white border-opacity-10 h-[7px] w-[22px] max-md:w-5 max-md:h-1.5 max-sm:h-[5.5px] max-sm:w-[18px] pointer-events-none" />
        </div>
        <label className="mt-2 cursor-pointer flex items-center justify-center">
          <input
            type="color"
            value={brushColor}
            onChange={e => setBrushColor(e.target.value)}
            className="opacity-0 w-0 h-0"
          />
          <div
            className="rounded-full border border-neutral-700"
            style={{ width: 19, height: 19, background: brushColor }}
          />
        </label>
      </div>
      <style>{`
        .slider-vertical::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 7px;
          border-radius: 6px;
          background: #232323;
          border: 2px solid #373737;
          box-shadow: 0 0 0 2px #232323;
        }
        .slider-vertical::-webkit-slider-runnable-track {
          width: 3.8px;
          height: 55px;
          background: #232323;
          border-radius: 3px;
        }
        .slider-vertical:focus::-webkit-slider-thumb {
          outline: none;
          border-color: #E1FF00;
        }
        .slider-vertical::-moz-range-thumb {
          width: 22px;
          height: 7px;
          border-radius: 6px;
          background: #232323;
          border: 2px solid #373737;
        }
        .slider-vertical::-moz-range-track {
          width: 3.8px;
          height: 55px;
          background: #232323;
          border-radius: 3px;
        }
        .slider-vertical:focus::-moz-range-thumb {
          outline: none;
          border-color: #E1FF00;
        }
        .slider-vertical::-ms-thumb {
          width: 22px;
          height: 7px;
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
