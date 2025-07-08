import React, { useState, useRef } from "react";
import { HexColorPicker } from "react-colorful";

interface TextSubBarProps {
  textColor: string;
  setTextColor: (color: string) => void;
  className?: string;
}

export const TextSubBar: React.FC<TextSubBarProps> = ({ textColor, setTextColor, className = "" }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sidebar: left 24px, width 45px, text icon is the fifth button (index 4)
  const sidebarLeft = 24;
  const sidebarWidth = 45;
  const textIndex = 4;
  const buttonHeight = 30;
  const gap = 12;
  const offset = 16 + (buttonHeight + gap) * textIndex + buttonHeight / 2 - 75 - 70 - 20 + 5; // Move down by 5px

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
      className={`fixed z-50 bg-[#1a1a1a] border border-[#373737] rounded-xl flex flex-col items-center justify-center ${className}`}
      style={{
        left: `${sidebarLeft + sidebarWidth + 12}px`,
        top: '50%',
        transform: `translateY(-50%) translateY(${offset}px)` ,
        width: `${sidebarWidth}px`,
        height: '60px',
        paddingTop: 20,
        paddingBottom: 20,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div className="flex items-center justify-center w-full" style={{position: 'relative'}}>
        <div
          className="rounded-full cursor-pointer"
          style={{
            width: 20,
            height: 20,
            border: 'none',
            background: textColor,
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
              left: 'calc(100% + 16px)',
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
            <HexColorPicker color={textColor} onChange={setTextColor} style={{width: 180, height: 120}} />
          </div>
        )}
      </div>
    </div>
  );
}; 