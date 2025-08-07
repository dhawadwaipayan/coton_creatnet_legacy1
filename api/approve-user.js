import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { approvalId, adminUserId } = req.body;

    if (!approvalId || !adminUserId) {
      return res.status(400).json({ error: 'Missing approvalId or adminUserId' });
    }

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
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: approval.email,
      password: atob(approval.password_hash), // Decode the password
      email_confirm: true,
      user_metadata: { name: approval.name }
    });

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