import React, { useState, useEffect } from 'react';

const SelectionResults = ({ selection, onBackToSelection }) => {
  const [showVideo, setShowVideo] = useState(false);

  // New mindfulness-based video mapping
  const videoMapping = {
    'hurry': {
      title: 'I eat in hurry',
      videoUrl: '/videos/hurry.mp4',
      // message: 'Based on your selection, here\'s a helpful video about slowing down and mindful eating habits.'
    },
    'mindfully': {
      title: 'I eat mindfully',
      videoUrl: '/videos/mindfully.mp4',
      // message: 'Based on your selection, here\'s a helpful video about maintaining mindful eating practices.'
    },
    'distracted': {
      title: 'I eat while distracted',
      videoUrl: '/videos/distracted.mp4',
      // message: 'Based on your selection, here\'s a helpful video about focused eating habits and avoiding distractions.'
    }
  };

  const currentVideo = videoMapping[selection];

  const handlePlayVideo = () => {
    setShowVideo(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Arial, sans-serif',
        padding: '15px',
        color: 'white',
        overflowY: 'auto',
        paddingTop: '30px',
      }}
    >
      {/* Congratulations Message - Mobile Optimized */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(15px)',
          borderRadius: '25px',
          padding: 'min(35px, 8vw)',
          textAlign: 'center',
          maxWidth: '90vw',
          width: '100%',
          marginBottom: '25px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* <div
          style={{
            fontSize: 'min(48px, 12vw)',
            marginBottom: '15px',
          }}
        >
          🎉
        </div>
        
        <h1
          style={{
            fontSize: 'min(28px, 7vw)',
            fontWeight: 'bold',
            margin: '0 0 15px 0',
            color: '#4CAF50',
          }}
        >
          Congratulations!
        </h1>
         */}
        <p
          style={{
            fontSize: 'min(18px, 4.5vw)',
            margin: '0 0 15px 0',
            lineHeight: '1.5',
          }}
        >
          Your selection was noted!
        </p>
        
        <div
          style={{
            background: 'rgba(76, 175, 80, 0.25)',
            border: '2px solid #4CAF50',
            borderRadius: '15px',
            padding: '12px 20px',
            fontSize: 'min(16px, 4vw)',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(76, 175, 80, 0.2)',
          }}
        >
          Selected: {selection}
        </div>
      </div>

      {/* Video Play Button Section */}
      {!showVideo && currentVideo && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            borderRadius: '25px',
            padding: 'min(25px, 6vw)',
            textAlign: 'center',
            maxWidth: '90vw',
            width: '100%',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            marginBottom: '25px',
          }}
        >
          <h3
            style={{
              fontSize: 'min(20px, 5vw)',
              margin: '0 0 15px 0',
              color: '#FFD700',
            }}
          >
            {currentVideo.title}
          </h3>
          
          <p
            style={{
              fontSize: 'min(14px, 3.5vw)',
              margin: '0 0 20px 0',
              opacity: 0.9,
              lineHeight: '1.4',
            }}
          >
            {currentVideo.message}
          </p>
          
          <button
            onClick={handlePlayVideo}
            style={{
              padding: '15px 30px',
              fontSize: 'min(18px, 4.5vw)',
              background: 'linear-gradient(45deg, #FF6B6B, #FF8E53)',
              color: 'white',
              border: 'none',
              borderRadius: '15px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              margin: '0 auto',
              boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)',
              transition: 'all 0.3s ease',
              touchAction: 'manipulation',
              userSelect: 'none',
            }}
            onTouchStart={(e) => {
              e.target.style.transform = 'scale(0.95)';
            }}
            onTouchEnd={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: '20px' }}>▶️</span>
            Play Video
          </button>
        </div>
      )}

      {/* Video Section - Mobile Optimized */}
      {showVideo && currentVideo && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            borderRadius: '25px',
            padding: 'min(25px, 6vw)',
            textAlign: 'center',
            maxWidth: '90vw',
            width: '100%',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
        >
          <h2
            style={{
              fontSize: 'min(22px, 5.5vw)',
              margin: '0 0 12px 0',
              color: '#FFD700',
            }}
          >
            {currentVideo.title}
          </h2>
          
          <p
            style={{
              fontSize: 'min(14px, 3.5vw)',
              margin: '0 0 18px 0',
              opacity: 0.9,
              lineHeight: '1.4',
            }}
          >
            {currentVideo.message}
          </p>
          
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '640px',
              margin: '0 auto',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            <video
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '15px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
              onError={(e) => {
                console.error('Video failed to load:', e);
                // Show fallback message if video fails to load
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
            >
              <source src={currentVideo.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            {/* Fallback message if video fails to load */}
            <div
              style={{
                display: 'none',
                padding: '40px',
                background: 'rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                fontSize: '16px',
              }}
            >
              <p>📹 Video: "{currentVideo.title}"</p>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>
                Video file not found. Please add the video file to the public/videos directory.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Previous Normal BMI selection section - commented out since we now use mindfulness categories */}
      {/* {selection === 'Normal' && (
        <div
          style={{
            background: 'rgba(76, 175, 80, 0.25)',
            border: '2px solid #4CAF50',
            borderRadius: '20px',
            padding: 'min(25px, 6vw)',
            textAlign: 'center',
            maxWidth: '90vw',
            width: '100%',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(76, 175, 80, 0.2)',
          }}
        >
          <div style={{ fontSize: 'min(32px, 8vw)', marginBottom: '12px' }}>✨</div>
          <h2
            style={{
              fontSize: 'min(22px, 5.5vw)',
              margin: '0 0 12px 0',
              color: '#4CAF50',
            }}
          >
            Excellent Choice!
          </h2>
          <p
            style={{
              fontSize: 'min(16px, 4vw)',
              margin: '0',
              lineHeight: '1.5',
            }}
          >
            You've selected the Normal BMI range. Keep up the great work with your healthy lifestyle!
          </p>
        </div>
      )} */}



      {/* Footer - Mobile Optimized */}
      <div
        style={{
          marginTop: '30px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: 'min(14px, 3.5vw)',
          opacity: 0.8,
          padding: '0 20px',
        }}
      >
        <p>Thank you for using our mindful eating selection system! 🧘</p>
      </div>
    </div>
  );
};

export default SelectionResults;
