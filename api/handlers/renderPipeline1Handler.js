// Render Pipeline 1 Handler - Consolidated render operations with dynamic prompts
// Handles model, colorway_color, colorway_print, flat, extract modes

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Dynamic prompt selection based on sub-mode
const getBasePrompt = (service) => {
  const prompts = {
    'render_model': process.env.RENDER_FASTRACK_KEY,
    'render_flat': process.env.RENDER_FLAT_BASE_PROMPT || process.env.RENDER_FASTRACK_KEY,
    'render_extract': process.env.RENDER_EXTRACT_BASE_PROMPT || process.env.RENDER_FASTRACK_KEY,
    'render_colorway_color': process.env.COLORWAY_COLOR_KEY,
    'render_colorway_print': process.env.COLORWAY_PRINT_KEY,
    'edit_fastrack': process.env.EDIT_FASTRACK_KEY
  };
  return prompts[service] || process.env.RENDER_FASTRACK_KEY;
};

// Get mode-specific configuration
const getModeConfig = (service) => {
  const configs = {
    'render_model': {
      mode: "Render Model",
      model_used: "RENDER_FASTRACK_KEY",
      message: "Fashion render complete"
    },
    'render_flat': {
      mode: "Render Flat",
      model_used: "RENDER_FLAT_BASE_PROMPT",
      message: "Fashion render complete (Flat mode)"
    },
    'render_extract': {
      mode: "Render Extract",
      model_used: "RENDER_EXTRACT_BASE_PROMPT",
      message: "Fashion render complete (Extract mode)"
    },
    'render_colorway_color': {
      mode: "Colorway Color",
      model_used: "COLORWAY_COLOR_KEY",
      message: "Colorway Color generation complete"
    },
    'render_colorway_print': {
      mode: "Colorway Print",
      model_used: "COLORWAY_PRINT_KEY",
      message: "Colorway Print generation complete"
    },
    'edit_fastrack': {
      mode: "Edit",
      model_used: "EDIT_FASTRACK_KEY",
      message: "Edit complete"
    }
  };
  return configs[service] || configs['render_model'];
};

export async function handleRenderPipeline1(action, data, service) {
  console.log('[Render Pipeline 1 Handler] handleRenderPipeline1 called with:', { action, service, dataKeys: Object.keys(data) });
  
  const { base64Sketch, base64Material, additionalDetails, selectedColor, referenceImage } = data;
  
  if (!base64Sketch) {
    throw new Error(`Missing base64Sketch for ${service}`);
  }

  // Get base prompt dynamically based on service
  const basePrompt = getBasePrompt(service);
  
  if (!basePrompt) {
    throw new Error(`${service} base prompt environment variable is not configured`);
  }

  // Get mode configuration
  const modeConfig = getModeConfig(service);

  // Build final prompt based on service type
  let finalPromptText = basePrompt;
  
  if (service === 'render_colorway_color' && selectedColor) {
    finalPromptText = `${basePrompt} ${selectedColor}`;
    console.log('[Render Pipeline 1 Handler] Using colorway color prompt with selected color:', selectedColor);
  } else if (service === 'render_colorway_print') {
    // Colorway print uses base prompt as-is
    console.log('[Render Pipeline 1 Handler] Using colorway print prompt');
  } else if (additionalDetails && additionalDetails.trim()) {
    finalPromptText += ` ${additionalDetails.trim()}`;
    console.log('[Render Pipeline 1 Handler] Using base prompt + additional details, total length:', finalPromptText.length);
  } else {
    console.log('[Render Pipeline 1 Handler] Using base prompt only, length:', finalPromptText.length);
  }

  // Clean base64 data
  const cleanBase64 = base64Sketch.replace(/^data:image\/[a-z]+;base64,/, '');
  const cleanMaterialBase64 = base64Material ? base64Material.replace(/^data:image\/[a-z]+;base64,/, '') : null;
  const cleanReferenceBase64 = referenceImage ? referenceImage.replace(/^data:image\/[a-z]+;base64,/, '') : null;

  // Return base64 data for direct download (no Supabase needed)
  const downloadData = `data:image/png;base64,${cleanBase64}`;

  // Get the model
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-image-preview" 
  });

  // Build content array based on service type
  const contentArray = [finalPromptText, {
    inlineData: {
      mimeType: "image/png",
      data: cleanBase64
    }
  }];

  // Add material image if provided (for render modes)
  if (cleanMaterialBase64 && (service.startsWith('render_model') || service.startsWith('render_flat') || service.startsWith('render_extract'))) {
    contentArray.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanMaterialBase64
      }
    });
  }

  // Add reference image if provided (for colorway print)
  if (cleanReferenceBase64 && service === 'render_colorway_print') {
    contentArray.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanReferenceBase64
      }
    });
  }

  // Generate content
  const result = await model.generateContent(contentArray);
  const response = await result.response;
  
  // Extract the generated image data
  const generatedImage = response.candidates?.[0]?.content?.parts?.find(
    part => part.inlineData && part.inlineData.mimeType?.startsWith('image/')
  );

  if (!generatedImage?.inlineData?.data) {
    throw new Error('No image generated by Gemini API');
  }

  const imageData = generatedImage.inlineData.data;

  // Let AI determine the aspect ratio - don't force any specific dimensions
  console.log('[Render Pipeline 1 Handler] Using AI-determined aspect ratio');

  // Build response based on service type
  const baseResponse = {
    success: true,
    mode: modeConfig.mode,
    model_used: modeConfig.model_used,
    output: [{
      type: "image_generation_call",
      result: imageData
    }],
    message: modeConfig.message,
    imageDimensions: {
      width: 1024,
      height: 1536,
      aspectRatio: 1024 / 1536
    }
  };

  // Add service-specific fields
  if (service === 'render_colorway_color') {
    baseResponse.enhanced_prompt = `Colorway Color generation with color ${selectedColor}`;
    baseResponse.output[0].enhanced_description = `Professional Colorway Color render generated with color ${selectedColor}`;
  } else if (service === 'render_colorway_print') {
    baseResponse.enhanced_prompt = "Colorway Print generation";
    baseResponse.output[0].enhanced_description = "Professional Colorway Print render generated";
  } else {
    // For render modes, add download data
    baseResponse.downloadData = downloadData;
  }

  return baseResponse;
}
