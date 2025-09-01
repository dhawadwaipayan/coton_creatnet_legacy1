// Video Handler - Handles video operations (fastrack only)
// Separate proxy handler for video operations

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function handleVideoFastrack(action, data) {
  console.log('[Video Handler] handleVideoFastrack called with:', { action, dataKeys: Object.keys(data) });
  const { base64Sketch, additionalDetails, userId } = data;
  
  if (!base64Sketch) {
    throw new Error('Missing base64Sketch for video fastrack');
  }

  // Get base prompt from environment variable
  const basePrompt = process.env.VIDEO_FST_KEY;
  
  if (!basePrompt) {
    throw new Error('VIDEO_FST_KEY environment variable is not configured');
  }
  
  // Use only the environment variable base prompt (no user details)
  const finalPrompt = basePrompt;
  
  console.log('[Video Handler] Using only VIDEO_FST_KEY prompt, length:', finalPrompt.length);

  // Clean base64 data
  const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');

  // Upload image to Supabase temp storage
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const imageId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const tempImagePath = `temp-images/${imageId}.png`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('temp-images')
    .upload(tempImagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload image to Supabase: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('temp-images')
    .getPublicUrl(tempImagePath);

  // Call Segmind Kling API
  const segmindResponse = await fetch('https://api.segmind.com/v1/kling-2.1', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SEGMIND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `Front View Shot of model in fashion garment. [Push in] [Static shot] Subtle shoulder rotation, confident smile, slight weight shift. ${finalPrompt}`,
      image_url: urlData.publicUrl,
      duration: 5,
      aspect_ratio: "9:16",
      style: "realistic"
    })
  });

  if (!segmindResponse.ok) {
    const errorText = await segmindResponse.text();
    throw new Error(`Segmind API error: ${segmindResponse.status} ${errorText}`);
  }

  const segmindResult = await segmindResponse.json();

  // Upload video to Supabase
  const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const videoPath = `board-videos/${videoId}.mp4`;

  const { data: videoUploadData, error: videoUploadError } = await supabase.storage
    .from('board-videos')
    .upload(videoPath, segmindResult.video, {
      contentType: 'video/mp4',
      upsert: false
    });

  if (videoUploadError) {
    throw new Error(`Failed to upload video to Supabase: ${videoUploadError.message}`);
  }

  // Get video public URL
  const { data: videoUrlData } = supabase.storage
    .from('board-videos')
    .getPublicUrl(videoPath);

  // Cleanup temp image
  try {
    await supabase.storage
      .from('temp-images')
      .remove([tempImagePath]);
  } catch (cleanupError) {
    console.warn('Failed to cleanup temporary image:', cleanupError);
  }

  // Return in format expected by client
  return {
    success: true,
    mode: "Video Fastrack",
    model_used: "video-ai-v2",
    enhanced_prompt: additionalDetails && additionalDetails.trim() 
      ? `Video generation with requirements: ${additionalDetails.trim()}`
      : "Video generation",
    output: [{
      type: "video_generation_call",
      result: videoUrlData.publicUrl,
      enhanced_description: additionalDetails && additionalDetails.trim()
        ? `Video generated. Custom requirements: ${additionalDetails.trim()}`
        : "Video generated"
    }],
    message: "Video generation complete",
    video: {
      id: videoId,
      url: videoUrlData.publicUrl,
      size: segmindResult.video.length
    }
  };
}
