import React from 'react';
import { supabase } from '../lib/utils';

interface VideoTestButtonProps {
  onVideoLoad: (videoUrl: string, x: number, y: number, width: number, height: number) => void;
}

export const VideoTestButton: React.FC<VideoTestButtonProps> = ({ onVideoLoad }) => {
  const handleTestVideo = async () => {
    try {
      // Get the last uploaded video from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please login first');
        return;
      }
      
      console.log('User ID:', user.id);
      console.log('User email:', user.email);
      
      // First, let's see what's in the root of board-videos bucket
      const { data: rootFiles, error: rootError } = await supabase.storage
        .from('board-videos')
        .list('', { limit: 100 });
      
      console.log('Root files:', rootFiles);
      if (rootError) console.log('Root error:', rootError);
      
      // Let's also try to list with no path to see if we can access the bucket at all
      const { data: bucketTest, error: bucketError } = await supabase.storage
        .from('board-videos')
        .list();
      
      console.log('Bucket test (no path):', bucketTest);
      if (bucketError) console.log('Bucket error:', bucketError);
      
      // Then check the user's folder
      const { data: userFiles, error: userError } = await supabase.storage
        .from('board-videos')
        .list(`${user.id}`, { limit: 100 });
      
      console.log('User files:', userFiles);
      if (userError) console.log('User error:', userError);
      
      // Then check the videos subfolder
      const { data: videoFiles, error } = await supabase.storage
        .from('board-videos')
        .list(`${user.id}/videos`, { limit: 100 });
      
      console.log('Video files:', videoFiles);
      if (error) console.log('Video error:', error);
      
      // Let's test if we can access the specific video file we know exists
      const knownVideoPath = 'a57ee3e3-c2f3-4a19-ace1-5d15a5dd4f52/videos/1756005533105-9525.mp4';
      const { data: knownVideoTest, error: knownVideoError } = await supabase.storage
        .from('board-videos')
        .getPublicUrl(knownVideoPath);
      
      console.log('Known video test:', knownVideoTest);
      if (knownVideoError) console.log('Known video error:', knownVideoError);
      
      if (error || !videoFiles || videoFiles.length === 0) {
        // Try to find any video files in the user's folder
        if (userFiles && userFiles.length > 0) {
          const videoFile = userFiles.find(file => file.name.endsWith('.mp4'));
          if (videoFile) {
            console.log('Found video in user folder:', videoFile);
            const { data: { publicUrl } } = supabase.storage
              .from('board-videos')
              .getPublicUrl(`${user.id}/${videoFile.name}`);
            
            const centerX = (5000 / 2) - 250;
            const centerY = (5000 / 2) - 444;
            
            onVideoLoad(publicUrl, centerX, centerY, 500, 889);
            alert(`Video loaded: ${videoFile.name}`);
            return;
          }
        }
        
        alert(`No videos found. Root files: ${rootFiles?.length || 0}, User files: ${userFiles?.length || 0}, Video files: ${videoFiles?.length || 0}`);
        return;
      }
      
      // Get the most recent video
      const latestVideo = videoFiles[0];
      const { data: { publicUrl } } = supabase.storage
        .from('board-videos')
        .getPublicUrl(`${user.id}/videos/${latestVideo.name}`);
      
      // Calculate center position (5000x5000 board)
      const centerX = (5000 / 2) - 250; // Half video width
      const centerY = (5000 / 2) - 444; // Half video height (9:16 ratio)
      
      // Call the parent function to add video to canvas
      onVideoLoad(publicUrl, centerX, centerY, 500, 889);
      alert(`Video loaded: ${latestVideo.name}`);
      
    } catch (err: any) {
      console.error('Error loading test video:', err);
      alert('Error loading video: ' + err.message);
    }
  };

  return (
    <button
      onClick={handleTestVideo}
      style={{
        position: 'absolute',
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        padding: '12px 16px',
        backgroundColor: '#E1FF00',
        color: '#000',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
      title="Test Video Loading (Temporary)"
    >
      🎬 Test Video
    </button>
  );
};
