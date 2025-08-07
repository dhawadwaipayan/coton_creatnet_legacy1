-- Make dwaipayan.dhawa15@gmail.com the admin user
-- Run this in your Supabase SQL Editor

-- First, let's find the user_id for dwaipayan.dhawa15@gmail.com
-- You can run this query to see the user_id:
-- SELECT id, email FROM auth.users WHERE email = 'dwaipayan.dhawa15@gmail.com';

-- Make dwaipayan.dhawa15@gmail.com the admin user
-- Replace 'USER_ID_HERE' with the actual user_id from the query above
INSERT INTO admin_users (user_id, email, name, is_super_admin)
VALUES (
  'USER_ID_HERE', -- Replace with actual user_id for dwaipayan.dhawa15@gmail.com
  'dwaipayan.dhawa15@gmail.com', 
  'Dwaipayan Dhawa', 
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  is_super_admin = true,
  email = EXCLUDED.email,
  name = EXCLUDED.name; 