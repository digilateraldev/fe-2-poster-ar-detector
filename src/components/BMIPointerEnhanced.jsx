/* Enhanced BMI Pointer with ArUco Markers + Hand/Fingertip Detection + 3-Second Selection */

import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { deviceIdManager, apiUtils } from '../utils/deviceId';

// const zones = {
//   Normal: [
//     [802, 4],
//     [1516, 4],
//     [1517, 1135],
//     [797, 1140],
//   ],
//   Underweight: [
//     [800, 1154],
//     [1516, 1149],
//     [1516, 2200],
//     [792, 2200],
//   ],
//   Obese: [
//     [4, 1156],
//     [788, 1156],
//     [785, 2200],
//     [4, 2200],
//   ],
//   Overweight: [
//     [4, 2],
//     [792, 7],
//     [785, 1140],
//     [4, 1140],
//   ],
// };

const zones = {
  distracted: [
    [703, 671],
    [1622, 652],
    [1628, 1312],
    [823, 1328]
  ],
  hurry: [
    [82, 1125],
    [748, 1133],
    [740, 1850],
    [66, 1860]
  ],
  mindfully: [
    [852, 1534],
    [1620, 1531],
    [1633, 2186],
    [802, 2192]
  ]
};

// Function to extract QR ID from URL
const getQrIdFromUrl = () => {
  // Check if we're in a QR scan URL like /qr/scan/{qrId} or /{qrId}
  const path = window.location.pathname;
  const qrIdMatch = path.match(/\/qr\/scan\/([a-zA-Z0-9]+)/) || path.match(/\/([a-zA-Z0-9]{6})$/);
  
  if (qrIdMatch) {
    return qrIdMatch[1];
  }
  
  // Check URL parameters as fallback
  const urlParams = new URLSearchParams(window.location.search);
  const qrIdParam = urlParams.get('qrId');
  
  if (qrIdParam) {
    return qrIdParam;
  }
  
  // Default fallback for development/testing
  return 'mindfulness_selection';
};

const BMIPointerEnhanced = ({ onSelectionComplete, qrId: propQrId }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);

  const [posterInView, setPosterInView] = useState(false);
  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand"); // "hand" or "fingertip"
  const [currentSelection, setCurrentSelection] = useState(null);
  const [isSelectionConfirmed, setIsSelectionConfirmed] = useState(false);
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmationToast, setShowConfirmationToast] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const selectionTimerRef = useRef(null);
  
  // ArUco detector initialization (like BMIPointerIntegrated)
  let detector = null;
  if (typeof window !== 'undefined' && window.AR) {
    detector = new window.AR.Detector();
  }
  const selectionStartTimeRef = useRef(null);
  const lastZoneRef = useRef(null);

  const cornerZones = {
    1: { x: 200, y: 50 },
    2: { x: 480, y: 50 },
    3: { x: 190, y: 450 },
    4: { x: 480, y: 450 },
  };

  const BUFFER = 170;
  const SELECTION_HOLD_TIME = 2000; // 2 seconds

  function isInCorner(marker, id) {
    const expected = cornerZones[id];
    if (!expected || !marker?.corners) return false;

    const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
    const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

    const inCorner =
      Math.abs(cx - expected.x) < BUFFER &&
      Math.abs(cy - expected.y) < BUFFER;

    console.log(`Marker ${id} center: (${Math.round(cx)}, ${Math.round(cy)}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`);

    return inCorner;
  }

  function isPosterTooFar(markers) {
    if (markers.length === 0) return false;
    
    let totalSize = 0;
    let validMarkers = 0;
    
    for (const marker of markers) {
      const width = Math.hypot(marker.corners[1].x - marker.corners[0].x, marker.corners[1].y - marker.corners[0].y);
      const height = Math.hypot(marker.corners[3].x - marker.corners[0].x, marker.corners[3].y - marker.corners[0].y);
      const avgSize = (width + height) / 2;
      
      totalSize += avgSize;
      validMarkers++;
    }
    
    if (validMarkers === 0) return false;
    
    const averageMarkerSize = totalSize / validMarkers;
    const MIN_MARKER_SIZE = 60;
    
    const tooFar = averageMarkerSize < MIN_MARKER_SIZE;
    
    if (tooFar) {
      console.log(`Markers too small (avg: ${averageMarkerSize.toFixed(2)}px < ${MIN_MARKER_SIZE}px) - poster too far`);
    }
    
    return tooFar;
  }

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

  const detectFingertipFromContours = (imageData, width, height) => {
    try {
      const canvas = detectionCanvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = width;
      canvas.height = height;
      
      ctx.putImageData(imageData, 0, 0);
      
      const data = imageData.data;
      const mask = new Uint8Array(width * height);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        
        const [h, s, v] = rgbToHsv(r, g, b);
        
        const isSkin = (h >= 0 && h <= 50 && s >= 0.23 && s <= 0.68 && v >= 0.35 && v <= 1.0) ||
                      (h >= 300 && h <= 360 && s >= 0.23 && s <= 0.68 && v >= 0.35 && v <= 1.0);
        
        const pixelIndex = Math.floor(i / 4);
        mask[pixelIndex] = isSkin ? 255 : 0;
      }
      
      const contours = findContours(mask, width, height);
      
      if (contours.length === 0) return null;
      
      const largestContour = contours.reduce((max, contour) => 
        contourArea(contour) > contourArea(max) ? contour : max
      );
      
      if (contourArea(largestContour) < 500) return null;
      
      const topmost = largestContour.reduce((top, point) => 
        point.y < top.y ? point : top
      );
      
      return { x: topmost.x, y: topmost.y };
    } catch (error) {
      console.error('Fingertip detection error:', error);
      return null;
    }
  };

  const findContours = (mask, width, height) => {
    const contours = [];
    const visited = new Set();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (mask[index] === 255 && !visited.has(index)) {
          const contour = traceContour(mask, width, height, x, y, visited);
          if (contour.length > 10) {
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  };

  const traceContour = (mask, width, height, startX, startY, visited) => {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const index = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited.has(index) || mask[index] !== 255) {
        continue;
      }
      
      visited.add(index);
      contour.push({x, y});
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) {
            stack.push({x: x + dx, y: y + dy});
          }
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

  const isPointInZone = (point, zone) => {
    let inside = false;
    for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
      if (((zone[i][1] > point.y) !== (zone[j][1] > point.y)) &&
          (point.x < (zone[j][0] - zone[i][0]) * (point.y - zone[i][1]) / (zone[j][1] - zone[i][1]) + zone[i][0])) {
        inside = !inside;
      }
    }
    return inside;
  };

  const handleZoneDetection = (detectedZone, pointerCoords) => {
    if (!detectedZone) {
      // Reset selection if no zone detected
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = null;
      }
      setSelectionProgress(0);
      setCurrentSelection(null);
      lastZoneRef.current = null;
      return;
    }

    // If same zone as before, continue timer
    if (lastZoneRef.current === detectedZone) {
      const elapsed = Date.now() - selectionStartTimeRef.current;
      const progress = Math.min((elapsed / SELECTION_HOLD_TIME) * 100, 100);
      setSelectionProgress(progress);

      if (progress >= 100 && !isSelectionConfirmed) {
        setIsSelectionConfirmed(true);
        setCurrentSelection(detectedZone);
        setCoordinates(pointerCoords);
        setShowConfirmationToast(true);
        clearTimeout(selectionTimerRef.current);
      }
    } else {
      // New zone detected, restart timer
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
      }
      
      lastZoneRef.current = detectedZone;
      selectionStartTimeRef.current = Date.now();
      setSelectionProgress(0);
      setCurrentSelection(detectedZone);
      setIsSelectionConfirmed(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentSelection || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      // // Get or generate device ID
      // let deviceId = localStorage.getItem('deviceId');
      // if (!deviceId) {
      //   deviceId = 'device_' + Math.random().toString(36).substr(2, 12);
      //   localStorage.setItem('deviceId', deviceId);
      // }
      // Get device ID from cookies (with automatic localStorage migration)
      const deviceId = deviceIdManager.getDeviceId();
      
      // Get QR ID from props or URL
      const qrId = propQrId || getQrIdFromUrl();
      console.log('Using QR ID:', qrId);

      const payload = {
        qrId: qrId,
        selection: currentSelection,
        coordinates: coordinates
        // deviceId will be automatically added by apiUtils
      };

      // const response = await fetch('http://localhost:5000/selection/store', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(payload)
      // });

      // const result = await response.json();

      // Use apiUtils for automatic device ID handling and cookie inclusion
      const result = await apiUtils.post('/selection/store', payload);

      if (result.success) {
        console.log('Selection stored successfully:', result);
        // Call the parent callback with selection data
        if (onSelectionComplete) {
          onSelectionComplete({
            selection: currentSelection,
            coordinates: coordinates,
            deviceId: deviceId
          });
        }
      } else {
        console.error('Failed to store selection:', result.error);
        alert('Failed to store selection. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting selection:', error);
      alert('Error submitting selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setCurrentSelection(null);
    setIsSelectionConfirmed(false);
    setSelectionProgress(0);
    setCoordinates(null);
    setShowConfirmationToast(false);
    lastZoneRef.current = null;
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
  };

  const handleConfirmSubmit = async () => {
    if (!currentSelection || isSubmitting) return;

    setIsSubmitting(true);
    setShowConfirmationToast(false);
    
    try {
      // Get device ID from cookies (with automatic localStorage migration)
      const deviceId = deviceIdManager.getDeviceId();
      
      // Get QR ID from props or URL
      const qrId = propQrId || getQrIdFromUrl();
      console.log('Using QR ID:', qrId);

      const payload = {
        qrId: qrId,
        selection: currentSelection,
        coordinates: coordinates
        // deviceId will be automatically added by apiUtils
      };

      // Use apiUtils for automatic device ID handling and cookie inclusion
      const result = await apiUtils.post('/selection/store', payload);

      if (result.success) {
        console.log('Selection stored successfully:', result);
        // Call the parent callback with selection data
        if (onSelectionComplete) {
          onSelectionComplete({
            selection: currentSelection,
            coordinates: coordinates,
            deviceId: deviceId
          });
        }
      } else {
        console.error('Failed to store selection:', result.error);
        alert('Failed to store selection. Please try again.');
        setShowConfirmationToast(true); // Show toast again on error
      }
    } catch (error) {
      console.error('Error submitting selection:', error);
      alert('Error submitting selection. Please try again.');
      setShowConfirmationToast(true); // Show toast again on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const startCamera = async () => {
    let stream = null;
    
    // Try different camera configurations in order of preference
    const cameraConfigs = [
      // 1. Rear camera (environment) - preferred for AR
      { video: { facingMode: { exact: "environment" }, width: 640, height: 480 } },
      // 2. Rear camera (ideal) - fallback if exact fails
      { video: { facingMode: { ideal: "environment" }, width: 640, height: 480 } },
      // 3. Front camera - if rear not available
      { video: { facingMode: "user", width: 640, height: 480 } },
      // 4. Any camera - last resort
      { video: { width: 640, height: 480 } },
      // 5. Basic video - minimal requirements
      { video: true }
    ];

    for (let i = 0; i < cameraConfigs.length; i++) {
      try {
        console.log(`Trying camera config ${i + 1}:`, cameraConfigs[i]);
        stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
        console.log(`Camera config ${i + 1} successful`);
        break;
      } catch (error) {
        console.log(`Camera config ${i + 1} failed:`, error.name, error.message);
        
        // If this is a permission error, show helpful message
        if (error.name === 'NotAllowedError') {
          setWarningMessage("📷 Camera permission denied. Please allow camera access and refresh the page.");
          return;
        }
        
        // If this is the last config and it failed, show error
        if (i === cameraConfigs.length - 1) {
          console.error("All camera configurations failed:", error);
          setWarningMessage(`❌ Camera access failed: ${error.message}. Please check your camera permissions.`);
          return;
        }
      }
    }

    // If we got a stream, set it up
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      
      return new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              console.log('Camera started successfully');
              setWarningMessage(""); // Clear any previous warnings
              resolve(videoRef.current);
            })
            .catch((playError) => {
              console.error('Video play failed:', playError);
              setWarningMessage("❌ Failed to start video playback");
              reject(playError);
            });
        };
        
        videoRef.current.onerror = (error) => {
          console.error('Video element error:', error);
          setWarningMessage("❌ Video element error");
          reject(error);
        };
      });
    }
  };

  const locateFile = (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  };

  useEffect(() => {
    const initializeDetection = async () => {
      await startCamera();

      // Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: locateFile
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
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (canvas && video) {
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
        if (fingerTip) {
          const { x, y } = fingerTip;

          pointerRef.current.style.display = "block";
          pointerRef.current.style.left = `${x}px`;
          pointerRef.current.style.top = `${y}px`;

          let detected = null;
          for (const [zoneName, zone] of Object.entries(zones)) {
            if (isPointInZone([x, y], zone)) {
              detected = zoneName;
              break;
            }
          }
          resultRef.current.textContent = detected
            ? `Detected: ${detected} (${detectionMode} mode)`
            : `Pointing outside zones (${detectionMode} mode)`;

          setWarningMessage("");
        } else {
          pointerRef.current.style.display = "none";
          resultRef.current.textContent = "No finger detected";
          setWarningMessage(
            "👆 Hand not detected. Keep your index finger visible."
          );
        }
      });

      handsRef.current = hands;

      // Start detection loop (js-aruco should already be available)
      console.log("Starting detection loop...");
      setWarningMessage("");
      detectLoop();
    };

    const detectLoop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detect ArUco markers using js-aruco
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const markers = detector.detect(imageData);

      if (markers.length > 0) {
        console.log("Detected marker(s):");
        markers.forEach((marker) => {
          const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
          const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
          const width = Math.hypot(marker.corners[1].x - marker.corners[0].x, marker.corners[1].y - marker.corners[0].y);
          const height = Math.hypot(marker.corners[3].x - marker.corners[0].x, marker.corners[3].y - marker.corners[0].y);
          console.log(`  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(cy)}), width: ${width.toFixed(2)} px, height: ${height.toFixed(2)} px`);
        });
      }

      // Check if poster is too far away (>2cm gap)
      const posterTooFar = isPosterTooFar(markers);
      
      if (posterTooFar) {
        pointerRef.current.style.display = "none";
        resultRef.current.textContent = "Move closer to the poster";
        setWarningMessage("📏 Poster is too far away. Move camera closer!");
        requestAnimationFrame(detectLoop);
        return;
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

      if (visible) {
        if (handsRef.current) {
          await handsRef.current.send({ image: video });
        }
        setWarningMessage("");
      } else {
        pointerRef.current.style.display = "none";
        resultRef.current.textContent = "Align poster with 4 markers";
        setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
      }

      requestAnimationFrame(detectLoop);
    };

    const scaleContainer = () => {
      const wrapper = containerRef.current?.parentElement;
      if (!wrapper || !containerRef.current) return;

      const scaleX = wrapper.clientWidth / 1517;
      const scaleY = wrapper.clientHeight / 2200;
      containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
    };

    scaleContainer();
    window.addEventListener("resize", scaleContainer);
    
    initializeDetection();

    return () => {
      window.removeEventListener("resize", scaleContainer);
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
      }
      // Cleanup MediaPipe
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (error) {
          console.error('MediaPipe cleanup error:', error);
        }
      }
      // Cleanup camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div
      className="wrapper"
      style={{
        position: "relative",
        width: "100vw",
        height: "calc(100vw * 2200 / 1517)",
        maxHeight: "100vh",
        maxWidth: "calc(100vh * 1517 / 2200)",
        margin: "auto",
        background: "black",
        objectFit: "contain",
      }}
    >
      <div
        id="container"
        ref={containerRef}
        style={{
          position: "absolute",
          width: "1517px",
          height: "2200px",
          transformOrigin: "top left",
          border: posterInView ? "5px solid green" : "5px dashed red",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "rgba(0,0,0,0.2)",
          }}
        />

        <canvas
          ref={canvasRef}
          width={1517}
          height={2200}
          style={{
            position: "absolute",
            width: "1517px",
            height: "2200px",
            display: "none",
          }}
        />

        <canvas
          ref={detectionCanvasRef}
          style={{
            display: "none",
          }}
        />

        <div
          ref={pointerRef}
          style={{
            position: "absolute",
            width: "30px",
            height: "30px",
            background: detectionMode === "hand" ? "rgba(0,255,0,0.5)" : "rgba(255, 134, 5, 0.7)",
            borderRadius: "50%",
            border: "2px solid white",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            display: "none",
          }}
        />

        {/* Selection Progress Bar */}
        {currentSelection && !isSelectionConfirmed && (
          <div
            style={{
              position: "absolute",
              top: "80px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(300px, 80vw)",
              height: "25px",
              background: "rgba(0,0,0,0.8)",
              borderRadius: "15px",
              overflow: "hidden",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                width: `${selectionProgress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
                transition: "width 0.1s ease",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "0",
                left: "0",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "14px",
                fontWeight: "bold",
                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              Hold on {currentSelection} ({Math.round(selectionProgress)}%)
            </div>
          </div>
        )}

        {/* Confirmation Toast */}
        {showConfirmationToast && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.95)",
              color: "white",
              padding: "25px",
              borderRadius: "20px",
              textAlign: "center",
              fontFamily: "Arial",
              width: "min(350px, 90vw)",
              maxWidth: "90vw",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)",
              zIndex: 1000,
            }}
          >
            <h2 style={{ margin: "0 0 20px 0", color: "#4CAF50" }}>
              Your selection was noted!
            </h2>
            <p style={{ fontSize: "18px", margin: "0 0 30px 0" }}>
              Selection: <strong>{currentSelection}</strong>
            </p>
            
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                style={{
                  padding: "15px 30px",
                  fontSize: "18px",
                  background: isSubmitting ? "#ccc" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  minWidth: "120px",
                  touchAction: "manipulation",
                  userSelect: "none",
                  boxShadow: "0 4px 15px rgba(76, 175, 80, 0.3)",
                }}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
              
              <button
                onClick={handleRetry}
                disabled={isSubmitting}
                style={{
                  padding: "15px 30px",
                  fontSize: "18px",
                  background: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  minWidth: "120px",
                  touchAction: "manipulation",
                  userSelect: "none",
                  boxShadow: "0 4px 15px rgba(255, 152, 0, 0.3)",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div
          ref={resultRef}
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "15px",
            fontSize: "24px",
            borderRadius: "10px",
            fontFamily: "Arial",
          }}
        >
          {currentSelection ? `Pointing at: ${currentSelection}` : "Point to a region"}
        </div>

        {warningMessage && (
          <div
            style={{
              position: "absolute",
              bottom: "80px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255, 165, 0, 0.85)",
              color: "black",
              padding: "12px",
              fontSize: "18px",
              borderRadius: "8px",
              fontFamily: "Arial",
              fontWeight: "bold",
            }}
          >
            ⚠️ {warningMessage}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: "15px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "12px 15px",
            borderRadius: "10px",
            textAlign: "center",
            fontFamily: "Arial",
            width: "min(400px, 90vw)",
            fontSize: "16px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          }}
        >
          📱 Align poster with markers, then point and hold for 3 seconds
          <br />
          <span style={{fontSize: "14px", opacity: 0.9, marginTop: "5px", display: "block"}}>
            {detectionMode === "hand" ? "🟢 Hand Detection" : "🟠 Fingertip Detection"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BMIPointerEnhanced;
