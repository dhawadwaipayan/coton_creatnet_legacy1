# Supabase Storage Setup for Board Images

## Overview
This implementation uses Supabase Storage to store board images instead of base64 in the database, providing better performance and scalability.

## Setup Instructions

### 1. Create Storage Bucket
Run the SQL script `supabase-storage-setup.sql` in your Supabase SQL Editor:

```sql
-- Create the storage bucket for board images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-images',
  'board-images',
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
);
```

### 2. Set Up RLS Policies
The SQL script also creates Row Level Security policies that:
- Allow users to upload images to their board folders
- Allow users to view images from their board folders
- Allow users to update images in their board folders
- Allow users to delete images from their board folders

### 3. File Structure
Images are stored in the following structure:
```
board-images/
├── {board-id-1}/
│   ├── {image-id-1}.png
│   ├── {image-id-2}.png
│   └── ...
├── {board-id-2}/
│   ├── {image-id-3}.png
│   └── ...
└── ...
```

## Features

### ✅ **Benefits:**
- **Reduced Database Size**: Images stored separately from database
- **Better Performance**: Faster loading and saving
- **Scalability**: Can handle many large images
- **Cost Effective**: More efficient storage usage
- **Security**: RLS policies ensure users only access their images

### 🔧 **How It Works:**

1. **Saving Images:**
   - Convert HTMLImageElement to Blob
   - Upload to Supabase Storage with path: `{boardId}/{imageId}.png`
   - Store only the public URL in database

2. **Loading Images:**
   - Load image URLs from database
   - Create HTMLImageElement from Supabase Storage URLs
   - Handle CORS with `crossOrigin = 'anonymous'`

3. **Cleanup:**
   - Delete board images when board is deleted
   - Automatic cleanup of orphaned images

### 🎯 **Usage:**

1. **Manual Save:** Click "Save" button or press Ctrl+S
2. **Loading:** Images automatically load when switching boards
3. **Error Handling:** Failed uploads are marked with error state

### 📊 **Storage Limits:**
- **File Size:** 50MB per image
- **Formats:** PNG, JPEG, JPG, GIF, WebP
- **Organization:** Images organized by board ID

## Troubleshooting

### Common Issues:

1. **CORS Errors:**
   - Ensure `crossOrigin = 'anonymous'` is set on images
   - Check Supabase Storage bucket is public

2. **Upload Failures:**
   - Check file size limits
   - Verify RLS policies are correct
   - Check network connectivity

3. **Loading Failures:**
   - Verify image URLs are correct
   - Check if images exist in storage
   - Review browser console for errors

### Debug Commands:
```javascript
// Check storage bucket
const { data, error } = await supabase.storage
  .from('board-images')
  .list();

// Check specific board images
const { data, error } = await supabase.storage
  .from('board-images')
  .list('your-board-id');
```

## Migration from Base64

If you have existing boards with base64 images, you can migrate them by:
1. Loading the board content
2. Converting base64 to blobs
3. Uploading to storage
4. Updating the database with new URLs

The system will automatically handle both old (base64) and new (storage URL) formats during the transition period. 