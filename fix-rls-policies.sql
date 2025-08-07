-- Quick fix for RLS policies
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create approval requests" ON user_approvals;
DROP POLICY IF EXISTS "Admins can view all approval requests" ON user_approvals;
DROP POLICY IF EXISTS "Admins can update approval requests" ON user_approvals;

-- Create new policies that allow unauthenticated access for approval requests
CREATE POLICY "Anyone can create approval requests" ON user_approvals
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all approval requests" ON user_approvals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can update approval requests" ON user_approvals
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Add policy for inserting approved users
CREATE POLICY "Admins can insert approved users" ON approved_users
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Add policy for initial admin creation
CREATE POLICY "Allow initial admin creation" ON admin_users
FOR INSERT WITH CHECK (true); 