export default async function handler(req, res) {
  console.log('Render AI function called with method:', req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Sketch, base64Material, promptText } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (!base64Sketch || !promptText) {
    console.log('Missing required fields:', { base64Sketch: !!base64Sketch, promptText: !!promptText });
    return res.status(400).json({ error: 'Missing base64Sketch or promptText' });
  }
  if (!apiKey) {
    console.log('Missing OPENAI_API_KEY in environment variables');
    return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
  }

  try {
    console.log('Making OpenAI API request...');
    // Build input array: always include sketch, optionally material
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
        input: [
          {
            role: 'user',
            content: inputArr
          }
        ],
        text: { format: { type: 'text' } },
        reasoning: {},
        tools: [
          {
            type: 'image_generation',
            size: '1024x1536',
            quality: 'high',
            output_format: 'png',
            background: 'opaque',
            moderation: 'low'
          }
        ],
        temperature: 1,
        max_output_tokens: 2048,
        top_p: 1,
        store: true
      })
    });
    console.log('OpenAI response status:', openaiRes.status, openaiRes.statusText);
    const data = await openaiRes.json();
    console.log('OpenAI response data:', data);
    if (!openaiRes.ok) {
      console.error('OpenAI API error:', data);
      return res.status(openaiRes.status).json({ error: data });
    }
    console.log('Sending successful response to client');
    res.status(openaiRes.status).json(data);
  } catch (err) {
    console.error('Render AI function error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
} 