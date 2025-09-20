// Render Pipeline 3 Handler - Segmind operations
// Handles different Segmind workflows based on mode

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Get Segmind workflow URL based on mode
const getSegmindUrl = (service) => {
  const urls = {
    'render_pro': process.env.RENDER_PRO_URL,        // v5 workflow
    'render_flat': process.env.RENDER_FLAT_URL,      // v4 workflow  
    'render_extract': process.env.RENDER_EXTRACT_URL, // v5 workflow
    'render_model': process.env.RENDER_MODEL_URL     // v6 workflow
  };
  return urls[service] || urls['render_pro'];
};

// Get mode-specific configuration
const getModeConfig = (service) => {
  const configs = {
    'render_pro': {
      mode: "Render Pro (Segmind)",
      model_used: "RENDER_PRO_URL",
      message: "Fashion render complete using Segmind Pro"
    },
    'render_flat': {
      mode: "Render Flat (Segmind)",
      model_used: "RENDER_FLAT_URL",
      message: "Fashion render complete using Segmind Flat"
    },
    'render_extract': {
      mode: "Render Extract (Segmind)",
      model_used: "RENDER_EXTRACT_URL",
      message: "Fashion render complete using Segmind Extract"
    },
    'render_model': {
      mode: "Render Model (Segmind)",
      model_used: "RENDER_MODEL_URL",
      message: "Fashion render complete using Segmind Model"
    }
  };
  return configs[service] || configs['render_pro'];
};

export async function handleRenderPipeline3(action, data, service) {
  console.log('[Render Pipeline 3 Handler] handleRenderPipeline3 called with:', { action, service, dataKeys: Object.keys(data) });
  
  const { base64Sketch, additionalDetails, userId } = data;
  
  if (!base64Sketch) {
    throw new Error(`Missing base64Sketch for ${service}`);
  }

  // Get Segmind API configuration
  const apiKey = process.env.SEGMIND_API_KEY;
  const workflowUrl = getSegmindUrl(service);
  
  console.log('[Render Pipeline 3 Handler] Environment check:');
  console.log('- SEGMIND_API_KEY exists:', !!apiKey);
  console.log('- API Key length:', apiKey ? apiKey.length : 0);
  console.log('- Service:', service);
  console.log('- Workflow URL:', workflowUrl);
  
  if (!apiKey) {
    throw new Error('SEGMIND_API_KEY environment variable is not configured');
  }
  
  if (!workflowUrl) {
    throw new Error(`${service} workflow URL environment variable is not configured`);
  }

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

  // Get public URL from board-images bucket
  const { data: publicUrlData } = supabase.storage
    .from('board-images')
    .getPublicUrl(tempImagePath);

  const imageUrl = publicUrlData.publicUrl;
  console.log('[Render Pipeline 3 Handler] Image uploaded, URL created:', imageUrl.substring(0, 50) + '...');

  // Prepare Segmind API request
  const segmindData = {
    sketch: imageUrl,
    additional_details: additionalDetails || ''
  };

  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  };

  console.log('[Render Pipeline 3 Handler] Calling Segmind API...');

  // Call Segmind API
  console.log('[Render Pipeline 3 Handler] Calling Segmind API with URL:', workflowUrl);
  console.log('[Render Pipeline 3 Handler] Request data:', JSON.stringify(segmindData, null, 2));
  
  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(segmindData)
  });

  console.log('[Render Pipeline 3 Handler] Response status:', response.status);
  console.log('[Render Pipeline 3 Handler] Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Render Pipeline 3 Handler] API Error:', response.status, errorText);
    throw new Error(`Segmind API error: ${response.status} - ${errorText}`);
  }

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const responseText = await response.text();
    console.error('[Render Pipeline 3 Handler] Non-JSON response:', responseText.substring(0, 200));
    throw new Error(`Segmind API returned non-JSON response: ${contentType}`);
  }

  const result = await response.json();
  console.log('[Render Pipeline 3 Handler] Segmind API response received:', JSON.stringify(result, null, 2));

  // Extract the generated image URL from Segmind response
  const generatedImageUrl = result.RenderPro_Output || result.renderPro_Output || result.output || result;
  
  if (!generatedImageUrl) {
    throw new Error('No image URL returned from Segmind API');
  }

  console.log('[Render Pipeline 3 Handler] Generated image URL:', generatedImageUrl);

  // Download the generated image from Segmind
  const imageResponse = await fetch(generatedImageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  console.log('[Render Pipeline 3 Handler] Downloaded generated image');

  // Upload the generated image to our board-images bucket
  const generatedImageId = `generated_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const generatedImagePath = `generated-images/${generatedImageId}.png`;

  const { data: uploadGeneratedData, error: uploadGeneratedError } = await supabase.storage
    .from('board-images')
    .upload(generatedImagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false
    });

  if (uploadGeneratedError) {
    throw new Error(`Failed to upload generated image to Supabase: ${uploadGeneratedError.message}`);
  }

  // Get public URL for the generated image
  const { data: generatedPublicUrlData } = supabase.storage
    .from('board-images')
    .getPublicUrl(generatedImagePath);

  const finalImageUrl = generatedPublicUrlData.publicUrl;
  console.log('[Render Pipeline 3 Handler] Generated image uploaded to board-images:', finalImageUrl);

  // Clean up temporary input image
  try {
    await supabase.storage
      .from('board-images')
      .remove([tempImagePath]);
    console.log('[Render Pipeline 3 Handler] Temporary input image cleaned up');
  } catch (cleanupError) {
    console.warn('[Render Pipeline 3 Handler] Failed to clean up temporary input image:', cleanupError);
  }

  // Get mode configuration
  const modeConfig = getModeConfig(service);

  // Return in format expected by client
  return {
    success: true,
    mode: modeConfig.mode,
    model_used: modeConfig.model_used,
    output: [{
      type: "image_generation_call",
      result: finalImageUrl
    }],
    message: modeConfig.message,
    imageDimensions: {
      width: 1024,
      height: 1536,
      aspectRatio: 1024 / 1536
    },
    downloadData: finalImageUrl
  };
}
