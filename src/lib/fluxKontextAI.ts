// This file is now only for type definitions and client-safe helpers for Together.ai Fast Render

export interface FluxKontextAIRequest {
  base64Sketch: string;
  userId: string;
}

// No server-side logic or Buffer usage here. All Together.ai and Supabase upload logic is in the API route. 