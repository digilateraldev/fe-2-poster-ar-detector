import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DocumentScanner from './components/DocumentScanner';
import VideoDisplay from './components/VideoDisplay';
import RegionDetection from './components/RegionDetection';
import BMISelectionApp from './components/BMISelectionApp';
import BMIPointerRobust from './components/BMI-withVideo';
import './App.css';

// Main App component with state management for detection flow
function MainApp() {
  const [currentView, setCurrentView] = useState('detection'); // 'detection' or 'video'
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedZoneInfo, setSelectedZoneInfo] = useState(null);
  const [currentlyDetectedZone, setCurrentlyDetectedZone] = useState(null);

  // Real-time zone detection callback (updates immediately)
  const handleZoneDetected = (zoneName, zoneInfo) => {
    console.log('Zone detected in real-time:', zoneName, zoneInfo);
    setCurrentlyDetectedZone(zoneName);
  };

  // Video request callback (when user clicks submit)
  const handleVideoRequested = (zoneName, zoneInfo) => {
    console.log('Video requested for zone:', zoneName, zoneInfo);
    setSelectedZone(zoneName);
    setSelectedZoneInfo(zoneInfo);
    setCurrentView('video');
  };

  const handleRetry = () => {
    setSelectedZone(null);
    setSelectedZoneInfo(null);
    setCurrentlyDetectedZone(null);
    setCurrentView('detection');
  };

  const handleClose = () => {
    setSelectedZone(null);
    setSelectedZoneInfo(null);
    setCurrentlyDetectedZone(null);
    setCurrentView('detection');
  };

  return (
    <div className="App">
      {currentView === 'detection' ? (
        <RegionDetection 
          onZoneDetected={handleZoneDetected}
          onVideoRequested={handleVideoRequested}
          onRetry={handleRetry}
        />
      ) : (
        <VideoDisplay 
          zoneName={selectedZone}
          zoneInfo={selectedZoneInfo}
          onRetry={handleRetry}
          onClose={handleClose}
        />
      )}
      
      {/* Debug info for currently detected zone */}
      {currentView === 'detection' && currentlyDetectedZone && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          Currently Detected: {currentlyDetectedZone}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              theme: {
                primary: 'green',
                secondary: 'black',
              },
            },
          }}
        />
        
        <Routes>
          {/* Main region detection workflow */}
          <Route path="/" element={<MainApp />} />
          
          {/* Legacy ArUco detection workflow routes */}
          <Route path="/scan/:qrId" element={<DocumentScanner />} />
          <Route path="/video/:qrId" element={<VideoDisplay />} />
          
          {/* Legacy/development routes */}
          <Route path="/bmi-selection" element={<BMISelectionApp />} />
          <Route path="/bmi-robust" element={<BMIPointerRobust />} />
          
          {/* 404 fallback */}
          <Route 
            path="*" 
            element={
              <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800 px-4">
                <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
                <p className="text-lg mb-6 text-center">
                  Sorry, the page you are looking for does not exist.
                </p>
                <a
                  href="/"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md shadow hover:bg-blue-700 transition"
                >
                  Go to Detection
                </a>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App
