# Gemini AI Integration Setup

## Overview
The render tab now supports two AI modes:
- **Accurate Mode**: Uses OpenAI (existing workflow)
- **Fastrack Mode**: Uses Google Gemini Flash 2.0 (new workflow)

## Setup Required

### 1. Environment Variables
Add these to your `.env` file:

```env
# OpenAI API Key (for Accurate mode)
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API Key (for Fastrack mode)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new project or select existing
3. Get your API key from the API section
4. Add it to your `.env` file

### 3. Install Dependencies
The Gemini SDK is already installed:
```bash
npm install @google/generative-ai
```

## How It Works

### Accurate Mode (OpenAI)
- Uses the existing OpenAI workflow
- Sends bounding box image + material image to OpenAI
- Returns generated image
- Higher quality, slower processing

### Fastrack Mode (Gemini Flash 2.0)
- Uses new Gemini Flash 2.0 workflow
- Sends bounding box image + material image to Gemini
- Returns generated image
- Faster processing, good quality

## API Endpoints
- `/api/render-ai` - OpenAI endpoint (existing)
- `/api/gemini-ai` - Gemini endpoint (new)

## Files Modified
- `src/components/RenderSubBar.tsx` - Added speed mode parameter
- `src/components/ModePanel.tsx` - Added Gemini workflow logic
- `src/lib/geminiAI.ts` - New Gemini service
- `api/gemini-ai.js` - New Gemini API endpoint

## Testing
1. Set up both API keys
2. Open render tab
3. Toggle between "Accurate" and "Fastrack"
4. Generate images to test both workflows 