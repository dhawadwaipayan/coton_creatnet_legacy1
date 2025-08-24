import React, { useState } from 'react';
import { ArrowsOutCardinal, PaintBrush, Shapes, TextT, RectangleDashed, Hand, DownloadSimple, SelectionBackground } from '@phosphor-icons/react';
import { removeImageBackground, blobToBase64 } from '@/lib/backgroundRemoval';

interface SidebarProps {
  onToolSelect?: (toolId: string) => void;
  selectedImageSrc?: string | null;
  selectedVideoSrc?: string | null;
  selectedTool: string | null;
  setSelectedTool: (toolId: string) => void;
  onBackgroundRemoved?: (newImageSrc: string) => void;
}
export const Sidebar: React.FC<SidebarProps> = ({
  onToolSelect,
  selectedImageSrc,
  selectedVideoSrc,
  selectedTool,
  setSelectedTool,
  onBackgroundRemoved
}) => {
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);

  const handleBackgroundRemove = async () => {
    if (!selectedImageSrc || isRemovingBackground) return;
    
    setIsRemovingBackground(true);
    console.log('[Sidebar] Starting background removal for:', selectedImageSrc);
    
    try {
      const result = await removeImageBackground(selectedImageSrc);
      
      if (result.success && result.data) {
        const base64Data = await blobToBase64(result.data);
        console.log('[Sidebar] Background removal successful, new image size:', result.data.size, 'bytes');
        
        // Call the callback to update the canvas
        onBackgroundRemoved?.(base64Data);
      } else {
        console.error('[Sidebar] Background removal failed:', result.error);
        alert(`Background removal failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[Sidebar] Background removal error:', error);
      alert('Background removal failed. Please try again.');
    } finally {
      setIsRemovingBackground(false);
    }
  };

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
        className={`group flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-colors duration-75 ${(selectedImageSrc || selectedVideoSrc) ? '' : 'opacity-50 cursor-not-allowed'}`}
        title={selectedVideoSrc ? "Download selected video" : "Download selected image"}
        disabled={!(selectedImageSrc || selectedVideoSrc)}
        onClick={() => {
          if (selectedVideoSrc) {
            // Download video
            const link = document.createElement('a');
            link.href = selectedVideoSrc;
            link.download = 'selected-video.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (selectedImageSrc) {
            // Download image
            const link = document.createElement('a');
            link.href = selectedImageSrc;
            link.download = 'selected-image.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      >
        <DownloadSimple size={20} color={(selectedImageSrc || selectedVideoSrc) ? '#fff' : '#A9A9A9'} className="group-hover:!text-white transition-colors duration-75" />
      </button>
      
      {/* Background Remove button */}
      <button
        className={`group flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-colors duration-75 ${selectedImageSrc && !selectedVideoSrc && !isRemovingBackground ? '' : 'opacity-50 cursor-not-allowed'}`}
        title={isRemovingBackground ? "Removing background..." : selectedVideoSrc ? "Background removal not available for videos" : "Remove background from selected image"}
        disabled={!selectedImageSrc || selectedVideoSrc || isRemovingBackground}
        onClick={handleBackgroundRemove}
      >
        {isRemovingBackground ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        ) : (
          <SelectionBackground 
            size={20} 
            color={selectedImageSrc && !selectedVideoSrc ? '#fff' : '#A9A9A9'} 
            className="group-hover:!text-white transition-colors duration-75" 
          />
        )}
      </button>
    </aside>;
}