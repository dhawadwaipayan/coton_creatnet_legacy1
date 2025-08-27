// Types for Gemini Service - Following referenced GitHub repository structure

export interface GeminiRenderResponse {
  success: boolean;
  mode: string;
  model_used: string;
  enhanced_prompt: string;
  output: Array<{
    type: string;
    result: string;
    enhanced_description: string;
  }>;
  message: string;
  imageDimensions?: {
    width: number;
    height: number;
    aspectRatio: number;
  };
}

// Existing render interfaces for compatibility
export interface RenderParams {
  base64Sketch: string;
  promptText?: string;
  isFastMode?: boolean;
}

export interface RenderOutput {
  type: string;
  result?: string;
  enhanced_description?: string;
}

export interface StandardRenderResponse {
  success: boolean;
  mode?: string;
  model_used?: string;
  enhanced_prompt?: string;
  output: RenderOutput[];
  message: string;
  error?: string;
}
