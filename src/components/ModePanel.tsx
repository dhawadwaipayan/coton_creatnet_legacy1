import React, { useState, useRef, useEffect } from 'react';
import { SketchSubBar } from './SketchSubBar';
import { RenderSubBar } from './RenderSubBar';
import { ColorwaySubBar } from './ColorwaySubBar';
import { VideoSubBar } from './VideoSubBar';
import { BrushSubBar } from './BrushSubBar';
import { FilmReel } from '@phosphor-icons/react';
// Removed CanvasHandle import; use any for canvasRef
import { callOpenAIGptImage } from '@/lib/openaiSketch';
import { callGeminiImageGeneration } from '@/lib/geminiAI';
import { callOpenRouterRender, extractBase64FromOpenRouterResponse } from '@/lib/openrouterRender';
import { generateImage, transformGeminiResponse } from '../services/geminiService';
import { generateColorwayColor, generateColorwayPrint, transformColorwayResponse } from '../services/colorwayService';
import { generateVideo } from '../services/videoService';
// Removed: import { Image as FabricImage } from 'fabric';
// Removed: import * as fabric from 'fabric';

export interface ModePanelProps {
  canvasRef: React.RefObject<any>;
  onSketchModeActivated?: () => void;
  onBoundingBoxCreated?: () => void;
  showSketchSubBar?: boolean;
  closeSketchBar?: () => void;
  closeRenderBar?: () => void;
  selectedMode?: string;
  setSelectedMode?: (mode: string) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  sketchModeActive: boolean;
  onSketchBoundingBoxChange: (box: { x: number, y: number, width: number, height: number } | null) => void;
  renderBoundingBox?: { x: number, y: number, width: number, height: number } | null;
  userId: string; // Add userId prop
}

export const ModePanel: React.FC<ModePanelProps> = ({
  canvasRef,
  onSketchModeActivated,
  onBoundingBoxCreated,
  showSketchSubBar,
  closeSketchBar,
  closeRenderBar,
  selectedMode,
  setSelectedMode,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  sketchModeActive,
  onSketchBoundingBoxChange,
  renderBoundingBox,
  userId // Destructure userId
}) => {
  const [showRenderSubBar, setShowRenderSubBar] = useState(false);
  const [showColorwaySubBar, setShowColorwaySubBar] = useState(false);
  const [showVideoSubBar, setShowVideoSubBar] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'generating' | 'error' | 'success'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastInputImage, setLastInputImage] = useState<string | null>(null);
  const [renderMaterial, setRenderMaterial] = useState<string | null>(null); // base64 material for Render AI
  const [colorwayReference, setColorwayReference] = useState<string | null>(null); // base64 reference for Colorway AI
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
    id: 'video',
    icon: 'https://cdn.builder.io/api/v1/image/assets/49361a2b7ce44657a799a73862a168f7/6eb8891421d30b1132ff78da0afd8482ce50b611?placeholderIfAbsent=true',
    label: 'Video'
  }];
  const handleModeSelect = (modeId: string) => {
    if (setSelectedMode) setSelectedMode(modeId);
    if (canvasRef.current && canvasRef.current.clearSketchBox) {
      canvasRef.current.clearSketchBox();
    }
    if (canvasRef.current && canvasRef.current.clearRenderBox) {
      canvasRef.current.clearRenderBox();
    }
    if (modeId === 'sketch') {
      setShowRenderSubBar(false);
      setShowColorwaySubBar(false);
      setShowVideoSubBar(false);
      if (onSketchModeActivated) onSketchModeActivated();
    } else if (modeId === 'render') {
      setShowRenderSubBar(true);
      setShowColorwaySubBar(false);
      setShowVideoSubBar(false);
      if (closeSketchBar) closeSketchBar();
    } else if (modeId === 'colorway') {
      setShowRenderSubBar(false);
      setShowColorwaySubBar(true);
      setShowVideoSubBar(false);
      if (closeSketchBar) closeSketchBar();
    } else if (modeId === 'video') {
      setShowRenderSubBar(false);
      setShowColorwaySubBar(false);
      setShowVideoSubBar(true);
      if (closeSketchBar) closeSketchBar();
    } else {
      if (closeSketchBar) closeSketchBar();
      setShowRenderSubBar(false);
      setShowColorwaySubBar(false);
      setShowVideoSubBar(false);
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

  // Close render sub bar if selectedMode changes to anything other than 'render'
  useEffect(() => {
    if (selectedMode !== 'render' && showRenderSubBar) {
      setShowRenderSubBar(false);
    }
  }, [selectedMode, showRenderSubBar]);

  // Close colorway sub bar if selectedMode changes to anything other than 'colorway'
  useEffect(() => {
    if (selectedMode !== 'colorway' && showColorwaySubBar) {
      setShowColorwaySubBar(false);
    }
  }, [selectedMode, showColorwaySubBar]);

  // Close video sub bar if selectedMode changes to anything other than 'video'
  useEffect(() => {
    if (selectedMode !== 'video' && showVideoSubBar) {
      setShowVideoSubBar(false);
    }
  }, [selectedMode, showVideoSubBar]);

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
    // Place a placeholder beside the bounding box maintaining aspect ratio
    const sketchBox = canvasRef.current.sketchBox;
    // Bounding box coordinates are already in canvas space, no need to add stagePos
    let x = sketchBox ? sketchBox.x + sketchBox.width + 40 : 100;
    let y = sketchBox ? sketchBox.y : 100;
    const placeholderUrl = '/Placeholder_Image_portrait.png';
    
    // Calculate aspect ratio based on AI output resolution (1024x1536)
    const aiWidth = 1024;
    const aiHeight = 1536;
    const aspectRatio = aiWidth / aiHeight; // 1024/1536 = 2/3
    const placeholderWidth = 500;
    const placeholderHeight = Math.round(placeholderWidth / aspectRatio); // 500 * (3/2) = 750
    
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
      // Remove the placeholder and add the real image in the same spot, maintaining aspect ratio
      if (canvasRef.current && placeholderId && canvasRef.current.replaceImageById) {
        canvasRef.current.replaceImageById(placeholderId, imageUrl);
      } else if (canvasRef.current.importImage) {
        // Use the same dimensions as the placeholder to maintain aspect ratio
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
    if (canvasRef.current && canvasRef.current.clearRenderBox) {
      canvasRef.current.clearRenderBox();
    }
    if (closeRenderBar) closeRenderBar();
  };

  const handleColorwayCancel = () => {
    setShowColorwaySubBar(false);
    if (setSelectedMode) setSelectedMode(''); // Reset to non-clicked state
    if (closeRenderBar) closeRenderBar();
  };

  const handleRenderGenerate = async (details: string, isFastMode: boolean) => {
    console.log('[ModePanel] handleRenderGenerate called with details:', details);
    console.log('[ModePanel] details length:', details?.length);
    console.log('[ModePanel] details trimmed:', details?.trim());
    console.log('[ModePanel] isFastMode:', isFastMode);
    
    setAiStatus('generating');
    setAiError(null);
    if (!canvasRef.current) {
      setAiStatus('idle');
      return;
    }
    // Always get the bounding box PNG from Canvas
    const base64Sketch = canvasRef.current.exportCurrentRenderBoxAsPng();
    if (!base64Sketch) {
      alert('No bounding box defined for export.');
      setAiStatus('idle');
      return;
    }
    // Handle material - only use what user uploaded
    const base64Material = renderMaterial;
    // Place a placeholder beside the bounding box maintaining aspect ratio
    const renderBox = canvasRef.current.renderBox;
    // Bounding box coordinates are already in canvas space, no need to add stagePos
    let x = renderBox ? renderBox.x + renderBox.width + 40 : 100;
    let y = renderBox ? renderBox.y : 100;
    const placeholderUrl = '/Placeholder_Image_portrait.png';
    
    // Calculate aspect ratio based on AI output resolution (1024x1536)
    // This will be updated dynamically when we get the actual image dimensions
    const aiWidth = 1024;
    const aiHeight = 1536;
    const aspectRatio = aiWidth / aiHeight; // 1024/1536 = 2/3
    const placeholderWidth = 500;
    const placeholderHeight = Math.round(placeholderWidth / aspectRatio); // 500 * (3/2) = 750
    
    // Store placeholder dimensions for later use when replacing with real image
    const placeholderDimensions = { width: placeholderWidth, height: placeholderHeight };
    
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
    // After adding placeholder, close render tab and switch to select tool
    if (closeSketchBar) closeSketchBar();
    if (setSelectedMode) setSelectedMode('select');
    // No overlay/status logic
    // Prepare input for AI generation with JSON prompt structure
    const jsonPrompt: any = {
      "task": "fashion_sketch_to_realistic_render",
      "input": {
        "sketch_image": base64Sketch,
        "annotations": "Annotations written directly on the sketch specifying garment details or visual directions (drawn marks on the garment). TREAT AS BINDING CONSTRAINTS. Do not render any text, arrows, labels, or overlay graphics. Remove all on-canvas annotation marks and clean leftover text artifacts; keep only the garment itself for final render.",
        "additional_details": "Optional free-text or structured notes for further specifics (e.g., asymmetric hem, puff sleeves, layered panels, lace trims).",
        "material_reference": base64Material || null,
        "reference_style": "high-resolution fashion photography",
        "model_preferences": {
          "height": "tall",
          "pose": "neutral runway stance, arms relaxed by sides",
          "body_type": "slim but natural proportions",
          "skin": "natural texture with soft shading",
          "hands": "anatomically correct, relaxed by sides"
        },
        "garment_rendering": {
          "fabric_mode": "material_reference_or_sketch",
          "fabric_logic": {
            "if_material_reference": "Map the material's weave, texture, and color smoothly onto the garment WITHOUT compression, gathering, smocking, or shirring unless explicitly annotated. Preserve scale (no stretch) and align pattern directions per zones.",
            "if_no_material_reference": "Faithfully reproduce the sketch's intended fabric and color. Preserve pattern scaling (checks, stripes, prints) and fabric effect without adding gathers/pleats/smocking unless explicitly annotated."
          },
          "fabric_application": {
            "zones": "EXACT from sketch; do not reinterpret. Respect boundaries for bodice, sleeves, skirt, waistband, trims, and hem. Do NOT invent construction details.",
            "pattern_behavior": "Maintain stripe/print continuity and straightness; avoid compression or wave artifacts. Keep vertical stripes vertical and evenly spaced across the bodice and skirt unless annotated otherwise.",
            "seam_alignment": "Align pattern across seams and at CF/CB where applicable; no distortion at high-curvature areas."
          },
          "texture": "Show accurate textile weave, subtle sheen, and depth. Use the reference material's microtexture as-is with correct scale and no over-sharpening.",
          "drape": "Apply fabric FLAT to match the sketch silhouette. NO added folds, gathers, shirring, or smocking unless explicitly annotated.",
          "outlines": "HARD CONSTRAINT. Preserve neckline, sleeve, waist, side seams, and hem lines pixel-accurate to the sketch with zero geometry changes.",
          "lighting": "Studio lighting with soft shadows and subtle specular highlights on folds (only if annotated).",
          "details": "Preserve all annotated and additional features (pleats, trims, buttons, seams, lace, embroidery). Depth/shadow only where those features exist; do not hallucinate extra construction."
        }
      },
      "output": {
        "format": "photorealistic full-body render",
        "background": "plain white or light grey seamless studio backdrop",
        "camera": {
          "angle": "front view",
          "framing": "full height, centered"
        },
        "consistency": {
          "style": "uniform rendering style across garments in the project",
          "accuracy": "STRICT: match sketch silhouette and zone boundaries exactly; follow annotations over model priors; when uncertain, default to flat, plain construction with no gathers."
        }
      }
    };
    
    // Add any additional details from user input
    if (details && details.trim()) {
      jsonPrompt.input.additional_details = details.trim();
    }
    
    const promptText = JSON.stringify(jsonPrompt, null, 2);
    
    try {
      let result;
      let base64 = null;
      
      if (isFastMode) {
        // Use Gemini API for Fastrack mode - following referenced GitHub repo structure
        console.log('[Render AI] Using Gemini API for Fastrack mode');
        console.log('[Render AI] Using concise fashion rendering prompt with material reference support');
        console.log('[Render AI] About to call generateImage with details:', details);
        console.log('[Render AI] Details type:', typeof details);
        console.log('[Render AI] Details value:', details);
        
        const geminiResponse = await generateImage(base64Sketch, base64Material, details);
        result = transformGeminiResponse(geminiResponse, details);
        
        console.log('[Render AI] Gemini API full response:', result);
        console.log('[Render AI] Response structure:', {
          success: result.success,
          mode: result.mode,
          modelUsed: result.model_used,
          hasEnhancedPrompt: !!result.enhanced_prompt,
          hasOutput: Array.isArray(result.output),
          outputLength: result.output?.length,
          imageDimensions: result.imageDimensions
        });
        
        // Debug aspect ratio information
        if (result.imageDimensions) {
          console.log('[Render AI] Aspect ratio debug info:', {
            geminiImage: {
              width: result.imageDimensions.width,
              height: result.imageDimensions.height,
              aspectRatio: result.imageDimensions.aspectRatio
            },
            placeholder: {
              width: placeholderWidth,
              height: placeholderHeight,
              aspectRatio: placeholderWidth / placeholderHeight
            },
            difference: Math.abs(result.imageDimensions.aspectRatio - (placeholderWidth / placeholderHeight))
          });
        } else {
          console.log('[Render AI] Warning: No imageDimensions in result');
        }
        
        // Log enhanced prompt for debugging
        if (result.enhanced_prompt) {
          console.log('[Render AI] Enhanced prompt used:', result.enhanced_prompt);
        }
      } else {
        // Use OpenAI for Accurate mode
        console.log('[Render AI] Using OpenAI for Accurate mode');
        result = await callOpenAIGptImage({
          base64Sketch,
          base64Material: base64Material,
          promptText,
          endpoint: '/api/render-ai'
        });
        console.log('[Render AI] OpenAI API full response:', result);
      }
      
      // Both AI providers now return the same structure: { output: [{ type: 'image_generation_call', result: base64 }] }
      if (result && Array.isArray(result.output)) {
        const imageOutput = result.output.find(
          (item) => item.type === 'image_generation_call' && item.result
        );
        if (imageOutput) {
          base64 = imageOutput.result;
        }
      }
      
      if (!base64) {
        const aiProvider = isFastMode ? 'Gemini 2.0 Flash' : 'OpenAI';
        setAiStatus('error');
        setAiError(`No image returned from ${aiProvider}.`);
        setTimeout(() => setAiStatus('idle'), 4000);
        alert(`No image returned from ${aiProvider}.`);
        return;
      }
      const imageUrl = `data:image/png;base64,${base64}`;
      // Replace the placeholder with the real image, maintaining proper aspect ratio
      if (canvasRef.current && placeholderId && canvasRef.current.replaceImageById) {
        // If we have image dimensions from Gemini, use them to calculate proper scaling
        let finalWidth = placeholderWidth;
        let finalHeight = placeholderHeight;
        
        if (result.imageDimensions) {
          const { width: geminiWidth, height: geminiHeight, aspectRatio: geminiAspectRatio } = result.imageDimensions;
          
          // Calculate new dimensions maintaining the placeholder's display size but with correct aspect ratio
          if (Math.abs(geminiAspectRatio - (placeholderWidth / placeholderHeight)) > 0.1) {
            // Aspect ratios are significantly different, recalculate dimensions
            if (geminiAspectRatio > (placeholderWidth / placeholderHeight)) {
              // Gemini image is wider, adjust height
              finalWidth = placeholderWidth;
              finalHeight = Math.round(placeholderWidth / geminiAspectRatio);
            } else {
              // Gemini image is taller, adjust width
              finalHeight = placeholderHeight;
              finalWidth = Math.round(placeholderHeight * geminiAspectRatio);
            }
            
            console.log('[Render AI] Aspect ratio adjusted:', {
              original: { width: placeholderWidth, height: placeholderHeight, ratio: placeholderWidth / placeholderHeight },
              gemini: { width: geminiWidth, height: geminiHeight, ratio: geminiAspectRatio },
              adjusted: { width: finalWidth, height: finalHeight, ratio: finalWidth / finalHeight }
            });
          }
        }
        
        // First remove the placeholder
        if (canvasRef.current.removeImage && placeholderId) {
          canvasRef.current.removeImage(placeholderId);
          console.log('[Render AI] Placeholder removed for aspect ratio adjustment');
        }
        
        // Now add the real image with correct dimensions
        if (canvasRef.current.importImage) {
          const newImageId = canvasRef.current.importImage(imageUrl, x, y, finalWidth, finalHeight);
          console.log('[Render AI] Real image imported with adjusted dimensions:', { 
            finalWidth, 
            finalHeight, 
            newImageId,
            aspectRatio: finalWidth / finalHeight 
          });
          
          // Select the new image
          if (canvasRef.current.setSelectedIds && newImageId) {
            canvasRef.current.setSelectedIds([{ id: newImageId, type: 'image' }]);
          }
        } else {
          // Fallback to replaceImageById if importImage is not available
          canvasRef.current.replaceImageById(placeholderId, imageUrl);
          console.log('[Render AI] Image replaced using fallback method');
        }
      } else if (canvasRef.current.importImage) {
        // Fallback: Use the same dimensions as the placeholder
        canvasRef.current.importImage(imageUrl, x, y, placeholderWidth, placeholderHeight);
      }
      setAiStatus('success');
      setTimeout(() => setAiStatus('idle'), 2000);
    } catch (err) {
      const aiProvider = isFastMode ? 'Gemini 2.5 Flash' : 'OpenAI';
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setAiStatus('idle'), 4000);
      alert(`[Render AI] ${aiProvider} Error: ` + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleColorwayGenerate = async (details: string, isPrintMode: boolean) => {
    setAiStatus('generating');
    setAiError(null);
    
    if (!canvasRef.current) {
      setAiStatus('idle');
      return;
    }

    // Get the selected image from Canvas for colorway generation
    const selectedImage = canvasRef.current.getSelectedImage();
    if (!selectedImage) {
      alert('Please select an image from the board for colorway generation.');
      setAiStatus('idle');
      return;
    }
    
    // Export the selected image as PNG
    const imageData = canvasRef.current.exportSelectedImageAsPng();
    if (!imageData) {
      alert('Failed to export selected image. Please make sure an image is selected.');
      setAiStatus('idle');
      return;
    }

    // Convert URL to base64 if needed
    let base64Sketch: string;
    if (imageData.startsWith('http')) {
      // If it's a URL, fetch and convert to base64
      try {
        const response = await fetch(imageData);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data:image/png;base64, prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(blob);
        });
        base64Sketch = base64;
      } catch (error) {
        console.error('Failed to convert URL to base64:', error);
        alert('Failed to process selected image. Please try again.');
        setAiStatus('idle');
        return;
      }
    } else {
      // If it's already base64, clean it
      base64Sketch = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    }

    // Place a placeholder beside the selected image
    let x = selectedImage.x + selectedImage.width + 40;
    let y = selectedImage.y;
    const placeholderUrl = '/Placeholder_Image_portrait.png';
    
    // Use a flexible placeholder size - will be adjusted based on actual AI output
    const placeholderWidth = 500;
    const placeholderHeight = 750; // Default height, will be adjusted based on actual aspect ratio
    
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

    // After adding placeholder, close render tab and switch to select tool
    if (closeSketchBar) closeSketchBar();
    if (setSelectedMode) setSelectedMode('select');

    try {
      let result;
      
      if (isPrintMode) {
        // Print mode: Generate print/pattern variations
        if (!colorwayReference) {
          alert('Print mode requires a reference image. Please add a reference image first.');
          setAiStatus('idle');
          return;
        }
        
        console.log('[Colorway AI] Using Print mode with reference image');
        const colorwayResponse = await generateColorwayPrint(base64Sketch, colorwayReference);
        result = transformColorwayResponse(colorwayResponse, 'print');
        
      } else {
        // Color mode: Generate color variations
        console.log('[Colorway AI] Using Color mode with color:', details);
        const colorwayResponse = await generateColorwayColor(base64Sketch, details);
        result = transformColorwayResponse(colorwayResponse, 'color', details);
      }
      
      console.log('[Colorway AI] Full response:', result);
      
      // Extract the generated image data
      if (result && Array.isArray(result.output)) {
        const imageOutput = result.output.find(
          (item) => item.type === 'image_generation_call' && item.result
        );
        if (imageOutput) {
          const base64 = imageOutput.result;
          const imageUrl = `data:image/png;base64,${base64}`;
          
          // Replace the placeholder with the real image, adjusting to actual AI-generated aspect ratio
          if (canvasRef.current && placeholderId && canvasRef.current.replaceImageById) {
            // Use actual dimensions from Gemini AI to calculate proper scaling
            let finalWidth = placeholderWidth;
            let finalHeight = placeholderHeight;
            
            if (result.imageDimensions) {
              const { width: colorwayWidth, height: colorwayHeight, aspectRatio: colorwayAspectRatio } = result.imageDimensions;
              
              console.log('[Colorway AI] Received image dimensions from Gemini:', {
                width: colorwayWidth,
                height: colorwayHeight,
                aspectRatio: colorwayAspectRatio,
                placeholderAspectRatio: placeholderWidth / placeholderHeight
              });
              
              // Calculate new dimensions maintaining the placeholder's display size but with correct aspect ratio
              if (Math.abs(colorwayAspectRatio - (placeholderWidth / placeholderHeight)) > 0.1) {
                // Aspect ratios are significantly different, recalculate dimensions
                if (colorwayAspectRatio > (placeholderWidth / placeholderHeight)) {
                  // Colorway image is wider, adjust height
                  finalWidth = placeholderWidth;
                  finalHeight = Math.round(placeholderWidth / colorwayAspectRatio);
                } else {
                  // Colorway image is taller, adjust width
                  finalHeight = placeholderHeight;
                  finalWidth = Math.round(placeholderHeight * colorwayAspectRatio);
                }
                
                console.log('[Colorway AI] Adjusted dimensions:', { finalWidth, finalHeight, colorwayAspectRatio });
              } else {
                console.log('[Colorway AI] Using placeholder dimensions (aspect ratios are similar)');
              }
            }
            
            canvasRef.current.replaceImageById(placeholderId, imageUrl, false, finalWidth, finalHeight);
          } else if (canvasRef.current.importImage) {
            // Use the same dimensions as the placeholder to maintain aspect ratio
            canvasRef.current.importImage(imageUrl, x, y, placeholderWidth, placeholderHeight);
          }
        }
      }
      
      setAiStatus('success');
      setTimeout(() => setAiStatus('idle'), 2000);
      
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setAiStatus('idle'), 4000);
      alert(`[Colorway AI] Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleVideoGenerate = async (details: string) => {
    setAiStatus('generating');
    setAiError(null);
    if (!canvasRef.current) {
      setAiStatus('idle');
      return;
    }
    
    // Get selected image from Canvas
    const selectedImage = canvasRef.current.getSelectedImage();
    if (!selectedImage) {
      alert('Please select an image from the board to generate video.');
      setAiStatus('idle');
      return;
    }
    
    // Export the selected image as PNG
    const imageData = canvasRef.current.exportSelectedImageAsPng();
    if (!imageData) {
      alert('Failed to export selected image. Please make sure an image is selected.');
      setAiStatus('idle');
      return;
    }

    // Convert URL to base64 if needed
    let base64Image: string;
    if (imageData.startsWith('http')) {
      // If it's a URL, fetch and convert to base64
      try {
        const response = await fetch(imageData);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data:image/png;base64, prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(blob);
        });
        base64Image = base64;
      } catch (error) {
        console.error('Failed to convert URL to base64:', error);
        alert('Failed to process selected image. Please try again.');
        setAiStatus('idle');
        return;
      }
    } else {
      // If it's already base64, clean it
      base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    }
    
    // Calculate position for video (beside selected image)
    let x = selectedImage.x + selectedImage.width + 40;
    let y = selectedImage.y;
    
    // Add placeholder image immediately for better UX
    const placeholderUrl = '/Placeholder_Image_video.png';
    const videoWidth = 764;   // Correct video width (aspect ratio)
    const videoHeight = 1200; // Correct video height (aspect ratio)
    
    let placeholderId: string | null = null;
    await new Promise<void>(resolve => {
      if (canvasRef.current?.importImage) {
        placeholderId = canvasRef.current.importImage(placeholderUrl, x, y, videoWidth, videoHeight, (id: string) => {
          // After placeholder is loaded, select it
          if (canvasRef.current && canvasRef.current.setSelectedIds) {
            canvasRef.current.setSelectedIds([{ id, type: 'image' }]);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
    
    // Switch to select tool for better UX
    if (setSelectedMode) setSelectedMode('select');
    
    try {
      // Call the new video service
      console.log('[Video AI] Calling video service with:', {
        imageDataLength: base64Image.length,
        prompt: details || '',
        userId
      });
      
      const result = await generateVideo({
        imageData: base64Image,
        prompt: details || '',
        userId
      });
      
      if (result.success && result.video) {
        console.log('🎬 Video generation successful, removing placeholder:', placeholderId);
        console.log('🎬 Processing info:', result.processingInfo);
        console.log('🎬 Final dimensions:', result.video.finalDimensions);
        
        // Remove placeholder image first
        if (canvasRef.current?.removeImage && placeholderId) {
          console.log('🎬 Calling removeImage method');
          canvasRef.current.removeImage(placeholderId);
          console.log('🎬 Placeholder image removed');
        } else {
          console.log('🎬 Cannot remove placeholder - removeImage method not available or placeholderId missing');
          console.log('🎬 removeImage available:', !!canvasRef.current?.removeImage);
          console.log('🎬 placeholderId:', placeholderId);
        }
        
        // Calculate video dimensions based on ORIGINAL INPUT IMAGE dimensions (not AI output)
        // This is crucial for proper desqueezing - we need the dimensions BEFORE squeezing to 9:16
        const originalInputAspectRatio = result.video.finalDimensions.aspectRatio;
        const originalInputWidth = result.video.finalDimensions.width;
        const originalInputHeight = result.video.finalDimensions.height;
        
        console.log('🎬 Desqueezing video to original input dimensions:', {
          originalInputWidth,
          originalInputHeight,
          originalInputAspectRatio,
          aiOutputAspectRatio: 9/16, // AI always outputs 9:16
          difference: Math.abs(originalInputAspectRatio - (9/16))
        });
        
        // Calculate desqueezed dimensions based on original input image
        let videoWidth: number;
        let videoHeight: number;
        
        // Use a reasonable display size while maintaining the original aspect ratio
        const maxDisplayDimension = 800; // Maximum display size for the video
        
        if (originalInputAspectRatio > 1) {
          // Original was landscape (wider than tall)
          videoWidth = maxDisplayDimension;
          videoHeight = Math.round(maxDisplayDimension / originalInputAspectRatio);
        } else {
          // Original was portrait (taller than wide)
          videoHeight = maxDisplayDimension;
          videoWidth = Math.round(maxDisplayDimension * originalInputAspectRatio);
        }
        
        console.log('🎬 Desqueezed video dimensions:', {
          originalInput: { width: originalInputWidth, height: originalInputHeight, ratio: originalInputAspectRatio },
          desqueezed: { width: videoWidth, height: videoHeight, ratio: videoWidth / videoHeight },
          aiOutput: { width: 1024, height: 1820, ratio: 9/16 }
        });
        
        // Use the working importVideo method to add video
        if (canvasRef.current?.importVideo) {
          const videoId = canvasRef.current.importVideo(
            result.video.url,  // Supabase video URL
            x,                  // X position beside selected image
            y,                  // Y position from selected image
            videoWidth,         // Dynamic width based on original aspect ratio
            videoHeight         // Dynamic height based on original aspect ratio
          );
          
          console.log('🎬 Video imported successfully with ID:', videoId);
          
          // Select the newly created video
          if (canvasRef.current.setSelectedIds) {
            canvasRef.current.setSelectedIds([{ id: videoId, type: 'video' }]);
          }
        }
        
        setAiStatus('success');
        setTimeout(() => setAiStatus('idle'), 2000);
        console.log('Video generated and imported successfully:', result.video);
      } else {
        throw new Error('Video generation failed');
      }
      
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
      console.error('[Video AI] Error:', err);
      alert('[Video AI] Error: ' + (err instanceof Error ? err.message : String(err)));
      
      // Remove placeholder on error
      if (canvasRef.current?.removeImage && placeholderId) {
        canvasRef.current.removeImage(placeholderId);
        console.log('🎬 Placeholder image removed due to error');
      }
    }
    
    console.log('Video generation requested:', { details, base64Image, selectedImage });
  };

  const handleVideoCancel = () => {
    setShowVideoSubBar(false);
    if (setSelectedMode) setSelectedMode(''); // Reset to non-clicked state
    if (canvasRef.current && canvasRef.current.clearSketchBox) {
      canvasRef.current.clearSketchBox();
    }
    if (closeSketchBar) closeSketchBar();
  };

  const handleRenderMaterial = (base64: string | null) => {
    setRenderMaterial(base64);
  };

  const handleColorwayReference = (base64: string | null) => {
    setColorwayReference(base64);
  };

  const handleAddMaterial = () => {
    console.log('Add material clicked');
    // Add your add material logic here
  };

  const handleAddColorwayReference = () => {
    console.log('Add colorway reference clicked');
    // Add your add colorway reference logic here
  };

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
          canGenerate={!!renderBoundingBox} // Only require bounding box, material is optional
        />
      )}
      {showColorwaySubBar && (
        <ColorwaySubBar 
          onCancel={handleColorwayCancel}
          onGenerate={handleColorwayGenerate}
          onAddReference={handleAddColorwayReference}
          onReferenceChange={handleColorwayReference}
        />
      )}
      {showVideoSubBar && (
        <VideoSubBar 
          onCancel={handleVideoCancel}
          onGenerate={handleVideoGenerate}
          hasSelectedImage={!!canvasRef.current?.getSelectedImage?.()}
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

      <div className={`flex gap-2.5 justify-center items-center self-stretch px-2.5 py-2 my-auto min-h-[30px] cursor-pointer transition-colors ${selectedMode === 'video' ? 'text-[#E1FF00]' : 'text-neutral-400 hover:text-[#FFFFFF]'}`} onClick={() => handleModeSelect('video')}>
        <FilmReel size={18} className="shrink-0" />
        <div className="self-stretch my-auto text-sm w-[40px]">
          Video
        </div>
      </div>
      </div>
    </div>
  );
};