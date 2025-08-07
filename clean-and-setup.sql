-- Clean up and setup - Remove all existing policies and create simple ones
-- Run this in your Supabase SQL Editor

-- First, drop all existing policies to clean slate
DROP POLICY IF EXISTS "Anyone can create approval requests" ON user_approvals;
DROP POLICY IF EXISTS "Admins can view all approval requests" ON user_approvals;
DROP POLICY IF EXISTS "Admins can update approval requests" ON user_approvals;
DROP POLICY IF EXISTS "Users can view their own approval" ON approved_users;
DROP POLICY IF EXISTS "Admins can view all approved users" ON approved_users;
DROP POLICY IF EXISTS "Admins can update approved users" ON approved_users;
DROP POLICY IF EXISTS "Admins can insert approved users" ON approved_users;
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin list" ON admin_users;
DROP POLICY IF EXISTS "Allow initial admin creation" ON admin_users;
DROP POLICY IF EXISTS "Anyone can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Anyone can insert admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can update admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can delete admin users" ON admin_users;
DROP POLICY IF EXISTS "Allow all operations on user_approvals" ON user_approvals;
DROP POLICY IF EXISTS "Allow all operations on approved_users" ON approved_users;
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;

-- Now create simple policies that allow all operations
CREATE POLICY "Allow all operations on user_approvals" ON user_approvals
FOR ALL USING (true);

CREATE POLICY "Allow all operations on approved_users" ON approved_users
FOR ALL USING (true);

CREATE POLICY "Allow all operations on admin_users" ON admin_users
FOR ALL USING (true); 