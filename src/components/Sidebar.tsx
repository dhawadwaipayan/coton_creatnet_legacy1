import React, { useState } from 'react';
import { ArrowsOutCardinal, PaintBrush, Shapes, TextT, RectangleDashed, Hand, DownloadSimple } from '@phosphor-icons/react';

interface SidebarProps {
  onToolSelect?: (toolId: string) => void;
  selectedImageSrc?: string | null;
  selectedTool: string | null;
  setSelectedTool: (toolId: string) => void;
}
export const Sidebar: React.FC<SidebarProps> = ({
  onToolSelect,
  selectedImageSrc,
  selectedTool,
  setSelectedTool
}) => {
  const tools = [{
    id: 'select',
    icon: ArrowsOutCardinal,
    label: 'Select'
  }, {
    id: 'hand',
    icon: Hand,
    label: 'Hand'
  }, {
    id: 'draw',
    icon: PaintBrush,
    label: 'Draw'
  },
  // SHAPE BUTTON REFERENCE (keep for future use)
  // {
  //   id: 'shape',
  //   icon: Shapes,
  //   label: 'Shape'
  // },
  {
    id: 'text',
    icon: TextT,
    label: 'Text'
  }, {
    id: 'frame',
    icon: RectangleDashed,
    label: 'Frame'
  }];
  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    onToolSelect?.(toolId);
    console.log(`Selected tool: ${toolId}`);
  };
  return <aside className="fixed left-6 top-1/2 transform -translate-y-1/2 z-10 w-[45px] bg-[#1a1a1a] border border-[#373737] rounded-xl py-4 px-3 flex flex-col gap-3 items-center shadow-lg">
      {tools.map(tool => {
        const IconComponent = tool.icon;
        const isActive = selectedTool === tool.id;
        const iconColor = isActive ? '#E1FF00' : '#A9A9A9';
        
        return (
          <button 
            key={tool.id} 
            onClick={() => handleToolSelect(tool.id)} 
            className="group flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-colors duration-75" 
            title={tool.label}
            tabIndex={0}
          >
            <IconComponent 
              size={20} 
              color={isActive ? '#E1FF00' : '#A9A9A9'}
              className="group-hover:!text-white transition-colors duration-75"
            />
          </button>
        );
      })}
      {/* Download button */}
      <button
        className={`group flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-colors duration-75 ${selectedImageSrc ? '' : 'opacity-50 cursor-not-allowed'}`}
        title="Download selected image"
        disabled={!selectedImageSrc}
        onClick={() => {
          if (!selectedImageSrc) return;
          const link = document.createElement('a');
          link.href = selectedImageSrc;
          link.download = 'selected-image.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      >
        <DownloadSimple size={20} color={selectedImageSrc ? '#fff' : '#A9A9A9'} className="group-hover:!text-white transition-colors duration-75" />
      </button>
    </aside>;
}