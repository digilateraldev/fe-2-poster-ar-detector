import React, { useEffect, useRef, useState } from "react";

const MarkerDetectionVisualizer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  const [detectedMarkers, setDetectedMarkers] = useState([]);
  const [warningMessage, setWarningMessage] = useState("Initializing camera...");
  const [isAligned, setIsAligned] = useState(false);

  // Color palette for different marker IDs (base colors)
  const baseMarkerColors = {
    1: '#FF0000', // Red
    2: '#00FF00', // Green  
    3: '#0000FF', // Blue
    4: '#FFFF00', // Yellow
  };

  // Size-based color variations (lighter/darker shades for different sizes)
  const getSizeBasedColor = (id, avgSize) => {
    const baseColor = baseMarkerColors[id] || '#FFFFFF';
    
    // Create different shades based on size ranges
    if (avgSize >= 150) return baseColor; // Original color for largest
    else if (avgSize >= 120) return baseColor + 'CC'; // 80% opacity
    else if (avgSize >= 90) return baseColor + '99'; // 60% opacity
    else if (avgSize >= 60) return baseColor + '66'; // 40% opacity
    else return baseColor + '33'; // 20% opacity for smallest
  };

  // Get size category for labeling
  const getSizeCategory = (avgSize) => {
    if (avgSize >= 150) return 'XL';
    else if (avgSize >= 120) return 'L';
    else if (avgSize >= 90) return 'M';
    else if (avgSize >= 60) return 'S';
    else return 'XS';
  };

  // No corner zone validation needed - markers are scattered across the poster

  useEffect(() => {
    let detector = null;

    const startCamera = async () => {
      let stream = null;
      let constraints = { video: { facingMode: { exact: "environment" } } };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        constraints.video.facingMode = { ideal: "environment" };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          resolve(videoRef.current);
        };
      });
    };

    const initializeDetector = () => {
      if (typeof window !== 'undefined' && window.AR) {
        detector = new window.AR.Detector();
        setWarningMessage("Camera ready - Show your ArUco markers");
        return true;
      }
      return false;
    };

    const detectLoop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      
      if (!video || !canvas || !overlayCanvas || !detector) {
        requestAnimationFrame(detectLoop);
        return;
      }

      // Check if video is ready
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        requestAnimationFrame(detectLoop);
        return;
      }

      try {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const overlayCtx = overlayCanvas.getContext("2d");
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Clear overlay
        overlayCtx.clearRect(0, 0, 1517, 2200);

        // Capture frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect markers
        const markers = detector.detect(imageData);
        
        // Process detected markers
        const markerData = markers.map((marker) => {
          const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
          const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
          const width = Math.hypot(
            marker.corners[1].x - marker.corners[0].x,
            marker.corners[1].y - marker.corners[0].y
          );
          const height = Math.hypot(
            marker.corners[3].x - marker.corners[0].x,
            marker.corners[3].y - marker.corners[0].y
          );
          const avgSize = (width + height) / 2;

          // Scale coordinates to 1517x2200 space
          const scaleX = 1517 / canvas.width;
          const scaleY = 2200 / canvas.height;
          
          const scaledCorners = marker.corners.map(corner => ({
            x: corner.x * scaleX,
            y: corner.y * scaleY
          }));
          
          const scaledCx = cx * scaleX;
          const scaledCy = cy * scaleY;

          return {
            id: marker.id,
            corners: scaledCorners,
            center: { x: Math.round(scaledCx), y: Math.round(scaledCy) },
            width: Math.round(width * scaleX * 100) / 100,
            height: Math.round(height * scaleY * 100) / 100,
            avgSize: Math.round(avgSize * scaleX * 100) / 100,
            area: Math.round(width * height * scaleX * scaleY),
            timestamp: Date.now()
          };
        });

        setDetectedMarkers(markerData);

        // Update status based on detected markers
        const hasMarkers = markerData.length > 0;
        setIsAligned(hasMarkers);

        // Update warning message
        if (markerData.length === 0) {
          setWarningMessage("No ArUco markers detected");
        } else {
          setWarningMessage(`✅ Detecting ${markerData.length} markers`);
        }

        // Draw markers on overlay canvas
        markerData.forEach((markerInfo) => {
          const color = getSizeBasedColor(markerInfo.id, markerInfo.avgSize);
          const sizeCategory = getSizeCategory(markerInfo.avgSize);
          
          // Draw marker outline
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = 4;
          overlayCtx.beginPath();
          overlayCtx.moveTo(markerInfo.corners[0].x, markerInfo.corners[0].y);
          for (let i = 1; i < markerInfo.corners.length; i++) {
            overlayCtx.lineTo(markerInfo.corners[i].x, markerInfo.corners[i].y);
          }
          overlayCtx.closePath();
          overlayCtx.stroke();

          // Fill marker with semi-transparent color
          overlayCtx.fillStyle = color.length > 7 ? color : color + '40'; // Handle colors with alpha
          overlayCtx.fill();

          // Draw center point
          overlayCtx.fillStyle = color.substring(0, 7); // Remove alpha for center point
          overlayCtx.beginPath();
          overlayCtx.arc(markerInfo.center.x, markerInfo.center.y, 10, 0, 2 * Math.PI);
          overlayCtx.fill();

          // Draw marker info
          overlayCtx.font = 'bold 18px Arial';
          const text1 = `ID: ${markerInfo.id} (${sizeCategory})`;
          const text2 = `${Math.round(markerInfo.avgSize)}px`;
          
          // Background for text
          overlayCtx.fillStyle = 'rgba(0,0,0,0.9)';
          overlayCtx.fillRect(markerInfo.center.x - 70, markerInfo.center.y - 40, 140, 60);
          
          // Text
          overlayCtx.fillStyle = '#ffffff';
          overlayCtx.fillText(text1, markerInfo.center.x - 65, markerInfo.center.y - 20);
          overlayCtx.fillText(text2, markerInfo.center.x - 30, markerInfo.center.y);
        });

      } catch (error) {
        console.error("Error in marker detection:", error);
        setDetectedMarkers([]);
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

    // Initialize
    startCamera().then(() => {
      if (initializeDetector()) {
        scaleContainer();
        window.addEventListener("resize", scaleContainer);
        detectLoop();
      } else {
        setWarningMessage("ArUco library not loaded. Please refresh the page.");
      }
    });

    return () => {
      window.removeEventListener("resize", scaleContainer);
      if (videoRef.current?.srcObject) {
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
          border: isAligned ? "5px solid green" : "5px dashed red",
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

        {/* Overlay canvas for marker visualization */}
        <canvas
          ref={overlayCanvasRef}
          width={1517}
          height={2200}
          style={{
            position: "absolute",
            width: "1517px",
            height: "2200px",
            pointerEvents: "none",
          }}
        />

        {/* Marker center pointers */}
        {detectedMarkers.map((marker, index) => {
          const color = getSizeBasedColor(marker.id, marker.avgSize);
          const sizeCategory = getSizeCategory(marker.avgSize);
          return (
            <div
              key={`pointer-${marker.id}-${index}`}
              style={{
                position: "absolute",
                left: `${marker.center.x}px`,
                top: `${marker.center.y}px`,
                width: "24px",
                height: "24px",
                background: color.substring(0, 7), // Remove alpha for solid pointer
                borderRadius: "50%",
                border: "3px solid white",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                zIndex: 10,
              }}
            >
              {/* Inner dot for better visibility */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "8px",
                  height: "8px",
                  background: "white",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          );
        })}

        {/* Status message */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: isAligned ? "rgba(0,128,0,0.8)" : "rgba(255,165,0,0.8)",
            color: "white",
            padding: "15px",
            fontSize: "20px",
            borderRadius: "10px",
            fontFamily: "Arial",
            fontWeight: "bold",
          }}
        >
          {warningMessage}
        </div>

        {/* Instructions */}
        <div
          style={{
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
          }}
        >
          Show ArUco markers to see color-coded detection
          <br />
          Each marker ID gets a unique color
        </div>

        {/* Detected markers summary */}
        {detectedMarkers.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(0,0,0,0.9)",
              color: "white",
              padding: "15px",
              borderRadius: "8px",
              fontFamily: "Arial",
              fontSize: "13px",
              maxWidth: "320px",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "10px", fontSize: "16px" }}>
              Detected Markers ({detectedMarkers.length})
            </div>
            <div style={{ fontSize: "11px", marginBottom: "8px", color: "#ccc" }}>
              Size Categories: XS(&lt;60px) S(60-89px) M(90-119px) L(120-149px) XL(≥150px)
            </div>
            {detectedMarkers
              .sort((a, b) => a.id - b.id || b.avgSize - a.avgSize) // Sort by ID then by size (largest first)
              .map((marker, index) => {
                const color = getSizeBasedColor(marker.id, marker.avgSize);
                const sizeCategory = getSizeCategory(marker.avgSize);
                return (
                  <div key={index} style={{ marginBottom: "6px", display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        backgroundColor: color.substring(0, 7), // Remove alpha
                        marginRight: "8px",
                        border: "1px solid white",
                        borderRadius: "2px",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>ID {marker.id}</strong> ({sizeCategory}): {Math.round(marker.avgSize)}px
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkerDetectionVisualizer;
