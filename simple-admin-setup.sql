-- Simple Admin Setup - Just create tables without complex RLS
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

-- 5. Simple RLS policies - allow all operations for now
CREATE POLICY "Allow all operations on user_approvals" ON user_approvals
FOR ALL USING (true);

CREATE POLICY "Allow all operations on approved_users" ON approved_users
FOR ALL USING (true);

CREATE POLICY "Allow all operations on admin_users" ON admin_users
FOR ALL USING (true);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_approvals_email ON user_approvals(email);
CREATE INDEX IF NOT EXISTS idx_user_approvals_status ON user_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approved_users_user_id ON approved_users(user_id);
CREATE INDEX IF NOT EXISTS idx_approved_users_email ON approved_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email); 