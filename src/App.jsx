import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DocumentScanner from './components/DocumentScanner';
import VideoDisplay from './components/VideoDisplay';
import BMISelectionApp from './components/BMISelectionApp';
import BMIPointerRobust from './components/BMI-withVideo';
import './App.css';

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
          {/* Main ArUco detection workflow routes */}
          <Route path="/scan/:qrId" element={<DocumentScanner />} />
          <Route path="/video/:qrId" element={<VideoDisplay />} />
          
          {/* Legacy/development routes */}
          <Route path="/bmi-selection" element={<BMISelectionApp />} />
          <Route path="/bmi-robust" element={<BMIPointerRobust />} />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/scan/demo-qr-123" replace />} />
          
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
                  Go to Scanner
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
