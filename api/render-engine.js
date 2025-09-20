// Render Engine - Handles render operations
// Routes sub-modes to appropriate handlers

import { createClient } from '@supabase/supabase-js';
import { handleRenderPipeline1 } from './handlers/renderPipeline1Handler.js';
import { handleRenderPipeline3 } from './handlers/renderPipeline3Handler.js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://coton-ai.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service, action, data, timestamp, nonce } = req.body;

    // Validate request structure
    if (!service || !action || !data) {
      return res.status(400).json({ 
        error: 'Missing required fields: service, action, data' 
      });
    }

    // Add request logging for debugging
    console.log(`[Render Engine] Routing request: ${service}.${action}`, {
      timestamp,
      nonce: nonce ? nonce.substring(0, 8) + '...' : 'none',
      dataKeys: Object.keys(data)
    });

    // Route to appropriate handler based on sub-mode
    let result;
    switch (service) {
      case 'render_fastrack':
        // render_fastrack is now render_model (Gemini)
        result = await handleRenderPipeline1(action, data, 'render_model');
        break;
      case 'render_model':
      case 'render_colorway_color':
      case 'render_colorway_print':
        // Route to renderPipeline1 for Gemini-based modes
        result = await handleRenderPipeline1(action, data, service);
        break;
      case 'render_pro':
      case 'render_flat':
      case 'render_extract':
        // Route to renderPipeline3 for Segmind-based modes
        result = await handleRenderPipeline3(action, data, service);
        break;
      default:
        return res.status(400).json({ 
          error: `Unknown render service: ${service}` 
        });
    }

    // Return successful response
    return res.status(200).json({
      success: true,
      service,
      action,
      result,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error(`[Render Proxy] Error:`, error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}
