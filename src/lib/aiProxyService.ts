// Coton Engine Service - Client-side service for making API calls through the unified engine
// This provides centralized routing for all external service calls

interface AIProxyRequest {
  service: string;
  action: string;
  data: any;
  timestamp?: number;
  nonce?: string;
}

interface AIProxyResponse {
  success: boolean;
  service: string;
  action: string;
  result?: any;
  error?: string;
  timestamp: number;
}

// Generate a random nonce for request identification
function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Make a request to the AI proxy
async function makeAIProxyRequest(request: AIProxyRequest): Promise<AIProxyResponse> {
  const { service, action, data } = request;
  
  const proxyRequest: AIProxyRequest = {
    service,
    action,
    data,
    timestamp: Date.now(),
    nonce: generateNonce()
  };

  console.log(`[Coton Engine Service] Making request: ${service}.${action}`, {
    nonce: proxyRequest.nonce?.substring(0, 8) + '...',
    dataKeys: Object.keys(data)
  });

  try {
    const response = await fetch('/api/coton-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyRequest)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: AIProxyResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Coton engine request failed');
    }

    console.log(`[Coton Engine Service] Request successful: ${service}.${action}`, {
      nonce: proxyRequest.nonce?.substring(0, 8) + '...',
      resultKeys: result.result ? Object.keys(result.result) : 'no result'
    });

    return result;

  } catch (error) {
    console.error(`[Coton Engine Service] Request failed: ${service}.${action}`, error);
    throw error;
  }
}

// Sketch AI Service
export async function callSketchAI(base64Image: string, promptText: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'sketch',
    action: 'generate',
    data: { base64Image, promptText }
  });
}

// Render AI Service
export async function callRenderAI(base64Sketch: string, promptText: string, base64Material?: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'render',
    action: 'generate',
    data: { base64Sketch, promptText, base64Material }
  });
}

// Video AI Service (Kling)
export async function callVideoAI(base64Sketch: string, promptText: string, userId: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'video',
    action: 'generate',
    data: { base64Sketch, promptText, userId }
  });
}

// Gemini AI Service (obfuscated as render_fastrack)
export async function callGeminiAI(base64Sketch: string, promptText: string, isFastMode: boolean = false, base64Material?: string, additionalDetails?: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'render_fastrack',
    action: 'generate',
    data: { base64Sketch, promptText, isFastMode, base64Material, additionalDetails }
  });
}

// OpenRouter AI Service
export async function callOpenRouterAI(base64Sketch: string, promptText: string, isFastMode: boolean = false): Promise<any> {
  return makeAIProxyRequest({
    service: 'openrouter',
    action: 'generate',
    data: { base64Sketch, promptText, isFastMode }
  });
}

// Flux AI Service
export async function callFluxAI(base64Sketch: string, userId: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'flux',
    action: 'generate',
    data: { base64Sketch, userId }
  });
}

// Kling AI Service
export async function callKlingAI(base64Sketch: string, promptText: string, userId: string): Promise<any> {
  return makeAIProxyRequest({
    service: 'kling',
    action: 'generate',
    data: { base64Sketch, promptText, userId }
  });
}

// Generic AI Service Call (for custom services)
export async function callAIService(service: string, action: string, data: any): Promise<any> {
  return makeAIProxyRequest({
    service,
    action,
    data
  });
}

// Export the main engine request function for advanced usage
export { makeAIProxyRequest };
export type { AIProxyRequest, AIProxyResponse };
