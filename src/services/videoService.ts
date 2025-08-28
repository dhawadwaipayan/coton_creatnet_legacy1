// Video AI service for fashion video generation using Segmind Kling AI
// This service calls the backend API endpoint for video generation

export interface VideoResult {
  success: boolean;
  video: {
    url: string;
    id: string;
  };
  message: string;
}

export interface VideoGenerationParams {
  imageData: string;
  prompt: string;
  userId: string;
}

/**
 * Generate video from fashion image using Segmind Kling AI
 */
export const generateVideo = async (params: VideoGenerationParams): Promise<VideoResult> => {
  const { imageData, prompt, userId } = params;
  
  console.log('[VideoService] Starting video generation');
  console.log('[VideoService] Image data format:', {
    startsWithData: imageData.startsWith('data:'),
    startsWithHttp: imageData.startsWith('http'),
    length: imageData.length
  });

  try {
    // Call the backend API endpoint for video generation
    console.log('[VideoService] Calling backend API endpoint');
    const response = await fetch('/api/kling-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        base64Image: imageData, 
        prompt: prompt,
        userId: userId
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[VideoService] API response received:', result);
    
    return result;

  } catch (error) {
    console.error('[VideoService] Error generating video:', error);
    throw error;
  }
};


