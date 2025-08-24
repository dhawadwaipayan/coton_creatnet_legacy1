# Video Storage Setup for CotonAI

## Quick Setup

You need to create a `board-videos` storage bucket in Supabase for video generation to work.

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Go to **Storage** in the left sidebar
3. Click **Create a new bucket**

### Step 2: Create the Bucket
- **Bucket name**: `board-videos`
- **Public bucket**: ✅ Check this (so videos can be streamed)
- **File size limit**: `100 MB` (videos are larger than images)
- **Allowed MIME types**: 
  - `video/mp4`
  - `video/webm` 
  - `video/avi`
  - `video/mov`
  - `video/quicktime`

### Step 3: Set RLS Policies (Optional)
If you want to use the SQL script instead of manual setup:
1. Go to **SQL Editor** in Supabase
2. Copy and paste the contents of `supabase-video-storage-setup.sql`
3. Click **Run** to execute the script

### Step 4: Test
After creating the bucket, try generating a video again. The error should be resolved.

## What This Bucket Does

- **Stores generated videos** from Segmind Kling AI
- **Organizes videos by user** in folders like `{userId}/videos/{videoId}.mp4`
- **Enables video streaming** on your board via iframe
- **Handles video cleanup** when boards are deleted

## File Structure
```
board-videos/
├── {user-id-1}/
│   ├── videos/
│   │   ├── {video-id-1}.mp4
│   │   └── {video-id-2}.mp4
│   └── temp/
│       └── {temp-image-id}.png
├── {user-id-2}/
│   └── videos/
│       └── {video-id-3}.mp4
└── ...
```

## Troubleshooting

### "Bucket not found" Error
- ✅ Make sure bucket name is exactly `board-videos`
- ✅ Check bucket is created in the correct Supabase project
- ✅ Verify bucket is public

### Upload Failures
- ✅ Check file size limit (100MB)
- ✅ Verify MIME types include video formats
- ✅ Check RLS policies if using custom permissions

### Video Not Playing
- ✅ Ensure bucket is public
- ✅ Check video file exists in storage
- ✅ Verify CORS settings if needed
