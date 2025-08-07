-- Fix for infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin list" ON admin_users;
DROP POLICY IF EXISTS "Allow initial admin creation" ON admin_users;

-- Create simpler policies that don't cause recursion
-- Allow anyone to view admin_users (needed for admin checks)
CREATE POLICY "Anyone can view admin list" ON admin_users
FOR SELECT USING (true);

-- Allow anyone to insert admin_users (needed for initial setup)
CREATE POLICY "Anyone can insert admin users" ON admin_users
FOR INSERT WITH CHECK (true);

-- Allow admins to update admin_users
CREATE POLICY "Admins can update admin users" ON admin_users
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Allow admins to delete admin_users
CREATE POLICY "Admins can delete admin users" ON admin_users
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
); 