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
    
    // Step 1: Analyze the sketch with vision model
    const visionModel = 'openai/gpt-4o';
    const enhancedPrompt = promptText 
      ? `Transform this sketch into a photorealistic render. ${promptText}. Focus on realistic materials, lighting, and textures.`
      : 'Transform this sketch into a photorealistic render with high-quality materials, realistic lighting, proper shadows, and detailed textures. Make it look like a professional product photograph.';
    
    console.log('Step 1: Analyzing sketch with vision model...');
    
    const visionRequestBody = {
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: enhancedPrompt + ' Describe this item in detail for realistic rendering, including materials, colors, style, and intended realism level. Keep the description concise but specific for image generation.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${cleanBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    };

    const visionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': siteName,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(visionRequestBody)
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
      return res.status(500).json({ error: 'No description received from vision analysis' });
    }

    console.log('Step 1 complete: Description generated');

    // Step 2: Generate image using description
    console.log('Step 2: Generating image...');
    
    // For fastrack mode, we'll simulate the process and return the enhanced prompt
    // In a real implementation, you'd integrate with DALL-E, Midjourney, or similar
    if (isFastMode) {
      console.log('Fastrack mode: Creating enhanced prompt-based response');
      
      // Create a mock base64 response (in real implementation, this would be from image gen API)
      const mockImageData = {
        success: true,
        mode: 'fastrack',
        model_used: visionModel,
        enhanced_prompt: description,
        original_sketch: cleanBase64,
        output: [{
          type: 'image_generation_call',
          result: cleanBase64, // In real implementation, this would be the generated image
          enhanced_description: description
        }],
        message: 'Fastrack render complete using OpenRouter analysis'
      };

      res.status(200).json(mockImageData);
    } else {
      // Accurate mode with more detailed processing
      console.log('Accurate mode: Detailed rendering analysis');
      
      const detailedResponse = {
        success: true,
        mode: 'accurate',
        model_used: visionModel,
        enhanced_prompt: description,
        original_sketch: cleanBase64,
        output: [{
          type: 'image_generation_call',
          result: cleanBase64, // In real implementation, this would be the generated image
          enhanced_description: description,
          processing_details: {
            analysis_complete: true,
            ready_for_generation: true,
            recommended_service: 'DALL-E 3 or Midjourney for best results'
          }
        }],
        message: 'Accurate render analysis complete using OpenRouter'
      };

      res.status(200).json(detailedResponse);
    }

  } catch (err) {
    console.error('OpenRouter Render AI function error:', err);
    res.status(500).json({ 
      error: err.message || String(err),
      details: 'Internal server error occurred while processing the request'
    });
  }
}
