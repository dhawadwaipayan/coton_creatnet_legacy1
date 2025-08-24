import React from 'react';
import { supabase } from '../lib/utils';

interface VideoTestButtonProps {
  onVideoLoad: (videoUrl: string, x: number, y: number, width: number, height: number) => void;
}

export const VideoTestButton: React.FC<VideoTestButtonProps> = ({ onVideoLoad }) => {
  const generateVideoHTML = (videoUrl: string) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Player</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: #000;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .video-container {
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
        }
        
        .video-controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            padding: 20px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .video-container:hover .video-controls {
            opacity: 1;
        }
        
        .control-buttons {
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
        }
        
        .control-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
        }
        
        .control-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        
        .play-pause {
            background: #E1FF00;
            color: #000;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(225,255,0,0.3);
        }
        
        .play-pause:hover {
            background: #cce600;
            box-shadow: 0 4px 12px rgba(225,255,0,0.4);
        }
        
        .video-info {
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            background: rgba(0,0,0,0.6);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="video-container">
        <video id="videoPlayer" preload="metadata" controls>
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
        
        <div class="video-info">
            🎬 CotonAI Video Player
        </div>
        
        <div class="video-controls">
            <div class="control-buttons">
                <button class="control-btn play-pause" id="playPauseBtn">▶ Play</button>
                <button class="control-btn" id="fullscreenBtn">⛶ Fullscreen</button>
            </div>
        </div>
    </div>

    <script>
        const video = document.getElementById('videoPlayer');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Play/Pause functionality
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                playPauseBtn.textContent = '⏸ Pause';
                playPauseBtn.classList.add('playing');
            } else {
                video.pause();
                playPauseBtn.textContent = '▶ Play';
                playPauseBtn.classList.remove('playing');
            }
        });
        
        // Fullscreen functionality
        fullscreenBtn.addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                video.requestFullscreen();
            }
        });
        
        // Update button text when video ends
        video.addEventListener('ended', () => {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.classList.remove('playing');
        });
        
        // Auto-hide controls after 3 seconds of inactivity
        let controlsTimeout;
        const showControls = () => {
            clearTimeout(controlsTimeout);
            document.querySelector('.video-controls').style.opacity = '1';
            controlsTimeout = setTimeout(() => {
                document.querySelector('.video-controls').style.opacity = '0';
            }, 3000);
        };
        
        video.addEventListener('mousemove', showControls);
        video.addEventListener('click', showControls);
        
        // Log for debugging
        console.log('Video player loaded with URL:', '${videoUrl}');
    </script>
</body>
</html>`;
  };

  const handleTestVideo = async () => {
    try {
      // Use the known working video URL directly
      const videoUrl = 'https://mtflgvphxklyzqmvrdyw.supabase.co/storage/v1/object/public/board-videos/a57ee3e3-c2f3-4a19-ace1-5d15a5dd4f52/videos/1756005533105-9525.mp4';
      
      console.log('Generating HTML page for video:', videoUrl);
      
      // Generate HTML page with embedded video
      const videoHTML = generateVideoHTML(videoUrl);
      
      // Convert HTML to Blob
      const htmlBlob = new Blob([videoHTML], { type: 'text/html' });
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000);
      const htmlFileName = `video-player-${timestamp}-${randomId}.html`;
      
      console.log('Uploading HTML page to Supabase:', htmlFileName);
      
      // Upload HTML to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('board-videos')
        .upload(`a57ee3e3-c2f3-4a19-ace1-5d15a5dd4f52/html/${htmlFileName}`, htmlBlob, {
          contentType: 'text/html',
          upsert: true
        });
      
      if (uploadError) {
        throw new Error(`Failed to upload HTML: ${uploadError.message}`);
      }
      
      // Get public URL for the HTML page
      const { data: urlData } = supabase.storage
        .from('board-videos')
        .getPublicUrl(`a57ee3e3-c2f3-4a19-ace1-5d15a5dd4f52/html/${htmlFileName}`);
      
      const htmlPageUrl = urlData.publicUrl;
      console.log('HTML page uploaded successfully:', htmlPageUrl);
      
      // Calculate center position (5000x5000 board)
      const centerX = (5000 / 2) - 250; // Half video width
      const centerY = (5000 / 2) - 444; // Half video height (9:16 ratio)
      
      // Call the parent function to add HTML page iframe to canvas
      onVideoLoad(htmlPageUrl, centerX, centerY, 500, 889);
      alert('Video HTML page created and loaded: ' + htmlFileName);
      
    } catch (err: any) {
      console.error('Error creating video HTML page:', err);
      alert('Error creating video HTML page: ' + err.message);
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
      title="Create Video HTML Page (Temporary)"
    >
      🎬 Create Video HTML
    </button>
  );
};
