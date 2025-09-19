// Segmind Handler - Handles Segmind API calls for pro mode
// Similar to video mode but for Segmind API

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function handleSegmindRender(action, data, mode) {
  console.log('[Segmind Handler] handleSegmindRender called with:', { action, mode, dataKeys: Object.keys(data) });
  const { base64Sketch, additionalDetails, userId } = data;
  
  if (!base64Sketch) {
    throw new Error('Missing base64Sketch for Segmind render');
  }

  // Get Segmind API configuration
  const apiKey = process.env.SEGMIND_API_KEY;
  const workflowUrl = process.env.SEGMIND_WORKFLOW_URL_PRO; // For pro mode
  
  if (!apiKey) {
    throw new Error('SEGMIND_API_KEY environment variable is not configured');
  }
  
  if (!workflowUrl) {
    throw new Error('SEGMIND_WORKFLOW_URL_PRO environment variable is not configured');
  }

  console.log('[Segmind Handler] Using workflow URL:', workflowUrl);

  // Clean base64 data
  const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');

  // Upload image to Supabase temp storage (similar to video mode)
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const imageId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const tempImagePath = `temp-images/${imageId}.png`;

  // Upload to board-images bucket
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
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('board-images')
    .createSignedUrl(tempImagePath, 600); // 10 minutes

  if (signedUrlError) {
    throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
  }

  const imageUrl = signedUrlData.signedUrl;
  console.log('[Segmind Handler] Image uploaded, URL created:', imageUrl.substring(0, 50) + '...');

  // Prepare Segmind API request
  const segmindData = {
    sketch: imageUrl,
    additional_details: additionalDetails || ''
  };

  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  };

  console.log('[Segmind Handler] Calling Segmind API...');

  // Call Segmind API
  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(segmindData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Segmind Handler] API Error:', response.status, errorText);
    throw new Error(`Segmind API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[Segmind Handler] Segmind API response received');

  // Clean up temporary image
  try {
    await supabase.storage
      .from('board-images')
      .remove([tempImagePath]);
    console.log('[Segmind Handler] Temporary image cleaned up');
  } catch (cleanupError) {
    console.warn('[Segmind Handler] Failed to clean up temporary image:', cleanupError);
  }

  // Return in format expected by client
  return {
    success: true,
    mode: "Render Pro (Segmind)",
    model_used: "segmind-pro",
    output: [{
      type: "image_generation_call",
      result: result.RenderPro_Output || result.renderPro_Output || result.output
    }],
    message: "Fashion render complete using Segmind Pro",
    imageDimensions: {
      width: 1024,
      height: 1536,
      aspectRatio: 1024 / 1536
    },
    downloadData: imageUrl // Return the original image URL for reference
  };
}
