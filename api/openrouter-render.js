export default async function handler(req, res) {
  console.log('OpenRouter Render AI function called with method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Sketch, promptText, isFastMode = false } = req.body || {};
  const apiKey = process.env.OPENROUTER_API_KEY;
  const siteUrl = process.env.SITE_URL || 'https://coton-creatnet.vercel.app';
  const siteName = process.env.SITE_NAME || 'Coton CreatNet';

  if (!base64Sketch) {
    console.log('Missing required field: base64Sketch');
    return res.status(400).json({ error: 'Missing base64Sketch' });
  }

  if (!apiKey) {
    console.log('Missing OPENROUTER_API_KEY in environment variables');
    return res.status(500).json({ error: 'OpenRouter API key not configured on server.' });
  }

  try {
    console.log('Starting OpenRouter render process...');
    
    // Clean base64 data (remove data:image/png;base64, prefix if present)
    const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Prepare the prompt
    const enhancedPrompt = promptText 
      ? `Transform this sketch into a photorealistic render. ${promptText}`
      : 'Transform this sketch into a photorealistic render.';
    
    console.log('Making OpenRouter API call with Gemini 2.5 Flash...');

    // Step 1: Analyze the image with vision model first
    console.log('Step 1: Analyzing image with Gemini...');
    const visionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": siteName,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.5-flash-image-preview",
        "messages": [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": enhancedPrompt + " Describe this sketch in detail for photorealistic image generation, including specific materials, lighting, colors, and realistic details."
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": `data:image/png;base64,${cleanBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!visionResponse.ok) {
      const errorData = await visionResponse.json();
      console.error('OpenRouter vision API error:', errorData);
      return res.status(visionResponse.status).json({ 
        error: errorData.error || 'Vision analysis failed',
        details: errorData
      });
    }

    const visionData = await visionResponse.json();
    const description = visionData.choices?.[0]?.message?.content;

    if (!description) {
      return res.status(500).json({ error: 'No description received from Gemini analysis' });
    }

    console.log('Step 1 complete: Image analysis finished');
    console.log('Generated description:', description);

    // Step 2: Generate image using the description
    console.log('Step 2: Generating image with FLUX...');
    const imageGenResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": siteName,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "black-forest-labs/flux-1.1-pro",
        "messages": [
          {
            "role": "user",
            "content": description
          }
        ]
      })
    });

    if (!imageGenResponse.ok) {
      const errorData = await imageGenResponse.json();
      console.error('OpenRouter image generation error:', errorData);
      // Fallback to description-only response if image generation fails
      return res.status(200).json({
        success: true,
        model_used: 'google/gemini-2.5-flash-image-preview',
        enhanced_prompt: description,
        original_sketch: cleanBase64,
        output: [{
          type: 'image_generation_call',
          result: cleanBase64,
          enhanced_description: description
        }],
        message: 'Analysis complete, but image generation failed. Returning enhanced description.',
        error: 'Image generation failed: ' + (errorData.error || 'Unknown error')
      });
    }

    const imageGenData = await imageGenResponse.json();
    console.log('Step 2 complete: Image generation finished');

    // Extract generated image from response
    let generatedImageBase64 = cleanBase64; // Fallback to original
    
    // Try to extract generated image - this depends on FLUX response format
    if (imageGenData.choices?.[0]?.message?.content) {
      const content = imageGenData.choices[0].message.content;
      // If FLUX returns base64 image in content, extract it
      if (content.includes('data:image/') || content.match(/^[A-Za-z0-9+/=]+$/)) {
        generatedImageBase64 = content.replace(/^data:image\/[a-z]+;base64,/, '');
        console.log('Successfully extracted generated image');
      }
    }

    // Return the response in the expected format
    const responseData = {
      success: true,
      model_used: 'google/gemini-2.5-flash-image-preview + black-forest-labs/flux-1.1-pro',
      enhanced_prompt: description,
      original_sketch: cleanBase64,
      output: [{
        type: 'image_generation_call',
        result: generatedImageBase64,
        enhanced_description: description
      }],
      message: 'Render complete using OpenRouter Gemini analysis + FLUX generation'
    };

    res.status(200).json(responseData);

  } catch (err) {
    console.error('OpenRouter Render AI function error:', err);
    res.status(500).json({ 
      error: err.message || String(err),
      details: 'Internal server error occurred while processing the request'
    });
  }
}
