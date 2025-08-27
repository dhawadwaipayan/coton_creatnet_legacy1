/**
 * OpenRouter Render AI Integration
 * Handles image analysis and rendering using OpenRouter API
 */

export interface OpenRouterRenderParams {
  base64Sketch: string;
  promptText?: string;
  isFastMode?: boolean;
}

export interface OpenRouterRenderResponse {
  success: boolean;
  mode: 'fastrack' | 'accurate';
  model_used: string;
  enhanced_prompt: string;
  original_sketch: string;
  output: Array<{
    type: string;
    result: string;
    enhanced_description?: string;
    processing_details?: any;
  }>;
  message: string;
  error?: string;
}

/**
 * Call OpenRouter API for image rendering
 */
export async function callOpenRouterRender(params: OpenRouterRenderParams): Promise<OpenRouterRenderResponse> {
  const { base64Sketch, promptText, isFastMode = false } = params;

  try {
    console.log('[OpenRouter Render] Making API call with params:', {
      hasSketch: !!base64Sketch,
      hasPrompt: !!promptText,
      isFastMode
    });

    const response = await fetch('/api/openrouter-render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Sketch,
        promptText,
        isFastMode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('[OpenRouter Render] API response received:', {
      success: result.success,
      mode: result.mode,
      hasOutput: Array.isArray(result.output),
      outputLength: result.output?.length
    });

    return result;

  } catch (error) {
    console.error('[OpenRouter Render] API call failed:', error);
    throw new Error(`OpenRouter Render API failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract base64 image from OpenRouter response
 */
export function extractBase64FromOpenRouterResponse(response: OpenRouterRenderResponse): string | null {
  if (!response.output || !Array.isArray(response.output)) {
    return null;
  }

  const imageOutput = response.output.find(
    item => item.type === 'image_generation_call' && item.result
  );

  return imageOutput?.result || null;
}

/**
 * Extract enhanced description from OpenRouter response
 */
export function extractDescriptionFromOpenRouterResponse(response: OpenRouterRenderResponse): string | null {
  return response.enhanced_prompt || null;
}
