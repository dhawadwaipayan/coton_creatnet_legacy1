// Colorway Service - Handles colorway operations (color and print)
// Separate service for colorway operations

import { trackGeneration, precheckGeneration } from '../lib/utils';

interface ColorwayRequest {
  mode: 'color' | 'print';
  base64Sketch: string;
  additionalDetails?: string;
  selectedColor?: string;
  referenceImage?: string;
}

interface ColorwayResponse {
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

export async function callColorwayService(request: ColorwayRequest, userId?: string): Promise<ColorwayResponse> {
  const { mode, base64Sketch, additionalDetails, selectedColor, referenceImage } = request;
  
  console.log(`[Colorway Service] Calling ${mode} mode with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasAdditionalDetails: !!additionalDetails,
    hasSelectedColor: !!selectedColor,
    hasReferenceImage: !!referenceImage
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
    const response = await fetch('/api/colorway-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: `colorway_${mode}`,
        action: 'generate',
        data: {
          base64Sketch,
          additionalDetails,
          selectedColor,
          referenceImage
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
      
      console.warn('[Colorway Service] Upstream error (sanitized):', errorData?.error || response.statusText);
      throw new Error('Colorway operation failed. Please try again.');
    }

    const result = await response.json();
    
    console.log(`[Colorway Service] ${mode} response:`, {
      success: result.success,
      hasOutput: !!result.result,
      error: result.error
    });

    // Track successful generation if userId is provided
    if (result.success && userId) {
      try {
        console.log(`[Colorway Service] Tracking ${mode} generation for user:`, userId);
        await trackGeneration(userId, 'image', {
          mode: `colorway_${mode}`,
          hasSelectedColor: !!selectedColor,
          hasReferenceImage: !!referenceImage,
          hasAdditionalDetails: !!additionalDetails,
          timestamp: Date.now()
        });
        console.log(`[Colorway Service] Successfully tracked ${mode} generation`);
      } catch (trackingError) {
        console.warn(`[Colorway Service] Failed to track generation:`, trackingError);
        // Don't throw error - tracking failure shouldn't break the generation
      }
    }

    return result.result;
  } catch (error) {
    console.error(`[Colorway Service] Error in ${mode}:`, error);
    throw error;
  }
}

// Convenience functions for each colorway mode
export const colorwayColor = (base64Sketch: string, selectedColor: string, additionalDetails?: string, userId?: string) =>
  callColorwayService({ mode: 'color', base64Sketch, selectedColor, additionalDetails }, userId);

export const colorwayPrint = (base64Sketch: string, referenceImage: string, additionalDetails?: string, userId?: string) =>
  callColorwayService({ mode: 'print', base64Sketch, referenceImage, additionalDetails }, userId);

// Alternative function names that match user's changes
export const generateColorwayColor = colorwayColor;
export const generateColorwayPrint = colorwayPrint;

// Transform function to match expected format
export function transformColorwayResponse(response: ColorwayResponse, mode: 'color' | 'print', details?: string) {
  return {
    success: response.success,
    mode: response.mode,
    model_used: response.model_used,
    enhanced_prompt: response.enhanced_prompt,
    output: response.output,
    message: response.message,
    imageDimensions: response.imageDimensions
  };
}
