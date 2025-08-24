import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function uploadVideoToSupabase(userId, videoBuffer) {
  const videoId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const filePath = `${userId}/videos/${videoId}.mp4`;
  
  console.log('Uploading video to Supabase Storage:', {
    userId,
    videoId,
    filePath,
    bufferSize: videoBuffer.length
  });
  
  const { data, error } = await supabase.storage
    .from('board-videos')
    .upload(filePath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });
  
  if (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
  
  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('board-videos')
    .getPublicUrl(filePath);
  
  return {
    videoId,
    publicUrl: urlData.publicUrl
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { base64Image, prompt, userId } = req.body;
    
    if (!base64Image || !prompt || !userId) {
      return res.status(400).json({ error: 'Missing base64Image, prompt, or userId' });
    }
    
    // Convert base64 to buffer for Supabase upload
    const base64Data = base64Image.split(',')[1] || base64Image;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Upload image to Supabase temporarily to get a public URL
    const tempImageId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const tempImagePath = `${userId}/temp/${tempImageId}.png`;
    
    const { data: tempImageData, error: tempImageError } = await supabase.storage
      .from('board-images')
      .upload(tempImagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (tempImageError) {
      console.error('Error uploading temporary image:', tempImageError);
      throw tempImageError;
    }
    
    // Get the public URL for the temporary image
    const { data: tempImageUrlData } = supabase.storage
      .from('board-images')
      .getPublicUrl(tempImagePath);
    
    const imageUrl = tempImageUrlData.publicUrl;
    
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
    
    console.log('Calling Segmind Kling AI with payload:', segmindPayload);
    
    // Call Segmind Kling AI API
    const segmindResponse = await fetch('https://api.segmind.com/v1/kling-2.1', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.SEGMIND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(segmindPayload)
    });
    
    if (!segmindResponse.ok) {
      const errorText = await segmindResponse.text();
      throw new Error(`Segmind API error: ${segmindResponse.status} ${segmindResponse.statusText} - ${errorText}`);
    }
    
    const segmindResult = await segmindResponse.json();
    console.log('Segmind API response:', JSON.stringify(segmindResult, null, 2));
    
    // Get the generated video URL from Segmind response
    let videoUrl = null;
    if (segmindResult && segmindResult.video_url) {
      videoUrl = segmindResult.video_url;
    } else if (segmindResult && segmindResult.output && segmindResult.output.video_url) {
      videoUrl = segmindResult.output.video_url;
    } else {
      throw new Error('No video URL found in Segmind response');
    }
    
    console.log('Generated video URL from Segmind:', videoUrl);
    
    // Download the video from Segmind
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from Segmind: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    
    console.log('Downloaded video from Segmind, size:', videoBuffer.length);
    
    // Upload video to Supabase storage
    const { videoId, publicUrl } = await uploadVideoToSupabase(userId, videoBuffer);
    
    // Clean up temporary image
    try {
      await supabase.storage
        .from('board-images')
        .remove([tempImagePath]);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary image:', cleanupError);
    }
    
    // Return success response with video data
    res.status(200).json({
      success: true,
      video: {
        id: videoId,
        url: publicUrl,
        size: videoBuffer.length
      },
      segmindResponse: segmindResult
    });
    
  } catch (error) {
    console.error('Kling AI Error:', error);
    res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
}
