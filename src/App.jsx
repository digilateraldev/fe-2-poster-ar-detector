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
  const [debugInfo, setDebugInfo] = useState([]);

  // Real-time zone detection callback (updates immediately)
  const handleZoneDetected = (zoneName, zoneInfo) => {
    console.log('Zone detected in real-time:', zoneName, zoneInfo);
    setCurrentlyDetectedZone(zoneName);
  };

  // Video request callback (when user clicks submit)
  const handleVideoRequested = (zoneName, zoneInfo) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, 
      `${timestamp}: 🎬 Video requested for zone: ${zoneName}`,
      `${timestamp}: 🔄 Setting selectedZone to: ${zoneName}`,
      `${timestamp}: 🔄 Setting currentView to: video`
    ]);
    
    console.log('🎬 Video requested for zone:', zoneName, zoneInfo);
    console.log('🔄 Setting selectedZone to:', zoneName);
    console.log('🔄 Setting selectedZoneInfo to:', zoneInfo);
    console.log('🔄 Setting currentView to: video');
    
    setSelectedZone(zoneName);
    setSelectedZoneInfo(zoneInfo);
    setCurrentView('video');
    
    console.log('✅ State update calls completed');
  };

  const handleRetry = () => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `${timestamp}: 🔄 Retry clicked - returning to detection`]);
    setSelectedZone(null);
    setSelectedZoneInfo(null);
    setCurrentlyDetectedZone(null);
    setCurrentView('detection');
  };

  const handleClose = () => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `${timestamp}: ❌ Close clicked - returning to detection`]);
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
      
      {/* Visual Debug Panel */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 1000,
        fontFamily: 'monospace'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
           Debug Info (Current View: {currentView})
        </div>
        <div style={{ marginBottom: '5px' }}>
          Selected Zone: {selectedZone || 'None'} | 
          Zone Info: {selectedZoneInfo ? 'Yes' : 'No'}
        </div>
        {debugInfo.slice(-5).map((info, index) => (
          <div key={index} style={{ fontSize: '11px', opacity: 0.8 }}>
            {info}
          </div>
        ))}
        <button 
          onClick={() => setDebugInfo([])} 
          style={{
            marginTop: '5px',
            padding: '2px 6px',
            fontSize: '10px',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '3px'
          }}
        >
          Clear
        </button>
      </div>
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
