-- Make dwaipayan.dhawa15@gmail.com the admin user
-- Run this in your Supabase SQL Editor

-- First, let's see the user_id for dwaipayan.dhawa15@gmail.com
SELECT id, email FROM auth.users WHERE email = 'dwaipayan.dhawa15@gmail.com';

-- Now make dwaipayan.dhawa15@gmail.com the admin user
-- This will use the user_id from the query above
INSERT INTO admin_users (user_id, email, name, is_super_admin)
SELECT 
  id as user_id,
  'dwaipayan.dhawa15@gmail.com' as email,
  'Dwaipayan Dhawa' as name,
  true as is_super_admin
FROM auth.users 
WHERE email = 'dwaipayan.dhawa15@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  is_super_admin = true,
  email = EXCLUDED.email,
  name = EXCLUDED.name; 