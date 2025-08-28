// Video AI service for fashion video generation using Segmind Kling AI
import { createClient } from '@supabase/supabase-js';

// Supabase client for video storage
const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
    // Process image data based on format
    let imageBuffer: Buffer;
    
    if (imageData.startsWith('data:')) {
      // It's a data URL, extract base64
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
      console.log('[VideoService] Processed data URL, buffer size:', imageBuffer.length);
    } else if (imageData.startsWith('http')) {
      // It's a URL, download the image
      console.log('[VideoService] Downloading image from URL:', imageData);
      const imageResponse = await fetch(imageData);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(imageArrayBuffer);
      console.log('[VideoService] Downloaded image, buffer size:', imageBuffer.length);
    } else {
      // Assume it's raw base64 data
      imageBuffer = Buffer.from(imageData, 'base64');
      console.log('[VideoService] Processed raw base64, buffer size:', imageBuffer.length);
    }

    // Upload image to Supabase temporarily to get a public URL
    const tempImageId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const tempImagePath = `${userId}/temp/${tempImageId}.png`;
    
    console.log('[VideoService] Uploading temporary image to Supabase');
    const { data: tempImageData, error: tempImageError } = await supabase.storage
      .from('board-images')
      .upload(tempImagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (tempImageError) {
      console.error('[VideoService] Error uploading temporary image:', tempImageError);
      throw tempImageError;
    }

    // Get the public URL for the temporary image
    const { data: tempImageUrlData } = supabase.storage
      .from('board-images')
      .getPublicUrl(tempImagePath);
    
    const imageUrl = tempImageUrlData.publicUrl;
    console.log('[VideoService] Temporary image URL:', imageUrl);

    // Prepare the request payload for Segmind Kling AI
    const segmindPayload = {
      "image": imageUrl,
      "prompt": `Front View Shot of model in fashion garment. [Push in] [Static shot] Subtle shoulder rotation, confident smile, slight weight shift. ${prompt}`,
      "negative_prompt": "No jittery motion, avoid rapid scene changes, no blur, no distortion.",
      "cfg_scale": 0.7,
      "mode": "std",
      "aspect_ratio": "9:16",
      "duration": 5
    };

    console.log('[VideoService] Calling Segmind Kling AI with payload:', segmindPayload);
    
    // Call Segmind Kling AI API
    const segmindResponse = await fetch('https://api.segmind.com/v1/kling-2.1', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.SEGMIND_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(segmindPayload)
    });

    console.log('[VideoService] Segmind response status:', segmindResponse.status);
    
    if (!segmindResponse.ok) {
      const errorText = await segmindResponse.text();
      throw new Error(`Segmind API error: ${segmindResponse.status} - ${errorText}`);
    }

    // Check if response is JSON or binary video
    const contentType = segmindResponse.headers.get('content-type');
    let videoBuffer: Buffer;
    let segmindResult = null;

    if (contentType && contentType.includes('application/json')) {
      // JSON response with video URL
      segmindResult = await segmindResponse.json();
      console.log('[VideoService] Segmind API response:', JSON.stringify(segmindResult, null, 2));
      
      // Get the generated video URL from Segmind response
      let videoUrl = null;
      if (segmindResult && segmindResult.video_url) {
        videoUrl = segmindResult.video_url;
      } else if (segmindResult && segmindResult.output && segmindResult.output.video_url) {
        videoUrl = segmindResult.output.video_url;
      } else {
        throw new Error('No video URL found in Segmind response');
      }
      
      console.log('[VideoService] Generated video URL from Segmind:', videoUrl);
      
      // Download the video from Segmind
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video from Segmind: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const videoArrayBuffer = await videoResponse.arrayBuffer();
      videoBuffer = Buffer.from(videoArrayBuffer);
    } else {
      // Direct binary video response
      console.log('[VideoService] Segmind returned direct video binary response');
      const videoArrayBuffer = await segmindResponse.arrayBuffer();
      videoBuffer = Buffer.from(videoArrayBuffer);
    }

    // Upload video to Supabase Storage
    console.log('[VideoService] Uploading video to Supabase Storage');
    const videoId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const filePath = `${userId}/videos/${videoId}.mp4`;
    
    const { data: videoData, error: videoError } = await supabase.storage
      .from('board-videos')
      .upload(filePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });
    
    if (videoError) {
      console.error('[VideoService] Error uploading video:', videoError);
      throw videoError;
    }

    // Get the public URL for the uploaded video
    const { data: videoUrlData } = supabase.storage
      .from('board-videos')
      .getPublicUrl(filePath);
    
    const finalVideoUrl = videoUrlData.publicUrl;
    console.log('[VideoService] Video uploaded successfully:', finalVideoUrl);

    // Clean up temporary image
    try {
      await supabase.storage
        .from('board-images')
        .remove([tempImagePath]);
      console.log('[VideoService] Temporary image cleaned up');
    } catch (cleanupError) {
      console.warn('[VideoService] Failed to clean up temporary image:', cleanupError);
    }

    return {
      success: true,
      video: {
        url: finalVideoUrl,
        id: videoId
      },
      message: 'Video generated successfully using Segmind Kling AI'
    };

  } catch (error) {
    console.error('[VideoService] Error generating video:', error);
    throw error;
  }
};

/**
 * Clean up temporary files (optional utility function)
 */
export const cleanupTempFiles = async (userId: string): Promise<void> => {
  try {
    const { data, error } = await supabase.storage
      .from('board-images')
      .list(`${userId}/temp`);
    
    if (error) {
      console.warn('[VideoService] Failed to list temp files for cleanup:', error);
      return;
    }

    if (data && data.length > 0) {
      const tempFiles = data.map(file => `${userId}/temp/${file.name}`);
      await supabase.storage
        .from('board-images')
        .remove(tempFiles);
      console.log('[VideoService] Cleaned up', tempFiles.length, 'temporary files');
    }
  } catch (cleanupError) {
    console.warn('[VideoService] Error during cleanup:', cleanupError);
  }
};
