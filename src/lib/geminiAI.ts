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
    // Prepare the request payload for Gemini Flash 2.0
    const requestBody = {
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [
        {
          parts: [
            {
              text: promptText
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Sketch.split(',')[1] // Remove data:image/png;base64, prefix
              }
            }
          ]
        }
      ],
      generation_config: {
        temperature: 0.7,
        top_p: 0.95,
        top_k: 64,
        max_output_tokens: 8192
      }
    };

    // Add material image if provided
    if (base64Material) {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: "image/png",
          data: base64Material.split(',')[1] // Remove data:image/png;base64, prefix
        }
      });
    }

    const response = await fetch('/api/gemini-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Transform Gemini response to match OpenAI format
    return {
      output: [
        {
          type: "image_generation_call",
          result: result.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data || null
        }
      ]
    };
  } catch (error) {
    console.error('Gemini AI Error:', error);
    throw error;
  }
}; 