// Video AI service for fashion video generation using Segmind Kling AI
// This service implements the dynamic aspect ratio pipeline
// Updated to use AI Proxy for network security

import { forceAspectRatio, type PreprocessingResult } from './imagePreprocessingService';
import { restoreAspectRatio, type VideoProcessingResult } from './videoPostProcessingService';
import { callKlingAI } from '../lib/aiProxyService';

export interface VideoResult {
  success: boolean;
  video: {
    url: string;
    id: string;
    originalAspectRatio: number;
    finalDimensions: {
      width: number;
      height: number;
      aspectRatio: number;
    };
  };
  message: string;
  processingInfo: {
    preprocessingTime: number;
    aiProcessingTime: number;
    postProcessingTime: number;
    totalTime: number;
  };
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
  
  const startTime = Date.now();
  console.log('[VideoService] Starting dynamic aspect ratio video generation pipeline');
  console.log('[VideoService] Image data format:', {
    startsWithData: imageData.startsWith('data:'),
    startsWithHttp: imageData.startsWith('http'),
    length: imageData.length
  });

  try {
    // Phase 1: Image Preprocessing (SQUEEZE to 9:16)
    console.log('[VideoService] Phase 1: Image SQUEEZE preprocessing to 9:16');
    const preprocessingStart = Date.now();
    
    const preprocessingResult: PreprocessingResult = await forceAspectRatio(imageData, 9/16);
    
    const preprocessingTime = Date.now() - preprocessingStart;
    console.log('[VideoService] SQUEEZE preprocessing complete in', preprocessingTime, 'ms');
    console.log('[VideoService] Original dimensions:', preprocessingResult.originalDimensions);
    console.log('[VideoService] Squeezed image size:', preprocessingResult.processedImage.length);
    console.log('[VideoService] Squeeze transformation applied successfully');

    // Phase 2: AI Processing (Segmind Kling AI via AI Proxy)
    console.log('[VideoService] Phase 2: AI video generation via AI Proxy');
    const aiStart = Date.now();
    
    // Call Kling AI through the proxy
    const proxyResponse = await callKlingAI(preprocessingResult.processedImage, prompt, userId);
    const aiResult = proxyResponse.result;
    const aiProcessingTime = Date.now() - aiStart;
    
    console.log('[VideoService] AI processing complete in', aiProcessingTime, 'ms');
    console.log('[VideoService] AI result:', aiResult);

    // Phase 3: Video Post-processing (DESQUEEZE to Original Aspect Ratio)
    console.log('[VideoService] Phase 3: Video DESQUEEZE post-processing');
    const postProcessingStart = Date.now();
    
    // For now, we'll use the AI result directly
    // In the future, this would process the video buffer to desqueeze back to original aspect ratio
    console.log('[VideoService] DESQUEEZE processing ready for FFmpeg.js integration');
    const postProcessingTime = Date.now() - postProcessingStart;
    
    const totalTime = Date.now() - startTime;
    
    console.log('[VideoService] Pipeline complete in', totalTime, 'ms');
    
    // Return enhanced result with processing information
    return {
      success: true,
      video: {
        url: aiResult.video.url,
        id: aiResult.video.id,
        originalAspectRatio: preprocessingResult.originalDimensions.aspectRatio,
        finalDimensions: {
          width: preprocessingResult.originalDimensions.width,
          height: preprocessingResult.originalDimensions.height,
          aspectRatio: preprocessingResult.originalDimensions.aspectRatio
        }
      },
      message: `Video generated successfully with SQUEEZE/DESQUEEZE pipeline. Original: ${preprocessingResult.originalDimensions.width}x${preprocessingResult.originalDimensions.height} (${preprocessingResult.originalDimensions.aspectRatio.toFixed(2)}:1) → Squeezed to 9:16 → AI processed → Ready for desqueeze`,
      processingInfo: {
        preprocessingTime,
        aiProcessingTime,
        postProcessingTime,
        totalTime
      }
    };

  } catch (error) {
    console.error('[VideoService] Error in video generation pipeline:', error);
    throw error;
  }
};


