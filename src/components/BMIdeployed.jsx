/* Integrated BMI Pointer with ArUco Markers + Hand/Fingertip Detection */

import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

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

const zoneInfo = {
  hurry: {
    title: "I eat in hurry",
    videoUrl: "/videos/hurry.mp4",
  },
  mindfully: {
    title: "I eat mindfully",
    videoUrl: "/videos/mindfully.mp4",
  },
  distracted: {
    title: "I eat while distracted",
    videoUrl: "../../public/videos/distracted.mp4",
  },
};

const BMISelectionApp = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);
  const videoPlayerRef = useRef(null);
  // const [videoShownForZone, setVideoShownForZone] = useState(null);

  const [posterInView, setPosterInView] = useState(false);
  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand"); // "hand" or "fingertip"
  const [currentZone, setCurrentZone] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const zoneTimeoutRef = useRef(null);

 const cornerZones = {
    2: { x: 200, y: 50 },
    13: { x: 480, y: 50 },
    6: { x: 190, y: 450 },
    3: { x: 480, y: 450 },
  };

  const BUFFER = 170;

  function isInCorner(marker, id) {
    const expected = cornerZones[id];
    if (!expected || !marker?.corners) return false;

    const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
    const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

    const inCorner =
      Math.abs(cx - expected.x) < BUFFER && Math.abs(cy - expected.y) < BUFFER;

    console.log(
      `Marker ${id} center: (${Math.round(cx)}, ${Math.round(
        cy
      )}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`
    );

    return inCorner;
  }

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

      const ctx = canvas.getContext("2d");
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
        const isSkin =
          h >= 0 &&
          h <= 20 &&
          s >= 48 / 255 &&
          s <= 1.0 &&
          v >= 80 / 255 &&
          v <= 1.0;

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
        if (area > maxArea && area > 500) {
          // Minimum area threshold
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
        x: (topmost.x / width) * 1517,
        y: (topmost.y / height) * 2200,
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
          if (contour.length > 10) {
            // Minimum contour size
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
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const idx = y * width + x;

      if (
        x < 0 ||
        x >= width ||
        y < 0 ||
        y >= height ||
        visited[idx] ||
        mask[idx] !== 255
      ) {
        continue;
      }

      visited[idx] = true;
      contour.push({ x, y });

      // Add 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({ x: x + dx, y: y + dy });
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

  const handleZoneDetection = (zoneName) => {
    if (zoneName !== currentZone) {
      setCurrentZone(zoneName);

      // Clear any existing timeout
      if (zoneTimeoutRef.current) {
        clearTimeout(zoneTimeoutRef.current);
      }

      // Set a new timeout to show video after 1 second of continuous detection
      zoneTimeoutRef.current = setTimeout(() => {
        if (zoneName && zoneInfo[zoneName]) {
          setShowVideo(true);
          if (videoPlayerRef.current) {
            videoPlayerRef.current.src = zoneInfo[zoneName].videoUrl;
            videoPlayerRef.current.load();
            videoPlayerRef.current.play().catch(e => console.error("Video play error:", e));
          }
        }
      }, 300);
    }
  };

  // const handleZoneDetection = (zoneName) => {
  //   if (!zoneName || zoneInfo[zoneName] === undefined) {
  //     setCurrentZone(null);
  //     return;
  //   }

  //   setCurrentZone(zoneName);

  //   // If video has already been shown for this zone, skip
  //   if (videoShownForZone === zoneName) return;

  //   // Clear any existing timeout
  //   if (zoneTimeoutRef.current) {
  //     clearTimeout(zoneTimeoutRef.current);
  //   }

  //   zoneTimeoutRef.current = setTimeout(() => {
  //     setShowVideo(true);
  //     setVideoShownForZone(zoneName); // Mark this zone as shown

  //     if (videoPlayerRef.current) {
  //       videoPlayerRef.current.src = zoneInfo[zoneName].videoUrl;
  //       videoPlayerRef.current.load();
  //       videoPlayerRef.current
  //         .play()
  //         .catch((e) => console.error("Video play error:", e));
  //     }
  //   }, 500); // or 500ms
  // };

  const handleCloseVideo = () => {
    setShowVideo(false);
    setCurrentZone(null);
    // setVideoShownForZone(null);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      videoPlayerRef.current.currentTime = 0;
    }
    if (zoneTimeoutRef.current) {
      clearTimeout(zoneTimeoutRef.current);
    }
  };

  useEffect(() => {
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
        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const indexTip = results.multiHandLandmarks[0][8];
          fingerTip = {
            x: indexTip.x * 1517,
            y: indexTip.y * 2200,
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
              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              try {
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                const detectedTip = detectFingertipFromContours(
                  imageData,
                  canvas.width,
                  canvas.height
                );
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

          handleZoneDetection(detected);
          setWarningMessage("");
        } else {
          pointerRef.current.style.display = "none";
          resultRef.current.textContent = "No finger detected";
          setWarningMessage(
            "👆 Hand not detected. Keep your index finger visible."
          );
          handleZoneDetection(null);
        }
      });

      // ArUco marker detection (from workingBmi.jsx)
      const detector = new window.AR.Detector();

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
            console.log(
              `  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(
                cy
              )})`
            );
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

        if (visible) {
          await hands.send({ image: video });
          setWarningMessage("");
        } else {
          pointerRef.current.style.display = "none";
          resultRef.current.textContent = "Align poster with 4 markers";
          setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
          handleZoneDetection(null);
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
      detectLoop();
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-black overflow-hidden">
      <div className="relative w-full h-full max-w-full max-h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full hidden"
        />

        <canvas
          ref={detectionCanvasRef}
          className="hidden"
        />

        <div
          ref={pointerRef}
          className="absolute w-8 h-8 bg-green-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden"
          style={{
            background: detectionMode === "hand" 
              ? "rgba(0,255,0,0.5)" 
              : "rgba(255,165,0,0.7)"
          }}
        />

        <div
          ref={resultRef}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm md:text-base text-center max-w-[90%]"
        >
          Loading...
        </div>

        {warningMessage && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-orange-200 text-black px-3 py-2 rounded-lg font-bold text-sm text-center max-w-[90%]">
            ⚠️ {warningMessage}
          </div>
        )}

        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-xs md:text-sm text-center max-w-[90%]">
          Align your poster with the frame and show all 4 markers
          <br />
          Point with your index finger
          <br />
          <span className="opacity-80">
            Mode: {detectionMode} | Pointer:{" "}
            {detectionMode === "hand" ? "🟢 (Hand)" : "🟠 (Fingertip)"}
          </span>
        </div>
      </div>

      {/* Video Player Modal - same as before */}
      {showVideo && currentZone && zoneInfo[currentZone] && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col justify-center items-center z-50">
          <div className="max-w-[90vw] max-h-[80vh] mb-5 text-center">
            <h2 className="text-white mb-5 text-lg md:text-xl">
              {zoneInfo[currentZone].title}
            </h2>
            <video
              ref={videoPlayerRef}
              controls
              autoPlay
              className="max-w-full max-h-[60vh]"
            >
              <source src={zoneInfo[currentZone].videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <button
            onClick={handleCloseVideo}
            className="px-5 py-2 text-lg bg-orange-600 text-white border-none rounded cursor-pointer"
          >
            Close Video
          </button>
        </div>
      )}
    </div>
  );
};

export default BMISelectionApp;
