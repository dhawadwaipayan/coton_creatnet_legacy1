# Admin Approval System Setup Guide

This guide will help you set up the admin approval system for your application.

## Step 1: Database Setup

1. **Run the SQL Script**: Execute the `admin-approval-setup.sql` file in your Supabase SQL Editor
   - This creates the necessary tables: `user_approvals`, `approved_users`, and `admin_users`
   - Sets up Row Level Security (RLS) policies
   - Creates indexes for better performance

## Step 2: Create Your First Admin User

Since the system requires admin approval, you'll need to manually create your first admin user:

### Option A: Direct Database Insert (Recommended)

1. **Sign up normally** through the application (this will create a pending approval)
2. **Get your user ID** from the Supabase Auth dashboard or by checking the `user_approvals` table
3. **Insert admin record** in the Supabase SQL Editor:

```sql
-- Replace with your actual user ID and email
INSERT INTO admin_users (user_id, email, name, is_super_admin) 
VALUES (
  'your-user-id-here', 
  'your-email@example.com', 
  'Your Name', 
  true
);

-- Also approve your own request
UPDATE user_approvals 
SET status = 'approved', 
    reviewed_by = 'your-user-id-here', 
    reviewed_at = NOW() 
WHERE email = 'your-email@example.com';

-- Add yourself to approved_users
INSERT INTO approved_users (user_id, email, name, approved_by)
SELECT 
  'your-user-id-here',
  email,
  name,
  'your-user-id-here'
FROM user_approvals 
WHERE email = 'your-email@example.com';
```

### Option B: Temporary Admin Creation Script

You can also create a temporary script to set up your first admin:

```javascript
// Run this in your browser console after signing up
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  // Insert admin record
  await supabase.from('admin_users').insert({
    user_id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email,
    is_super_admin: true
  });
  
  // Approve your own request
  await supabase.from('user_approvals')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('email', user.email);
    
  // Add to approved users
  await supabase.from('approved_users').insert({
    user_id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email,
    approved_by: user.id
  });
}
```

## Step 3: Test the System

1. **Sign out** and sign back in
2. **Verify admin access**: You should see the admin dashboard instead of the regular app
3. **Test approval flow**: 
   - Create a new account with a different email
   - Check that it appears in the "Pending Approvals" tab
   - Approve the user and verify they can sign in

## How the System Works

### For New Users:
1. **Request Access**: Users click "Request Access" instead of "Sign Up"
2. **Pending Status**: Their request is stored in `user_approvals` with status "pending"
3. **Admin Review**: Admins can see pending requests in the admin dashboard
4. **Approval/Rejection**: Admins can approve or reject users with optional notes
5. **Account Creation**: When approved, a real Supabase Auth account is created
6. **Access Granted**: Approved users can sign in normally

### For Admins:
1. **Admin Dashboard**: Access the admin interface at `/admin` (automatically shown for admin users)
2. **Pending Approvals**: View and manage all pending requests
3. **User Management**: View all approved users and their status
4. **Approval Actions**: One-click approve/reject with optional notes

### Security Features:
- **RLS Policies**: Database-level security ensures users only see their own data
- **Admin Verification**: Admin status is checked on every request
- **Audit Trail**: All approval actions are logged with timestamps
- **Email Validation**: Users must provide valid email addresses

## Admin Dashboard Features

### Pending Approvals Tab:
- List of all users waiting for approval
- User details (name, email, request date)
- Approve/Reject buttons
- Optional rejection notes

### Approved Users Tab:
- List of all approved users
- User status (active/inactive)
- Approval date and approver
- User management capabilities

## Troubleshooting

### Common Issues:

1. **"User not approved" error**: Make sure the user is in the `approved_users` table
2. **Admin dashboard not showing**: Verify the user is in the `admin_users` table
3. **RLS policy errors**: Check that the SQL setup script ran successfully
4. **Approval not working**: Ensure the admin user has proper permissions

### Debug Commands:

```sql
-- Check if a user is admin
SELECT * FROM admin_users WHERE user_id = 'your-user-id';

-- Check if a user is approved
SELECT * FROM approved_users WHERE user_id = 'your-user-id';

-- View all pending approvals
SELECT * FROM user_approvals WHERE status = 'pending';
```

## Next Steps

1. **Customize the UI**: Modify the admin dashboard styling to match your brand
2. **Add Email Notifications**: Implement email alerts for new requests and approvals
3. **Enhanced Security**: Add additional verification steps for admin actions
4. **User Roles**: Implement different admin permission levels
5. **Analytics**: Add reporting and analytics for user management

## Support

If you encounter any issues during setup, check:
1. Supabase logs for database errors
2. Browser console for JavaScript errors
3. Network tab for API request failures
4. RLS policies are properly configured 