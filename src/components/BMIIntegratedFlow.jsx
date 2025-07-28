/* Integrated BMI Detection + Video Display Flow */

import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { apiUtils } from '../utils/deviceId';
import { deviceIdManager } from '../utils/deviceId';

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

const videoMapping = {
  'hurry': {
    title: 'I eat in hurry',
    videoUrl: '/videos/hurry.mp4',
  },
  'mindfully': {
    title: 'I eat mindfully',
    videoUrl: '/videos/mindfully.mp4',
  },
  'distracted': {
    title: 'I eat while distracted',
    videoUrl: '/videos/distracted.mp4',
  }
};

const BMIIntegratedFlow = () => {
  // Detection states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);

  const [posterInView, setPosterInView] = useState(false);
  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand");
  const [currentPhase, setCurrentPhase] = useState("detection"); // "detection", "results", "video"
  const [selectedZone, setSelectedZone] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const holdStartTime = useRef(null);
  const holdDuration = 3000; // 3 seconds

  const cornerZones = {
    1: { x: 200, y: 50 },
    2: { x: 480, y: 50 },
    3: { x: 190, y: 450 },
    4: { x: 480, y: 450 },
  };

  const BUFFER = 170;

  // Detection functions (from BMI-2)
  function isInCorner(marker, id) {
    const expected = cornerZones[id];
    if (!expected || !marker?.corners) return false;

    const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
    const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

    const inCorner =
      Math.abs(cx - expected.x) < BUFFER &&
      Math.abs(cy - expected.y) < BUFFER;

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

      const ctx = canvas.getContext('2d');
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
        
        const isSkin = (h >= 0 && h <= 20) || (h >= 340 && h <= 360);
        const satOk = s >= 0.2 && s <= 0.8;
        const valOk = v >= 0.4 && v <= 0.95;
        
        const pixelIndex = Math.floor(i / 4);
        mask[pixelIndex] = (isSkin && satOk && valOk) ? 255 : 0;
      }
      
      const contours = findContours(mask, width, height);
      
      if (contours.length === 0) return null;
      
      const largestContour = contours.reduce((largest, current) => 
        contourArea(current) > contourArea(largest) ? current : largest
      );
      
      if (contourArea(largestContour) < 500) return null;
      
      const topPoint = largestContour.reduce((top, point) => 
        point.y < top.y ? point : top
      );
      
      return { x: topPoint.x, y: topPoint.y };
    } catch (error) {
      console.error("Fingertip detection error:", error);
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
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const index = y * width + x;
      
      if (visited.has(index) || x < 0 || x >= width || y < 0 || y >= height || mask[index] !== 255) {
        continue;
      }
      
      visited.add(index);
      contour.push({ x, y });
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) {
            stack.push({ x: x + dx, y: y + dy });
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
      if (
        zone[i][1] > point.y !== zone[j][1] > point.y &&
        point.x < ((zone[j][0] - zone[i][0]) * (point.y - zone[i][1])) / (zone[j][1] - zone[i][1]) + zone[i][0]
      ) {
        inside = !inside;
      }
    }
    return inside;
  };

  const handleZoneDetection = async (detectedZone) => {
    if (!holdStartTime.current) {
      holdStartTime.current = Date.now();
      return;
    }

    const holdTime = Date.now() - holdStartTime.current;
    if (holdTime >= holdDuration) {
      try {
        const response = await apiUtils.post('/store', {
          qrId: 'integrated-flow',
          deviceId: deviceIdManager.getDeviceId(),
          selection: detectedZone,
          timestamp: new Date().toISOString()
        });

        if (response.ok) {
          setSelectedZone(detectedZone);
          setCurrentPhase("results");
          holdStartTime.current = null;
        }
      } catch (error) {
        console.error("Submit failed", error);
      }
    }
  };

  const handlePlayVideo = () => {
    setShowVideo(true);
    setCurrentPhase("video");
  };

  const handleBackToDetection = () => {
    setCurrentPhase("detection");
    setSelectedZone(null);
    setShowVideo(false);
    holdStartTime.current = null;
  };

  // Complete detection initialization with ArUco markers and MediaPipe
  useEffect(() => {
    if (currentPhase !== "detection") return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            scaleContainer();
          };
        }
      } catch (error) {
        console.error("Camera access failed:", error);
        setWarningMessage("Camera access failed");
      }
    };

    const locateFile = (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    };

    // Initialize MediaPipe Hands
    const hands = new Hands({
      locateFile,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });

    hands.onResults((results) => {
      if (currentPhase !== "detection") return;
      
      const pointer = pointerRef.current;
      const result = resultRef.current;
      
      if (!pointer || !result) return;

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetectionFailCount.current = 0;
        setDetectionMode("hand");
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8]; // Index finger tip
        
        const video = videoRef.current;
        if (!video) return;
        
        const x = indexTip.x * video.videoWidth;
        const y = indexTip.y * video.videoHeight;
        
        pointer.style.display = "block";
        pointer.style.left = `${x}px`;
        pointer.style.top = `${y}px`;
        
        // Check which zone the finger is pointing at
        let detectedZone = null;
        for (const [zoneName, zoneCoords] of Object.entries(zones)) {
          if (isPointInZone({ x, y }, zoneCoords)) {
            detectedZone = zoneName;
            break;
          }
        }
        
        if (detectedZone) {
          result.textContent = `Pointing at: ${detectedZone}`;
          handleZoneDetection(detectedZone);
        } else {
          result.textContent = "Point at a zone";
          holdStartTime.current = null;
        }
      } else {
        handDetectionFailCount.current++;
        
        if (handDetectionFailCount.current >= 5) {
          setDetectionMode("fingertip");
          
          // Fallback to fingertip detection
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video && canvas) {
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const fingertip = detectFingertipFromContours(imageData, canvas.width, canvas.height);
            
            if (fingertip) {
              pointer.style.display = "block";
              pointer.style.left = `${fingertip.x}px`;
              pointer.style.top = `${fingertip.y}px`;
              
              let detectedZone = null;
              for (const [zoneName, zoneCoords] of Object.entries(zones)) {
                if (isPointInZone(fingertip, zoneCoords)) {
                  detectedZone = zoneName;
                  break;
                }
              }
              
              if (detectedZone) {
                result.textContent = `Pointing at: ${detectedZone}`;
                handleZoneDetection(detectedZone);
              } else {
                result.textContent = "Point at a zone";
                holdStartTime.current = null;
              }
            } else {
              pointer.style.display = "none";
              result.textContent = "Show your finger";
              holdStartTime.current = null;
            }
          }
        }
      }
    });

    handsRef.current = hands;

    // Initialize ArUco detector
    let detector;
    if (window.AR) {
      detector = new window.AR.Detector();
    } else {
      console.error("js-aruco not loaded");
      setWarningMessage("ArUco library not loaded");
      return;
    }

    const detectLoop = async () => {
      if (currentPhase !== "detection") return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(detectLoop);
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detect ArUco markers
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

      // Check if poster is too far away
      const posterTooFar = isPosterTooFar(markers);
      
      if (posterTooFar) {
        pointerRef.current.style.display = "none";
        resultRef.current.textContent = "Move closer to the poster";
        setWarningMessage("📏 Poster is too far away. Move camera closer!");
        requestAnimationFrame(detectLoop);
        return;
      }

      // Check marker alignment
      const detectedIds = markers.map((m) => m.id).sort();
      const matchedMarkers = markers.filter((marker) => isInCorner(marker, marker.id));
      const matchedIds = matchedMarkers.map((m) => m.id).sort();

      const lastDetected = lastDetectedIdsRef.current.join(",");
      const currentDetected = matchedIds.join(",");

      if (lastDetected !== currentDetected) {
        console.log("Marker IDs changed:", matchedIds);
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
        await hands.send({ image: video });
        setWarningMessage("");
      } else {
        pointerRef.current.style.display = "none";
        resultRef.current.textContent = "Align poster with 4 markers";
        setWarningMessage("📄 Poster not aligned. Show all 4 ArUco markers.");
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

    window.addEventListener("resize", scaleContainer);
    startCamera();
    
    return () => {
      window.removeEventListener("resize", scaleContainer);
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [currentPhase]);

  // Render based on current phase
  if (currentPhase === "results" || currentPhase === "video") {
    const currentVideo = videoMapping[selectedZone];
    
    return (
      <div style={{
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
      }}>
        <div style={{
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
        }}>
          <p style={{
            fontSize: 'min(18px, 4.5vw)',
            margin: '0 0 15px 0',
            lineHeight: '1.5',
          }}>
            Your selection was noted!
          </p>
          
          <div style={{
            background: 'rgba(76, 175, 80, 0.25)',
            border: '2px solid #4CAF50',
            borderRadius: '15px',
            padding: '12px 20px',
            fontSize: 'min(16px, 4vw)',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(76, 175, 80, 0.2)',
          }}>
            Selected: {selectedZone}
          </div>
        </div>

        {!showVideo && currentVideo && (
          <div style={{
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
          }}>
            <h3 style={{
              fontSize: 'min(20px, 5vw)',
              margin: '0 0 15px 0',
              color: '#FFD700',
            }}>
              {currentVideo.title}
            </h3>
            
            <button
              onClick={handlePlayVideo}
              style={{
                background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                border: 'none',
                borderRadius: '25px',
                color: 'white',
                fontSize: 'min(16px, 4vw)',
                fontWeight: 'bold',
                padding: 'min(15px, 4vw) min(30px, 8vw)',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
                marginRight: '10px',
              }}
            >
              ▶️ Play Video
            </button>

            <button
              onClick={handleBackToDetection}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '25px',
                color: 'white',
                fontSize: 'min(14px, 3.5vw)',
                padding: 'min(12px, 3vw) min(25px, 6vw)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {showVideo && currentVideo && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            borderRadius: '25px',
            padding: 'min(25px, 6vw)',
            textAlign: 'center',
            maxWidth: '90vw',
            width: '100%',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}>
            <h2 style={{
              fontSize: 'min(22px, 5.5vw)',
              margin: '0 0 12px 0',
              color: '#FFD700',
            }}>
              {currentVideo.title}
            </h2>
            
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '640px',
              margin: '0 auto 20px auto',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}>
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
              >
                <source src={currentVideo.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            <button
              onClick={handleBackToDetection}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '25px',
                color: 'white',
                fontSize: 'min(14px, 3.5vw)',
                padding: 'min(12px, 3vw) min(25px, 6vw)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // Detection phase UI
  return (
    <div className="wrapper" style={{
      position: "relative",
      width: "100vw",
      height: "calc(100vw * 2200 / 1517)",
      maxHeight: "100vh",
      maxWidth: "calc(100vh * 1517 / 2200)",
      margin: "auto",
      background: "black",
      objectFit: "contain",
    }}>
      <div
        id="container"
        ref={containerRef}
        style={{
          position: "absolute",
          width: "1517px",
          height: "2200px",
          transformOrigin: "top left",
          border: "5px dashed red",
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
          style={{ display: "none" }}
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
          Loading...
        </div>

        <div style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          textAlign: "center",
          fontFamily: "Arial",
        }}>
          Point at a zone for 3 seconds to select
          <br />
          <span style={{fontSize: "14px", opacity: 0.8}}>
            Zones: Hurry | Mindfully | Distracted
          </span>
        </div>
      </div>
    </div>
  );
};

export default BMIIntegratedFlow;
