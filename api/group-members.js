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
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'GET') {
    const { createRateLimiter } = require('./_rateLimit');
    const rateLimit = createRateLimiter({ windowMs: 60_000, max: 60 });
    if (!rateLimit(req, res)) return;
    return handleGetMembers(req, res);
  } else if (req.method === 'POST') {
    const { createRateLimiter } = require('./_rateLimit');
    const rateLimit = createRateLimiter({ windowMs: 60_000, max: 20 });
    if (!rateLimit(req, res)) return;
    return handleAddMember(req, res);
  } else if (req.method === 'DELETE') {
    const { createRateLimiter } = require('./_rateLimit');
    const rateLimit = createRateLimiter({ windowMs: 60_000, max: 20 });
    if (!rateLimit(req, res)) return;
    return handleRemoveMember(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetMembers(req, res) {
  try {
    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({ error: 'Missing groupId' });
    }

    // Derive admin from Authorization bearer token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    const { data: userFromToken, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !userFromToken?.user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    const adminUserId = userFromToken.user.id;

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Get group members with user details
    const { data: members, error: membersError } = await supabase
      .from('group_memberships')
      .select(`
        *,
        approved_users!inner(
          id,
          user_id,
          email,
          name,
          is_active
        )
      `)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false });

    if (membersError) {
      console.error('Error getting group members:', membersError);
      return res.status(500).json({ error: 'Error getting group members' });
    }

    return res.status(200).json({ 
      success: true, 
      data: members 
    });

  } catch (error) {
    console.error('Error in handleGetMembers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleAddMember(req, res) {
  try {
    const { groupId, userId } = req.body;

    if (!groupId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    const { data: userFromToken, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !userFromToken?.user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    const adminUserId = userFromToken.user.id;

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Check if user is already a member
    const { data: existingMember, error: checkError } = await supabase
      .from('group_memberships')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing membership:', checkError);
      return res.status(500).json({ error: 'Error checking existing membership' });
    }

    if (existingMember) {
      if (existingMember.is_active) {
        return res.status(400).json({ error: 'User is already a member of this group' });
      } else {
        // Reactivate existing membership
        const { data: reactivatedMember, error: reactivateError } = await supabase
          .from('group_memberships')
          .update({ is_active: true, joined_at: new Date().toISOString() })
          .eq('id', existingMember.id)
          .select()
          .single();

        if (reactivateError) {
          console.error('Error reactivating membership:', reactivateError);
          return res.status(500).json({ error: 'Error reactivating membership' });
        }

        return res.status(200).json({ 
          success: true, 
          data: reactivatedMember,
          message: 'User added to group successfully' 
        });
      }
    }

    // Add new membership
    const { data: membership, error: membershipError } = await supabase
      .from('group_memberships')
      .insert([{
        group_id: groupId,
        user_id: userId,
        is_active: true
      }])
      .select()
      .single();

    if (membershipError) {
      console.error('Error adding member:', membershipError);
      return res.status(500).json({ error: 'Error adding member to group' });
    }

    return res.status(200).json({ 
      success: true, 
      data: membership,
      message: 'User added to group successfully' 
    });

  } catch (error) {
    console.error('Error in handleAddMember:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRemoveMember(req, res) {
  try {
    const { groupId, userId } = req.query;

    if (!groupId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    const { data: userFromToken, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !userFromToken?.user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    const adminUserId = userFromToken.user.id;

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Deactivate membership instead of deleting
    const { error: removeError } = await supabase
      .from('group_memberships')
      .update({ is_active: false })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (removeError) {
      console.error('Error removing member:', removeError);
      return res.status(500).json({ error: 'Error removing member from group' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'User removed from group successfully' 
    });

  } catch (error) {
    console.error('Error in handleRemoveMember:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
