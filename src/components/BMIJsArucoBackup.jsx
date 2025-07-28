//22-07 6.30pm
// import React, { useEffect, useRef, useState } from "react";
// import { Hands } from "@mediapipe/hands";
// // import AR from "js-aruco";
// // import { Detector } from "js-aruco";

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

// const BMIPointerWithJsAruco = () => {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const pointerRef = useRef(null);
//   const resultRef = useRef(null);
//   const containerRef = useRef(null);

//   const [posterInView, setPosterInView] = useState(false);
//   const [warningMessage, setWarningMessage] = useState("Initializing...");
//   const lastDetectedIdsRef = useRef([]);
//   const hasBeenAligned = useRef(false);

//   useEffect(() => {
//     const isPointInZone = (point, zone) => {
//       const [x, y] = point;
//       let inside = false;
//       for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
//         const [xi, yi] = zone[i];
//         const [xj, yj] = zone[j];
//         const intersect =
//           yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
//         if (intersect) inside = !inside;
//       }
//       return inside;
//     };

//     const startCamera = async () => {
//       let stream = null;
//       let constraints = { video: { facingMode: { exact: "environment" } } };

//       try {
//         stream = await navigator.mediaDevices.getUserMedia(constraints);
//       } catch (err) {
//         constraints.video.facingMode = { ideal: "environment" };
//         try {
//           stream = await navigator.mediaDevices.getUserMedia(constraints);
//         } catch (err2) {
//           stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         }
//       }

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }

//       return new Promise((resolve) => {
//         videoRef.current.onloadedmetadata = () => {
//           resolve(videoRef.current);
//         };
//       });
//     };

//     startCamera().then(() => {
//       const hands = new Hands({
//         locateFile: (file) =>
//           `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
//       });

//       hands.setOptions({
//         maxNumHands: 1,
//         modelComplexity: 0,
//         minDetectionConfidence: 0.3,
//         minTrackingConfidence: 0.3,
//       });

//       hands.onResults((results) => {
//         if (
//           results.multiHandLandmarks &&
//           results.multiHandLandmarks.length > 0
//         ) {
//           const indexTip = results.multiHandLandmarks[0][8];
//           const x = indexTip.x * 1517;
//           const y = indexTip.y * 2200;

//           pointerRef.current.style.display = "block";
//           pointerRef.current.style.left = `${x}px`;
//           pointerRef.current.style.top = `${y}px`;

//           let detected = null;
//           for (const [zoneName, zone] of Object.entries(zones)) {
//             if (isPointInZone([x, y], zone)) {
//               detected = zoneName;
//               break;
//             }
//           }
//           resultRef.current.textContent = detected
//             ? `Detected: ${detected}`
//             : "Pointing outside zones";

//           setWarningMessage("");
//         } else {
//           pointerRef.current.style.display = "none";
//           resultRef.current.textContent = "No finger detected";
//           setWarningMessage(
//             "👆 Hand not detected. Keep your index finger visible."
//           );
//         }
//       });

//       // const detector = new Detector();
//       const detector = new window.AR.Detector();

//       const detectLoop = async () => {
//         const video = videoRef.current;
//         const canvas = canvasRef.current;
//         if (!video || !canvas) return;

//         // const ctx = canvas.getContext("2d");
//         const ctx = canvas.getContext("2d", { willReadFrequently: true });

//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//         //Detect ArUco markers using js-aruco
//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const markers = detector.detect(imageData);

//         // const detectedIds = markers.map((m) => m.id);
//         // console.log(" Detected marker IDs:", detectedIds);
//         const requiredIds = [1, 2, 3, 4];
//         const detectedIds = markers.map((m) => m.id).sort();
//         const lastDetected = lastDetectedIdsRef.current.join(",");
//         const currentDetected = detectedIds.join(",");

//         if (lastDetected !== currentDetected) {
//           console.log(" Marker IDs changed:", detectedIds);
//           lastDetectedIdsRef.current = detectedIds;
//         }

//         const matchedCount = requiredIds.filter((id) =>
//           detectedIds.includes(id)
//         ).length;
//         const visible = !hasBeenAligned.current
//           ? matchedCount === 4
//           : matchedCount >= 3;

//         if (!hasBeenAligned.current && matchedCount === 4) {
//           hasBeenAligned.current = true;
//         }

//         setPosterInView(visible);

//         if (detectedIds.length > 0) {
//           setWarningMessage(`Markers visible: ${detectedIds.join(", ")}`);
//         } else {
//           setWarningMessage("No markers detected");
//         }
//         // setWarningMessage(markerText);

//         // const requiredIds = [1, 2, 3, 4];
//         // const visible = requiredIds.every((id) => detectedIds.includes(id));
//         // const visible = detectedIds.length >= 1;

//         if (visible) {
//           await hands.send({ image: video });
//           setWarningMessage("");
//         } else {
//           pointerRef.current.style.display = "none";
//           resultRef.current.textContent = "Align poster with 4 markers";
//           setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
//         }

//         requestAnimationFrame(detectLoop);
//       };

//       const scaleContainer = () => {
//         const wrapper = containerRef.current?.parentElement;
//         if (!wrapper || !containerRef.current) return;

//         const scaleX = wrapper.clientWidth / 1517;
//         const scaleY = wrapper.clientHeight / 2200;
//         containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
//       };

//       scaleContainer();
//       window.addEventListener("resize", scaleContainer);
//       detectLoop();
//     });
//   }, []);

//   return (
//     <div
//       className="wrapper"
//       style={{
//         position: "relative",
//         width: "100vw",
//         height: "calc(100vw * 2200 / 1517)",
//         maxHeight: "100vh",
//         maxWidth: "calc(100vh * 1517 / 2200)",
//         margin: "auto",
//         background: "black",
//         objectFit: "contain",
//       }}
//     >
//       <div
//         id="container"
//         ref={containerRef}
//         style={{
//           position: "absolute",
//           width: "1517px",
//           height: "2200px",
//           transformOrigin: "top left",
//           border: "5px dashed red",
//         }}
//       >
//         <video
//           ref={videoRef}
//           autoPlay
//           playsInline
//           style={{
//             // position: "absolute",
//             width: "100%",
//             height: "100%",
//             objectFit: "cover",
//             background: "rgba(0,0,0,0.2)",
//           }}
//         />
//         <canvas
//           ref={canvasRef}
//           width={1517}
//           height={2200}
//           style={{
//             position: "absolute",
//             width: "1517px",
//             height: "2200px",
//             display: "none",
//           }}
//         />

//         <div
//           ref={pointerRef}
//           style={{
//             position: "absolute",
//             width: "30px",
//             height: "30px",
//             background: "rgba(255,0,0,0.5)",
//             borderRadius: "50%",
//             border: "2px solid white",
//             transform: "translate(-50%, -50%)",
//             pointerEvents: "none",
//             display: "none",
//           }}
//         />
//         <div
//           ref={resultRef}
//           style={{
//             position: "absolute",
//             bottom: "20px",
//             left: "50%",
//             transform: "translateX(-50%)",
//             background: "rgba(0,0,0,0.7)",
//             color: "white",
//             padding: "15px",
//             fontSize: "24px",
//             borderRadius: "10px",
//             fontFamily: "Arial",
//           }}
//         >
//           Loading...
//         </div>
//         {warningMessage && (
//           <div
//             style={{
//               position: "absolute",
//               bottom: "80px",
//               left: "50%",
//               transform: "translateX(-50%)",
//               background: "rgba(255, 165, 0, 0.85)",
//               color: "black",
//               padding: "12px",
//               fontSize: "18px",
//               borderRadius: "8px",
//               fontFamily: "Arial",
//               fontWeight: "bold",
//             }}
//           >
//             ⚠️ {warningMessage}
//           </div>
//         )}

//         <div
//           style={{
//             position: "absolute",
//             top: "20px",
//             left: "50%",
//             transform: "translateX(-50%)",
//             background: "rgba(0,0,0,0.7)",
//             color: "white",
//             padding: "10px",
//             borderRadius: "5px",
//             textAlign: "center",
//             fontFamily: "Arial",
//           }}
//         >
//           Align your poster with the frame and show all 4 markers
//           <br />
//           Point with your index finger
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BMIPointerWithJsAruco;




//23-07 11am
{/* Mininmum 3 markers should be visible at their respective corners*/}

// import React, { useEffect, useRef, useState } from "react";
// import { Hands } from "@mediapipe/hands";
// // import AR from "js-aruco";
// // import { Detector } from "js-aruco";

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

// const BMIPointerWithJsAruco = () => {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const pointerRef = useRef(null);
//   const resultRef = useRef(null);
//   const containerRef = useRef(null);

//   const [posterInView, setPosterInView] = useState(false);
//   const [warningMessage, setWarningMessage] = useState("Initializing...");
//   const lastDetectedIdsRef = useRef([]);
//   const hasBeenAligned = useRef(false);

//   // const cornerZones = {
//   //   1: { x: 0, y: 0 },
//   //   2: { x: 1517, y: 0 },
//   //   3: { x: 1517, y: 2200 },
//   //   4: { x: 0, y: 2200 },
//   // };

// //   const cornerZones = {
// //   1: { x: 0, y: 0 },
// //   2: { x: 1517, y: 0 },
// //   3: { x: 0, y: 2200 },
// //   4: { x: 1517, y: 2200 },
// // };

// const cornerZones = {
//   1: { x: 200, y: 50 },
//   2: { x: 480, y: 50 },
//   3: { x: 190, y: 450 },
//   4: { x: 480, y: 450 },
// };



//   const BUFFER = 170; // ~2cm physical margin on A4

//   function isInCorner(marker, id) {
//     const expected = cornerZones[id];
//     if (!expected || !marker?.corners) return false;

//     // Get the center of the marker
//     const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
//     const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

//      const inCorner =
//     Math.abs(cx - expected.x) < BUFFER &&
//     Math.abs(cy - expected.y) < BUFFER;

//   console.log(`Marker ${id} center: (${Math.round(cx)}, ${Math.round(cy)}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`);

//   return inCorner;
//   }

//   useEffect(() => {
//     const isPointInZone = (point, zone) => {
//       const [x, y] = point;
//       let inside = false;
//       for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
//         const [xi, yi] = zone[i];
//         const [xj, yj] = zone[j];
//         const intersect =
//           yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
//         if (intersect) inside = !inside;
//       }
//       return inside;
//     };

//     const startCamera = async () => {
//       let stream = null;
//       let constraints = { video: { facingMode: { exact: "environment" } } };

//       try {
//         stream = await navigator.mediaDevices.getUserMedia(constraints);
//       } catch (err) {
//         constraints.video.facingMode = { ideal: "environment" };
//         try {
//           stream = await navigator.mediaDevices.getUserMedia(constraints);
//         } catch (err2) {
//           stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         }
//       }

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }

//       return new Promise((resolve) => {
//         videoRef.current.onloadedmetadata = () => {
//           resolve(videoRef.current);
//         };
//       });
//     };

//     startCamera().then(() => {
//       const hands = new Hands({
//         locateFile: (file) =>
//           `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
//       });

//       hands.setOptions({
//         maxNumHands: 1,
//         modelComplexity: 0,
//         minDetectionConfidence: 0.3,
//         minTrackingConfidence: 0.3,
//       });

//       hands.onResults((results) => {
//         if (
//           results.multiHandLandmarks &&
//           results.multiHandLandmarks.length > 0
//         ) {
//           const indexTip = results.multiHandLandmarks[0][8];
//           const x = indexTip.x * 1517;
//           const y = indexTip.y * 2200;

//           pointerRef.current.style.display = "block";
//           pointerRef.current.style.left = `${x}px`;
//           pointerRef.current.style.top = `${y}px`;

//           let detected = null;
//           for (const [zoneName, zone] of Object.entries(zones)) {
//             if (isPointInZone([x, y], zone)) {
//               detected = zoneName;
//               break;
//             }
//           }
//           resultRef.current.textContent = detected
//             ? `Detected: ${detected}`
//             : "Pointing outside zones";

//           setWarningMessage("");
//         } else {
//           pointerRef.current.style.display = "none";
//           resultRef.current.textContent = "No finger detected";
//           setWarningMessage(
//             "👆 Hand not detected. Keep your index finger visible."
//           );
//         }
//       });

//       // const detector = new Detector();
//       const detector = new window.AR.Detector();

//       const detectLoop = async () => {
//         const video = videoRef.current;
//         const canvas = canvasRef.current;
//         if (!video || !canvas) return;

//         const ctx = canvas.getContext("2d", { willReadFrequently: true });
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//         // Detect ArUco markers using js-aruco
//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const markers = detector.detect(imageData);

// if (markers.length > 0) {
//   console.log("Detected marker(s):");
//   markers.forEach((marker) => {
//     const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
//     const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
//     console.log(`  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(cy)})`);
//   });
// }



//         // 🔹 Raw IDs (all detected markers)
// const detectedIds = markers.map((m) => m.id).sort();
// // console.log("Raw Detected IDs:", detectedIds);

//         const matchedMarkers = markers.filter((marker) =>
//           isInCorner(marker, marker.id)
//         );
//         const matchedIds = matchedMarkers.map((m) => m.id).sort();
//         // console.log("Matched Corner IDs:", matchedIds);

//         const lastDetected = lastDetectedIdsRef.current.join(",");
//         const currentDetected = matchedIds.join(",");

//         if (lastDetected !== currentDetected) {
//           console.log(" Marker IDs changed:", matchedIds);
//           lastDetectedIdsRef.current = matchedIds;
//         }

//         // Alignment logic
//         if (!hasBeenAligned.current && matchedIds.length === 4) {
//           hasBeenAligned.current = true;
//           console.log("Poster aligned!");
//         }

//         const visible = hasBeenAligned.current
//           ? matchedIds.length >= 3
//           : matchedIds.length === 4;

//         setPosterInView(visible);

//         if (matchedIds.length > 0) {
//           setWarningMessage(`Markers visible: ${matchedIds.join(", ")}`);
//         } else {
//           setWarningMessage("No markers detected");
//         }

//         if (visible) {
//           await hands.send({ image: video });
//           setWarningMessage("");
//         } else {
//           pointerRef.current.style.display = "none";
//           resultRef.current.textContent = "Align poster with 4 markers";
//           setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
//         }

//         requestAnimationFrame(detectLoop);
//       };

//       const scaleContainer = () => {
//         const wrapper = containerRef.current?.parentElement;
//         if (!wrapper || !containerRef.current) return;

//         const scaleX = wrapper.clientWidth / 1517;
//         const scaleY = wrapper.clientHeight / 2200;
//         containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
//       };

//       scaleContainer();
//       window.addEventListener("resize", scaleContainer);
//       detectLoop();
//     });
//   }, []);

//   return (
//     <div
//       className="wrapper"
//       style={{
//         position: "relative",
//         width: "100vw",
//         height: "calc(100vw * 2200 / 1517)",
//         maxHeight: "100vh",
//         maxWidth: "calc(100vh * 1517 / 2200)",
//         margin: "auto",
//         background: "black",
//         objectFit: "contain",
//       }}
//     >
//       <div
//         id="container"
//         ref={containerRef}
//         style={{
//           position: "absolute",
//           width: "1517px",
//           height: "2200px",
//           transformOrigin: "top left",
//           border: "5px dashed red",
//         }}
//       >
//         <video
//           ref={videoRef}
//           autoPlay
//           playsInline
//           style={{
//             // position: "absolute",
//             width: "100%",
//             height: "100%",
//             objectFit: "cover",
//             background: "rgba(0,0,0,0.2)",
//            
//           }}
//         />
//         {/* <video
//   ref={videoRef}
//   autoPlay
//   playsInline
//   width={1517}
//   height={2200}
//   style={{
//     position: "absolute",
//     width: "1517px",   
//     height: "2200px",
//     objectFit: "cover",
//     background: "rgba(0,0,0,0.2)",
//   }}
// /> */}

//         {/* <canvas
//           ref={canvasRef}
//           style={{
//             display: "none",
//           }}
//         /> */}
//         <canvas
//           ref={canvasRef}
//           width={1517}
//           height={2200}
//           style={{
//             position: "absolute",
//             width: "1517px",
//             height: "2200px",
//             display: "none",
//           }}
//         />

//         <div
//           ref={pointerRef}
//           style={{
//             position: "absolute",
//             width: "30px",
//             height: "30px",
//             background: "rgba(255,0,0,0.5)",
//             borderRadius: "50%",
//             border: "2px solid white",
//             transform: "translate(-50%, -50%)",
//             pointerEvents: "none",
//             display: "none",
//           }}
//         />
//         <div
//           ref={resultRef}
//           style={{
//             position: "absolute",
//             bottom: "20px",
//             left: "50%",
//             transform: "translateX(-50%)",
//             background: "rgba(0,0,0,0.7)",
//             color: "white",
//             padding: "15px",
//             fontSize: "24px",
//             borderRadius: "10px",
//             fontFamily: "Arial",
//           }}
//         >
//           Loading...
//         </div>
//         {warningMessage && (
//           <div
//             style={{
//               position: "absolute",
//               bottom: "80px",
//               left: "50%",
//               transform: "translateX(-50%)",
//               background: "rgba(255, 165, 0, 0.85)",
//               color: "black",
//               padding: "12px",
//               fontSize: "18px",
//               borderRadius: "8px",
//               fontFamily: "Arial",
//               fontWeight: "bold",
//             }}
//           >
//             ⚠️ {warningMessage}
//           </div>
//         )}

//         <div
//           style={{
//             position: "absolute",
//             top: "20px",
//             left: "50%",
//             transform: "translateX(-50%)",
//             background: "rgba(0,0,0,0.7)",
//             color: "white",
//             padding: "10px",
//             borderRadius: "5px",
//             textAlign: "center",
//             fontFamily: "Arial",
//           }}
//         >
//           Align your poster with the frame and show all 4 markers
//           <br />
//           Point with your index finger
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BMIPointerWithJsAruco;
