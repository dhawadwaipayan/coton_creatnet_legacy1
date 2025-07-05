import React, { useState } from 'react';
import { SketchSubBar } from './SketchSubBar';
import { RenderSubBar } from './RenderSubBar';
import type { CanvasHandle } from './Canvas';
import { callOpenAIGptImage } from '@/lib/openaiSketch';
import { Image as FabricImage } from 'fabric';
import * as fabric from 'fabric';

interface ModePanelProps {
  canvasRef: React.RefObject<CanvasHandle>;
}

export const ModePanel: React.FC<ModePanelProps> = ({ canvasRef }) => {
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [showSketchSubBar, setShowSketchSubBar] = useState(false);
  const [showRenderSubBar, setShowRenderSubBar] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'generating' | 'error' | 'success'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
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
    setSelectedMode(modeId);
    if (modeId === 'sketch') {
      setShowSketchSubBar(true);
      setShowRenderSubBar(false);
    } else if (modeId === 'render') {
      setShowRenderSubBar(true);
      setShowSketchSubBar(false);
    } else {
      setShowSketchSubBar(false);
      setShowRenderSubBar(false);
    }
    console.log(`Selected mode: ${modeId}`);
  };

  const handleSketchCancel = () => {
    setShowSketchSubBar(false);
    setSelectedMode(''); // Reset to non-clicked state
  };

  const handleSketchGenerate = async (details: string) => {
    setAiStatus('generating');
    setAiError(null);
    if (!canvasRef.current) {
      console.error('No canvas ref available');
      return;
    }
    const fabricCanvas = canvasRef.current.getFabricCanvas();
    if (!fabricCanvas) {
      console.error('No fabric canvas instance');
      return;
    }
    // Use the selected (active) frame for AI input
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || !(activeObject as any).isFrameContainer) {
      setAiStatus('idle');
      alert('Please select a frame to use as input for AI generation.');
      return;
    }
    const frame = activeObject as any; // FrameContainer
    // Always update children before generating
    if (typeof frame.updateChildren === 'function') frame.updateChildren();
    // Get all objects inside the selected frame (robust)
    const allObjects = fabricCanvas.getObjects();
    const frameObjects = allObjects.filter(obj =>
      obj !== frame && !(obj as any).isFrameContainer &&
      typeof frame.isObjectInside === 'function' && frame.isObjectInside(obj)
    );
    if (!frameObjects.length) {
      setAiStatus('idle');
      alert('No objects found inside the selected frame. Please add objects to the frame for AI generation.');
      return;
    }
    // Debug: log frame objects and their types and constructors
    console.log('Frame objects for rasterization:', frameObjects.map(obj => ({ type: obj.type, constructor: obj.constructor?.name, obj })));
    // Robust rasterization: always deep clone frame objects, never touch originals
    let base64Image = null;
    try {
      console.log('[Sketch AI] Starting robust rasterization (frame)...');
      // Compute bounds of all frame objects
      const bounds = frameObjects.reduce((acc, obj) => {
        const left = obj.left ?? 0;
        const top = obj.top ?? 0;
        const width = obj.width ? obj.width * (obj.scaleX ?? 1) : 0;
        const height = obj.height ? obj.height * (obj.scaleY ?? 1) : 0;
        return {
          minX: Math.min(acc.minX, left),
          minY: Math.min(acc.minY, top),
          maxX: Math.max(acc.maxX, left + width),
          maxY: Math.max(acc.maxY, top + height)
        };
      }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      const width = Math.ceil(bounds.maxX - bounds.minX);
      const height = Math.ceil(bounds.maxY - bounds.minY);
      const tempCanvas = new fabric.Canvas(null, { width, height, backgroundColor: '#fff' });
      // Deep clone frame objects
      const serialized = frameObjects.map(obj => obj.toObject());
      await new Promise<void>((resolve, reject) => {
        (fabric.util.enlivenObjects as any)(serialized, (clones: any[]) => {
          if (!clones || clones.length === 0) {
            reject(new Error('No objects could be enlivened'));
            return;
          }
          // Group if more than one
          let toAdd: any = clones;
          if (clones.length > 1) {
            toAdd = new fabric.Group(clones, { left: 0, top: 0 });
          }
          if (Array.isArray(toAdd)) {
            toAdd.forEach((obj: any) => tempCanvas.add(obj));
          } else {
            tempCanvas.add(toAdd);
          }
          tempCanvas.renderAll();
          base64Image = tempCanvas.toDataURL({ format: 'png', multiplier: 1 });
          tempCanvas.dispose();
          resolve();
        });
      });
      console.log('[Sketch AI] Rasterization complete, base64Image length:', base64Image?.length);
    } catch (e) {
      setAiStatus('idle');
      alert('[Sketch AI] Rasterization failed: ' + (e instanceof Error ? e.message : String(e)));
      console.error('[Sketch AI] Rasterization error:', e);
      return;
    }
    if (!base64Image) {
      alert('Failed to rasterize any objects inside the frame for AI generation.');
      setAiStatus('idle');
      return;
    }
    console.log('[Sketch AI] Rasterization complete, base64Image length:', base64Image.length);
    // Prepare input for OpenAI
    let annotationText: string = '';
    frameObjects.forEach(obj => {
      if (obj.type === 'i-text' || obj.type === 'text') {
        annotationText += (obj as any).text + ' ';
      }
    });
    const promptText = `Generate Image by redoing the flat sketch in the same style, incorporating the prompts indicated in the image. ${annotationText.trim()} ${details}`.trim();
    try {
      console.log('[Sketch AI] Calling OpenAI API...');
      const result = await callOpenAIGptImage({
        base64Image,
        promptText
      });
      console.log('[Sketch AI] OpenAI API full response:', result);
      // Extract base64 image from OpenAI response
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
      // Place to the right of the frame
      let x = (frame.left ?? 0) + (frame.width ?? 0) + 40;
      let y = frame.top ?? 0;
      const finalImgObj = await FabricImage.fromURL(imageUrl);
      finalImgObj.set({
        left: x,
        top: y,
        scaleX: 0.5,
        scaleY: 0.5,
        selectable: true,
        evented: true
      });
      fabricCanvas.add(finalImgObj);
      fabricCanvas.renderAll();
      setAiStatus('success');
      setTimeout(() => setAiStatus('idle'), 2000);
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setAiStatus('idle'), 4000);
      alert('[Sketch AI] Error: ' + (err instanceof Error ? err.message : String(err)));
      console.error('[Sketch AI] Error:', err);
    }
  };

  const handleRenderCancel = () => {
    setShowRenderSubBar(false);
    setSelectedMode(''); // Reset to non-clicked state
  };

  const handleRenderGenerate = (details: string) => {
    console.log('Render generating with details:', details);
    // Add your render generation logic here
  };

  const handleAddMaterial = () => {
    console.log('Add material clicked');
    // Add your add material logic here
  };
  return (
    <div className="flex flex-col items-center">
      {/* AI Status Indicator */}
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 10000 }}>
        {aiStatus !== 'idle' && (
          <div className={`px-4 py-2 rounded shadow-lg text-sm font-medium transition-all duration-300 ${aiStatus === 'generating' ? 'bg-blue-800 text-white' : aiStatus === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {aiStatus === 'generating' && 'Generating with AI...'}
            {aiStatus === 'success' && 'AI image generated!'}
            {aiStatus === 'error' && (aiError || 'AI error')}
          </div>
        )}
      </div>
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