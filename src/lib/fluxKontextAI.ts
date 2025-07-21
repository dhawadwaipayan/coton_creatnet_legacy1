import fetch from 'node-fetch';
import { supabase } from './utils';

const FLUX_KONTEXT_PROMPT = `Generate a photorealistic render of the sketch with a all over white fabric material. The final output should have a flat black background. Ensure that all topstitches, buttons, and trims use the same color as the primary material. Preserve the proportions and silhouette of the original sketch while applying accurate fabric texture, shading, and natural lighting for realism.`;

async function uploadSketchToSupabase(base64Sketch: string, userId: string) {
  // Remove data URL prefix if present
  const base64Data = base64Sketch.split(',')[1] || base64Sketch;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const imageId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  // Use a generic boardId for now, or pass as param if needed
  const boardId = 'together-fastmode';
  const url = await supabaseUploadHelper(userId, boardId, imageId, blob);
  return url;
}

async function supabaseUploadHelper(userId: string, boardId: string, imageId: string, blob: Blob) {
  // This uses the uploadBoardImage helper from utils.ts
  // You may want to add error handling here
  return await (await import('./utils')).uploadBoardImage(userId, boardId, imageId, blob);
}

export async function callFluxKontextAI({ base64Sketch, userId }: { base64Sketch: string, userId: string }) {
  // 1. Upload sketch to Supabase and get public URL
  const imageUrl = await uploadSketchToSupabase(base64Sketch, userId);
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
  // result.data[0].b64_json will contain the base64 image
  return result;
} 