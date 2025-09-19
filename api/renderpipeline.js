// Render Pipeline - Handles Segmind API calls for pro mode
// Dedicated proxy for Segmind render operations

import { createClient } from '@supabase/supabase-js';
import { handleSegmindRender } from './handlers/segmindHandler.js';

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
    console.log(`[Render Pipeline] Routing request: ${service}.${action}`, {
      timestamp,
      nonce: nonce ? nonce.substring(0, 8) + '...' : 'none',
      dataKeys: Object.keys(data)
    });

    // Route to appropriate Segmind handler
    let result;
    switch (service) {
      case 'render_pro':
        result = await handleSegmindRender(action, data, 'pro');
        break;
      default:
        return res.status(400).json({ 
          error: `Unknown render pipeline service: ${service}` 
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
    console.error(`[Render Pipeline] Error:`, error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}
