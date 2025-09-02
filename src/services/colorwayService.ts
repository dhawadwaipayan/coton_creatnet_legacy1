// Colorway Service - Handles colorway operations (color and print)
// Separate service for colorway operations

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

export async function callColorwayService(request: ColorwayRequest): Promise<ColorwayResponse> {
  const { mode, base64Sketch, additionalDetails, selectedColor, referenceImage } = request;
  
  console.log(`[Colorway Service] Calling ${mode} mode with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasAdditionalDetails: !!additionalDetails,
    hasSelectedColor: !!selectedColor,
    hasReferenceImage: !!referenceImage
  });

  try {
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
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`[Colorway Service] ${mode} response:`, {
      success: result.success,
      hasOutput: !!result.result,
      error: result.error
    });

    return result.result;
  } catch (error) {
    console.error(`[Colorway Service] Error in ${mode}:`, error);
    throw error;
  }
}

// Convenience functions for each colorway mode
export const colorwayColor = (base64Sketch: string, selectedColor: string, additionalDetails?: string) =>
  callColorwayService({ mode: 'color', base64Sketch, selectedColor, additionalDetails });

export const colorwayPrint = (base64Sketch: string, referenceImage: string, additionalDetails?: string) =>
  callColorwayService({ mode: 'print', base64Sketch, referenceImage, additionalDetails });

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
