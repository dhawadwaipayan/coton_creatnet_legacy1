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

// Supabase Board CRUD helpers
export async function getBoardsForUser(userId: string) {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('lastEdited', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBoard({ user_id, name, content }: { user_id: string, name: string, content: any }) {
  const { data, error } = await supabase
    .from('boards')
    .insert([{ user_id, name, content, lastEdited: Date.now() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBoard({ id, name, content }: { id: string, name?: string, content?: any }) {
  const update: any = { lastEdited: Date.now() };
  if (name !== undefined) update.name = name;
  if (content !== undefined) update.content = content;
  const { data, error } = await supabase
    .from('boards')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBoard(id: string) {
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
