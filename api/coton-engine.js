// Coton Engine - Unified service router for all external API calls
// This provides a centralized endpoint for service routing

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service, action, data, timestamp, nonce } = req.body;

    // Validate request structure
    if (!service || !action || !data) {
      return res.status(400).json({ 
        error: 'Missing required fields: service, action, data' 
      });
    }

    // Add request logging for debugging (can be removed in production)
    console.log(`[Coton Engine] Routing request: ${service}.${action}`, {
      timestamp,
      nonce: nonce ? nonce.substring(0, 8) + '...' : 'none',
      dataKeys: Object.keys(data)
    });
    
    // Enhanced debugging for render fastrack mode
    if (service === 'render_fastrack') {
      console.log('[Coton Engine] Render fastrack service called - Gemini AI mode');
      console.log('[Coton Engine] Gemini API Key available:', !!process.env.GEMINI_API_KEY);
    } else if (service === 'gemini') {
      console.log('[Coton Engine] Legacy Gemini service called - should use render_fastrack instead');
      console.log('[Coton Engine] Gemini API Key available:', !!process.env.GEMINI_API_KEY);
    } else if (service === 'flux') {
      console.log('[Coton Engine] Flux service called - should NOT be called for render fastrack');
      console.log('[Coton Engine] Together API Key available:', !!process.env.TOGETHER_API_KEY);
    }

    // Route to appropriate AI service
    let result;
    switch (service) {
      case 'sketch':
        result = await handleSketchAI(action, data);
        break;
      case 'render':
        result = await handleRenderAI(action, data);
        break;
      case 'video':
        result = await handleVideoAI(action, data);
        break;
      case 'render_fastrack':
        result = await handleGeminiAI(action, data);
        break;
      case 'gemini':
        // Legacy support - route to same handler but log warning
        console.log('[Coton Engine] WARNING: Using legacy gemini service, should use render_fastrack');
        result = await handleGeminiAI(action, data);
        break;
      case 'openrouter':
        result = await handleOpenRouterAI(action, data);
        break;
      case 'flux':
        result = await handleFluxAI(action, data);
        break;
      case 'kling':
        result = await handleKlingAI(action, data);
        break;
      default:
        return res.status(400).json({ 
          error: `Unknown service: ${service}` 
        });
    }

    // Return successful response
    return res.status(200).json({
      success: true,
      service,
      action,
      result,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Coton Engine] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: Date.now()
    });
  }
}

// Sketch AI Handler
async function handleSketchAI(action, data) {
  const { base64Image, promptText } = data;
  
  if (!base64Image || !promptText) {
    throw new Error('Missing base64Image or promptText for sketch AI');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openaiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: promptText },
          { type: 'input_image', image_url: base64Image }
        ]
      }],
      text: { format: { type: 'text' } },
      reasoning: {},
      tools: [{
        type: 'image_generation',
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
        background: 'transparent',
        moderation: 'low'
      }],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    })
  });

  if (!openaiRes.ok) {
    const errorData = await openaiRes.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || openaiRes.statusText}`);
  }

  return await openaiRes.json();
}

// Render AI Handler
async function handleRenderAI(action, data) {
  const { base64Sketch, base64Material, promptText } = data;
  
  if (!base64Sketch || !promptText) {
    throw new Error('Missing base64Sketch or promptText for render AI');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const inputArr = [
    { type: 'input_text', text: promptText },
    { type: 'input_image', image_url: base64Sketch }
  ];
  
  if (base64Material) {
    inputArr.push({ type: 'input_image', image_url: base64Material });
  }

  const openaiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      input: [{
        role: 'user',
        content: inputArr
      }],
      text: { format: { type: 'text' } },
      reasoning: {},
      tools: [{
        type: 'image_generation',
        size: '1024x1536',
        quality: 'high',
        output_format: 'png',
        background: 'opaque',
        moderation: 'low'
      }],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    })
  });

  if (!openaiRes.ok) {
    const errorData = await openaiRes.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || openaiRes.statusText}`);
  }

  return await openaiRes.json();
}

// Video AI Handler (Kling)
async function handleVideoAI(action, data) {
  const { base64Sketch, promptText, userId } = data;
  
  if (!base64Sketch || !promptText || !userId) {
    throw new Error('Missing required fields for video AI');
  }

  const apiKey = process.env.SEGMIND_API_KEY;
  if (!apiKey) {
    throw new Error('Segmind API key not configured');
  }

  const response = await fetch('https://api.kling.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: promptText,
      model: 'kling-v1',
      width: 1024,
      height: 1024,
      steps: 50,
      image_url: base64Sketch
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kling API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Gemini AI Handler - Exact replica of original geminiService.ts
async function handleGeminiAI(action, data) {
  const { base64Sketch, promptText, isFastMode = false, base64Material, additionalDetails } = data;
  
  if (!base64Sketch || !promptText) {
    throw new Error('Missing base64Sketch or promptText for Gemini AI');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Coton Engine] GEMINI_API_KEY environment variable is missing');
    throw new Error('Gemini API key not configured - check GEMINI_API_KEY environment variable');
  }
  console.log('[Coton Engine] Gemini API key found, proceeding with API call');

  // Use the Google Generative AI SDK approach for proper image generation
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Clean base64 data (remove data:image/png;base64, prefix if present)
  const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Clean material image data if provided
  const cleanMaterialBase64 = base64Material ? base64Material.replace(/^data:image\/[a-z]+;base64,/, '') : null;

  // Get base prompt from environment variable for security
  const basePrompt = process.env.RENDER_FASTRACK_KEY;
  
  console.log('[Coton Engine] Environment variable check:');
  console.log('[Coton Engine] RENDER_FASTRACK_KEY exists:', !!process.env.RENDER_FASTRACK_KEY);
  console.log('[Coton Engine] RENDER_FASTRACK_KEY length:', process.env.RENDER_FASTRACK_KEY?.length || 0);
  console.log('[Coton Engine] Received promptText:', promptText);
  console.log('[Coton Engine] Is placeholder?', promptText === "RENDER_FASTRACK_PROMPT");
  
  if (!basePrompt) {
    console.error('[Coton Engine] ERROR: RENDER_FASTRACK_KEY environment variable is not configured');
    throw new Error('RENDER_FASTRACK_KEY environment variable is not configured');
  }

  // Replace placeholder with actual prompt or use provided prompt
  let finalPromptText = promptText === "RENDER_FASTRACK_PROMPT" ? basePrompt : promptText;
  
  // Log if using environment variable
  if (promptText === "RENDER_FASTRACK_PROMPT") {
    console.log('[Coton Engine] Using RENDER_FASTRACK_KEY environment variable for base prompt');
    console.log('[Coton Engine] Final prompt length:', finalPromptText.length);
  } else {
    console.log('[Coton Engine] Using provided prompt text');
  }
  
  // If additionalDetails is provided, append it (like original service)
  if (additionalDetails && additionalDetails.trim()) {
    finalPromptText += `\n\nAdditional User Requirements: ${additionalDetails.trim()}`;
  }
  
  console.log('[Coton Engine] Final promptText:', finalPromptText);
  console.log('[Coton Engine] Prompt length:', finalPromptText.length);
  
  // Get the model directly from Gemini SDK (exact same as original)
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-image-preview" 
  });

  // Generate content directly using the SDK (exact same as original)
  const result = await model.generateContent([
    finalPromptText,
    {
      inlineData: {
        mimeType: "image/png",
        data: cleanBase64
      }
    },
    // Add material image if provided (exact same as original)
    ...(cleanMaterialBase64 ? [{
      inlineData: {
        mimeType: "image/png",
        data: cleanMaterialBase64
      }
    }] : [])
  ]);

  const response = await result.response;
  
  console.log('[Coton Engine] Gemini response received:', {
    hasCandidates: !!response.candidates,
    candidatesLength: response.candidates?.length,
    firstCandidate: response.candidates?.[0] ? {
      hasContent: !!response.candidates[0].content,
      hasParts: !!response.candidates[0].content?.parts,
      partsLength: response.candidates[0].content?.parts?.length,
      partsTypes: response.candidates[0].content?.parts?.map(p => ({
        hasText: !!p.text,
        hasInlineData: !!p.inlineData,
        mimeType: p.inlineData?.mimeType
      }))
    } : null
  });
  
  // Extract the generated image data (exact same as original)
  const generatedImage = response.candidates?.[0]?.content?.parts?.find(
    part => part.inlineData && part.inlineData.mimeType?.startsWith('image/')
  );

  console.log('[Coton Engine] Generated image check:', {
    foundImage: !!generatedImage,
    hasInlineData: !!generatedImage?.inlineData,
    hasData: !!generatedImage?.inlineData?.data,
    mimeType: generatedImage?.inlineData?.mimeType,
    dataLength: generatedImage?.inlineData?.data?.length
  });

  if (!generatedImage?.inlineData?.data) {
    console.error('[Coton Engine] No image generated - full response:', JSON.stringify(response, null, 2));
    throw new Error('No image generated by Gemini API');
  }

  // Return in the same format as original service (camelCase for client compatibility)
  return {
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            mimeType: generatedImage.inlineData.mimeType,
            data: generatedImage.inlineData.data
          }
        }]
      }
    }]
  };
}

// OpenRouter AI Handler
async function handleOpenRouterAI(action, data) {
  const { base64Sketch, promptText, isFastMode = false } = data;
  
  if (!base64Sketch || !promptText) {
    throw new Error('Missing base64Sketch or promptText for OpenRouter AI');
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const model = isFastMode ? 'segmind/flux-dev' : 'segmind/flux-pro';
  
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: promptText,
      image: base64Sketch,
      width: 1024,
      height: 1024,
      steps: isFastMode ? 20 : 50,
      guidance_scale: 7.5
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
  }

  return await response.json();
}

// Flux AI Handler
async function handleFluxAI(action, data) {
  const { base64Sketch, userId } = data;
  
  if (!base64Sketch || !userId) {
    throw new Error('Missing base64Sketch or userId for Flux AI');
  }

  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error('Together API key not configured for Flux AI');
  }

  // Upload sketch to Supabase and get public URL
  const base64Data = base64Sketch.split(',')[1] || base64Sketch;
  const buffer = Buffer.from(base64Data, 'base64');
  const imageId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const boardId = 'together-fastmode';
  
  // This would need the Supabase upload logic from the original flux-kontext-ai.js
  // For now, we'll use the base64 directly
  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Generate a high-quality image based on the provided sketch',
      model: 'black-forest-labs/FLUX.1-kontext-dev',
      width: 768,
      height: 768,
      steps: 40,
      image_url: base64Sketch
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Together API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Kling AI Handler (Segmind API)
async function handleKlingAI(action, data) {
  console.log('[Coton Engine] handleKlingAI called with:', { action, dataKeys: Object.keys(data) });
  const { base64Sketch, promptText, userId } = data;
  
  console.log('[Coton Engine] Kling AI parameters:', {
    hasBase64Sketch: !!base64Sketch,
    promptText: promptText,
    hasUserId: !!userId
  });
  
  // Allow empty promptText – server will supply base prompt when missing
  if (!base64Sketch || !userId) {
    throw new Error('Missing required fields for Kling AI');
  }

  const apiKey = process.env.SEGMIND_API_KEY;
  if (!apiKey) {
    throw new Error('Segmind API key not configured');
  }

  // Convert base64 to buffer for Supabase upload
  let imageBuffer;
  if (base64Sketch.startsWith('data:')) {
    // It's a data URL, extract base64
    const base64Data = base64Sketch.split(',')[1];
    imageBuffer = Buffer.from(base64Data, 'base64');
  } else if (base64Sketch.startsWith('http')) {
    // It's a URL, download the image
    const imageResponse = await fetch(base64Sketch);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    imageBuffer = Buffer.from(imageArrayBuffer);
  } else {
    // Assume it's raw base64 data (without data: prefix)
    try {
      imageBuffer = Buffer.from(base64Sketch, 'base64');
    } catch (error) {
      throw new Error('Invalid base64 image data');
    }
  }

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
    throw tempImageError;
  }
  
  // Get the public URL for the temporary image
  const { data: tempImageUrlData } = supabase.storage
    .from('board-images')
    .getPublicUrl(tempImagePath);
  
  const imageUrl = tempImageUrlData.publicUrl;

  // Prepare the request payload for Segmind Kling AI
  const basePrompt = "Front View Shot of model in fashion garment. [Push in] [Static shot] Subtle shoulder rotation, confident smile, slight weight shift.";
  const finalPrompt = promptText && promptText.trim() 
    ? `${basePrompt} ${promptText.trim()}` 
    : basePrompt;
    
  console.log('[Coton Engine] Prompt construction:', {
    receivedPromptText: promptText,
    promptTextType: typeof promptText,
    promptTextLength: promptText?.length || 0,
    promptTextTrimmed: promptText?.trim() || '',
    basePrompt: basePrompt,
    finalPrompt: finalPrompt
  });
    
  const segmindPayload = {
    "image": imageUrl,
    "prompt": finalPrompt,
    "negative_prompt": "No jittery motion, avoid rapid scene changes, no blur, no distortion.",
    "cfg_scale": 0.7,
    "mode": "std",
    "aspect_ratio": "9:16",
    "duration": 5
  };

  // Call Segmind Kling AI API
  const segmindResponse = await fetch('https://api.segmind.com/v1/kling-2.1', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SEGMIND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(segmindPayload)
  });

  // Check if response is JSON or binary video
  const contentType = segmindResponse.headers.get('content-type');
  let videoBuffer;
  let segmindResult = null;

  if (contentType && contentType.includes('application/json')) {
    // JSON response with video URL
    segmindResult = await segmindResponse.json();
    
    // Get the generated video URL from Segmind response
    let videoUrl = null;
    if (segmindResult && segmindResult.video_url) {
      videoUrl = segmindResult.video_url;
    } else if (segmindResult && segmindResult.output && segmindResult.output.video_url) {
      videoUrl = segmindResult.output.video_url;
    } else {
      throw new Error('No video URL found in Segmind response');
    }
    
    // Download the video from Segmind
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from Segmind: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    videoBuffer = Buffer.from(videoArrayBuffer);
  } else {
    // Direct binary video response
    const videoArrayBuffer = await segmindResponse.arrayBuffer();
    videoBuffer = Buffer.from(videoArrayBuffer);
  }

  // Upload video to Supabase storage
  const videoId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const filePath = `${userId}/videos/${videoId}.mp4`;
  
  const { data: uploadData, error } = await supabase.storage
    .from('board-videos')
    .upload(filePath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });
  
  if (error) {
    throw error;
  }
  
  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('board-videos')
    .getPublicUrl(filePath);

  // Clean up temporary image
  try {
    await supabase.storage
      .from('board-images')
      .remove([tempImagePath]);
  } catch (cleanupError) {
    console.warn('Failed to cleanup temporary image:', cleanupError);
  }

  // Return success response with video data
  return {
    success: true,
    video: {
      id: videoId,
      url: urlData.publicUrl,
      size: videoBuffer.length
    },
    segmindResponse: segmindResult
  };
}
