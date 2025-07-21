import { uploadBoardImage } from '../src/lib/utils';

const FLUX_KONTEXT_PROMPT = `Generate a photorealistic render of the sketch with a all over white fabric material. The final output should have a flat black background. Ensure that all topstitches, buttons, and trims use the same color as the primary material. Preserve the proportions and silhouette of the original sketch while applying accurate fabric texture, shading, and natural lighting for realism.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { base64Sketch, userId } = req.body;
    if (!base64Sketch || !userId) {
      return res.status(400).json({ error: 'Missing base64Sketch or userId' });
    }
    // 1. Upload sketch to Supabase and get public URL
    const base64Data = base64Sketch.split(',')[1] || base64Sketch;
    const buffer = Buffer.from(base64Data, 'base64');
    const imageId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const boardId = 'together-fastmode';
    const imageUrl = await uploadBoardImage(userId, boardId, imageId, buffer);
    // 2. Call Together.ai with the public URL
    const response = await fetch('https://api.together.xyz/v1/images/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: FLUX_KONTEXT_PROMPT,
        model: 'black-forest-labs/FLUX.1-kontext-dev',
        width: 768,
        height: 768,
        steps: 40,
        image_url: imageUrl
      })
    });
    if (!response.ok) {
      throw new Error(`Together.ai API error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    console.error('Flux Kontext AI Error:', error);
    res.status(500).json({ error: error.message });
  }
} 