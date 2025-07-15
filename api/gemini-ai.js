import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, contents, generation_config } = req.body;

    // Validate required fields
    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the model
    const geminiModel = genAI.getGenerativeModel({ model });

    // Prepare the content parts
    const parts = contents[0].parts.map(part => {
      if (part.text) {
        return { text: part.text };
      } else if (part.inline_data) {
        return {
          inlineData: {
            mimeType: part.inline_data.mime_type,
            data: part.inline_data.data
          }
        };
      }
      return part;
    });

    // Generate content
    const result = await geminiModel.generateContent({
      contents: [{ parts }],
      generationConfig: generation_config
    });

    const response = await result.response;
    
    // Extract the generated image data
    const generatedImage = response.candidates[0].content.parts.find(
      part => part.inlineData && part.inlineData.mimeType.startsWith('image/')
    );

    if (!generatedImage) {
      return res.status(400).json({ error: 'No image generated' });
    }

    res.status(200).json({
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
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 