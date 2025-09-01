/**
 * OpenRouter Render AI Integration
 * Handles image analysis and rendering using OpenRouter API
 * Updated to use AI Proxy for network security
 */

import { callOpenRouterAI } from './aiProxyService';

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
 * Call OpenRouter API for image rendering via AI Proxy
 */
export async function callOpenRouterRender(params: OpenRouterRenderParams): Promise<OpenRouterRenderResponse> {
  const { base64Sketch, promptText, isFastMode = false } = params;

  try {
    console.log('[OpenRouter Render] Making API call via AI Proxy with params:', {
      hasSketch: !!base64Sketch,
      hasPrompt: !!promptText,
      isFastMode
    });

    const proxyResponse = await callOpenRouterAI(base64Sketch, promptText || '', isFastMode);
    const result = proxyResponse.result;
    
    console.log('[OpenRouter Render] API response received via AI Proxy:', {
      success: result.success,
      mode: result.mode,
      hasOutput: Array.isArray(result.output),
      outputLength: result.output?.length
    });

    return result;

  } catch (error) {
    console.error('[OpenRouter Render] AI Proxy call failed:', error);
    throw new Error(`OpenRouter Render API failed via proxy: ${error instanceof Error ? error.message : String(error)}`);
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
