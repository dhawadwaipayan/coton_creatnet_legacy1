import React, { useState, useRef } from "react";
import { HexColorPicker } from "react-colorful";

interface BrushSubBarProps {
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  className?: string;
}

export const BrushSubBar: React.FC<BrushSubBarProps> = ({ brushColor, setBrushColor, brushSize, setBrushSize, className = "" }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sidebar: left 24px, width 45px
  // Sidebar is vertically centered: top 50%, translateY(-50%)
  // Brush icon is the third button (index 2), each button 30px, gap 12px, padding 16px
  const sidebarLeft = 24;
  const sidebarWidth = 45;
  const brushIndex = 2;
  const buttonHeight = 30;
  const gap = 12;
  const offset = 16 + (buttonHeight + gap) * brushIndex + buttonHeight / 2 - 75 - 70 - 20; // Move bar up by 90px total

  // Slider values
  const min = 1;
  const max = 20;
  const percent = ((brushSize - min) / (max - min)) * 100;
  const invertedPercent = 100 - percent;

  // Close picker on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker]);

  return (
    <div
      className={`fixed z-50 bg-[#1a1a1a] border border-[#373737] rounded-xl flex flex-col items-center justify-between ${className}`}
      style={{
        left: `${sidebarLeft + sidebarWidth + 12}px`,
        top: '50%',
        transform: `translateY(-50%) translateY(${offset}px)` ,
        width: `${sidebarWidth}px`,
        height: '170px',
        paddingTop: 20,
        paddingBottom: 20,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div style={{paddingTop: 0, paddingBottom: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        {/* Custom vertical slider */}
        <div style={{position: 'relative', height: 90, width: 16, display: 'flex', alignItems: 'center', marginBottom: 20}}>
          {/* Track background */}
          <div style={{position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: 4, height: '100%', background: '#373737', borderRadius: 2}} />
          {/* Green fill */}
          <div style={{position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 4, height: `${percent}%`, background: '#E1FF00', borderRadius: 2}} />
          {/* Range input (transparent, overlays for interaction) */}
          <input
            type="range"
            min={min}
            max={max}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 16,
              height: 90,
              opacity: 0,
              zIndex: 2,
              writingMode: 'vertical-lr',
              WebkitAppearance: 'slider-vertical',
              direction: 'rtl',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          {/* Custom thumb */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: `calc(${percent}% - 7px)`, // 7px is half the thumb size
              transform: 'translateX(-50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#1A1A1A',
              border: '2px solid #373737',
              zIndex: 1,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {/* Color picker inside the bar, centered at the bottom */}
        <div className="flex items-center justify-center w-full" style={{position: 'relative'}}>
          <div
            className="rounded-full cursor-pointer"
            style={{
              width: 20,
              height: 20,
              border: 'none',
              background: brushColor,
              padding: 0,
              margin: 0,
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              display: 'block',
            }}
            onClick={() => setShowPicker((v) => !v)}
          />
          {showPicker && (
            <div
              ref={pickerRef}
              style={{
                position: 'absolute',
                left: 'calc(100% + 16px)', // 16px gap to the right of the bar
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#232323',
                border: '1.5px solid #373737',
                borderRadius: 12,
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                padding: 16,
                zIndex: 100,
              }}
            >
              <HexColorPicker color={brushColor} onChange={setBrushColor} style={{width: 180, height: 120}} />
            </div>
          )}
        </div>
      </div>
      <style>{`
        input[type='color'].rounded-full {
          border-radius: 50%;
          overflow: hidden;
        }
        input[type='color'].rounded-full::-webkit-color-swatch {
          border-radius: 50%;
          border: none;
        }
        input[type='color'].rounded-full::-webkit-color-swatch-wrapper {
          border-radius: 50%;
          padding: 0;
        }
        input[type='color'].rounded-full::-moz-color-swatch {
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
};
