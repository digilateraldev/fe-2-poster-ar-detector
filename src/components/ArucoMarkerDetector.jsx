import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const ArucoMarkerDetector = ({ onRegionDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [regionDetected, setRegionDetected] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [detectionKey, setDetectionKey] = useState(0);
  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);

  // Define the zones with their polygon coordinates
  const zones = {
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

  // Corner positions for marker alignment
  const cornerZones = {
    1: { x: 200, y: 50 },
    2: { x: 480, y: 50 },
    3: { x: 190, y: 450 },
    4: { x: 480, y: 450 },
  };

  const BUFFER = 170;

  useEffect(() => {
    if (!window.AR) {
      console.error("❌ ArUco not loaded. Make sure scripts are included in index.html");
      return;
    }

    const AR = window.AR;
    const detector = new AR.Detector();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      video.srcObject = stream;
      await video.play();
    };

    // Check if marker is in its expected corner position
    const isInCorner = (marker, id) => {
      const expected = cornerZones[id];
      if (!expected || !marker?.corners) return false;

      const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
      const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

      const inCorner =
        Math.abs(cx - expected.x) < BUFFER && Math.abs(cy - expected.y) < BUFFER;

      return inCorner;
    };

    // Check if poster is too far based on marker size
    const isPosterTooFar = (markers) => {
      if (markers.length === 0) return false;

      let totalSize = 0;
      let validMarkers = 0;

      for (const marker of markers) {
        const width = Math.hypot(
          marker.corners[1].x - marker.corners[0].x,
          marker.corners[1].y - marker.corners[0].y
        );
        const height = Math.hypot(
          marker.corners[3].x - marker.corners[0].x,
          marker.corners[3].y - marker.corners[0].y
        );
        const avgSize = (width + height) / 2;

        totalSize += avgSize;
        validMarkers++;
      }

      if (validMarkers === 0) return false;

      const averageMarkerSize = totalSize / validMarkers;
      const MIN_MARKER_SIZE = 60; // pixels - corresponds to ~2cm gap
      return averageMarkerSize < MIN_MARKER_SIZE;
    };

    // Point-in-polygon detection using ray casting algorithm
    const isPointInZone = (point, zone) => {
      const [x, y] = point;
      let inside = false;
      
      for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
        const [xi, yi] = zone[i];
        const [xj, yj] = zone[j];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      
      return inside;
    };

    // Function to determine region based on marker positions
    const detectHandRegion = (markers) => {
      const requiredIds = [2, 13, 6, 3];
      const foundMarkers = requiredIds.map(id => markers.find(m => m.id === id));
      
      if (foundMarkers.filter(Boolean).length >= 3) {
        const idMap = {};
        foundMarkers.forEach(m => {
          if (m) idMap[m.id] = m;
        });

        const corners = [];
        if (idMap[2]) corners.push(idMap[2].corners[2]);
        if (idMap[13]) corners.push(idMap[13].corners[3]);
        if (idMap[3]) corners.push(idMap[3].corners[0]);
        if (idMap[6]) corners.push(idMap[6].corners[1]);

        const xs = corners.map(corner => corner.x);
        const ys = corners.map(corner => corner.y);
        
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        
        // Scale the detected point from canvas size to 1517x2200 coordinate system
        const scaledX = (centerX / canvas.width) * 1517;
        const scaledY = (centerY / canvas.height) * 2200;
        
        let detectedRegionName = null;
        for (const [zoneName, zone] of Object.entries(zones)) {
          if (isPointInZone([scaledX, scaledY], zone)) {
            detectedRegionName = zoneName;
            break;
          }
        }
        
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          centerX: centerX,
          centerY: centerY,
          corners: corners,
          markers: foundMarkers,
          timestamp: Date.now(),
          regionName: detectedRegionName
        };
      }
      return null;
    };

    const process = () => {
      if (!video || video.readyState !== 4) {
        requestAnimationFrame(process);
        return;
      }

      // Set stable canvas size
      const maxWidth = 320;
      const maxHeight = 480;
      
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      
      // Calculate how to fit the video into the portrait canvas
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const canvasAspectRatio = maxWidth / maxHeight;
      
      let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
      
      // Crop video to fit portrait canvas
      if (videoAspectRatio > canvasAspectRatio) {
        sourceWidth = video.videoHeight * canvasAspectRatio;
        sourceX = (video.videoWidth - sourceWidth) / 2;
      } else {
        sourceHeight = video.videoWidth / canvasAspectRatio;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }
      
      context.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, maxWidth, maxHeight
      );
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const markers = detector.detect(imageData);

      // Check if poster is too far away
      const posterTooFar = isPosterTooFar(markers);
      if (posterTooFar) {
        setWarningMessage("📏 Poster is too far away. Move camera closer!");
        requestAnimationFrame(process);
        return;
      }

      // Raw IDs (all detected markers)
      const detectedIds = markers.map((m) => m.id).sort();

      const matchedMarkers = markers.filter((marker) =>
        isInCorner(marker, marker.id)
      );
      const matchedIds = matchedMarkers.map((m) => m.id).sort();

      // Alignment logic
      if (!hasBeenAligned.current && matchedIds.length === 4) {
        hasBeenAligned.current = true;
        setWarningMessage("Poster aligned!");
      }

      const visible = hasBeenAligned.current
        ? matchedIds.length >= 3
        : matchedIds.length === 4;

      if (matchedIds.length > 0) {
        setWarningMessage(`Markers visible: ${matchedIds.join(", ")}`);
      } else {
        setWarningMessage("No markers detected");
      }

      if (visible) {
        const requiredIds = [2, 13, 6, 3];
        const foundMarkers = markers.filter(m => requiredIds.includes(m.id));

        if (foundMarkers.length >= 3) {
          const region = detectHandRegion(markers);
          if (region && region.regionName) {
            setDetectedRegion(region);
            setRegionDetected(true);
            
            toast.success(`${region.regionName.charAt(0).toUpperCase() + region.regionName.slice(1)} region detected! Choose your action.`, {
              duration: 6000,
              id: "region-detected"
            });
          }
        }
      } else {
        setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
      }

      // Draw markers
      context.strokeStyle = 'lime';
      context.lineWidth = 3;
      markers.forEach(marker => {
        context.beginPath();
        marker.corners.forEach((corner, i) => {
          if (i === 0) context.moveTo(corner.x, corner.y);
          else context.lineTo(corner.x, corner.y);
        });
        context.closePath();
        context.stroke();
      });

      requestAnimationFrame(process);
    };

    startCamera().then(() => {
      requestAnimationFrame(process);
    });

    return () => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [detectionKey]);

  const handleSubmit = () => {
    if (detectedRegion && onRegionDetected) {
      onRegionDetected(detectedRegion);
    }
  };

  const handleRetry = () => {
    setRegionDetected(false);
    setDetectedRegion(null);
    toast.dismiss("region-detected");
    setDetectionKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col items-center p-4 w-full max-w-sm mx-auto">
      {!regionDetected ? (
        <div className="relative w-full">
          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas 
            ref={canvasRef} 
            className="w-full h-[400px] rounded-lg border-2 border-gray-300 shadow-md"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-2">
            <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs text-center">
              {warningMessage || "Keep the poster aligned"}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-green-800 font-medium text-sm">Region detected successfully!</p>
            <p className="text-green-600 text-xs mt-1">Choose your action below</p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmit}
              className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Submit
            </button>
            <button
              onClick={handleRetry}
              className="w-full px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArucoMarkerDetector;


// import React, { useEffect, useRef, useState } from 'react';
// import { toast } from 'react-hot-toast';

// const ArucoMarkerDetector = ({ onRegionDetected }) => {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const [regionDetected, setRegionDetected] = useState(false);
//   const [detectedRegion, setDetectedRegion] = useState(null);
//   const [detectionKey, setDetectionKey] = useState(0); // Key to force remount

//   useEffect(() => {
//     if (!window.AR) {
//       console.error("❌ ArUco not loaded. Make sure scripts are included in index.html");
//       return;
//     }

//     const AR = window.AR;
//     const detector = new AR.Detector();

//     const video = videoRef.current;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d', { willReadFrequently: true });

//     const startCamera = async () => {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
//       video.srcObject = stream;
//       await video.play();
//     };

//     // Region polygon coordinates (testing with different scaling)
//     // Let's try scaling based on the actual detection points we're seeing
//     // Detection points are around [194, centerY] so let's adjust scaling
//     const scaleX = 320 / 1920; // Original assumption
//     const scaleY = 400 / 2400; // Original assumption
    
//     // Proper scaling based on detected point analysis
//     // Detected points are around [175, 205] on 320x400 canvas
//     // Original coordinates range from ~80-1600 (X) and ~650-2200 (Y)
//     // Let's scale to fit the canvas properly
//     const altScaleX = 320 / 1700; // Scale X coordinates to fit 320 width
//     const altScaleY = 400 / 2200; // Scale Y coordinates to fit 400 height
    
//     const originalRegionPolygons = {
//       distracted: [
//         [703, 671],
//         [1622, 652],
//         [1628, 1312],
//         [823, 1328],
//       ],
//       hurry: [
//         [82, 1125],
//         [748, 1133],
//         [740, 1850],
//         [66, 1860],
//       ],
//       mindfully: [
//         [852, 1534],
//         [1620, 1531],
//         [1633, 2186],
//         [802, 2192],
//       ],
//     };
    
//     // Scale coordinates to match our 320x400 canvas
//     const regionPolygons = {};
//     for (const [regionName, polygon] of Object.entries(originalRegionPolygons)) {
//       regionPolygons[regionName] = polygon.map(([x, y]) => [
//         Math.round(x * altScaleX), // Using no scaling for testing
//         Math.round(y * altScaleY)  // Using no scaling for testing
//       ]);
//     }
    
//     console.log('=== ALL SCALED POLYGONS ===');
//     console.log('Distracted:', JSON.stringify(regionPolygons.distracted));
//     console.log('Hurry:', JSON.stringify(regionPolygons.hurry));
//     console.log('Mindfully:', JSON.stringify(regionPolygons.mindfully));
//     console.log('===============================');

//     // Point-in-polygon detection using ray casting algorithm
//     const isPointInPolygon = (point, polygon) => {
//       const [x, y] = point;
//       let inside = false;
      
//       for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
//         const [xi, yi] = polygon[i];
//         const [xj, yj] = polygon[j];
        
//         if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
//           inside = !inside;
//         }
//       }
      
//       return inside;
//     };

//     // Function to determine region based on detection data
//     // Following BMI-withVideo.jsx approach: scale detected point UP to 1517x2200
//     const determineRegionFromPoint = (centerX, centerY, canvasWidth, canvasHeight) => {
//       // Scale the detected point from actual canvas size to 1517x2200 coordinate system
//       const scaledX = (centerX / canvasWidth) * 1517;
//       const scaledY = (centerY / canvasHeight) * 2200;
//       const scaledPoint = [scaledX, scaledY];
      
//       console.log('=== REGION DETECTION DEBUG ===');
//       console.log(`Original detected point (${canvasWidth}x${canvasHeight}):`, [centerX, centerY]);
//       console.log('Scaled point (1517x2200):', scaledPoint);
//       console.log(`Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
      
//       // Check regions in order of specificity (smaller/more specific regions first)
//       const regionOrder = ['mindfully', 'hurry', 'distracted'];
      
//       for (const regionName of regionOrder) {
//         const zone = originalRegionPolygons[regionName];
//         console.log(`Checking ${regionName} zone:`, JSON.stringify(zone));
//         const isInside = isPointInPolygon(scaledPoint, zone);
//         console.log(`Point in ${regionName}:`, isInside);
        
//         if (isInside) {
//           console.log(`✅ Point [${scaledPoint}] detected in ${regionName} region`);
//           return regionName;
//         }
//       }
      
//       console.log(`❌ Point [${scaledPoint}] not in any defined region`);
//       return null; // no region detected
//     };

//     const detectHandRegion = (markers, canvasWidth, canvasHeight) => {
//       const requiredIds = [2, 13, 6, 3];
//       const foundMarkers = requiredIds.map(id => markers.find(m => m.id === id));
      
//       if (foundMarkers.filter(Boolean).length >= 3) {
//         const idMap = {};
//         foundMarkers.forEach(m => {
//           if (m) idMap[m.id] = m;
//         });

//         const corners = [];
//         if (idMap[2]) corners.push(idMap[2].corners[2]);
//         if (idMap[13]) corners.push(idMap[13].corners[3]);
//         if (idMap[3]) corners.push(idMap[3].corners[0]);
//         if (idMap[6]) corners.push(idMap[6].corners[1]);

//         const xs = corners.map(corner => corner.x);
//         const ys = corners.map(corner => corner.y);
        
//         const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
//         const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        
//         // Determine which region this point falls into using dynamic canvas dimensions
//         const detectedRegionName = determineRegionFromPoint(centerX, centerY, canvasWidth, canvasHeight);
        
//         return {
//           minX: Math.min(...xs),
//           maxX: Math.max(...xs),
//           minY: Math.min(...ys),
//           maxY: Math.max(...ys),
//           centerX: centerX,
//           centerY: centerY,
//           corners: corners,
//           markers: foundMarkers, // Add the markers array for DocumentScanner
//           timestamp: Date.now(),
//           regionName: detectedRegionName // Add the detected region name
//         };
//       }
//       return null;
//     };

//     let processed = false;

//     const process = () => {
//       if (!video || video.readyState !== 4) {
//         requestAnimationFrame(process);
//         return;
//       }

//       // Use fixed portrait dimensions to prevent scrollbars
//       // Set stable canvas size that fits in viewport
//       const maxWidth = 320;
//       const maxHeight = 480; // Portrait aspect ratio (2:3)
      
//       canvas.width = maxWidth;
//       canvas.height = maxHeight;
      
//       // Calculate how to fit the video into the portrait canvas
//       const videoAspectRatio = video.videoWidth / video.videoHeight;
//       const canvasAspectRatio = maxWidth / maxHeight;
      
//       let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
      
//       // Crop video to fit portrait canvas while maintaining aspect ratio
//       if (videoAspectRatio > canvasAspectRatio) {
//         // Video is wider than canvas - crop sides
//         sourceWidth = video.videoHeight * canvasAspectRatio;
//         sourceX = (video.videoWidth - sourceWidth) / 2;
//       } else {
//         // Video is taller than canvas - crop top/bottom
//         sourceHeight = video.videoWidth / canvasAspectRatio;
//         sourceY = (video.videoHeight - sourceHeight) / 2;
//       }
      
//       context.drawImage(
//         video,
//         sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle (cropped)
//         0, 0, maxWidth, maxHeight // Destination rectangle (full canvas)
//       );
//       const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
//       const markers = detector.detect(imageData);

//       const requiredIds = [2, 13, 6, 3];
//       const foundMarkers = markers.filter(m => requiredIds.includes(m.id));

//       if (foundMarkers.length >= 3 && !processed) {
//         console.log("✅ Markers detected:", foundMarkers.map(m => m.id).join(', '));
//         console.log(`📐 Canvas dimensions: ${canvas.width}x${canvas.height}`);
//         processed = true;

//         const region = detectHandRegion(foundMarkers, canvas.width, canvas.height);
//         if (region) {
//           setDetectedRegion(region);
//           setRegionDetected(true);
          
//           if (region.regionName) {
//             toast.success(`${region.regionName.charAt(0).toUpperCase() + region.regionName.slice(1)} region detected! Choose your action.`, {
//               duration: 6000,
//               id: "region-detected"
//             });
//           } else {
//             toast.error("Markers detected but no region identified. Choose your action.", {
//               duration: 6000,
//               id: "region-detected"
//             });
//           }
//         }
//       }

//       // Draw markers
//       context.strokeStyle = 'lime';
//       context.lineWidth = 3;
//       foundMarkers.forEach(marker => {
//         context.beginPath();
//         marker.corners.forEach((corner, i) => {
//           if (i === 0) context.moveTo(corner.x, corner.y);
//           else context.lineTo(corner.x, corner.y);
//         });
//         context.closePath();
//         context.stroke();
//       });

//       if (!processed) {
//         requestAnimationFrame(process);
//       }
//     };

//     startCamera().then(() => {
//       requestAnimationFrame(process);
//     });

//     return () => {
//       const stream = video.srcObject;
//       if (stream) {
//         stream.getTracks().forEach(track => track.stop());
//       }
//     };
//   }, [detectionKey]); // Re-run effect when detectionKey changes

//   const handleSubmit = () => {
//     if (detectedRegion && onRegionDetected) {
//       onRegionDetected(detectedRegion);
//     }
//   };

//   const handleRetry = () => {
//     setRegionDetected(false);
//     setDetectedRegion(null);
//     toast.dismiss("region-detected");
    
//     // Force component remount by changing the key
//     // This will restart the entire detection process cleanly
//     setDetectionKey(prev => prev + 1);
//   };

//   return (
//     <div className="flex flex-col items-center p-4 w-full max-w-sm mx-auto">
//       {/* <h1 className="text-xl font-bold text-gray-800 mb-4">ArUco Hand Detection</h1> */}
      
//       {!regionDetected ? (
//         <div className="relative w-full">
//           <video ref={videoRef} style={{ display: 'none' }} />
//           <canvas 
//             ref={canvasRef} 
//             className="w-full h-[400px] rounded-lg border-2 border-gray-300 shadow-md"
//           />
//           <div className="absolute bottom-4 left-0 right-0 flex justify-center px-2">
//             <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs text-center">
//              Keep the poster aligned
//             </div>
//           </div>
//         </div>
//       ) : (
//         <div className="w-full">
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
//             <p className="text-green-800 font-medium text-sm">Region detected successfully!</p>
//             <p className="text-green-600 text-xs mt-1">Choose your action below</p>
//           </div>
          
//           <div className="flex flex-col gap-3">
//             <button
//               onClick={handleSubmit}
//               className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
//             >
//               Submit
//             </button>
//             <button
//               onClick={handleRetry}
//               className="w-full px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors text-sm"
//             >
//               Retry
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ArucoMarkerDetector;
