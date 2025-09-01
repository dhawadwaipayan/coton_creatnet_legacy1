// Render Service - Handles both fastrack and accurate modes
// Separate service for render operations

interface RenderRequest {
  mode: 'fastrack' | 'accurate';
  base64Sketch: string;
  base64Material?: string;
  additionalDetails?: string;
}

interface RenderResponse {
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
}

export async function callRenderService(request: RenderRequest): Promise<RenderResponse> {
  const { mode, base64Sketch, base64Material, additionalDetails } = request;
  
  console.log(`[Render Service] Calling ${mode} mode with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasBase64Material: !!base64Material,
    hasAdditionalDetails: !!additionalDetails
  });

  try {
    const response = await fetch('/api/render-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: `render_${mode}`,
        action: 'generate',
        data: {
          base64Sketch,
          base64Material,
          additionalDetails,
          isFastMode: mode === 'fastrack'
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
    
    console.log(`[Render Service] ${mode} response:`, {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0
    });

    return result;
  } catch (error) {
    console.error(`[Render Service] Error in ${mode}:`, error);
    throw error;
  }
}

// Convenience functions
export const renderFastrack = (base64Sketch: string, base64Material?: string, additionalDetails?: string) =>
  callRenderService({ mode: 'fastrack', base64Sketch, base64Material, additionalDetails });

export const renderAccurate = (base64Sketch: string, base64Material?: string, additionalDetails?: string) =>
  callRenderService({ mode: 'accurate', base64Sketch, base64Material, additionalDetails });
