// Render Service - Handles both fastrack and accurate modes
// Separate service for render operations

// Tracking disabled: no imports

interface RenderRequest {
  mode: 'fastrack' | 'accurate' | 'model' | 'flat' | 'pro' | 'extract';
  base64Sketch: string;
  base64Material?: string;
  additionalDetails?: string;
}

interface RenderResponse {
  success: boolean;
  mode: string;
  model_used: string;
  enhanced_prompt?: string;
  output: Array<{
    type: string;
    result: string;
    enhanced_description?: string;
  }>;
  message: string;
  imageDimensions?: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  // Polling properties for async operations
  poll_url?: string;
  request_id?: string;
  status?: string;
  downloadData?: string;
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
    // Tracking/precheck disabled
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
            isFastMode: mode === 'fastrack' || mode === 'model'  // Model mode also uses fast mode
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
      
      // Sanitize provider-specific errors
      console.warn('[Render Service] Upstream error (sanitized):', errorData?.error || response.statusText);
      throw new Error('Image generation failed. Please try again.');
    }

    const result = await response.json();
    
    console.log(`[Render Service] ${mode} response:`, {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0
    });

    // Tracking disabled

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

// New sub-mode functions
export const renderModel = (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) =>
  callRenderService({ mode: 'model', base64Sketch, base64Material, additionalDetails }, userId);

export const renderFlat = (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) =>
  callRenderService({ mode: 'flat', base64Sketch, base64Material, additionalDetails }, userId);

export const renderPro = async (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) => {
  // First call to get poll URL
  const initialResponse = await callRenderService({ mode: 'pro', base64Sketch, base64Material, additionalDetails }, userId);
  
  // If we have a poll URL, start polling
  if (initialResponse.poll_url) {
    return await pollSegmindResult(initialResponse.poll_url, initialResponse);
  }
  
  return initialResponse;
};

// Polling function for Segmind async results
async function pollSegmindResult(pollUrl: string, initialResponse: any, maxAttempts: number = 30): Promise<any> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`[Render Pro] Polling attempt ${attempts + 1}/${maxAttempts}`);
      
      const pollResponse = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!pollResponse.ok) {
        throw new Error(`Polling failed: ${pollResponse.status}`);
      }
      
      const pollResult = await pollResponse.json();
      console.log('[Render Pro] Poll result:', pollResult);
      
      // Check if processing is complete
      if (pollResult.status === 'COMPLETED' && pollResult.RenderPro_Output) {
        console.log('[Render Pro] Processing completed successfully');
        
        // Fetch the final image
        const imageResponse = await fetch(pollResult.RenderPro_Output);
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch final image');
        }
        
        const imageBlob = await imageResponse.blob();
        const imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data:image/png;base64, prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(imageBlob);
        });
        
        // Return in the same format as other render modes
        return {
          success: true,
          mode: "Render Pro (Segmind)",
          model_used: "segmind-workflow-v2",
          output: [{
            type: "image_generation_call",
            result: imageBase64
          }],
          message: "Fashion render complete using Segmind AI",
          imageDimensions: initialResponse.imageDimensions,
          downloadData: initialResponse.downloadData
        };
      } else if (pollResult.status === 'FAILED') {
        throw new Error('Segmind processing failed');
      }
      
      // Still processing, wait and try again
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempts++;
      
    } catch (error) {
      console.error('[Render Pro] Polling error:', error);
      throw error;
    }
  }
  
  throw new Error('Segmind processing timeout - maximum attempts reached');
}

export const renderExtract = (base64Sketch: string, base64Material?: string, additionalDetails?: string, userId?: string) =>
  callRenderService({ mode: 'extract', base64Sketch, base64Material, additionalDetails }, userId);
