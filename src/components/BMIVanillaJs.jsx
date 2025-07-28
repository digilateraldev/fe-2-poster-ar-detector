<!DOCTYPE html>
<html>
<head>
    <title>BMI Poster Pointer (1517x2200)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        html, body {
            margin: 0; padding: 0; height: 100%; background: black;
        }
        .wrapper {
            position: relative;
            width: 100vw;
            height: calc(100vw * 2200 / 1517);
            max-height: 100vh;
            max-width: calc(100vh * 1517 / 2200);
            margin: auto;
        }
        #container {
            position: absolute; top: 0; left: 0;
            width: 1517px; height: 2200px;
            transform-origin: top left;
            border: 5px dashed red;
        }
        #video-feed {
            position: absolute; width: 100%; height: 100%;
            object-fit: cover;
            background: rgba(0,0,0,0.2);
        }
        #pointer {
            position: absolute; width: 30px; height: 30px;
            background: rgba(255,0,0,0.5); border-radius: 50%;
            border: 2px solid white; transform: translate(-50%, -50%);
            pointer-events: none;
        }
        #result {
            position: absolute; bottom: 20px; left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7); color: white;
            padding: 15px; font-size: 24px; border-radius: 10px; font-family: Arial;
        }
        #instructions {
            position: absolute; top: 20px; left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7); color: white; padding: 10px;
            border-radius: 5px; text-align: center; font-family: Arial;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div id="container">
            <video id="video-feed" autoplay playsinline></video>
            <div id="pointer"></div>
            <div id="result">Point at the poster</div>
            <div id="instructions">
                Align your poster with this frame<br>
                Point with your index finger
            </div>
        </div>
    </div>
    <!-- MediaPipe Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
    <script>
        // Update these zones if you have new polygon coordinates for the new poster size
        const zones = {
            "Normal": [[802, 4], [1516, 4], [1517, 1135], [797, 1140]],
            "Underweight": [[800, 1154], [1516, 1149], [1516, 2200], [792, 2200]],
            "Obese": [[4, 1156], [788, 1156], [785, 2200], [4, 2200]],
            "Overweight": [[4, 2], [792, 7], [785, 1140], [4, 1140]]
        };

        const videoElement = document.getElementById('video-feed');
        const pointer = document.getElementById('pointer');
        const resultDiv = document.getElementById('result');
        const container = document.getElementById('container');

        async function setupCamera() {
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
            videoElement.srcObject = stream;
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    resolve(videoElement);
                };
            });
        }

        function isPointInZone(point, zone) {
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
        }

        async function runDetection() {
            await setupCamera();

            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 0,
                minDetectionConfidence: 0.3,
                minTrackingConfidence: 0.3
            });

            hands.onResults((results) => {
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const indexFingerTip = results.multiHandLandmarks[0][8];
                    const x = indexFingerTip.x * 1517;
                    const y = indexFingerTip.y * 2200;

                    pointer.style.display = 'block';
                    pointer.style.left = `${x}px`;
                    pointer.style.top = `${y}px`;

                    let detectedZone = null;
                    for (const [zoneName, zone] of Object.entries(zones)) {
                        if (isPointInZone([x, y], zone)) {
                            detectedZone = zoneName;
                            break;
                        }
                    }
                    resultDiv.textContent = detectedZone ? `Detected: ${detectedZone}` : "Pointing outside zones";
                } else {
                    pointer.style.display = 'none';
                    resultDiv.textContent = "No finger detected";
                }
            });

            // Use animation frame loop, not Camera class!
            async function detectionLoop() {
                await hands.send({ image: videoElement });
                requestAnimationFrame(detectionLoop);
            }
            detectionLoop();

            // Responsive scaling
            function scaleContainer() {
                const wrapper = document.querySelector('.wrapper');
                const scaleX = wrapper.clientWidth / 1517;
                const scaleY = wrapper.clientHeight / 2200;
                container.style.transform = `scale(${scaleX}, ${scaleY})`;
            }
            scaleContainer();
            window.addEventListener('resize', scaleContainer);
        }

        runDetection().catch(err => {
            alert("Detection setup failed: " + err.message);
        });
    </script>
</body>
</html>