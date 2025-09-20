// Render Pipeline 2 Handler - Video operations
// Migrated from videoHandler.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function handleRenderPipeline2(action, data, service) {
  console.log('[Render Pipeline 2 Handler] handleRenderPipeline2 called with:', { action, service, dataKeys: Object.keys(data) });
  const { base64Sketch, additionalDetails, userId } = data;
  
  if (!base64Sketch) {
    throw new Error('Missing base64Sketch for video fastrack');
  }

  // Get base prompt from environment variable
  const basePrompt = process.env.VIDEO_FST_KEY;
  
  if (!basePrompt) {
    throw new Error('VIDEO_FST_KEY environment variable is not configured');
  }
  
  // Use environment variable base prompt and append user details if provided
  let finalPrompt = basePrompt;
  
  if (additionalDetails && additionalDetails.trim()) {
    finalPrompt += ` ${additionalDetails.trim()}`;
  }
  
  console.log('[Render Pipeline 2 Handler] Final prompt length:', finalPrompt.length);

  // Clean base64 data
  const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');

  // Upload image to Supabase temp storage
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const imageId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const tempImagePath = `temp-images/${imageId}.png`;

  // Upload to board-images bucket (your existing bucket)
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('board-images')
    .upload(tempImagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload image to Supabase: ${uploadError.message}`);
  }

  // Get signed URL from board-images bucket (10 minutes expiry for Segmind processing)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('board-images')
    .createSignedUrl(tempImagePath, 600);

  if (urlError) {
    throw new Error(`Failed to create signed URL: ${urlError.message}`);
  }

  console.log('[Render Pipeline 2 Handler] Image upload result:', {
    uploadData: uploadData?.path,
    urlData: urlData?.signedUrl ? 'Signed URL created successfully' : 'No signed URL',
    tempImagePath
  });

  // Validate that we have a valid image URL
  if (!urlData?.signedUrl) {
    throw new Error('Failed to get signed URL for uploaded image');
  }

  // Test that the signed URL is accessible (optional verification)
  try {
    const testResponse = await fetch(urlData.signedUrl, { method: 'HEAD' });
    if (!testResponse.ok) {
      console.warn(`[Render Pipeline 2 Handler] Signed URL test failed: ${testResponse.status}`);
    } else {
      console.log('[Render Pipeline 2 Handler] Signed URL verified as accessible');
    }
  } catch (testError) {
    console.warn('[Render Pipeline 2 Handler] Signed URL test error:', testError.message);
  }

  // Prepare Segmind API request
  const segmindRequest = {
    prompt: `Front View Shot of model in fashion garment. [Push in] [Static shot] Subtle shoulder rotation, confident smile, slight weight shift. ${finalPrompt}`,
    image: urlData.signedUrl,  // Use signed URL for private bucket access
    duration: 5,
    aspect_ratio: "9:16",
    style: "realistic"
  };

  console.log('[Render Pipeline 2 Handler] Segmind API request:', {
    prompt: segmindRequest.prompt.substring(0, 100) + '...',
    image: segmindRequest.image,
    duration: segmindRequest.duration,
    aspect_ratio: segmindRequest.aspect_ratio,
    style: segmindRequest.style
  });

  // Call Segmind Kling API
  const segmindResponse = await fetch('https://api.segmind.com/v1/kling-2.1', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SEGMIND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(segmindRequest)
  });

  if (!segmindResponse.ok) {
    const errorText = await segmindResponse.text();
    throw new Error(`Segmind API error: ${segmindResponse.status} ${errorText}`);
  }

  // Segmind API returns video file directly, not JSON
  const videoBuffer = await segmindResponse.arrayBuffer();
  console.log('[Render Pipeline 2 Handler] Received video from Segmind API:', {
    size: videoBuffer.byteLength,
    contentType: segmindResponse.headers.get('content-type')
  });

  // Upload video to Supabase with user ID prefix for RLS
  const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const videoPath = `${userId}/${videoId}.mp4`;

  // Upload video to board-videos bucket (your existing bucket)
  const { data: videoUploadData, error: videoUploadError } = await supabase.storage
    .from('board-videos')
    .upload(videoPath, Buffer.from(videoBuffer), {
      contentType: 'video/mp4',
      upsert: false
    });

  if (videoUploadError) {
    throw new Error(`Failed to upload video to Supabase: ${videoUploadError.message}`);
  }

  // Get public URL for video (permanent access for authenticated users)
  const { data: videoUrlData } = await supabase.storage
    .from('board-videos')
    .getPublicUrl(videoPath);

  if (!videoUrlData?.publicUrl) {
    throw new Error('Failed to get public URL for video');
  }

  // Cleanup temp image from board-images bucket
  try {
    await supabase.storage
      .from('board-images')
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
      size: videoBuffer.byteLength
    }
  };
}
