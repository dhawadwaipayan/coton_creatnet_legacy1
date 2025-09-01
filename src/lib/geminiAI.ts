// Gemini AI Integration
// Updated to use AI Proxy for network security

import { callGeminiAI } from './aiProxyService';

interface GeminiImageGenerationParams {
  base64Sketch: string;
  base64Material?: string;
  promptText: string;
}

interface GeminiResponse {
  output: Array<{
    type: string;
    result?: string;
  }>;
}

export const callGeminiImageGeneration = async ({
  base64Sketch,
  base64Material,
  promptText
}: GeminiImageGenerationParams): Promise<GeminiResponse> => {
  try {
    console.log('[Gemini AI] Making API call via AI Proxy:', {
      hasSketch: !!base64Sketch,
      hasMaterial: !!base64Material,
      hasPrompt: !!promptText
    });

    // Call Gemini AI through the proxy
    const proxyResponse = await callGeminiAI(base64Sketch, promptText, false);
    const result = proxyResponse.result;
    
    // Transform Gemini response to match OpenAI format
    const transformedResponse = {
      output: [
        {
          type: "image_generation_call",
          result: result.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data || null
        }
      ]
    };

    console.log('[Gemini AI] Response received via AI Proxy:', {
      hasOutput: Array.isArray(transformedResponse.output),
      outputLength: transformedResponse.output?.length
    });

    return transformedResponse;
    
  } catch (error) {
    console.error('[Gemini AI] AI Proxy call failed:', error);
    throw error;
  }
}; 