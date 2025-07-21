import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Supabase client setup (hardcoded for debugging)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZmxndnBoeGtseXpxbXZyZHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDg4OTksImV4cCI6MjA2NzU4NDg5OX0.3fK8z6DnuaMjZsbrLb-3GRg3JQN1d84LI-qkTw2XxXo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase Auth helpers (not used in UI yet)
export async function signUp(email: string, password: string, name?: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function getUser() {
  return supabase.auth.getUser();
}

// Supabase Storage helpers for board images
export async function uploadBoardImage(userId: string, boardId: string, imageId: string, imageBlob: Blob | Buffer) {
  const filePath = `${userId}/${boardId}/${imageId}.png`;
  console.log('Uploading image to Supabase Storage:', {
    userId,
    boardId,
    imageId,
    filePath,
    blobType: (imageBlob as any)?.type,
    blobSize: (imageBlob as any)?.size
  });
  const { data, error } = await supabase.storage
    .from('board-images')
    .upload(filePath, imageBlob, {
      contentType: 'image/png',
      upsert: true
    });
  
  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
  
  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('board-images')
    .getPublicUrl(filePath);
  
  return urlData.publicUrl;
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

// Convert HTMLImageElement to Blob
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
    
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not convert image to blob'));
      }
    }, 'image/png');
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

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
