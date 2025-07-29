import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const VideoDisplay = ({ zoneName, zoneInfo, onRetry, onClose }) => {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  useEffect(() => {
    if (zoneName && zoneInfo) {
      console.log('VideoDisplay received:', { zoneName, zoneInfo });
      setLoading(false);
      
      // Auto-play video when component loads
      if (videoRef.current) {
        videoRef.current.src = zoneInfo.videoUrl;
        videoRef.current.load();
        videoRef.current.play().catch(e => console.error("Video play error:", e));
      }
    } else {
      setError("No zone information provided");
      setLoading(false);
    }
  }, [zoneName, zoneInfo]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Detection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
                {zoneInfo?.title || 'Detection Result'}
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                Watch your personalized video below
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs sm:text-sm text-blue-200">Zone</div>
              <div className="font-mono text-sm sm:text-base">{zoneName}</div>
            </div>
          </div>
        </div>

        {/* Detection Summary */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          {/* <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Detection Summary</h2> */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
              <div className="text-blue-800 font-medium text-sm sm:text-base">QR Code ID</div>
              <div className="text-blue-600 text-base sm:text-lg font-semibold">{qrId}</div>
            </div> */}
            <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
              <div className="text-green-800 font-medium text-sm sm:text-base">Selected Region</div>
              <div className="text-green-600 text-base sm:text-lg font-semibold capitalize">{selectedRegion || 'Loading...'}</div>
            </div>
            {/* <div className="bg-purple-50 p-3 sm:p-4 rounded-lg sm:col-span-2 lg:col-span-1">
              <div className="text-purple-800 font-medium text-sm sm:text-base">Detection Time</div>
              <div className="text-purple-600 text-base sm:text-lg font-semibold">
                {videoData?.timestamp ? new Date(videoData.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div> */}
          </div>
        </div>

        {/* Video Content Area */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
          {/* <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Video Content</h2> */}
          
          {/* Responsive video container */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            {zoneName && zoneInfo?.videoUrl ? (
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                controls
                autoPlay
                onError={(e) => {
                  console.error('Video error:', e);
                  setError('Failed to load video');
                }}
              >
                <source src={zoneInfo.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white p-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl mb-2 sm:mb-4">⚠️</div>
                  <div className="text-sm sm:text-lg mb-1 sm:mb-2">No Video Available</div>
                  <div className="text-xs sm:text-sm text-gray-300 mb-2">
                    Unable to load video for the selected zone
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Region Details */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Detected Markers</h3>
              <div className="space-y-2">
                {videoData?.markers?.filter(marker => marker != null).map((marker, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-medium">Marker ID: {marker.id}</div>
                      <div className="text-sm text-gray-600">
                        Position: ({Math.round(marker.corners?.[0]?.x || 0)}, {Math.round(marker.corners?.[0]?.y || 0)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div> */}

            {/* <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Region Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Width:</span>
                  <span className="font-medium">{Math.round(videoData?.maxX - videoData?.minX || 0)} px</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Height:</span>
                  <span className="font-medium">{Math.round(videoData?.maxY - videoData?.minY || 0)} px</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Center X:</span>
                  <span className="font-medium">{Math.round((videoData?.maxX + videoData?.minX) / 2 || 0)} px</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Center Y:</span>
                  <span className="font-medium">{Math.round((videoData?.maxY + videoData?.minY) / 2 || 0)} px</span>
                </div>
              </div>
            </div> */}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => toast.success("Video shared successfully!")}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Share Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDisplay;
