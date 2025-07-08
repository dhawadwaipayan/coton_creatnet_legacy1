import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Image as FabricImage } from 'fabric';
import type { Canvas as FabricCanvas } from 'fabric';
import { useCanvasInitialization } from '@/hooks/useCanvasInitialization';
import { useSimpleToolSwitching } from '@/hooks/useSimpleToolSwitching';
import { useObjectStateManager } from '@/hooks/useObjectStateManager';
import { useTextTool } from '@/hooks/useTextTool';
import { useHandTool } from '@/hooks/useHandTool';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import { useFrameTool } from '@/hooks/useFrameTool';
import { CanvasToolIndicator } from './CanvasToolIndicator';

interface CanvasProps {
  className?: string;
  selectedTool?: string;
  onSelectedImageSrcChange?: (src: string | null) => void;
  brushColor?: string;
  brushSize?: number;
  textColor?: string;
  onTextAdded?: () => void;
}

export interface CanvasHandle {
  getFabricCanvas: () => FabricCanvas | null;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ className = '', selectedTool = 'select', onSelectedImageSrcChange, brushColor = '#e5e5e5', brushSize = 16, textColor = '#FF0000', onTextAdded }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
    const [isCreatingFrame, setIsCreatingFrame] = useState(false);
    const [frames, setFrames] = useState<any[]>([]);

    // Initialize Fabric.js canvas
    const fabricCanvas = useCanvasInitialization(canvasRef);

    // Expose fabricCanvas to parent
    useImperativeHandle(ref, () => ({
      getFabricCanvas: () => fabricCanvas
    }), [fabricCanvas]);

    // New simplified architecture
    useSimpleToolSwitching(fabricCanvas, selectedTool, brushColor, brushSize);
    useObjectStateManager(fabricCanvas, selectedTool);
    
    // Tool-specific handlers
    useTextTool(fabricCanvas, selectedTool, textColor, onTextAdded);
    
    useHandTool({
      fabricCanvas,
      selectedTool
    });
    
    useDeleteHandler(fabricCanvas, selectedTool);
    
    // Frame tool integration
    useFrameTool({
      fabricCanvas,
      selectedTool,
      isCreatingFrame,
      setIsCreatingFrame,
      setFrames
    });

    // Make drawn paths selectable when created
    useEffect(() => {
      if (!fabricCanvas) return;

      const handlePathCreated = (e: any) => {
        const path = e.path;
        if (path) {
          path.set({
            selectable: true,
            evented: true,
          });
          console.log('Path created and made selectable:', path);
        }
      };

      fabricCanvas.on('path:created', handlePathCreated);

      return () => {
        fabricCanvas.off('path:created', handlePathCreated);
      };
    }, [fabricCanvas]);

    // Register global image import handler for TopBar
    useEffect(() => {
      if (!fabricCanvas) return;

      const handleImageImport = (file: File) => {
        console.log('Canvas: Received image import request for:', file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          console.log('Canvas: FileReader loaded, creating Fabric image');
          
          FabricImage.fromURL(result)
            .then((img) => {
              console.log('Canvas: Fabric image created, adding to canvas');
              img.set({
                left: 100,
                top: 100,
                scaleX: 0.5,
                scaleY: 0.5,
                selectable: true,
                evented: true,
              });
              fabricCanvas.add(img);
              fabricCanvas.renderAll();
              console.log('Canvas: Image added successfully');
            })
            .catch((error) => {
              console.error('Canvas: Error creating Fabric image:', error);
            });
        };
        
        reader.onerror = (error) => {
          console.error('Canvas: FileReader error:', error);
        };
        
        reader.readAsDataURL(file);
      };

      // Register handler on window object for TopBar to use
      (window as any).handleCanvasImageImport = handleImageImport;
      console.log('Canvas: Image import handler registered on window');

      return () => {
        delete (window as any).handleCanvasImageImport;
        console.log('Canvas: Image import handler removed from window');
      };
    }, [fabricCanvas]);

    // Add state to track last selected image src
    useEffect(() => {
      if (!fabricCanvas || !onSelectedImageSrcChange) return;

      const handleSelection = () => {
        const active = fabricCanvas.getActiveObject();
        if (active && active.type === 'image' && (active as any).getSrc) {
          // For Fabric.Image, getSrc() returns the image src
          onSelectedImageSrcChange((active as any).getSrc());
        } else {
          onSelectedImageSrcChange(null);
        }
      };
      fabricCanvas.on('selection:created', handleSelection);
      fabricCanvas.on('selection:updated', handleSelection);
      fabricCanvas.on('selection:cleared', handleSelection);
      // Initial check
      handleSelection();
      return () => {
        fabricCanvas.off('selection:created', handleSelection);
        fabricCanvas.off('selection:updated', handleSelection);
        fabricCanvas.off('selection:cleared', handleSelection);
      };
    }, [fabricCanvas, onSelectedImageSrcChange]);

    return (
      <div className={`fixed inset-0 z-0 overflow-hidden ${className}`}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ 
            cursor: selectedTool === 'draw' ? 'crosshair' : 'default',
            touchAction: 'none', // Prevent touch scrolling on mobile
            pointerEvents: 'auto' // Ensure mouse events are captured
          }}
        />
        
        {/* <CanvasToolIndicator selectedTool={selectedTool} /> */}
      </div>
    );
  }
);
