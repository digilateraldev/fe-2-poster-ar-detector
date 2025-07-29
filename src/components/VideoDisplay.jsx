import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const VideoDisplay = () => {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // Video mapping based on region selection
  const videoMapping = {
    hurry: '/videos/hurry.mp4',
    distracted: '/videos/distracted.mp4',
    mindfully: '/videos/mindfully.mp4'
  };

  // Region polygon coordinates
  const regionPolygons = {
    distracted: [
      [703, 671],
      [1622, 652],
      [1628, 1312],
      [823, 1328],
    ],
    hurry: [
      [82, 1125],
      [748, 1133],
      [740, 1850],
      [66, 1860],
    ],
    mindfully: [
      [852, 1534],
      [1620, 1531],
      [1633, 2186],
      [802, 2192],
    ],
  };

  // Point-in-polygon detection using ray casting algorithm
  const isPointInPolygon = (point, polygon) => {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  };

  // Function to determine region based on detection data
  const determineRegion = (detectionData) => {
    const { region } = detectionData;
    
    if (region && region.centerX !== undefined && region.centerY !== undefined) {
      const detectedPoint = [region.centerX, region.centerY];
      
      // Check each region polygon
      for (const [regionName, polygon] of Object.entries(regionPolygons)) {
        if (isPointInPolygon(detectedPoint, polygon)) {
          console.log(`Point [${detectedPoint}] detected in ${regionName} region`);
          return regionName;
        }
      }
      
      console.log(`Point [${detectedPoint}] not in any defined region`);
    }
    
    // return 'mindfully'; // default - commented out as requested
    return null; // no region detected
  };

  useEffect(() => {
    // Get detection data from localStorage or sessionStorage
    const detectionData = localStorage.getItem(`detection_${qrId}`);
    
    if (!detectionData) {
      toast.error("No detection data found. Please scan again.");
      navigate(`/scan/${qrId}`);
      return;
    }

    try {
      const parsedData = JSON.parse(detectionData);
      setVideoData(parsedData);
      
      // Determine which region/video to show
      const region = determineRegion(parsedData);
      setSelectedRegion(region);
      
      console.log('Detection data:', parsedData);
      console.log('Scaled region polygons:', regionPolygons);
      console.log('VideoDisplay scaling factors - scaleX:', 1, 'scaleY:', 1);
      console.log('Video path:', region ? videoMapping[region] : 'No region detected');
      
      // Debug: Show center point used for detection
      if (parsedData.region) {
        console.log('Center point used for detection:', [parsedData.region.centerX, parsedData.region.centerY]);
      }
      
      // Check if regionName is already in the data (from ArUco detector)
      if (parsedData.regionName) {
        console.log('Region already detected in ArUco detector:', parsedData.regionName);
        setSelectedRegion(parsedData.regionName);
        setLoading(false);
        return;
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error parsing detection data:", error);
      setError("Invalid detection data");
      setLoading(false);
    }
  }, [qrId, navigate]);

  const handleReturnToScan = () => {
    // Clear stored detection data
    localStorage.removeItem(`detection_${qrId}`);
    navigate(`/scan/${qrId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-lg">Loading video content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-red-600 text-xl mb-4">Error: {error}</div>
        <button
          onClick={handleReturnToScan}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Return to Scanner
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        {/* <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Video Content</h1>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Based on your detected region</p>
            </div>
            <button
              onClick={handleReturnToScan}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base self-start sm:self-auto"
            >
              ← Back to Scanner
            </button>
          </div>
        </div> */}

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
          <div className="relative bg-black rounded-lg overflow-hidden w-full max-w-full">
            {/* Mobile-first responsive aspect ratio with explicit constraints */}
            <div className="aspect-video w-full max-w-full relative">
              {selectedRegion ? (
                <video 
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                  muted
                  playsInline
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    width: '100%',
                    height: '100%'
                  }}
                  key={selectedRegion} // Force re-render when region changes
                >
                  <source src={videoMapping[selectedRegion]} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white p-4">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl mb-2 sm:mb-4">⚠️</div>
                    <div className="text-sm sm:text-lg mb-1 sm:mb-2">No Region Detected</div>
                    <div className="text-xs sm:text-sm text-gray-300 mb-2">
                      The detected point is not within any defined region boundaries
                    </div>
                    <div className="text-xs text-gray-400">
                      Detection area: {Math.round(videoData?.maxX - videoData?.minX || 0)} × {Math.round(videoData?.maxY - videoData?.minY || 0)} px
                    </div>
                  </div>
                </div>
              )}
            </div>
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
          {/* <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={handleReturnToScan}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Scan New Region
            </button>
            <button
              onClick={() => toast.success("Video shared successfully!")}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Share Video
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default VideoDisplay;
