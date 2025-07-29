import React from 'react';
import { useLocation } from 'react-router-dom';

const VideoPlayerPage = () => {
  const { state } = useLocation();
  const { videoUrl, title } = state || {};

  return (
    <div className="video-player-page">
      <h1>{title}</h1>
      <video controls autoPlay src={videoUrl} style={{ width: '100%' }} />
    </div>
  );
};

export default VideoPlayerPage;