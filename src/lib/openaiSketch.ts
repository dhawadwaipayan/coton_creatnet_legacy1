// OpenAI Sketch Image Generation Utility
// Updated to use AI Proxy for network security

import { callSketchAI, callRenderAI } from './aiProxyService';

export async function callOpenAIGptImage({
  base64Sketch,
  base64Material,
  promptText,
  endpoint = "/api/sketch-ai"
}: {
  base64Sketch: string,
  base64Material?: string,
  promptText: string,
  endpoint?: string
}) {
  console.log('[callOpenAIGptImage] Preparing to call via AI Proxy', {
    base64SketchDefined: typeof base64Sketch !== 'undefined',
    base64SketchLength: base64Sketch ? base64Sketch.length : 0,
    base64MaterialDefined: typeof base64Material !== 'undefined',
    base64MaterialLength: base64Material ? base64Material.length : 0,
    promptText,
    endpoint
  });
  
  if (!base64Sketch) {
    throw new Error('No bounding box image (base64Sketch) provided to OpenAI.');
  }

  try {
    let result;
    
    // Route through AI Proxy based on endpoint
    if (endpoint === '/api/sketch-ai') {
      // Sketch AI call
      const proxyResponse = await callSketchAI(base64Sketch, promptText);
      result = proxyResponse.result;
    } else {
      // Render AI call (with optional material)
      const proxyResponse = await callRenderAI(base64Sketch, promptText, base64Material);
      result = proxyResponse.result;
    }
    
    console.log('[callOpenAIGptImage] Success response via AI Proxy:', result);
    return result;
    
  } catch (error) {
    console.error('[callOpenAIGptImage] AI Proxy call failed:', error);
    throw new Error("OpenAI API error via proxy: " + (error instanceof Error ? error.message : String(error)));
  }
} 