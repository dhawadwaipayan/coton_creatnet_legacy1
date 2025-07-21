import { callFluxKontextAI } from '../src/lib/fluxKontextAI';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { base64Sketch, userId } = req.body;
    if (!base64Sketch || !userId) {
      return res.status(400).json({ error: 'Missing base64Sketch or userId' });
    }
    const result = await callFluxKontextAI({ base64Sketch, userId });
    res.status(200).json(result);
  } catch (error) {
    console.error('Flux Kontext AI Error:', error);
    res.status(500).json({ error: error.message });
  }
} 