// Unified AI Service - Single entry point for all AI operations
// Simplified architecture with dedicated handlers for each mode

interface AIRequest {
  mode: 'render' | 'edit' | 'colorway' | 'video';
  subMode?: 'fastrack' | 'accurate' | 'color' | 'print';
  base64Sketch: string;
  promptText?: string;
  base64Material?: string;
  additionalDetails?: string;
  selectedColor?: string;
  referenceImage?: string;
  userId?: string;
}

interface AIResponse {
  success: boolean;
  mode: string;
  model_used: string;
  enhanced_prompt: string;
  output: Array<{
    type: string;
    result: string;
    enhanced_description: string;
  }>;
  message: string;
  imageDimensions?: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  error?: string;
}

// Single AI service call function
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const { mode, subMode, base64Sketch, promptText, base64Material, additionalDetails, selectedColor, referenceImage, userId } = request;
  
  console.log(`[AI Service] Calling ${mode}${subMode ? ` (${subMode})` : ''} with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasPromptText: !!promptText,
    hasBase64Material: !!base64Material,
    hasAdditionalDetails: !!additionalDetails,
    hasSelectedColor: !!selectedColor,
    hasReferenceImage: !!referenceImage,
    hasUserId: !!userId
  });

  try {
    const response = await fetch('/api/coton-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: `${mode}${subMode ? `_${subMode}` : ''}`,
        action: 'generate',
        data: {
          base64Sketch,
          promptText: promptText || '',
          base64Material,
          additionalDetails,
          selectedColor,
          referenceImage,
          userId,
          isFastMode: subMode === 'fastrack'
        },
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`[AI Service] ${mode}${subMode ? ` (${subMode})` : ''} response:`, {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error(`[AI Service] Error in ${mode}${subMode ? ` (${subMode})` : ''}:`, error);
    throw error;
  }
}

// Convenience functions for each mode
export const renderAI = {
  fastrack: (base64Sketch: string, base64Material?: string, additionalDetails?: string) =>
    callAI({ mode: 'render', subMode: 'fastrack', base64Sketch, base64Material, additionalDetails }),
  
  accurate: (base64Sketch: string, base64Material?: string, additionalDetails?: string) =>
    callAI({ mode: 'render', subMode: 'accurate', base64Sketch, base64Material, additionalDetails })
};

export const editAI = {
  fastrack: (base64Sketch: string, additionalDetails?: string) =>
    callAI({ mode: 'edit', subMode: 'fastrack', base64Sketch, additionalDetails })
};

export const colorwayAI = {
  color: (base64Sketch: string, selectedColor: string) =>
    callAI({ mode: 'colorway', subMode: 'color', base64Sketch, selectedColor }),
  
  print: (base64Sketch: string, referenceImage: string) =>
    callAI({ mode: 'colorway', subMode: 'print', base64Sketch, referenceImage })
};

export const videoAI = {
  fastrack: (base64Sketch: string, additionalDetails?: string, userId?: string) =>
    callAI({ mode: 'video', subMode: 'fastrack', base64Sketch, additionalDetails, userId })
};
