import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Supabase client setup (hardcoded for debugging)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZmxndnBoeGtseXpxbXZyZHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDg4OTksImV4cCI6MjA2NzU4NDg5OX0.3fK8z6DnuaMjZsbrLb-3GRg3JQN1d84LI-qkTw2XxXo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin Approval System Functions
export async function requestAccess(email: string, _password: string, name: string) {
  // New flow: do not store passwords in approvals table
  const { data, error } = await supabase
    .from('user_approvals')
    .insert([{
      email,
      name,
      status: 'pending'
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error requesting access:', error);
    throw error;
  }
  
  return { data, error: null };
}

export async function checkApprovalStatus(email: string) {
  const { data, error } = await supabase
    .from('user_approvals')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error('Error checking approval status:', error);
    throw error;
  }
  
  return { data, error: null };
}

export async function isUserApproved(userId: string) {
  const { data, error } = await supabase
    .from('approved_users')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error checking if user is approved:', error);
    throw error;
  }
  
  return { data, error: null };
}

export async function isUserAdmin(userId: string) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error checking if user is admin:', error);
    throw error;
  }
  
  return { data, error: null };
}

// Admin Functions
export async function getPendingApprovals() {
  const { data, error } = await supabase
    .from('user_approvals')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });
  
  if (error) {
    console.error('Error getting pending approvals:', error);
    throw error;
  }
  
  return data;
}

export async function approveUser(approvalId: string, adminUserId: string) {
  try {
    // Include bearer token for server-side auth
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch('/api/approve-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        approvalId,
        // adminUserId no longer trusted server-side; kept for backward compatibility
        adminUserId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to approve user');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
}

export async function rejectUser(approvalId: string, adminUserId: string, notes?: string) {
  const { error } = await supabase
    .from('user_approvals')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      notes
    })
    .eq('id', approvalId);
  
  if (error) {
    console.error('Error rejecting user:', error);
    throw error;
  }
  
  return { data: null, error: null };
}

export async function getAllApprovedUsers() {
  const { data, error } = await supabase
    .from('approved_users')
    .select('*')
    .order('approved_at', { ascending: false });
  
  if (error) {
    console.error('Error getting approved users:', error);
    throw error;
  }
  
  return data;
}

// Modified Auth Functions
export async function signUp(email: string, password: string, name?: string) {
  // Instead of creating user directly, request approval
  return requestAccess(email, password, name || '');
}

export async function signIn(email: string, password: string) {
  // First, check if user is approved
  const { data: approval } = await checkApprovalStatus(email);
  
  if (approval && approval.status === 'pending') {
    return { 
      data: null, 
      error: { message: 'Your access request is still pending approval. Please wait for admin approval.' }
    };
  }
  
  if (approval && approval.status === 'rejected') {
    return { 
      data: null, 
      error: { message: 'Your access request has been rejected. Please contact the administrator.' }
    };
  }
  
  // If approved or no approval record exists, proceed with normal sign in
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    return { data, error };
  }
  
  // Check if the signed-in user is approved
  if (data.user) {
    const { data: approvedUser } = await isUserApproved(data.user.id);
    if (!approvedUser) {
      // Sign out the user if they're not approved
      await supabase.auth.signOut();
      return { 
        data: null, 
        error: { message: 'Your account is not approved. Please contact the administrator.' }
      };
    }
  }
  
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function getUser() {
  return supabase.auth.getUser();
}

// Supabase Storage helpers for board images
export async function uploadBoardImage(userId: string, boardId: string, imageId: string, imageBlob: Blob | Buffer) {
  // Determine file extension and content type based on blob type
  const isWebP = (imageBlob as any)?.type === 'image/webp';
  const fileExtension = isWebP ? 'webp' : 'png';
  const contentType = isWebP ? 'image/webp' : 'image/png';
  const filePath = `${userId}/${boardId}/${imageId}.${fileExtension}`;
  
  console.log('Uploading image to Supabase Storage:', {
    userId,
    boardId,
    imageId,
    filePath,
    blobType: (imageBlob as any)?.type,
    blobSize: (imageBlob as any)?.size,
    format: fileExtension,
    compression: isWebP ? 'WebP (85% quality)' : 'PNG (lossless)'
  });
  
  const { data, error } = await supabase.storage
    .from('board-images')
    .upload(filePath, imageBlob, {
      contentType: contentType,
      upsert: true
    });
  
  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
  
  // Get the public URL
  const { data: signed } = await supabase.storage
    .from('board-images')
    .createSignedUrl(filePath, 60);
  
  return signed?.signedUrl || '';
}

export async function deleteBoardImage(boardId: string, imageId: string) {
  const filePath = `${boardId}/${imageId}.png`;
  const { error } = await supabase.storage
    .from('board-images')
    .remove([filePath]);
  
  if (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

export async function deleteBoardImages(boardId: string) {
  // List all files in the board folder
  const { data: files, error: listError } = await supabase.storage
    .from('board-images')
    .list(boardId);
  
  if (listError) {
    console.error('Error listing board images:', listError);
    return;
  }
  
  if (files && files.length > 0) {
    const filePaths = files.map(file => `${boardId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from('board-images')
      .remove(filePaths);
    
    if (deleteError) {
      console.error('Error deleting board images:', deleteError);
    }
  }
}

// Convert HTMLImageElement to Blob with maximum quality PNG
export function imageElementToBlob(image: HTMLImageElement, width?: number, height?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width || image.width;
    canvas.height = height || image.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Use PNG format with maximum quality for best image preservation
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not convert image to PNG blob'));
        }
      }, 'image/png'); // PNG format for maximum quality
    } else {
      // Fallback for older browsers
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error('Could not convert image to blob'));
        }
      }, 'image/png');
    }
  });
}

// Supabase Board CRUD helpers
export async function getBoardsForUser(userId: string) {
  console.log('Getting boards for user:', userId);
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('lastEdited', { ascending: false });
  if (error) {
    console.error('Error getting boards:', error);
    throw error;
  }
  console.log('Retrieved boards:', data);
  return data;
}

export async function createBoard({ user_id, name, content }: { user_id: string, name: string, content: any }) {
  console.log('Creating board:', { user_id, name, content });
  const { data, error } = await supabase
    .from('boards')
    .insert([{ user_id, name, content, lastEdited: Date.now() }])
    .select()
    .single();
  if (error) {
    console.error('Error creating board:', error);
    throw error;
  }
  console.log('Created board:', data);
  return data;
}

export async function updateBoard({ id, name, content }: { id: string, name?: string, content?: any }) {
  console.log('Updating board:', { id, name, content });
  const update: any = { lastEdited: Date.now() };
  if (name !== undefined) update.name = name;
  if (content !== undefined) update.content = content;
  const { data, error } = await supabase
    .from('boards')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating board:', error);
    throw error;
  }
  console.log('Updated board:', data);
  return data;
}

export async function deleteBoard(id: string) {
  // Delete all images for this board first
  await deleteBoardImages(id);
  
  // Then delete the board
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting board:', error);
    throw error;
  }
  return true;
}

// Group Management Functions
export async function getGroups(adminUserId: string) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch(`/api/groups`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get groups');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error getting groups:', error);
    throw error;
  }
}

export async function createGroup(adminUserId: string, groupData: {
  name: string;
  description?: string;
  imageLimit: number;
  videoLimit: number;
}) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        ...groupData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create group');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
}

export async function updateGroup(adminUserId: string, groupId: string, groupData: {
  name?: string;
  description?: string;
  imageLimit?: number;
  videoLimit?: number;
}) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch(`/api/groups?groupId=${groupId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        ...groupData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update group');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
}

export async function deleteGroup(adminUserId: string, groupId: string) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch(`/api/groups?groupId=${groupId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete group');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
}

export async function getGroupMembers(adminUserId: string, groupId: string) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch(`/api/group-members?groupId=${groupId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get group members');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error getting group members:', error);
    throw error;
  }
}

export async function addUserToGroup(adminUserId: string, groupId: string, userId: string) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch('/api/group-members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        groupId,
        userId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add user to group');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error adding user to group:', error);
    throw error;
  }
}

export async function removeUserFromGroup(adminUserId: string, groupId: string, userId: string) {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const response = await fetch(`/api/group-members?groupId=${groupId}&userId=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to remove user from group');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error removing user from group:', error);
    throw error;
  }
}

export async function trackGeneration(userId: string, generationType: 'image' | 'video', metadata?: any) {
  try {
    const response = await fetch('/api/track-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        generationType,
        metadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 429) {
        // Limit exceeded
        return { data: errorData.data, error: errorData.error };
      }
      throw new Error(errorData.error || 'Failed to track generation');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error tracking generation:', error);
    throw error;
  }
}

// Precheck without consuming credit
export async function precheckGeneration(userId: string, generationType: 'image' | 'video') {
  try {
    const response = await fetch('/api/track-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        generationType,
        checkOnly: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 429) {
        return { data: errorData.data, error: errorData.error };
      }
      throw new Error(errorData.error || 'Failed to precheck generation');
    }

    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error prechecking generation:', error);
    throw error;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
