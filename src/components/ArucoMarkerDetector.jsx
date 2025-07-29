import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Hands } from '@mediapipe/hands';

const ArucoMarkerDetector = ({ onRegionDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionCanvasRef = useRef(null);
  const [regionDetected, setRegionDetected] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [detectionKey, setDetectionKey] = useState(0); // Key to force remount
  const [detectionMode, setDetectionMode] = useState('hand'); // 'hand' or 'fingertip'
  const [posterInView, setPosterInView] = useState(false);
  const [warningMessage, setWarningMessage] = useState('Initializing...');
  
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);

  // Corner zones for ArUco marker alignment
  const cornerZones = {
    2: { x: 200, y: 50 },
    13: { x: 480, y: 50 },
    6: { x: 190, y: 450 },
    3: { x: 480, y: 450 },
  };

  const BUFFER = 170;

  // Check if marker is in expected corner position
  const isInCorner = (marker, id) => {
    const expected = cornerZones[id];
    if (!expected || !marker?.corners) return false;

    const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
    const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

    const inCorner =
      Math.abs(cx - expected.x) < BUFFER &&
      Math.abs(cy - expected.y) < BUFFER;

    console.log(`Marker ${id} center: (${Math.round(cx)}, ${Math.round(cy)}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`);

    return inCorner;
  };

  // RGB to HSV conversion function
  const rgbToHsv = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    let s = 0;
    const v = max;
    
    if (diff !== 0) {
      s = diff / max;
      
      switch (max) {
        case r:
          h = ((g - b) / diff) % 6;
          break;
        case g:
          h = (b - r) / diff + 2;
          break;
        case b:
          h = (r - g) / diff + 4;
          break;
      }
      h = h * 60;
      if (h < 0) h += 360;
    }
    
    return [h, s, v];
  };

  // Fingertip detection using contours (adapted from Python code)
  const detectFingertipFromContours = (imageData, width, height) => {
    try {
      const canvas = detectionCanvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      
      // Put image data on canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Get pixel data
      const data = imageData.data;
      const skinMask = new Uint8ClampedArray(width * height);
      
      // HSV skin color detection (matching Python implementation)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255.0;
        const g = data[i + 1] / 255.0;
        const b = data[i + 2] / 255.0;
        
        // Convert RGB to HSV
        const hsv = rgbToHsv(r, g, b);
        const h = hsv[0];
        const s = hsv[1];
        const v = hsv[2];
        
        // HSV skin color range (from Python: lower=[0,48,80], upper=[20,255,255])
        const isSkin = (h >= 0 && h <= 20) && 
                      (s >= 48/255 && s <= 1.0) && 
                      (v >= 80/255 && v <= 1.0);
        
        skinMask[Math.floor(i / 4)] = isSkin ? 255 : 0;
      }
      
      // Find contours (simplified approach)
      const contours = findContours(skinMask, width, height);
      
      if (contours.length === 0) return null;
      
      // Find largest contour
      let largestContour = contours[0];
      let maxArea = contourArea(largestContour);
      
      for (let i = 1; i < contours.length; i++) {
        const area = contourArea(contours[i]);
        if (area > maxArea && area > 500) { // Minimum area threshold
          maxArea = area;
          largestContour = contours[i];
        }
      }
      
      if (maxArea < 500) return null;
      
      // Find topmost point (fingertip)
      let topmost = largestContour[0];
      for (const point of largestContour) {
        if (point.y < topmost.y) {
          topmost = point;
        }
      }
      
      return {
        x: topmost.x / width * 1517,
        y: topmost.y / height * 2200
      };
      
    } catch (error) {
      console.error("Fingertip detection error:", error);
      return null;
    }
  };

  // Simplified contour finding
  const findContours = (mask, width, height) => {
    const contours = [];
    const visited = new Array(width * height).fill(false);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx] === 255 && !visited[idx]) {
          const contour = traceContour(mask, width, height, x, y, visited);
          if (contour.length > 10) { // Minimum contour size
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  };

  // Simple contour tracing
  const traceContour = (mask, width, height, startX, startY, visited) => {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || mask[idx] !== 255) {
        continue;
      }
      
      visited[idx] = true;
      contour.push({x, y});
      
      // Add 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }
    
    return contour;
  };

  const contourArea = (contour) => {
    if (contour.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    return Math.abs(area) / 2;
  };

  // Point-in-polygon detection for zones
  const isPointInZone = (point, zone) => {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
      const [xi, yi] = zone[i];
      const [xj, yj] = zone[j];
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

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
      let stream = null;
      let constraints = { video: { facingMode: { exact: 'environment' } } };

      try {
        console.log('Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Camera access granted with rear camera');
      } catch (err) {
        console.log('Rear camera failed, trying ideal environment...');
        constraints.video.facingMode = { ideal: 'environment' };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Camera access granted with ideal environment');
        } catch (err2) {
          console.log('Environment camera failed, trying any camera...');
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log('Camera access granted with any camera');
        }
      }

      if (video) {
        video.srcObject = stream;
        console.log('Video stream assigned to video element');
      }

      return new Promise((resolve) => {
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            console.log('Video started successfully');
            resolve(video);
          } catch (error) {
            console.error('Error starting video:', error);
            resolve(video);
          }
        };
      });
    };

    // Region polygon coordinates (testing with different scaling)
    // Let's try scaling based on the actual detection points we're seeing
    // Detection points are around [194, centerY] so let's adjust scaling
    const scaleX = 320 / 1920; // Original assumption
    const scaleY = 400 / 2400; // Original assumption
    
    // Proper scaling based on detected point analysis
    // Detected points are around [175, 205] on 320x400 canvas
    // Original coordinates range from ~80-1600 (X) and ~650-2200 (Y)
    // Let's scale to fit the canvas properly
    const altScaleX = 320 / 1700; // Scale X coordinates to fit 320 width
    const altScaleY = 400 / 2200; // Scale Y coordinates to fit 400 height
    
    const originalRegionPolygons = {
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
    
    // Scale coordinates to match our 320x400 canvas
    const regionPolygons = {};
    for (const [regionName, polygon] of Object.entries(originalRegionPolygons)) {
      regionPolygons[regionName] = polygon.map(([x, y]) => [
        Math.round(x * altScaleX), // Using no scaling for testing
        Math.round(y * altScaleY)  // Using no scaling for testing
      ]);
    }
    
    console.log('=== ALL SCALED POLYGONS ===');
    console.log('Distracted:', JSON.stringify(regionPolygons.distracted));
    console.log('Hurry:', JSON.stringify(regionPolygons.hurry));
    console.log('Mindfully:', JSON.stringify(regionPolygons.mindfully));
    console.log('===============================');

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
    // Following BMI-withVideo.jsx approach: scale detected point UP to 1517x2200
    const determineRegionFromPoint = (centerX, centerY, canvasWidth, canvasHeight) => {
      // Scale the detected point from actual canvas size to 1517x2200 coordinate system
      const scaledX = (centerX / canvasWidth) * 1517;
      const scaledY = (centerY / canvasHeight) * 2200;
      const scaledPoint = [scaledX, scaledY];
      
      console.log('=== REGION DETECTION DEBUG ===');
      console.log(`Original detected point (${canvasWidth}x${canvasHeight}):`, [centerX, centerY]);
      console.log('Scaled point (1517x2200):', scaledPoint);
      console.log(`Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
      
      // Check regions in order of specificity (smaller/more specific regions first)
      const regionOrder = ['mindfully', 'hurry', 'distracted'];
      
      for (const regionName of regionOrder) {
        const zone = originalRegionPolygons[regionName];
        console.log(`Checking ${regionName} zone:`, JSON.stringify(zone));
        const isInside = isPointInPolygon(scaledPoint, zone);
        console.log(`Point in ${regionName}:`, isInside);
        
        if (isInside) {
          console.log(`✅ Point [${scaledPoint}] detected in ${regionName} region`);
          return regionName;
        }
      }
      
      console.log(`❌ Point [${scaledPoint}] not in any defined region`);
      return null; // no region detected
    };

    const detectHandRegion = (markers, canvasWidth, canvasHeight) => {
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
        
        // Determine which region this point falls into using dynamic canvas dimensions
        const detectedRegionName = determineRegionFromPoint(centerX, centerY, canvasWidth, canvasHeight);
        
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          centerX: centerX,
          centerY: centerY,
          corners: corners,
          markers: foundMarkers, // Add the markers array for DocumentScanner
          timestamp: Date.now(),
          regionName: detectedRegionName // Add the detected region name
        };
      }
      return null;
    };

    let processed = false;

    // Enhanced detection process with MediaPipe hands integration
    const detectLoop = async () => {
      if (!video || !video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(detectLoop);
        return;
      }

      // Set canvas dimensions to match video but scale for display
      const maxWidth = 320;
      const maxHeight = 400;
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      
      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video to canvas (scaled to fit)
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, maxWidth, maxHeight);

      // Detect ArUco markers using js-aruco
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const markers = detector.detect(imageData);

      if (markers.length > 0) {
        console.log("Detected marker(s):");
        markers.forEach((marker) => {
          const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
          const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
          console.log(`  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(cy)})`);
        });
      }

      // Raw IDs (all detected markers)
      const detectedIds = markers.map((m) => m.id).sort();

      const matchedMarkers = markers.filter((marker) =>
        isInCorner(marker, marker.id)
      );
      const matchedIds = matchedMarkers.map((m) => m.id).sort();

      const lastDetected = lastDetectedIdsRef.current.join(",");
      const currentDetected = matchedIds.join(",");

      if (lastDetected !== currentDetected) {
        console.log(" Marker IDs changed:", matchedIds);
        lastDetectedIdsRef.current = matchedIds;
      }

      // Alignment logic
      if (!hasBeenAligned.current && matchedIds.length === 4) {
        hasBeenAligned.current = true;
        console.log("Poster aligned!");
      }

      const visible = hasBeenAligned.current
        ? matchedIds.length >= 3
        : matchedIds.length === 4;

      setPosterInView(visible);

      if (matchedIds.length > 0) {
        setWarningMessage(`Markers visible: ${matchedIds.join(", ")}`);
      } else {
        setWarningMessage("No markers detected");
      }

      if (visible && !processed) {
        await handsRef.current?.send({ image: video });
        setWarningMessage("");
      } else {
        setWarningMessage("Show all 4 ArUco markers.");
      }

      // Draw markers
      context.strokeStyle = 'lime';
      context.lineWidth = 3;
      matchedMarkers.forEach(marker => {
        context.beginPath();
        marker.corners.forEach((corner, i) => {
          if (i === 0) context.moveTo(corner.x, corner.y);
          else context.lineTo(corner.x, corner.y);
        });
        context.closePath();
        context.stroke();
      });

      requestAnimationFrame(detectLoop);
    };

    // Initialize MediaPipe Hands
    startCamera().then(() => {
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      handsRef.current = hands;

      hands.onResults((results) => {
        let fingerTip = null;
        
        // First try hand detection
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const indexTip = results.multiHandLandmarks[0][8];
          fingerTip = {
            x: indexTip.x * 1517,
            y: indexTip.y * 2200
          };
          handDetectionFailCount.current = 0;
          setDetectionMode("hand");
        } else {
          handDetectionFailCount.current++;
          
          // If hand detection fails for several frames, try fingertip detection
          if (handDetectionFailCount.current > 3) {
            setDetectionMode("fingertip");
            
            // Capture current frame for fingertip detection
            if (canvas && video) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              try {
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const detectedTip = detectFingertipFromContours(imageData, canvas.width, canvas.height);
                if (detectedTip) {
                  fingerTip = detectedTip;
                }
              } catch (error) {
                console.error("Error in fingertip detection:", error);
              }
            }
          }
        }

        // Process detected fingertip
        if (fingerTip && posterInView) {
          const { x, y } = fingerTip;

          let detected = null;
          for (const [zoneName, zone] of Object.entries(zones)) {
            if (isPointInZone([x, y], zone)) {
              detected = zoneName;
              break;
            }
          }
          
          if (detected && !processed) {
            console.log(`✅ ${detected} region detected via ${detectionMode} mode!`);
            processed = true;
            
            const region = {
              minX: x - 50,
              maxX: x + 50,
              minY: y - 50,
              maxY: y + 50,
              centerX: x,
              centerY: y,
              corners: [{x: x, y: y}],
              markers: [], // No markers for hand detection
              timestamp: Date.now(),
              regionName: detected
            };
            
            setDetectedRegion(region);
            setRegionDetected(true);
            
            toast.success(`${detected.charAt(0).toUpperCase() + detected.slice(1)} region detected! Choose your action.`, {
              duration: 6000,
              id: "region-detected"
            });
          }
        }
      });

      detectLoop();
    });

    return () => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [detectionKey]); // Re-run effect when detectionKey changes

  const handleSubmit = () => {
    if (detectedRegion && onRegionDetected) {
      onRegionDetected(detectedRegion);
    }
  };

  const handleRetry = () => {
    setRegionDetected(false);
    setDetectedRegion(null);
    toast.dismiss("region-detected");
    
    // Force component remount by changing the key
    // This will restart the entire detection process cleanly
    setDetectionKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col items-center p-4 w-full max-w-sm mx-auto">
      {/* <h1 className="text-xl font-bold text-gray-800 mb-4">ArUco Hand Detection</h1> */}
      
      {!regionDetected ? (
        <div className="relative w-full">
          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas 
            ref={canvasRef} 
            width={320}
            height={400}
            className="w-full h-[400px] rounded-lg border-2 border-gray-300 shadow-md"
            style={{
              display: 'block',
              maxWidth: '100%',
              height: 'auto',
              backgroundColor: '#000'
            }}
          />
          <canvas
            ref={detectionCanvasRef}
            style={{ display: 'none' }}
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-2">
           {/* <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs text-center">
             Keep the poster aligned
            </div> */}
          </div>
          <div className="absolute top-4 left-0 right-0 flex justify-center px-2">
            {/* <div className="bg-blue-600 bg-opacity-80 text-white px-3 py-1 rounded-full text-xs text-center">
              Mode: {detectionMode} | Poster: {posterInView ? '✅ Aligned' : '❌ Not Aligned'}
            </div> */}
          </div>
          {warningMessage && (
            <div className="absolute top-12 left-0 right-0 flex justify-center px-2">
              <div className="bg-orange-500 bg-opacity-80 text-white px-3 py-1 rounded-full text-xs text-center">
               {warningMessage}
              </div>
            </div>
          )}
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
