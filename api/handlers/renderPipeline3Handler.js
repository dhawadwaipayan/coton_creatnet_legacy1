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

// Poll Segmind API for completion
async function pollSegmindResult(pollUrl, requestId) {
  console.log('[Render Pipeline 3 Handler] Starting polling for request:', requestId);
  
  const maxAttempts = 30; // 5 minutes max (10 seconds * 30)
  const pollInterval = 10000; // 10 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Render Pipeline 3 Handler] Polling attempt ${attempt}/${maxAttempts}`);
    
    try {
      const pollResponse = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.SEGMIND_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (!pollResponse.ok) {
        console.error(`[Render Pipeline 3 Handler] Polling failed: ${pollResponse.status}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      const pollResult = await pollResponse.json();
      console.log(`[Render Pipeline 3 Handler] Poll result:`, JSON.stringify(pollResult, null, 2));
      
      if (pollResult.status === 'COMPLETED' || pollResult.status === 'SUCCESS') {
        console.log('[Render Pipeline 3 Handler] Request completed, processing result...');
        return await processSegmindResult(pollResult, requestId);
      } else if (pollResult.status === 'FAILED' || pollResult.status === 'ERROR') {
        throw new Error(`Segmind request failed: ${pollResult.message || 'Unknown error'}`);
      } else if (pollResult.status === 'QUEUED' || pollResult.status === 'PROCESSING') {
        console.log(`[Render Pipeline 3 Handler] Request still ${pollResult.status}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      } else {
        console.log(`[Render Pipeline 3 Handler] Unknown status: ${pollResult.status}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
    } catch (error) {
      console.error(`[Render Pipeline 3 Handler] Polling error on attempt ${attempt}:`, error);
      if (attempt === maxAttempts) {
        throw new Error(`Polling failed after ${maxAttempts} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error(`Request timed out after ${maxAttempts} polling attempts`);
}

// Process the completed Segmind result
async function processSegmindResult(result, requestId) {
  console.log('[Render Pipeline 3 Handler] Processing completed result for request:', requestId);
  
  // Extract the generated image URL from the completed result
  let generatedImageUrl = null;
  
  // Check if output is a JSON string that needs parsing
  if (result.output && typeof result.output === 'string') {
    try {
      const parsedOutput = JSON.parse(result.output);
      console.log('[Render Pipeline 3 Handler] Parsed output:', JSON.stringify(parsedOutput, null, 2));
      
      // Look for RenderPro_Output in the parsed array
      if (Array.isArray(parsedOutput)) {
        for (const item of parsedOutput) {
          if (item.keyname === 'RenderPro_Output' && item.value && item.value.data) {
            generatedImageUrl = item.value.data;
            console.log('[Render Pipeline 3 Handler] Found URL in parsed output:', generatedImageUrl);
            break;
          }
        }
      }
    } catch (parseError) {
      console.error('[Render Pipeline 3 Handler] Failed to parse output JSON:', parseError);
    }
  }
  
  // Fallback to other possible response structures
  if (!generatedImageUrl) {
    if (result.RenderPro_Output) {
      generatedImageUrl = result.RenderPro_Output;
    } else if (result.renderPro_Output) {
      generatedImageUrl = result.renderPro_Output;
    } else if (result.result) {
      generatedImageUrl = result.result;
    } else if (result.url) {
      generatedImageUrl = result.url;
    } else if (result.image_url) {
      generatedImageUrl = result.image_url;
    } else if (result.imageUrl) {
      generatedImageUrl = result.imageUrl;
    }
  }
  
  // If it's still an object, try to extract URL from nested structure
  if (generatedImageUrl && typeof generatedImageUrl === 'object') {
    console.log('[Render Pipeline 3 Handler] Generated image URL is an object, trying to extract URL...');
    generatedImageUrl = generatedImageUrl.url || generatedImageUrl.image_url || generatedImageUrl.imageUrl || generatedImageUrl.result || generatedImageUrl.output;
  }
  
  if (!generatedImageUrl || typeof generatedImageUrl !== 'string') {
    console.error('[Render Pipeline 3 Handler] Could not extract valid URL from completed result:', JSON.stringify(result, null, 2));
    throw new Error('No valid image URL returned from completed Segmind request');
  }

  console.log('[Render Pipeline 3 Handler] Extracted image URL from completed result:', generatedImageUrl);

  // Download the generated image from Segmind
  const imageResponse = await fetch(generatedImageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }

  const generatedImageBuffer = await imageResponse.arrayBuffer();
  console.log('[Render Pipeline 3 Handler] Downloaded generated image');

  // Upload the generated image to our board-images bucket
  const generatedImageId = `generated_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const generatedImagePath = `generated-images/${generatedImageId}.png`;

  const { data: uploadGeneratedData, error: uploadGeneratedError } = await supabase.storage
    .from('board-images')
    .upload(generatedImagePath, generatedImageBuffer, {
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

  // Get mode configuration
  const modeConfig = getModeConfig('render_pro');

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
  console.log('- Workflow URL type:', typeof workflowUrl);
  console.log('- RENDER_PRO_URL env var:', process.env.RENDER_PRO_URL);
  console.log('- RENDER_PRO_URL type:', typeof process.env.RENDER_PRO_URL);
  
  if (!apiKey) {
    throw new Error('SEGMIND_API_KEY environment variable is not configured');
  }
  
  if (!workflowUrl) {
    throw new Error(`${service} workflow URL environment variable is not configured`);
  }
  
  if (typeof workflowUrl !== 'string') {
    throw new Error(`${service} workflow URL environment variable is not a string: ${typeof workflowUrl}`);
  }
  
  // Validate URL format
  try {
    new URL(workflowUrl);
  } catch (urlError) {
    throw new Error(`Invalid workflow URL format: ${workflowUrl} - ${urlError.message}`);
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

  // Check if the request is queued and needs polling
  if (result.status === 'QUEUED' && result.poll_url) {
    console.log('[Render Pipeline 3 Handler] Request is queued, starting polling...');
    return await pollSegmindResult(result.poll_url, result.request_id);
  }

  // If not queued, try to extract the image URL directly
  let generatedImageUrl = null;
  
  // Try to extract URL from various possible response structures
  if (result.RenderPro_Output) {
    generatedImageUrl = result.RenderPro_Output;
  } else if (result.renderPro_Output) {
    generatedImageUrl = result.renderPro_Output;
  } else if (result.output) {
    generatedImageUrl = result.output;
  } else if (result.result) {
    generatedImageUrl = result.result;
  } else if (result.url) {
    generatedImageUrl = result.url;
  } else if (result.image_url) {
    generatedImageUrl = result.image_url;
  } else if (result.imageUrl) {
    generatedImageUrl = result.imageUrl;
  }
  
  // If it's still an object, try to extract URL from nested structure
  if (generatedImageUrl && typeof generatedImageUrl === 'object') {
    console.log('[Render Pipeline 3 Handler] Generated image URL is an object, trying to extract URL...');
    generatedImageUrl = generatedImageUrl.url || generatedImageUrl.image_url || generatedImageUrl.imageUrl || generatedImageUrl.result || generatedImageUrl.output;
  }
  
  if (!generatedImageUrl || typeof generatedImageUrl !== 'string') {
    console.error('[Render Pipeline 3 Handler] Could not extract valid URL from response:', JSON.stringify(result, null, 2));
    throw new Error('No valid image URL returned from Segmind API');
  }

  console.log('[Render Pipeline 3 Handler] Extracted image URL:', generatedImageUrl);

  // Process the immediate result (no polling needed)
  return await processSegmindResult(result, 'immediate');
}
