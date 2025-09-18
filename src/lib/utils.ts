import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Supabase client setup
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Do not throw to avoid breaking runtime; surface a clear warning instead
  // Ensure env vars are configured in your .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  console.warn('[Security] Missing Supabase env configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Legacy approval system removed - all users are now auto-approved

// Admin functions removed - no longer needed with auto-approval

// Google OAuth Authentication Functions
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  });
  
  return { data, error };
}

export async function handleGoogleAuthCallback() {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    return { data: null, error };
  }
  
  if (data.session?.user) {
    // Auto-create user profile and approve
    await createUserProfile(data.session.user);
    await autoApproveUser(data.session.user);
  }
  
  return { data, error };
}

// Create user profile from Google data
export async function createUserProfile(user: { id: string; email?: string; user_metadata?: any }) {
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (existingProfile) {
    return existingProfile;
  }
  
  const profileData = {
    user_id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    profile_picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    auth_provider: 'google',
    auth_provider_id: user.user_metadata?.sub || user.id
  };
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([profileData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating user profile:', error);
  }
  
  return data;
}

// Auto-approve user (no admin approval needed)
export async function autoApproveUser(user: { id: string; email?: string; user_metadata?: any }) {
  // Check if user is already in approved_users
  const { data: existingUser } = await supabase
    .from('approved_users')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (existingUser) {
    return existingUser;
  }
  
  // Auto-approve the user
  const { data, error } = await supabase
    .from('approved_users')
    .insert([{
      user_id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      profile_picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      auth_provider: 'google',
      auth_provider_id: user.user_metadata?.sub || user.id,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error auto-approving user:', error);
  }
  
  return data;
}

// Simplified authentication functions (auto-approval enabled)
export async function signUp(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || '',
        full_name: name || ''
      }
    }
  });
  
  if (data.user && !error) {
    // Auto-approve the user
    await autoApproveUser(data.user);
  }
  
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (data.user && !error) {
    // Ensure user is auto-approved
    await autoApproveUser(data.user);
  }
  
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Password reset function
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?mode=recovery`,
  });
  
  return { data, error };
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
  console.warn('[tracking] Disabled: trackGeneration no-op');
  return { data: { bypassed: true }, error: null };
}

// Precheck without consuming credit
export async function precheckGeneration(userId: string, generationType: 'image' | 'video') {
  console.warn('[tracking] Disabled: precheckGeneration no-op');
  return { data: { allowed: true, bypassed: true }, error: null };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
