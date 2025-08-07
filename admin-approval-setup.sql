-- Admin Approval System Database Setup
-- Run this in your Supabase SQL Editor

-- 1. Create user_approvals table to store pending approval requests
CREATE TABLE IF NOT EXISTS user_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- 2. Create approved_users table to store approved user records
CREATE TABLE IF NOT EXISTS approved_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- 3. Create admin_users table to store admin user IDs
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_super_admin BOOLEAN DEFAULT false
);

-- 4. Enable RLS on all tables
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for user_approvals
-- Allow anyone to insert approval requests (needed for initial signup)
CREATE POLICY "Anyone can create approval requests" ON user_approvals
FOR INSERT WITH CHECK (true);

-- Allow admins to view all approval requests
CREATE POLICY "Admins can view all approval requests" ON user_approvals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Allow admins to update approval requests
CREATE POLICY "Admins can update approval requests" ON user_approvals
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- 6. Create RLS policies for approved_users
-- Allow users to view their own approval record
CREATE POLICY "Users can view their own approval" ON approved_users
FOR SELECT USING (user_id = auth.uid());

-- Allow admins to view all approved users
CREATE POLICY "Admins can view all approved users" ON approved_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Allow admins to update approved users
CREATE POLICY "Admins can update approved users" ON approved_users
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Allow admins to insert approved users
CREATE POLICY "Admins can insert approved users" ON approved_users
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- 7. Create RLS policies for admin_users
-- Allow admins to view admin list
CREATE POLICY "Admins can view admin list" ON admin_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Allow super admins to manage admin list
CREATE POLICY "Super admins can manage admin list" ON admin_users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.is_super_admin = true
  )
);

-- Allow initial admin creation (for first admin setup)
CREATE POLICY "Allow initial admin creation" ON admin_users
FOR INSERT WITH CHECK (true);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_approvals_email ON user_approvals(email);
CREATE INDEX IF NOT EXISTS idx_user_approvals_status ON user_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approved_users_user_id ON approved_users(user_id);
CREATE INDEX IF NOT EXISTS idx_approved_users_email ON approved_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- 9. Insert initial super admin (replace with your email)
-- You'll need to manually insert your admin user after creating your account
-- INSERT INTO admin_users (user_id, email, name, is_super_admin) 
-- VALUES ('your-user-id-here', 'your-email@example.com', 'Your Name', true); 