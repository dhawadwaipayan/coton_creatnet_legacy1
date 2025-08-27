# OpenRouter API Setup

This document explains how to set up OpenRouter API integration for the render fastrack mode.

## Prerequisites

1. Create an account at [OpenRouter.ai](https://openrouter.ai/)
2. Generate an API key from your OpenRouter dashboard
3. Add credits to your OpenRouter account

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# OpenRouter API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Site information for OpenRouter rankings
SITE_URL=https://coton-creatnet.vercel.app
SITE_NAME=Coton CreatNet
```

## Supported Models

The integration uses different models based on the mode:

### Fastrack Mode
- **Model**: `anthropic/claude-3.5-sonnet`
- **Purpose**: Fast image analysis and description generation
- **Cost**: Lower cost, faster response

### Accurate Mode
- **Model**: `openai/gpt-4o`
- **Purpose**: Detailed image analysis for high-quality rendering
- **Cost**: Higher cost, more detailed analysis

## API Endpoint

The new OpenRouter integration is available at:
- **Endpoint**: `/api/openrouter-render`
- **Method**: POST
- **Content-Type**: application/json

### Request Body

```json
{
  "base64Sketch": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "promptText": "Make this sketch look realistic with leather materials",
  "isFastMode": true
}
```

### Response Structure

```json
{
  "success": true,
  "mode": "fastrack",
  "model_used": "anthropic/claude-3.5-sonnet",
  "enhanced_prompt": "Detailed description for realistic rendering...",
  "original_sketch": "base64_image_data",
  "output": [{
    "type": "image_generation_call",
    "result": "base64_image_data",
    "enhanced_description": "Detailed rendering description..."
  }],
  "message": "Fastrack render complete using OpenRouter analysis"
}
```

## Usage in Application

The render functionality is integrated into the existing workflow:

1. User creates a sketch on the canvas
2. User selects the Render mode and creates a bounding box
3. User clicks the fastrack toggle (⚡ icon) to enable OpenRouter mode
4. User clicks Generate to process the sketch
5. OpenRouter analyzes the sketch and provides enhanced descriptions
6. The result can be used for further image generation

## Integration Points

### Frontend Components
- `src/components/RenderSubBar.tsx` - UI controls
- `src/components/ModePanel.tsx` - Mode handling and API calls

### Backend API
- `api/openrouter-render.js` - OpenRouter API integration

### Library Functions
- `src/lib/openrouterRender.ts` - Type-safe API client

## Testing

To test the integration:

1. Set up the environment variables
2. Create a sketch on the canvas
3. Select Render mode
4. Enable fastrack mode (⚡ icon should show "Fastrack")
5. Click Generate
6. Check browser console for API logs
7. Verify the enhanced description is generated

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure `OPENROUTER_API_KEY` is set in `.env.local`
2. **CORS Issues**: OpenRouter API should work from server-side only
3. **Rate Limits**: Check OpenRouter dashboard for usage limits
4. **Model Availability**: Ensure the selected models are available in your region

### Debug Logs

The integration includes comprehensive logging:
- `[OpenRouter Render]` prefix for client-side logs
- API response structure logging
- Enhanced prompt generation details

### Error Messages

Common error messages and solutions:
- `OpenRouter API key not configured`: Add API key to environment
- `Missing base64Sketch`: Ensure a sketch is created and bounding box is selected
- `Vision analysis failed`: Check API key and model availability

## Next Steps

For full image generation capability, consider integrating with:
- DALL-E 3 for high-quality image generation
- Midjourney API for artistic rendering
- Stable Diffusion for cost-effective generation

The current implementation provides enhanced descriptions that can be used with any image generation service.
