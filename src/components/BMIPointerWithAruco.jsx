import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

const zones = {
  Normal: [[802, 4], [1516, 4], [1517, 1135], [797, 1140]],
  Underweight: [[800, 1154], [1516, 1149], [1516, 2200], [792, 2200]],
  Obese: [[4, 1156], [788, 1156], [785, 2200], [4, 2200]],
  Overweight: [[4, 2], [792, 7], [785, 1140], [4, 1140]],
};

const BMIPointerWithAruco = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const containerRef = useRef(null);

  const [posterInView, setPosterInView] = useState(false);

  useEffect(() => {
    // const waitForOpenCV = (cb) => {
    //   if (window.cv && cv.aruco) cb();
    //   else setTimeout(() => waitForOpenCV(cb), 100);
      
    // };
    const waitForOpenCV = (cb) => {
  if (window.cv && cv.aruco) {
    console.log("✅ OpenCV + ArUco is loaded");
    cb();
  } else {
    console.log("⏳ Waiting for OpenCV...");
    setTimeout(() => waitForOpenCV(cb), 100);
  }
};


    const isPointInZone = (point, zone) => {
      const [x, y] = point;
            let inside = false;
            for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
                const [xi, yi] = zone[i];
                const [xj, yj] = zone[j];
                const intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
    };

    const startCamera = async () => {
        console.log("startCamera called");
  let stream = null;
  let constraints = { video: { facingMode: { exact: "environment" } } };

  try {
     console.log("Trying exact environment");
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
     console.log("Fallback to ideal environment");
    constraints.video.facingMode = { ideal: "environment" };
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err2) {
         console.log("Fallback to any camera");
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
  }

//   videoRef.current.srcObject = stream;
if (videoRef.current) {
    videoRef.current.srcObject = stream;
    console.log("Camera stream set");
  }

  return new Promise((resolve) => {
    videoRef.current.onloadedmetadata = () => {
              console.log("Metadata loaded");

      resolve(videoRef.current);
    };
  });
};


    waitForOpenCV(() => {
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

        hands.onResults((results) => {
          if (
            results.multiHandLandmarks &&
            results.multiHandLandmarks.length > 0
          ) {
            const indexTip = results.multiHandLandmarks[0][8];
            const x = indexTip.x * 1517;
            const y = indexTip.y * 2200;

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
              ? `Detected: ${detected}`
              : "Pointing outside zones";
          } else {
            pointerRef.current.style.display = "none";
            resultRef.current.textContent = "No finger detected";
          }
        });

        const detectLoop = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (!video || !canvas) return;

          const ctx = canvas.getContext("2d");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const src = cv.imread(canvas);
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

          const dictionary = cv.aruco.getPredefinedDictionary(cv.aruco.DICT_4X4_50);
          console.log(cv.aruco); // should be defined

          const markerCorners = new cv.MatVector();
          const markerIds = new cv.Mat();
          const parameters = new cv.aruco.DetectorParameters();

          cv.aruco.detectMarkers(gray, dictionary, markerCorners, markerIds, parameters);

          const detectedIds = markerIds.data32S ? Array.from(markerIds.data32S) : [];
          const requiredIds = [1, 2, 3, 4]; // Change to match your printed marker IDs

          const visible = requiredIds.every((id) => detectedIds.includes(id));
          setPosterInView(visible);

          src.delete();
          gray.delete();
          markerCorners.delete();
          markerIds.delete();

          // Run MediaPipe only if all required markers are visible
          if (visible) {
            await hands.send({ image: video });
          } else {
            pointerRef.current.style.display = "none";
            resultRef.current.textContent = "Align poster with 4 markers";
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
    });
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
          border: "5px dashed red",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "rgba(0,0,0,0.2)",
          }}
        />
        <canvas
          ref={canvasRef}
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
            background: "rgba(255,0,0,0.5)",
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
          Align your poster with the frame and show all 4 markers<br />
          Point with your index finger
        </div>
      </div>
    </div>
  );
};

export default BMIPointerWithAruco;
