// Edit Service - Handles edit operations (fastrack only)
// Separate service for edit operations

// Tracking disabled: no imports

interface EditRequest {
  base64Sketch: string;
  additionalDetails?: string;
}

interface EditResponse {
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

export async function callEditService(request: EditRequest, userId?: string): Promise<EditResponse> {
  const { base64Sketch, additionalDetails } = request;
  
  console.log('[Edit Service] Calling edit fastrack with:', {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasAdditionalDetails: !!additionalDetails
  });

  try {
    // Tracking/precheck disabled
    const response = await fetch('/api/edit-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'edit_fastrack',
        action: 'generate',
        data: {
          base64Sketch,
          additionalDetails
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
      
      console.warn('[Edit Service] Upstream error (sanitized):', errorData?.error || response.statusText);
      throw new Error('Image editing failed. Please try again.');
    }

    const result = await response.json();
    
    console.log('[Edit Service] edit fastrack response:', {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0
    });

    // Tracking disabled

    return result.result;
  } catch (error) {
    console.error('[Edit Service] Error in edit fastrack:', error);
    throw error;
  }
}

// Convenience function
export const editFastrack = (base64Sketch: string, additionalDetails?: string, userId?: string) =>
  callEditService({ base64Sketch, additionalDetails }, userId);
