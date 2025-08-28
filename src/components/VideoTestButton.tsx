import React from 'react';

interface VideoTestButtonProps {
  onVideoLoad: (videoUrl: string, x: number, y: number, width: number, height: number) => void;
}

export const VideoTestButton: React.FC<VideoTestButtonProps> = ({ onVideoLoad }) => {
  const handleTestVideo = async () => {
    try {
      // Use the known working video URL directly
      const videoUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co/storage/v1/object/public/board-videos/a57ee3e3-c2f3-4a19-ace1-5d15a5dd4f52/videos/1756005533105-9525.mp4';
      
      console.log('Adding video to current board:', videoUrl);
      
          // Calculate center position (30000x30000 board)
    const centerX = (30000 / 2) - 250; // Half video width
    const centerY = (30000 / 2) - 444; // Half video height (9:16 ratio)
      
      // Call the parent function to add video to canvas using Konva.js
      onVideoLoad(videoUrl, centerX, centerY, 500, 889);
      alert('Video added to current board using Konva.js!');
      
    } catch (err: any) {
      console.error('Error adding video to board:', err);
      alert('Error adding video: ' + err.message);
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
      title="Add Video to Current Board (Konva.js)"
    >
      🎬 Add Video
    </button>
  );
};
