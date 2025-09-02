import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'GET') {
    return handleGetGroups(req, res);
  } else if (req.method === 'POST') {
    return handleCreateGroup(req, res);
  } else if (req.method === 'PUT') {
    return handleUpdateGroup(req, res);
  } else if (req.method === 'DELETE') {
    return handleDeleteGroup(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetGroups(req, res) {
  try {
    const { adminUserId } = req.query;

    if (!adminUserId) {
      return res.status(400).json({ error: 'Missing adminUserId' });
    }

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Get all groups with member counts and usage
    const { data: groups, error: groupsError } = await supabase
      .from('user_groups')
      .select(`
        *,
        group_memberships!inner(count),
        generation_usage(count)
      `)
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Error getting groups:', groupsError);
      return res.status(500).json({ error: 'Error getting groups' });
    }

    // Calculate usage for each group
    const groupsWithUsage = await Promise.all(
      groups.map(async (group) => {
        // Get member count
        const { count: memberCount } = await supabase
          .from('group_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('is_active', true);

        // Get image usage count
        const { count: imageUsage } = await supabase
          .from('generation_usage')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('generation_type', 'image');

        // Get video usage count
        const { count: videoUsage } = await supabase
          .from('generation_usage')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('generation_type', 'video');

        return {
          ...group,
          member_count: memberCount || 0,
          image_usage: imageUsage || 0,
          video_usage: videoUsage || 0,
          image_remaining: Math.max(0, group.image_limit - (imageUsage || 0)),
          video_remaining: Math.max(0, group.video_limit - (videoUsage || 0))
        };
      })
    );

    return res.status(200).json({ 
      success: true, 
      data: groupsWithUsage 
    });

  } catch (error) {
    console.error('Error in handleGetGroups:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateGroup(req, res) {
  try {
    const { adminUserId, name, description, imageLimit, videoLimit } = req.body;

    if (!adminUserId || !name || imageLimit === undefined || videoLimit === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .insert([{
        name,
        description: description || '',
        image_limit: parseInt(imageLimit),
        video_limit: parseInt(videoLimit),
        created_by: adminUserId
      }])
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return res.status(500).json({ error: 'Error creating group' });
    }

    return res.status(200).json({ 
      success: true, 
      data: group,
      message: 'Group created successfully' 
    });

  } catch (error) {
    console.error('Error in handleCreateGroup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUpdateGroup(req, res) {
  try {
    const { groupId } = req.query;
    const { adminUserId, name, description, imageLimit, videoLimit } = req.body;

    if (!groupId || !adminUserId) {
      return res.status(400).json({ error: 'Missing groupId or adminUserId' });
    }

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Update the group
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (imageLimit !== undefined) updateData.image_limit = parseInt(imageLimit);
    if (videoLimit !== undefined) updateData.video_limit = parseInt(videoLimit);

    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (groupError) {
      console.error('Error updating group:', groupError);
      return res.status(500).json({ error: 'Error updating group' });
    }

    return res.status(200).json({ 
      success: true, 
      data: group,
      message: 'Group updated successfully' 
    });

  } catch (error) {
    console.error('Error in handleUpdateGroup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDeleteGroup(req, res) {
  try {
    const { groupId } = req.query;
    const { adminUserId } = req.body;

    if (!groupId || !adminUserId) {
      return res.status(400).json({ error: 'Missing groupId or adminUserId' });
    }

    // Verify admin access
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Unauthorized: User is not an admin' });
    }

    // Delete group memberships first
    const { error: membershipsError } = await supabase
      .from('group_memberships')
      .delete()
      .eq('group_id', groupId);

    if (membershipsError) {
      console.error('Error deleting group memberships:', membershipsError);
      return res.status(500).json({ error: 'Error deleting group memberships' });
    }

    // Delete generation usage records
    const { error: usageError } = await supabase
      .from('generation_usage')
      .delete()
      .eq('group_id', groupId);

    if (usageError) {
      console.error('Error deleting generation usage:', usageError);
      return res.status(500).json({ error: 'Error deleting generation usage' });
    }

    // Delete the group
    const { error: groupError } = await supabase
      .from('user_groups')
      .delete()
      .eq('id', groupId);

    if (groupError) {
      console.error('Error deleting group:', groupError);
      return res.status(500).json({ error: 'Error deleting group' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Group deleted successfully' 
    });

  } catch (error) {
    console.error('Error in handleDeleteGroup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
