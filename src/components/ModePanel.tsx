import React, { useState, useRef, useEffect } from 'react';
import { SketchSubBar } from './SketchSubBar';
import { RenderSubBar } from './RenderSubBar';
import { BrushSubBar } from './BrushSubBar';
// Removed CanvasHandle import; use any for canvasRef
import { callOpenAIGptImage } from '@/lib/openaiSketch';
// Removed: import { Image as FabricImage } from 'fabric';
// Removed: import * as fabric from 'fabric';

export interface ModePanelProps {
  canvasRef: React.RefObject<any>;
  onSketchModeActivated?: () => void;
  onBoundingBoxCreated?: () => void;
  showSketchSubBar?: boolean;
  closeSketchBar?: () => void;
  selectedMode?: string;
  setSelectedMode?: (mode: string) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  sketchModeActive: boolean;
  onSketchBoundingBoxChange: (box: { x: number, y: number, width: number, height: number } | null) => void;
}

export const ModePanel: React.FC<ModePanelProps> = ({ canvasRef, onSketchModeActivated, onBoundingBoxCreated, showSketchSubBar, closeSketchBar, selectedMode, setSelectedMode, brushColor, setBrushColor, brushSize, setBrushSize, sketchModeActive, onSketchBoundingBoxChange }) => {
  const [showRenderSubBar, setShowRenderSubBar] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'generating' | 'error' | 'success'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastInputImage, setLastInputImage] = useState<string | null>(null);
  const modes = [{
    id: 'sketch',
    icon: 'https://cdn.builder.io/api/v1/image/assets/49361a2b7ce44657a799a73862a168f7/ee2941b19a658fe2d209f852cf910c39252d3c4f?placeholderIfAbsent=true',
    label: 'Sketch'
  }, {
    id: 'render',
    icon: 'https://cdn.builder.io/api/v1/image/assets/49361a2b7ce44657a799a73862a168f7/837a94f315ae3d40b566e53a84400dac739a1e1a?placeholderIfAbsent=true',
    label: 'Render'
  }, {
    id: 'colorway',
    icon: 'https://cdn.builder.io/api/v1/image/assets/49361a2b7ce44657a799a73862a168f7/455b40b53a04278357300eaa66c8577afba94ea1?placeholderIfAbsent=true',
    label: 'Colorway'
  }, {
    id: 'sides',
    icon: 'https://cdn.builder.io/api/v1/image/assets/49361a2b7ce44657a799a73862a168f7/6eb8891421d30b1132ff78da0afd8482ce50b611?placeholderIfAbsent=true',
    label: 'Sides'
  }];
  const handleModeSelect = (modeId: string) => {
    if (setSelectedMode) setSelectedMode(modeId);
    if (canvasRef.current && canvasRef.current.clearSketchBox) {
      canvasRef.current.clearSketchBox();
    }
    if (modeId === 'sketch') {
      setShowRenderSubBar(false);
      if (onSketchModeActivated) onSketchModeActivated();
    } else if (modeId === 'render') {
      setShowRenderSubBar(true);
      if (closeSketchBar) closeSketchBar();
    } else {
      if (closeSketchBar) closeSketchBar();
      setShowRenderSubBar(false);
    }
    console.log(`Selected mode: ${modeId}`);
  };

  const handleSketchCancel = () => {
    if (closeSketchBar) closeSketchBar();
    if (setSelectedMode) setSelectedMode(''); // Reset to non-clicked state
    if (canvasRef.current && canvasRef.current.clearSketchBox) {
      canvasRef.current.clearSketchBox();
    }
    // boundingBoxRef.current = null; // This line is no longer needed
    // setSketchBoundingBox(null); // This line is no longer needed
  };

  // Bounding box state for Sketch mode
  const [sketchBoundingBox, setSketchBoundingBox] = useState<{ left: number, top: number, width: number, height: number } | null>(null);
  const boundingBoxRef = useRef<any>(null);
  const boundingBoxDrawing = useRef(false);
  const boundingBoxStart = useRef<{ x: number, y: number } | null>(null);

  // Add state for Konva-based bounding box
  const [konvaSketchBox, setKonvaSketchBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Ensure bounding box state is updated from Canvas
  const handleSketchBoundingBoxChange = (box: { x: number, y: number, width: number, height: number } | null) => {
    console.log('Bounding box updated:', box);
    setKonvaSketchBox(box);
    if (onSketchBoundingBoxChange) onSketchBoundingBoxChange(box);
  };

  // Remove all functions, useEffects, and logic that reference fabric, FabricImage, or getFabricCanvas
  // Remove all bounding box logic that uses fabricCanvas or fabric.Rect
  // Only keep Konva-based bounding box state and callbacks (e.g., konvaSketchBox, handleSketchBoundingBoxChange)
  // Ensure handleSketchGenerate and handleRenderGenerate use only Konva-based export methods via canvasRef.current
  // On Generate, always call canvasRef.current.exportCurrentBoundingBoxAsPng()
  const handleSketchGenerate = async (details: string) => {
    setAiStatus('generating');
    setAiError(null);
    if (!canvasRef.current) {
      setAiStatus('idle');
      return;
    }
    // Always get the bounding box PNG from Canvas
    const base64Sketch = canvasRef.current.exportCurrentBoundingBoxAsPng();
    if (!base64Sketch) {
      alert('No bounding box defined for export.');
      setAiStatus('idle');
      return;
    }
    // Place a 500x500 placeholder beside the bounding box using the provided transparent PNG
    const sketchBox = canvasRef.current.sketchBox;
    const stagePos = canvasRef.current.stagePos || { x: 0, y: 0 };
    let x = sketchBox ? sketchBox.x + sketchBox.width + 40 : 100;
    let y = sketchBox ? sketchBox.y : 100;
    x += stagePos.x;
    y += stagePos.y;
    const placeholderUrl = '/Placeholder_Image.png';
    const placeholderWidth = 200;
    const placeholderHeight = 200;
    let placeholderId: string | null = null;
    await new Promise<void>(resolve => {
      if (canvasRef.current.importImage) {
        placeholderId = canvasRef.current.importImage(placeholderUrl, x, y, placeholderWidth, placeholderHeight, (id: string) => {
          // After image is loaded, select it
          if (canvasRef.current && canvasRef.current.setSelectedIds) {
            canvasRef.current.setSelectedIds([{ id, type: 'image' }]);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
    // After adding placeholder, close sketch tab and switch to select tool
    if (closeSketchBar) closeSketchBar();
    if (setSelectedMode) setSelectedMode('select');
    // No overlay/status logic
    // Prepare input for OpenAI
    const promptText = `Generate an Image by redoing the flat sketch in the same style. The generated flat sketch should have only black lines. Consider if any annotations are given on the image to update those changes on the newly generated flat sketch. ${details}`.trim();
    try {
      const result = await callOpenAIGptImage({
        base64Sketch,
        promptText
      });
      let base64 = null;
      if (result && Array.isArray(result.output)) {
        const imageOutput = result.output.find(
          (item) => item.type === 'image_generation_call' && item.result
        );
        if (imageOutput) {
          base64 = imageOutput.result;
        }
      }
      if (!base64) {
        setAiStatus('error');
        setAiError('No image returned from OpenAI.');
        setTimeout(() => setAiStatus('idle'), 4000);
        alert('No image returned from OpenAI.');
        return;
      }
      const imageUrl = `data:image/png;base64,${base64}`;
      // Remove the placeholder and add the real image in the same spot
      // (Find the placeholder by its coordinates and size)
      if (canvasRef.current && canvasRef.current.replaceImageAt) {
        canvasRef.current.replaceImageAt(x, y, placeholderWidth, placeholderHeight, imageUrl);
      } else if (canvasRef.current.importImage) {
        canvasRef.current.importImage(imageUrl, x, y, placeholderWidth, placeholderHeight);
      }
      setAiStatus('success');
      setTimeout(() => setAiStatus('idle'), 2000);
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setAiStatus('idle'), 4000);
      alert('[Sketch AI] Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRenderCancel = () => {
    setShowRenderSubBar(false);
    if (setSelectedMode) setSelectedMode(''); // Reset to non-clicked state
    if (canvasRef.current) {
      // Remove any existing bounding box (robust)
      // This logic needs to be adapted to Konva if it's still needed
      // For now, assuming Konva handles its own bounding box state
    }
    // boundingBoxRef.current = null; // This line is no longer needed
    // setRenderBoundingBox(null); // This line is no longer needed
  };

  const handleRenderGenerate = async (details: string) => {
    setAiStatus('generating');
    setAiError(null);
    if (!canvasRef.current) {
      console.error('No canvas ref available');
      return;
    }
    // const fabricCanvas = canvasRef.current.getFabricCanvas(); // No longer needed
    if (!konvaSketchBox) { // Use Konva-based bounding box
      alert('No bounding box defined for export.');
      setAiStatus('idle');
      return;
    }
    // Export the bounding box area as PNG using Konva.js only
    let base64Sketch = null;
    try {
      const { x, y, width, height } = konvaSketchBox;
      // Konva.js export doesn't directly support cropping to a specific area.
      // We need to render the entire stage to a canvas and then crop.
      // This is a simplified approach and might not be perfect for all cases.
      // A more robust solution would involve a custom export function.
      const stage = canvasRef.current.getKonvaStage();
      if (!stage) {
        throw new Error('Konva stage not found');
      }
      const canvas = document.createElement('canvas');
      canvas.width = stage.width();
      canvas.height = stage.height();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context not available');
      }
      stage.draw(); // Draw the entire stage to the canvas
      base64Sketch = canvas.toDataURL('image/png');
      setLastInputImage(base64Sketch);
      if (base64Sketch) {
        const link = document.createElement('a');
        link.href = base64Sketch;
        link.download = 'openai-input.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      setAiStatus('idle');
      alert('[Render AI] Bounding box export failed: ' + (err instanceof Error ? err.message : String(err)));
      console.error('[Render AI] Bounding box export error:', err);
      return;
    }
    if (!base64Sketch) {
      alert('Failed to export bounding box area for AI generation.');
      setAiStatus('idle');
      return;
    }
    // Use attached material if present, else use a pure white PNG
    let base64Material = null; // No longer needed
    if (!base64Material) {
      // Create a 1024x1024 white PNG as fallback
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1024, 1024);
      base64Material = canvas.toDataURL('image/png');
    }
    // Prompt for render
    const promptText = `Generate an image by using the attached material to turn the sketch into a realistic representation with a transparent background. All the topstitches and buttons will be of the same colour. In case any prompt is given on the image or as an additional input, include those changes as well. ${details}`.trim();
    try {
      const result = await callOpenAIGptImage({
        base64Sketch,
        base64Material, // This parameter is no longer needed
        promptText,
        endpoint: '/api/render-ai'
      });
      console.log('[Render AI] OpenAI API full response:', result);
      let base64 = null;
      if (result && Array.isArray(result.output)) {
        const imageOutput = result.output.find(
          (item) => item.type === 'image_generation_call' && item.result
        );
        if (imageOutput) {
          base64 = imageOutput.result;
        }
      }
      if (!base64) {
        setAiStatus('error');
        setAiError('No image returned from OpenAI.');
        setTimeout(() => setAiStatus('idle'), 4000);
        alert('No image returned from OpenAI.');
        return;
      }
      const imageUrl = `data:image/png;base64,${base64}`;
      let x = konvaSketchBox.x + konvaSketchBox.width + 40; // Use Konva-based bounding box
      let y = konvaSketchBox.y;
      const finalImgObj = await new Promise<any>((resolve) => {
        canvasRef.current.importImage(imageUrl, x, y, (img) => {
          resolve(img);
        });
      });
      // Add the imported image to the stage
      const layer = canvasRef.current.getKonvaLayer();
      if (layer) {
        layer.add(finalImgObj);
        layer.draw();
      }
      setAiStatus('success');
      setTimeout(() => setAiStatus('idle'), 2000);
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setAiStatus('idle'), 4000);
      alert('[Render AI] Error: ' + (err instanceof Error ? err.message : String(err)));
      console.error('[Render AI] Error:', err);
    }
    if (onBoundingBoxCreated) onBoundingBoxCreated();
  };

  const handleRenderMaterial = (base64: string | null) => {
    // setRenderMaterial(base64); // No longer needed
  };

  const handleAddMaterial = () => {
    console.log('Add material clicked');
    // Add your add material logic here
  };

  // 1. Add state for renderBoundingBox and renderMaterial
  const [renderBoundingBox, setRenderBoundingBox] = useState<{ left: number, top: number, width: number, height: number } | null>(null);
  const [renderMaterial, setRenderMaterial] = useState<string | null>(null); // base64

  // 2. Bounding box logic for Render mode (copy of Sketch, but for Render)
  useEffect(() => {
    if (!showRenderSubBar || !canvasRef.current) return;
    // const fabricCanvas = canvasRef.current.getFabricCanvas(); // No longer needed
    if (!konvaSketchBox) { // Use Konva-based bounding box
      setRenderBoundingBox(null);
      return;
    }
    // Remove any existing bounding box (robust)
    // This logic needs to be adapted to Konva if it's still needed
    // For now, assuming Konva handles its own bounding box state
    // LOCK BOARD: Disable all object interaction and selection
    // This logic needs to be adapted to Konva if it's still needed
    // For now, assuming Konva handles its own object interaction
    // fabricCanvas.forEachObject(obj => { // No longer needed
    //   obj.selectable = false;
    //   obj.evented = false;
    // });
    // fabricCanvas.selection = false; // No longer needed
    // fabricCanvas.skipTargetFind = true; // No longer needed
    // fabricCanvas.discardActiveObject(); // No longer needed
    // fabricCanvas.renderAll(); // No longer needed
    // fabricCanvas.defaultCursor = 'crosshair'; // No longer needed
    const handleMouseDown = (opt: any) => {
      if (boundingBoxDrawing.current) return;
      boundingBoxDrawing.current = true;
      const pointer = opt.target.getLayer().getPointerPosition(); // Use Konva pointer
      boundingBoxStart.current = { x: pointer.x, y: pointer.y };
      // Remove any existing bounding box before creating new
      // removeBoundingBoxesByName(fabricCanvas, 'render-bounding-box'); // No longer needed
      // Create a temp rect
      const rect = new fabric.Rect({ // This line is no longer needed
        left: pointer.x,
        top: pointer.y,
        width: 1,
        height: 1,
        fill: 'rgba(0,0,0,0.0)',
        stroke: '#E1FF00',
        strokeWidth: 2,
        selectable: false,
        hasBorders: false,
        hasControls: false,
        lockRotation: true,
        objectCaching: false,
        name: 'render-bounding-box',
        evented: false,
      });
      // fabricCanvas.add(rect); // No longer needed
      // boundingBoxRef.current = rect; // No longer needed
    };
    const handleMouseMove = (opt: any) => {
      if (!boundingBoxDrawing.current || !boundingBoxRef.current || !boundingBoxStart.current) return;
      const pointer = opt.target.getLayer().getPointerPosition(); // Use Konva pointer
      const startX = boundingBoxStart.current.x;
      const startY = boundingBoxStart.current.y;
      const left = Math.min(startX, pointer.x);
      const top = Math.min(startY, pointer.y);
      const width = Math.abs(pointer.x - startX);
      const height = Math.abs(pointer.y - startY);
      // boundingBoxRef.current.set({ left, top, width, height }); // No longer needed
      // fabricCanvas.renderAll(); // No longer needed
    };
    const handleMouseUp = () => {
      if (!boundingBoxDrawing.current || !boundingBoxRef.current) return;
      boundingBoxDrawing.current = false;
      boundingBoxStart.current = null;
      // Finalize the bounding box
      // boundingBoxRef.current.set({ // No longer needed
      //   selectable: true,
      //   hasBorders: true,
      //   hasControls: true,
      //   evented: true,
      // });
      // boundingBoxRef.current.setControlsVisibility({ mtr: false }); // No longer needed
      // fabricCanvas.setActiveObject(boundingBoxRef.current); // No longer needed
      setRenderBoundingBox({
        left: konvaSketchBox.x, // Use Konva-based bounding box
        top: konvaSketchBox.y,
        width: konvaSketchBox.width,
        height: konvaSketchBox.height,
      });
      // fabricCanvas.forEachObject(obj => { obj.evented = true; }); // No longer needed
      // fabricCanvas.selection = true; // No longer needed
      // fabricCanvas.skipTargetFind = false; // No longer needed
      // fabricCanvas.renderAll(); // No longer needed
      // boundingBoxRef.current.on('modified', () => { // No longer needed
      //   setRenderBoundingBox({
      //     left: boundingBoxRef.current.left ?? 0,
      //     top: boundingBoxRef.current.top ?? 0,
      //     width: boundingBoxRef.current.width! * (boundingBoxRef.current.scaleX ?? 1),
      //     height: boundingBoxRef.current.height! * (boundingBoxRef.current.scaleY ?? 1),
      //   });
      // });
      // boundingBoxRef.current.on('moving', () => { // No longer needed
      //   setRenderBoundingBox({
      //     left: boundingBoxRef.current.left ?? 0,
      //     top: boundingBoxRef.current.top ?? 0,
      //     width: boundingBoxRef.current.width! * (boundingBoxRef.current.scaleX ?? 1),
      //     height: boundingBoxRef.current.height! * (boundingBoxRef.current.scaleY ?? 1),
      //   });
      // });
      // boundingBoxRef.current.on('scaling', () => { // No longer needed
      //   setRenderBoundingBox({
      //     left: boundingBoxRef.current.left ?? 0,
      //     top: boundingBoxRef.current.top ?? 0,
      //     width: boundingBoxRef.current.width! * (boundingBoxRef.current.scaleX ?? 1),
      //     height: boundingBoxRef.current.height! * (boundingBoxRef.current.scaleY ?? 1),
      //   });
      // });
      // fabricCanvas.off('mouse:down', handleMouseDown); // No longer needed
      // fabricCanvas.off('mouse:move', handleMouseMove); // No longer needed
      // fabricCanvas.off('mouse:up', handleMouseUp); // No longer needed
      // fabricCanvas.defaultCursor = 'default'; // No longer needed
      if (onBoundingBoxCreated) onBoundingBoxCreated();
    };
    // fabricCanvas.on('mouse:down', handleMouseDown); // No longer needed
    // fabricCanvas.on('mouse:move', handleMouseMove); // No longer needed
    // fabricCanvas.on('mouse:up', handleMouseUp); // No longer needed
    // Listen for image add/remove/clear and remove bounding box
    // This logic needs to be adapted to Konva if it's still needed
    // For now, assuming Konva handles its own object management
    // const handleObjectAdded = (e) => { // No longer needed
    //   if (e.target && e.target.type === 'image') {
    //     removeBoundingBoxesByName(fabricCanvas, 'render-bounding-box');
    //     boundingBoxRef.current = null;
    //     setRenderBoundingBox(null);
    //   }
    // };
    // const handleObjectRemoved = (e) => { // No longer needed
    //   if (e.target && e.target.type === 'image') {
    //     removeBoundingBoxesByName(fabricCanvas, 'render-bounding-box');
    //     boundingBoxRef.current = null;
    //     setRenderBoundingBox(null);
    //   }
    // };
    // fabricCanvas.on('object:added', handleObjectAdded); // No longer needed
    // fabricCanvas.on('object:removed', handleObjectRemoved); // No longer needed
    return () => {
      // fabricCanvas.off('mouse:down', handleMouseDown); // No longer needed
      // fabricCanvas.off('mouse:move', handleMouseMove); // No longer needed
      // fabricCanvas.off('mouse:up', handleMouseUp); // No longer needed
      // fabricCanvas.off('object:added', handleObjectAdded); // No longer needed
      // fabricCanvas.off('object:removed', handleObjectRemoved); // No longer needed
      // fabricCanvas.defaultCursor = 'default'; // No longer needed
      // removeBoundingBoxesByName(fabricCanvas, 'render-bounding-box'); // No longer needed
      // boundingBoxRef.current = null; // No longer needed
      // setRenderBoundingBox(null); // No longer needed
    };
  }, [showRenderSubBar, canvasRef, konvaSketchBox]); // Added konvaSketchBox to dependency array

  return (
    <div className="flex flex-col items-center">
      {showSketchSubBar && (
        <SketchSubBar 
          onCancel={handleSketchCancel}
          onGenerate={handleSketchGenerate}
        />
      )}
      {showRenderSubBar && (
        <RenderSubBar 
          onCancel={handleRenderCancel}
          onGenerate={handleRenderGenerate}
          onAddMaterial={handleAddMaterial}
          onMaterialChange={handleRenderMaterial}
          canGenerate={!!konvaSketchBox} // Use Konva-based bounding box
        />
      )}
      <div style={{
        minWidth: '500px',
        maxWidth: '500px',
        height: '45px'
      }} className="flex-1 gap-4 justify-center items-center border border-[#373737] flex flex px-[8px] bg-[#1a1a1a] rounded-xl mx-0">
      <div className={`flex gap-2.5 justify-center items-center self-stretch px-2.5 py-2 my-auto text-sm whitespace-nowrap min-h-[30px] cursor-pointer transition-colors ${selectedMode === 'sketch' ? 'text-[#E1FF00]' : 'text-neutral-400 hover:text-[#FFFFFF]'}`} onClick={() => handleModeSelect('sketch')}>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path d="M14.626 9.67546C15.5271 9.44151 16.473 9.44151 17.3741 9.67546H14.626Z" fill="currentColor" />
          <path d="M10.7036 13.5286C10.9517 12.6315 11.4247 11.8125 12.0777 11.1492L10.7036 13.5286Z" fill="currentColor" />
          <path d="M12.0777 18.8514C11.4245 18.1878 10.9515 17.3684 10.7036 16.4708L12.0777 18.8514Z" fill="currentColor" />
          <path d="M17.3741 20.3245C16.473 20.5584 15.5271 20.5584 14.626 20.3245H17.3741Z" fill="currentColor" />
          <path d="M21.2964 16.4714C21.0483 17.3686 20.5754 18.1876 19.9224 18.8509L21.2964 16.4714Z" fill="currentColor" />
          <path d="M19.9224 11.1487C20.5755 11.8123 21.0485 12.6317 21.2964 13.5293L19.9224 11.1487Z" fill="currentColor" />
          <path d="M14.626 9.67546C15.5271 9.44151 16.473 9.44151 17.3741 9.67546M10.7036 13.5286C10.9517 12.6315 11.4247 11.8125 12.0777 11.1492M12.0777 18.8514C11.4245 18.1878 10.9515 17.3684 10.7036 16.4708M17.3741 20.3245C16.473 20.5584 15.5271 20.5584 14.626 20.3245M21.2964 16.4714C21.0483 17.3686 20.5754 18.1876 19.9224 18.8509M19.9224 11.1487C20.5755 11.8123 21.0485 12.6317 21.2964 13.5293" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="self-stretch my-auto w-11">Sketch</div>
      </div>

      <div className={`flex gap-2.5 justify-center items-center self-stretch px-2.5 py-2 my-auto text-sm whitespace-nowrap min-h-[30px] cursor-pointer transition-colors ${selectedMode === 'render' ? 'text-[#E1FF00]' : 'text-neutral-400 hover:text-[#FFFFFF]'}`} onClick={() => handleModeSelect('render')}>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path d="M16 20.5C19.0376 20.5 21.5 18.0376 21.5 15C21.5 11.9624 19.0376 9.5 16 9.5M16 20.5C12.9624 20.5 10.5 18.0376 10.5 15C10.5 11.9624 12.9624 9.5 16 9.5M16 20.5V9.5M19.6666 10.9008V19.0992M17.8334 9.81335V20.1866" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="self-stretch my-auto w-[47px]">Render</div>
      </div>

      <div className={`flex gap-2.5 justify-center items-center self-stretch px-2.5 py-2 my-auto text-sm whitespace-nowrap min-h-[30px] cursor-pointer transition-colors ${selectedMode === 'colorway' ? 'text-[#E1FF00]' : 'text-neutral-400 hover:text-[#FFFFFF]'}`} onClick={() => handleModeSelect('colorway')}>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path d="M19.2999 16.1V20.5M21.5 18.2999H17.1M14.9 11.7C14.9 12.915 13.915 13.9 12.7 13.9C11.485 13.9 10.5 12.915 10.5 11.7C10.5 10.485 11.485 9.5 12.7 9.5C13.915 9.5 14.9 10.485 14.9 11.7ZM21.5 11.7C21.5 12.915 20.515 13.9 19.3 13.9C18.0849 13.9 17.1 12.915 17.1 11.7C17.1 10.485 18.0849 9.5 19.3 9.5C20.515 9.5 21.5 10.485 21.5 11.7ZM14.9 18.3C14.9 19.515 13.915 20.5 12.7 20.5C11.485 20.5 10.5 19.515 10.5 18.3C10.5 17.0849 11.485 16.1 12.7 16.1C13.915 16.1 14.9 17.0849 14.9 18.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="self-stretch my-auto w-[62px]">Colorway</div>
      </div>

      <div className={`flex gap-2.5 justify-center items-center self-stretch px-2.5 py-2 my-auto min-h-[30px] cursor-pointer transition-colors ${selectedMode === 'sides' ? 'text-[#E1FF00]' : 'text-neutral-400 hover:text-[#FFFFFF]'}`} onClick={() => handleModeSelect('sides')}>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path d="M18.5565 12.9548H21.6244M21.6244 12.9548V9.88696M21.6244 12.9548L19.8169 11.1473C18.7702 10.1006 17.353 9.50871 15.8727 9.5001C14.3924 9.49148 12.9684 10.0668 11.9095 11.1013M13.4435 17.0453H10.3756M10.3756 17.0453V20.1131M10.3756 17.0453L12.1831 18.8528C13.2298 19.8995 14.6471 20.4913 16.1273 20.4999C17.6076 20.5086 19.0316 19.9332 20.0905 18.8988" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="self-stretch my-auto text-sm w-[35px]">
          Sides
        </div>
      </div>
      </div>
    </div>
  );
};