// Video Service - Handles video operations (fastrack only)
// Separate service for video operations

interface VideoRequest {
  base64Sketch: string;
  additionalDetails?: string;
  userId: string;
}

interface VideoResponse {
  success: boolean;
  mode: string;
  model_used: string;
  enhanced_prompt: string;
  video: {
    id: string;
    url: string;
    size: number;
  };
  message: string;
}

export async function callVideoService(request: VideoRequest): Promise<VideoResponse> {
  const { base64Sketch, additionalDetails, userId } = request;
  
  console.log(`[Video Service] Calling fastrack mode with:`, {
    hasBase64Sketch: !!base64Sketch,
    base64SketchLength: base64Sketch?.length || 0,
    hasAdditionalDetails: !!additionalDetails,
    hasUserId: !!userId
  });

  try {
    const response = await fetch('/api/video-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'video_fastrack',
        action: 'generate',
        data: {
          base64Sketch,
          additionalDetails,
          userId
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
    
    console.log(`[Video Service] fastrack response:`, {
      success: result.success,
      hasVideo: !!result.result?.video,
      error: result.error
    });

    return result.result;
  } catch (error) {
    console.error(`[Video Service] Error in fastrack:`, error);
    throw error;
  }
}

// Convenience function for video fastrack
export const videoFastrack = (base64Sketch: string, userId: string, additionalDetails?: string) =>
  callVideoService({ base64Sketch, userId, additionalDetails });
