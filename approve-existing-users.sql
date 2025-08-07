-- Approve all existing users automatically
-- Run this in your Supabase SQL Editor

-- Insert all existing auth users into approved_users table
INSERT INTO approved_users (user_id, email, name, approved_by, approved_at)
SELECT 
  au.id as user_id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
  au.id as approved_by, -- Self-approved for existing users
  au.created_at as approved_at
FROM auth.users au
WHERE au.email IS NOT NULL
  AND au.email != ''
  AND NOT EXISTS (
    SELECT 1 FROM approved_users apu 
    WHERE apu.user_id = au.id
  );

-- Also add any existing users to admin_users if needed
-- Uncomment the line below if you want to make a specific user an admin
-- INSERT INTO admin_users (user_id, email, name, is_super_admin) 
-- VALUES ('dd523e4f-bb41-4bd6-b929-d4c4e15a15a8', 'sourasenee.dhawa@gmail.com', 'Sourasenee Dhawa', true); 