// Video Service - Handles video operations (fastrack only)
// Separate service for video operations

import { forceAspectRatio, PreprocessingResult } from './imagePreprocessingService';
import { restoreAspectRatio, VideoProcessingResult } from './videoPostProcessingService';
import { trackGeneration, precheckGeneration } from '../lib/utils';

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
    finalDimensions?: {
      width: number;
      height: number;
      aspectRatio: number;
    };
  };
  message: string;
  preprocessingInfo?: PreprocessingResult;
  postProcessingInfo?: VideoProcessingResult;
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
    // Precheck: block upfront if limit reached
    if (userId) {
      const { error } = await precheckGeneration(userId, 'video');
      if (error) {
        const limitError: any = new Error('LIMIT_EXCEEDED');
        limitError.message = 'Please update video credit';
        limitError.name = 'LimitExceededError';
        throw limitError;
      }
    }
    // STEP 1: SQUEEZE - Preprocess image to 9:16 aspect ratio
    console.log('[Video Service] Starting image preprocessing (squeeze)');
    const preprocessingResult = await forceAspectRatio(base64Sketch, 9/16);
    
    console.log('[Video Service] Preprocessing complete:', {
      originalAspectRatio: preprocessingResult.originalDimensions.aspectRatio,
      targetAspectRatio: 9/16,
      squeezed: preprocessingResult.originalDimensions.aspectRatio !== (9/16)
    });

    // Use the squeezed image for API call
    const squeezedImage = preprocessingResult.processedImage;
    const response = await fetch('/api/video-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'video_fastrack',
        action: 'generate',
        data: {
          base64Sketch: squeezedImage, // Use squeezed image instead of original
          additionalDetails,
          userId
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
        limitError.message = 'Please update video credit';
        limitError.name = 'LimitExceededError';
        throw limitError;
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`[Video Service] fastrack response:`, {
      success: result.success,
      hasVideo: !!result.result?.video,
      error: result.error
    });

    if (!result.success || !result.result?.video) {
      return result.result;
    }

    // STEP 2: DESQUEEZE - Post-process video to restore original aspect ratio
    console.log('[Video Service] Starting video post-processing (desqueeze)');
    
    try {
      // Fetch the video from the URL
      const videoResponse = await fetch(result.result.video.url);
      const videoBuffer = await videoResponse.arrayBuffer();
      
      // Desqueeze the video back to original aspect ratio
      const postProcessingResult = await restoreAspectRatio(
        Buffer.from(videoBuffer),
        preprocessingResult.originalDimensions,
        9/16
      );
      
      console.log('[Video Service] Post-processing complete:', {
        originalDimensions: preprocessingResult.originalDimensions,
        finalDimensions: postProcessingResult.finalDimensions,
        desqueezed: preprocessingResult.originalDimensions.aspectRatio !== (9/16)
      });

      // Create a new video URL from the desqueezed video
      // In a real implementation, you would upload this to your storage
      const desqueezedVideoBlob = new Blob([postProcessingResult.processedVideo], { type: 'video/mp4' });
      const desqueezedVideoUrl = URL.createObjectURL(desqueezedVideoBlob);

      // Return response with preprocessing and post-processing info
      const responseWithProcessing = {
        ...result.result,
        video: {
          ...result.result.video,
          url: desqueezedVideoUrl, // Use desqueezed video URL
          finalDimensions: postProcessingResult.finalDimensions
        },
        preprocessingInfo: preprocessingResult,
        postProcessingInfo: postProcessingResult
      };

      console.log('[Video Service] Complete processing pipeline finished');
      
      // Track successful generation
      try {
        console.log('[Video Service] Tracking video generation for user:', userId);
        await trackGeneration(userId, 'video', {
          mode: 'video_fastrack',
          hasAdditionalDetails: !!additionalDetails,
          hasPreprocessing: !!preprocessingResult,
          hasPostProcessing: !!postProcessingResult,
          timestamp: Date.now()
        });
        console.log('[Video Service] Successfully tracked video generation');
      } catch (trackingError) {
        console.warn('[Video Service] Failed to track generation:', trackingError);
        // Don't throw error - tracking failure shouldn't break the generation
      }
      
      return responseWithProcessing;

    } catch (desqueezeError) {
      console.warn('[Video Service] Desqueeze failed, returning original video:', desqueezeError);
      
      // If desqueeze fails, return original video with preprocessing info
      const fallbackResponse = {
        ...result.result,
        video: {
          ...result.result.video,
          finalDimensions: preprocessingResult.originalDimensions
        },
        preprocessingInfo: preprocessingResult
      };
      
      // Track successful generation even if desqueeze failed
      try {
        console.log('[Video Service] Tracking video generation (fallback) for user:', userId);
        await trackGeneration(userId, 'video', {
          mode: 'video_fastrack',
          hasAdditionalDetails: !!additionalDetails,
          hasPreprocessing: !!preprocessingResult,
          hasPostProcessing: false, // Desqueeze failed
          timestamp: Date.now()
        });
        console.log('[Video Service] Successfully tracked video generation (fallback)');
      } catch (trackingError) {
        console.warn('[Video Service] Failed to track generation (fallback):', trackingError);
        // Don't throw error - tracking failure shouldn't break the generation
      }
      
      return fallbackResponse;
    }
  } catch (error) {
    console.error(`[Video Service] Error in fastrack:`, error);
    throw error;
  }
}

// Convenience function for video fastrack
export const videoFastrack = (base64Sketch: string, userId: string, additionalDetails?: string) =>
  callVideoService({ base64Sketch, userId, additionalDetails });
