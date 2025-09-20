// Render Engine - Handles render operations
// Routes sub-modes to appropriate handlers

import { createClient } from '@supabase/supabase-js';
import { handleRenderPipeline1 } from './handlers/renderPipeline1Handler.js';

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
        // render_fastrack is now render_model
        result = await handleRenderPipeline1(action, data, 'render_model');
        break;
      case 'render_model':
      case 'render_flat':
      case 'render_extract':
      case 'render_colorway_color':
      case 'render_colorway_print':
        // Route to renderPipeline1 for all render sub-modes
        result = await handleRenderPipeline1(action, data, service);
        break;
      case 'render_pro':
        // Route to renderpipeline for Segmind integration (keep existing for now)
        const renderPipelineResponse = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/renderpipeline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service: 'render_pro',
            action,
            data,
            timestamp: Date.now(),
            nonce: Math.random().toString(36).substring(2, 15)
          })
        });

        if (!renderPipelineResponse.ok) {
          const errorData = await renderPipelineResponse.json();
          throw new Error(errorData.error || 'Render pipeline error');
        }

        const pipelineResult = await renderPipelineResponse.json();
        result = pipelineResult.result;
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
