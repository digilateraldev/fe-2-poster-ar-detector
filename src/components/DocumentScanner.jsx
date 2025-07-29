import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { deviceIdManager, apiUtils } from '../utils/deviceId';
import ArucoMarkerDetector from './ArucoMarkerDetector';

const DocumentScanner = () => {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegionDetected = async (detectedRegion) => {
    setIsSubmitting(true);
    
    try {
      // Get device ID from cookies
      const deviceId = deviceIdManager.getDeviceId();
      
      // Store detection data locally for the video page
      localStorage.setItem(`detection_${qrId}`, JSON.stringify(detectedRegion));
      
      // Prepare data for backend API - backend expects qrId and selection
      const detectionData = {
        qrId: qrId,
        selection: detectedRegion.regionName || 'unknown', // Backend expects 'selection' field
        deviceId: deviceId,
        // Additional data for internal use
        markers: detectedRegion.markers,
        region: {
          minX: detectedRegion.minX,
          maxX: detectedRegion.maxX,
          minY: detectedRegion.minY,
          maxY: detectedRegion.maxY,
          width: detectedRegion.maxX - detectedRegion.minX,
          height: detectedRegion.maxY - detectedRegion.minY,
          centerX: (detectedRegion.maxX + detectedRegion.minX) / 2,
          centerY: (detectedRegion.maxY + detectedRegion.minY) / 2
        },
        timestamp: detectedRegion.timestamp,
        markersCount: detectedRegion.markers.length
      };

      // Call backend API to store the detection using apiUtils
      try {
        // Using apiUtils which automatically includes device ID in headers and body
        const response = await apiUtils.post('/selection/store', detectionData);
        console.log('Detection stored successfully:', response);
        
        toast.success("Detection stored successfully!", {
          duration: 3000,
          id: "detection-stored"
        });

        // Navigate to video display page
        navigate(`/video/${qrId}`);
        
      } catch (apiError) {
        console.error('API call failed:', apiError);
        toast.error("Failed to store detection. Please try again.");
      }
      
    } catch (error) {
      console.error('Error handling region detection:', error);
      toast.error("Error processing detection. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-lg">Storing your detection...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait while we process your data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* <div>
              <h1 className="text-2xl font-bold text-gray-800">Document Scanner</h1>
              <p className="text-gray-600 mt-1">QR ID: {qrId}</p>
            </div>
            <div className="text-sm text-gray-500">
              Step 1 of 2: Detect Region
            </div> */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-6">
        <ArucoMarkerDetector onRegionDetected={handleRegionDetected} />
      </div>

      {/* Footer Instructions */}
      <div className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              {/* <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-blue-600 font-bold text-lg">1</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Position Markers</h3>
              <p className="text-gray-600 text-sm">Show at least 3 ArUco markers in the camera view</p> */}
            </div>
            <div className="flex flex-col items-center">
              {/* <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-green-600 font-bold text-lg">2</span>
              </div> */}
              {/* <h3 className="text-gray-800 mb-2">Detect Region</h3>
              <p className="text-gray-600 text-sm">System will detect your hand/fingertip region automatically</p> */}
            </div>
            <div className="flex flex-col items-center">
              {/* <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-purple-600 font-bold text-lg">3</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Submit & View</h3>
              <p className="text-gray-600 text-sm">Confirm detection and view your personalized video content</p> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentScanner;
