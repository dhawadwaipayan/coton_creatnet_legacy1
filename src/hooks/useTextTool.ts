import { useEffect } from 'react';
import { Canvas as FabricCanvas, IText } from 'fabric';

export const useTextTool = (
  fabricCanvas: FabricCanvas | null,
  selectedTool: string,
  textColor: string = '#FFFFFF',
  onTextAdded?: () => void
) => {
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // FREEZE: Skip during drawing mode
    if (selectedTool === 'draw') {
      console.log('TextTool: Frozen during drawing mode');
      return;
    }
    
    if (selectedTool !== 'text') return;

    const handleTextCreation = (opt: any) => {
      const pointer = fabricCanvas.getPointer(opt.e);
      console.log('Adding text at:', pointer.x, pointer.y);
      
      const text = new IText('Click to edit text', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 16,
        fill: textColor,
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
      });
      
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      text.enterEditing();
      fabricCanvas.renderAll();
      if (onTextAdded) onTextAdded();
    };

    fabricCanvas.on('mouse:down', handleTextCreation);

    return () => {
      fabricCanvas.off('mouse:down', handleTextCreation);
    };
  }, [fabricCanvas, selectedTool, textColor, onTextAdded]);
};