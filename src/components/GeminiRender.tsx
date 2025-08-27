import React, { useState } from 'react';
import { generateImage, transformGeminiResponse } from '../services/geminiService';
import { GeminiImageRequest, GeminiRenderResponse } from '../types';

interface GeminiRenderProps {
  base64Sketch: string;
  promptText?: string;
  onSuccess: (response: GeminiRenderResponse) => void;
  onError: (error: string) => void;
  onStart: () => void;
}

/**
 * GeminiRender Component - Following referenced GitHub repository structure
 * Handles Gemini API integration for photorealistic sketch rendering
 */
export const GeminiRender: React.FC<GeminiRenderProps> = ({
  base64Sketch,
  promptText,
  onSuccess,
  onError,
  onStart
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!base64Sketch) {
      onError('No sketch provided');
      return;
    }

    setIsGenerating(true);
    onStart();

    try {
      console.log('[Gemini Render] Starting generation with base prompt: "Make this sketch photorealistic."');
      
      const request: GeminiImageRequest = {
        base64Sketch,
        promptText
      };

      const response = await generateImage(request);
      
      if (response.success && response.imageData) {
        const transformedResponse = transformGeminiResponse(response);
        console.log('[Gemini Render] Generation successful');
        onSuccess(transformedResponse);
      } else {
        console.error('[Gemini Render] Generation failed:', response.error);
        onError(response.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('[Gemini Render] Error during generation:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="gemini-render">
      <button 
        onClick={handleGenerate} 
        disabled={isGenerating || !base64Sketch}
        className="generate-button"
      >
        {isGenerating ? 'Generating...' : 'Generate with Gemini'}
      </button>
      
      {isGenerating && (
        <div className="generation-status">
          <p>Converting sketch to photorealistic image...</p>
        </div>
      )}
    </div>
  );
};

export default GeminiRender;
