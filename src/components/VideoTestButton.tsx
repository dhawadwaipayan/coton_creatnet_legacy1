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
      
      // List videos in user's folder
      const { data: videoFiles, error } = await supabase.storage
        .from('board-videos')
        .list(`${user.id}/videos`, {
          limit: 1,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      if (error || !videoFiles || videoFiles.length === 0) {
        alert('No videos found');
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
