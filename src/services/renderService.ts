// Render Service - Handles both fastrack and accurate modes
// Separate service for render operations

import { trackGeneration, precheckGeneration } from '../lib/utils';

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

export async function callRenderService(request: RenderRequest, userId?: string): Promise<RenderResponse> {
  const { mode, base64Sketch, base64Material, additionalDetails } = request;
  
  console.log(`[Render Service] Calling ${mode} mode with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasBase64Material: !!base64Material,
    hasAdditionalDetails: !!additionalDetails,
    additionalDetailsLength: additionalDetails?.length || 0
  });

  try {
    // Precheck: block upfront if limit reached
    if (userId) {
      const { error } = await precheckGeneration(userId, 'image');
      if (error) {
        const limitError: any = new Error('LIMIT_EXCEEDED');
        limitError.message = 'Please update image credit';
        limitError.name = 'LimitExceededError';
        throw limitError;
      }
    }
    const response = await fetch('/api/render-engine', {
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
      
      // Check for limit exceeded error (429)
      if (response.status === 429) {
        const limitError = new Error('LIMIT_EXCEEDED');
        limitError.message = 'Please update image credit';
        limitError.name = 'LimitExceededError';
        throw limitError;
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`[Render Service] ${mode} response:`, {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0
    });

    // Track successful generation if userId is provided
    if (result.success && userId) {
      try {
        console.log(`[Render Service] Tracking ${mode} generation for user:`, userId);
        await trackGeneration(userId, 'image', {
          mode,
          hasMaterial: !!base64Material,
          hasAdditionalDetails: !!additionalDetails,
          timestamp: Date.now()
        });
        console.log(`[Render Service] Successfully tracked ${mode} generation`);
      } catch (trackingError) {
        console.warn(`[Render Service] Failed to track generation:`, trackingError);
        // Don't throw error - tracking failure shouldn't break the generation
      }
    }

    return result.result;
  } catch (error) {
    console.error(`[Render Service] Error in ${mode}:`, error);
    throw error;
  }
}

// Convenience functions
export const renderFastrack = (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) =>
  callRenderService({ mode: 'fastrack', base64Sketch, base64Material, additionalDetails }, userId);

export const renderAccurate = (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) =>
  callRenderService({ mode: 'accurate', base64Sketch, base64Material, additionalDetails }, userId);
