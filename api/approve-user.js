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

  try {
    // Basic rate limit: 10 approvals/minute per IP
    const { createRateLimiter } = require('./_rateLimit');
    const rateLimit = createRateLimiter({ windowMs: 60_000, max: 10 });
    if (!rateLimit(req, res)) return;
    const { approvalId } = req.body || {};
    // Backward compatibility: accept adminUserId but do not trust it
    const { adminUserId: _legacyAdminUserId } = req.body || {};

    if (!approvalId) {
      return res.status(400).json({ error: 'Missing approvalId' });
    }

    // SECURITY: Verify the caller via Authorization bearer token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    }

    // Get the user from the provided JWT
    const { data: userFromToken, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !userFromToken?.user) {
      console.error('Authentication failed from token:', tokenError);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    const adminUserId = userFromToken.user.id;

    // SECURITY: Verify that the user is actually an admin
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      console.error('Unauthorized access attempt:', { adminUserId, error: adminError });
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // SECURITY: Log admin action for audit trail
    console.log('Admin action:', {
      action: 'approve_user',
      adminUserId,
      adminEmail: adminData.email,
      approvalId,
      timestamp: new Date().toISOString()
    });

    // First, get the approval request
    const { data: approval, error: approvalError } = await supabase
      .from('user_approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (approvalError) {
      console.error('Error getting approval request:', approvalError);
      return res.status(500).json({ error: 'Error getting approval request' });
    }

    // Create the actual user account in Supabase Auth
    // Backward compatibility: if a reversible password_hash exists (legacy), use createUser
    // Safer path: if no password stored, prefer invite flow
    let authData = null;
    let authError = null;
    if (approval.password_hash) {
      const result = await supabase.auth.admin.createUser({
        email: approval.email,
        password: atob(approval.password_hash),
        email_confirm: true,
        user_metadata: { name: approval.name }
      });
      authData = result.data;
      authError = result.error;
    } else {
      const result = await supabase.auth.admin.inviteUserByEmail(approval.email, {
        data: { name: approval.name }
      });
      authData = result.data;
      authError = result.error;
    }

    if (authError) {
      console.error('Error creating user account:', authError);
      return res.status(500).json({ error: 'Error creating user account' });
    }

    // Add user to approved_users table
    const { data: approvedUser, error: approvedError } = await supabase
      .from('approved_users')
      .insert([{
        user_id: authData.user.id,
        email: approval.email,
        name: approval.name,
        approved_by: adminUserId
      }])
      .select()
      .single();

    if (approvedError) {
      console.error('Error adding user to approved_users:', approvedError);
      return res.status(500).json({ error: 'Error adding user to approved users' });
    }

    // Update the approval request status
    const { error: updateError } = await supabase
      .from('user_approvals')
      .update({
        status: 'approved',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', approvalId);

    if (updateError) {
      console.error('Error updating approval status:', updateError);
      return res.status(500).json({ error: 'Error updating approval status' });
    }

    return res.status(200).json({ 
      success: true, 
      data: approvedUser,
      message: 'User approved successfully' 
    });

  } catch (error) {
    console.error('Error in approve-user API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 