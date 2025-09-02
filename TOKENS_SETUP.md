# Token Management System Setup

This document provides instructions for setting up the new token management system in your admin panel.

## 🚀 Quick Start

### 1. Database Setup

Run the SQL commands in `database-schema.sql` in your Supabase SQL editor to create the required tables:

```sql
-- Copy and paste the contents of database-schema.sql into your Supabase SQL editor
```

### 2. Environment Variables

Make sure your `.env` file has the required Supabase service role key:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Deploy API Endpoints

The following API endpoints have been created and need to be deployed:

- `/api/groups.js` - Group management (CRUD operations)
- `/api/group-members.js` - Member management (add/remove users)
- `/api/track-generation.js` - Usage tracking

### 4. Test the System

1. Go to your admin dashboard
2. Click on the new "Tokens" tab
3. Create a test group with some limits
4. Add users to the group
5. Test generation limits

## 📊 Features

### Admin Panel Features

- **Group Management**: Create, edit, and delete user groups
- **Member Assignment**: Add/remove users from groups
- **Usage Tracking**: Real-time countdown of remaining generations
- **Visual Indicators**: Progress bars showing usage vs limits
- **Limit Enforcement**: Automatic blocking when limits are reached

### Group Management

- Set separate limits for image and video generations
- Add descriptions to groups
- View member counts and usage statistics
- Edit limits without affecting existing usage

### Usage Tracking

- Real-time usage monitoring
- Visual progress bars (green/yellow/red)
- Remaining count display
- Automatic limit enforcement

## 🔧 Integration with Existing Services

To integrate with your existing generation services, add usage tracking calls:

### For Image Generation

```typescript
import { trackGeneration } from '../lib/utils';

// Before starting image generation
const usageCheck = await trackGeneration(userId, 'image');
if (!usageCheck.data.allowed) {
  throw new Error(usageCheck.error || 'Image generation limit exceeded');
}

// Proceed with image generation...
```

### For Video Generation

```typescript
import { trackGeneration } from '../lib/utils';

// Before starting video generation
const usageCheck = await trackGeneration(userId, 'video');
if (!usageCheck.data.allowed) {
  throw new Error(usageCheck.error || 'Video generation limit exceeded');
}

// Proceed with video generation...
```

## 🗄️ Database Schema

### Tables Created

1. **`user_groups`** - Stores group information and limits
2. **`group_memberships`** - Links users to groups
3. **`generation_usage`** - Tracks actual usage

### Key Features

- **Row Level Security (RLS)** enabled for all tables
- **Admin-only access** through RLS policies
- **Performance indexes** for fast queries
- **Helper functions** for usage statistics

## 🎨 UI Components

### New Components Added

- **Tokens Tab** in AdminDashboard
- **Group Cards** with usage visualization
- **Create/Edit Group Modals**
- **Member Management Modal**
- **Progress Bars** for usage tracking

### Styling

- Consistent with existing admin panel design
- Dark theme with green accent colors
- Responsive grid layout
- Interactive hover states

## 🔒 Security

### Admin Authentication

- All group operations require admin authentication
- RLS policies ensure only admins can access data
- API endpoints validate admin status

### Data Protection

- Input validation on all forms
- SQL injection protection
- XSS protection headers
- Rate limiting ready

## 📈 Usage Statistics

### Real-time Monitoring

- Live usage counts
- Remaining generation tracking
- Visual progress indicators
- Historical usage data

### Group Analytics

- Member count tracking
- Usage per group
- Limit vs actual usage
- Trend analysis ready

## 🚨 Error Handling

### User Experience

- Clear error messages
- Graceful degradation
- Loading states
- Confirmation dialogs

### System Reliability

- Database transaction safety
- Rollback on failures
- Comprehensive logging
- Error recovery

## 🔄 Future Enhancements

### Planned Features

- **Usage Analytics Dashboard** - Charts and trends
- **Bulk Operations** - Mass user assignment
- **Export Functionality** - Usage reports
- **Notification System** - Limit warnings
- **API Rate Limiting** - Additional protection

### Scalability

- Efficient database queries
- Caching strategies
- Background job processing
- Horizontal scaling ready

## 🆘 Troubleshooting

### Common Issues

1. **Groups not loading**: Check admin authentication
2. **Usage not tracking**: Verify API endpoint deployment
3. **Limits not enforced**: Check generation service integration
4. **Database errors**: Verify RLS policies and permissions

### Debug Steps

1. Check browser console for errors
2. Verify API endpoint responses
3. Check Supabase logs
4. Validate database permissions

## 📞 Support

If you encounter any issues:

1. Check the browser console for errors
2. Verify all API endpoints are deployed
3. Ensure database schema is properly set up
4. Check environment variables

The system is designed to be robust and fail-safe, with comprehensive error handling and user feedback.
