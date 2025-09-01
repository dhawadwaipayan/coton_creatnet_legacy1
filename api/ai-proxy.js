// Unified AI Proxy - Routes all AI API calls through a single endpoint
// This hides individual AI service calls from the network tab

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
    console.log(`[AI Proxy] Routing request: ${service}.${action}`, {
      timestamp,
      nonce: nonce ? nonce.substring(0, 8) + '...' : 'none',
      dataKeys: Object.keys(data)
    });
    
    // Enhanced debugging for render fastrack mode
    if (service === 'gemini') {
      console.log('[AI Proxy] Gemini service called - render fastrack mode');
      console.log('[AI Proxy] Gemini API Key available:', !!process.env.GEMINI_API_KEY);
    } else if (service === 'flux') {
      console.log('[AI Proxy] Flux service called - should NOT be called for render fastrack');
      console.log('[AI Proxy] Together API Key available:', !!process.env.TOGETHER_API_KEY);
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
      case 'gemini':
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
    console.error('[AI Proxy] Error:', error);
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

  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) {
    throw new Error('Kling API key not configured');
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

// Gemini AI Handler
async function handleGeminiAI(action, data) {
  const { base64Sketch, promptText, isFastMode = false } = data;
  
  if (!base64Sketch || !promptText) {
    throw new Error('Missing base64Sketch or promptText for Gemini AI');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[AI Proxy] GEMINI_API_KEY environment variable is missing');
    throw new Error('Gemini API key not configured - check GEMINI_API_KEY environment variable');
  }
  console.log('[AI Proxy] Gemini API key found, proceeding with API call');

  // Use the Google Generative AI SDK approach for proper image generation
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use the correct model for image generation
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp' 
  });

  // Prepare the content parts
  const parts = [
    { text: promptText },
    {
      inlineData: {
        mimeType: "image/png",
        data: base64Sketch.split(',')[1] || base64Sketch
      }
    }
  ];

  // Generate content with image generation capabilities
  const result = await model.generateContent(
    {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      }
    },
    undefined, // No safety settings
    {
      response_mime_type: "image/png",
      response_modalities: ["IMAGE", "TEXT"]
    }
  );

  const response = await result.response;
  
  // Extract the generated image data
  const generatedImage = response.candidates[0].content.parts.find(
    part => part.inlineData && part.inlineData.mimeType.startsWith('image/')
  );

  if (!generatedImage) {
    throw new Error('No image generated by Gemini API');
  }

  return {
    candidates: [{
      content: {
        parts: [{
          inline_data: {
            mime_type: generatedImage.inlineData.mimeType,
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

// Kling AI Handler
async function handleKlingAI(action, data) {
  const { base64Sketch, promptText, userId } = data;
  
  if (!base64Sketch || !promptText || !userId) {
    throw new Error('Missing required fields for Kling AI');
  }

  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) {
    throw new Error('Kling API key not configured');
  }

  const response = await fetch('https://api.kling.ai/v1/videos/generations', {
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
      duration: 5,
      image_url: base64Sketch
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kling API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}
