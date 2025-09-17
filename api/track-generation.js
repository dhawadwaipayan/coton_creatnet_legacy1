import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TEMP: Completely bypass tracking; always allow without auth/DB
  try {
    const { checkOnly } = req.body || {};
    return res.status(200).json({
      success: true,
      data: {
        allowed: true,
        bypassed: true,
        precheck: !!checkOnly
      }
    });
  } catch (e) {
    return res.status(200).json({ success: true, data: { allowed: true, bypassed: true } });
  }

  try {
    // Limit generation tracking to 60 req/min per IP
    const { createRateLimiter } = require('./_rateLimit');
    const rateLimit = createRateLimiter({ windowMs: 60_000, max: 60 });
    if (!rateLimit(req, res)) return;
    const { generationType, metadata, checkOnly } = req.body;

    if (!generationType) {
      return res.status(400).json({ error: 'Missing generationType' });
    }

    // Derive user from Authorization header
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    const { data: userFromToken, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !userFromToken?.user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    const userId = userFromToken.user.id;

    if (!['image', 'video'].includes(generationType)) {
      return res.status(400).json({ error: 'Invalid generationType. Must be "image" or "video"' });
    }

    // Get user's group membership
    const { data: membership, error: membershipError } = await supabase
      .from('group_memberships')
      .select(`
        *,
        user_groups!inner(
          id,
          name,
          image_limit,
          video_limit
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membershipError) {
      if (membershipError.code === 'PGRST116') {
        // User is not in any group, allow generation (no limits)
        return res.status(200).json({ 
          success: true, 
          data: { 
            allowed: true, 
            reason: 'User not in any group - no limits applied' 
          } 
        });
      }
      console.error('Error getting user membership:', membershipError);
      return res.status(500).json({ error: 'Error checking user membership' });
    }

    const group = membership.user_groups;
    const groupId = group.id;

    // Check current usage
    const { count: currentUsage } = await supabase
      .from('generation_usage')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('generation_type', generationType);

    const limit = generationType === 'image' ? group.image_limit : group.video_limit;
    const usage = currentUsage || 0;

    // Check if limit would be exceeded
    if (usage >= limit) {
      return res.status(429).json({ 
        success: false, 
        error: `${generationType} generation limit exceeded`,
        data: {
          allowed: false,
          limit,
          usage,
          remaining: 0
        }
      });
    }

    // If this is a precheck request, do not record usage
    if (checkOnly) {
      return res.status(200).json({ 
        success: true, 
        data: {
          allowed: true,
          limit,
          usage,
          remaining: limit - usage,
          precheck: true
        }
      });
    }

    // Record the generation usage
    const { data: usageRecord, error: usageError } = await supabase
      .from('generation_usage')
      .insert([{
        group_id: groupId,
        user_id: userId,
        generation_type: generationType,
        metadata: metadata || {}
      }])
      .select()
      .single();

    if (usageError) {
      console.error('Error recording generation usage:', usageError);
      return res.status(500).json({ error: 'Error recording generation usage' });
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        allowed: true,
        limit,
        usage: usage + 1,
        remaining: limit - (usage + 1),
        usageRecord
      }
    });

  } catch (error) {
    console.error('Error in track-generation API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
