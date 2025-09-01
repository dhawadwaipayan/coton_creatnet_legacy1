// Coton Engine - Unified service router for all external API calls
// This provides a centralized endpoint for service routing

import { createClient } from '@supabase/supabase-js';
import { handleRenderFastrack, handleRenderAccurate } from './handlers/renderHandler.js';
import { handleEditFastrack } from './handlers/editHandler.js';
import { handleColorwayColor, handleColorwayPrint } from './handlers/colorwayHandler.js';
import { handleVideoFastrack } from './handlers/videoHandler.js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    console.log(`[Coton Engine] Routing request: ${service}.${action}`, {
      timestamp,
      nonce: nonce ? nonce.substring(0, 8) + '...' : 'none',
      dataKeys: Object.keys(data)
    });

    // Route to appropriate AI service
    let result;
    switch (service) {
      // New simplified routing
      case 'render_fastrack':
        result = await handleRenderFastrack(action, data);
        break;
      case 'render_accurate':
        result = await handleRenderAccurate(action, data);
        break;
      case 'edit_fastrack':
        result = await handleEditFastrack(action, data);
        break;
      case 'colorway_color':
        result = await handleColorwayColor(action, data);
        break;
      case 'colorway_print':
        result = await handleColorwayPrint(action, data);
        break;
      case 'video_fastrack':
        result = await handleVideoFastrack(action, data);
        break;
      default:
        return res.status(400).json({ 
          error: `Unknown service: ${service}` 
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
    console.error(`[Coton Engine] Error:`, error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}
