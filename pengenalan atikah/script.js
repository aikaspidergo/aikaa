
/* ============================================================
   RETROLENS WEB EDITION
   FULL HAND TRACKING ENGINE
   ------------------------------------------------------------
   Hand Tracking       : MediaPipe Hands
   Dynamic Portal      : 2 Hands / 4+ Landmark
   Gesture Detection   : Open Palm / Fist / Peace / Pinch
   Portal Transform    : Position / Size / Rotation / Shape
   Filters             : Dual Tone / Thermal / Sketch / Pixelate
                         Glitch / Invert / Red / Edge / Blur
                         Cartoon / Rainbow
   ============================================================ */

"use strict";

/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
    willReadFrequently: true
});

const startButton = document.getElementById("startButton");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const fpsValue = document.getElementById("fpsValue");

const welcome = document.getElementById("welcome");

const handCount = document.getElementById("handCount");

const portalStatus = document.getElementById("portalStatus");
const portalDescription = document.getElementById("portalDescription");

const filterNumber = document.getElementById("filterNumber");
const filterName = document.getElementById("filterName");
const secondaryFilter = document.getElementById("secondaryFilter");
const filterButtons = document.getElementById("filterButtons");

const mode2D = document.getElementById("mode2D");
const mode3D = document.getElementById("mode3D");


/* ============================================================
   CANVAS / OFFSCREEN CANVAS
   ============================================================ */

const effectCanvas = document.createElement("canvas");
const effectCtx = effectCanvas.getContext("2d", {
    willReadFrequently: true
});


/* ============================================================
   STATE
   ============================================================ */

let stream = null;
let cameraRunning = false;
let animationId = null;

let handsDetector = null;
let mediaPipeReady = false;

let activeFilter = 0;
let render3D = false;

let frameCounter = 0;
let fps = 0;
let lastFPSUpdate = performance.now();

let lastFilterSwitch = 0;
let lastModeSwitch = 0;

let pinchState = false;
let peaceState = false;
let fistState = false;

let lastGesture = "NONE";

let portalVisible = false;
let portalEnergy = 0;

let lastResults = null;

let smoothedPortal = null;

let previousPortalCenter = null;
let portalVelocity = {
    x: 0,
    y: 0
};

let portalRotation = 0;
let portalScale = 1;


/* ============================================================
   FILTER LIST
   ============================================================ */

const filters = [
    {
        name: "DUAL-TONE",
        key: "dual-tone"
    },
    {
        name: "THERMAL",
        key: "thermal"
    },
    {
        name: "SKETCH",
        key: "sketch"
    },
    {
        name: "PIXELATE",
        key: "pixelate"
    },
    {
        name: "GLITCH",
        key: "glitch"
    },
    {
        name: "INVERT",
        key: "invert"
    },
    {
        name: "RED CHANNEL",
        key: "red-channel"
    },
    {
        name: "EDGE",
        key: "edge"
    },
    {
        name: "BLUR",
        key: "blur"
    },
    {
        name: "CARTOON",
        key: "cartoon"
    },
    {
        name: "RAINBOW WAVE",
        key: "rainbow-wave"
    }
];


/* ============================================================
   MEDIAPIPE HAND CONNECTIONS
   ============================================================ */

const HAND_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17]
];


/* ============================================================
   UTILITY
   ============================================================ */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function lerp(a, b, amount) {
    return a + (b - a) * amount;
}


function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


function midpoint(a, b) {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };
}


function angleBetween(a, b) {
    return Math.atan2(
        b.y - a.y,
        b.x - a.x
    );
}


/* ============================================================
   CREATE FILTER BUTTONS
   ============================================================ */

function createFilterButtons() {

    if (!filterButtons) {
        return;
    }

    filterButtons.innerHTML = "";

    filters.forEach((filter, index) => {

        const button =
            document.createElement("button");

        button.className = "filter-button";

        if (index === activeFilter) {
            button.classList.add("active");
        }

        button.textContent =
            String(index + 1).padStart(2, "0") +
            "  " +
            filter.name;

        button.addEventListener("click", () => {

            activeFilter = index;

            updateFilterUI();
        });

        filterButtons.appendChild(button);
    });
}


/* ============================================================
   UPDATE FILTER UI
   ============================================================ */

function updateFilterUI() {

    if (!filters.length) {
        return;
    }

    const current =
        filters[activeFilter];

    const next =
        filters[
            (activeFilter + 1) %
            filters.length
        ];

    if (filterNumber) {
        filterNumber.textContent =
            String(activeFilter + 1).padStart(2, "0");
    }

    if (filterName) {
        filterName.textContent =
            current.name;
    }

    if (secondaryFilter) {
        secondaryFilter.textContent =
            "NEXT: " + next.name;
    }

    if (filterButtons) {

        const buttons =
            filterButtons.querySelectorAll(
                ".filter-button"
            );

        buttons.forEach((button, index) => {

            button.classList.toggle(
                "active",
                index === activeFilter
            );
        });
    }
}


/* ============================================================
   NEXT FILTER
   ============================================================ */

function nextFilter() {

    activeFilter++;

    if (
        activeFilter >=
        filters.length
    ) {
        activeFilter = 0;
    }

    updateFilterUI();
}


/* ============================================================
   PREVIOUS FILTER
   ============================================================ */

function previousFilter() {

    activeFilter--;

    if (activeFilter < 0) {
        activeFilter =
            filters.length - 1;
    }

    updateFilterUI();
}


/* ============================================================
   START CAMERA
   ============================================================ */

async function startCamera() {

    if (cameraRunning) {
        return;
    }

    try {

        statusText.textContent =
            "STARTING CAMERA...";

        statusDot.classList.add(
            "loading"
        );

        stream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    },

                    facingMode: "user",

                    frameRate: {
                        ideal: 30,
                        max: 60
                    }
                },

                audio: false
            });

        video.srcObject = stream;

        video.setAttribute(
            "playsinline",
            ""
        );

        video.muted = true;

        await video.play();

        const width =
            video.videoWidth ||
            1280;

        const height =
            video.videoHeight ||
            720;

        canvas.width = width;
        canvas.height = height;

        effectCanvas.width = width;
        effectCanvas.height = height;

        cameraRunning = true;

        welcome.classList.add(
            "hidden"
        );

        welcome.style.display = "none";

        statusText.textContent =
            "CAMERA ONLINE";

        statusDot.classList.remove(
            "loading"
        );

        statusDot.classList.add(
            "online"
        );

        portalStatus.textContent =
            "SCANNING";

        portalDescription.textContent =
            "Tunjukkan kedua tangan ke kamera.";

        resetTrackingState();

        await startHandTracking();

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        cameraRunning = false;

        statusText.textContent =
            "CAMERA ERROR";

        portalStatus.textContent =
            "ERROR";

        portalDescription.textContent =
            "Kamera tidak dapat diakses. Pastikan izin kamera diberikan.";

        statusDot.classList.remove(
            "loading"
        );

        statusDot.classList.remove(
            "online"
        );
    }
}


/* ============================================================
   STOP CAMERA
   ============================================================ */

function stopCamera() {

    cameraRunning = false;

    if (animationId) {

        cancelAnimationFrame(
            animationId
        );

        animationId = null;
    }

    if (stream) {

        stream
            .getTracks()
            .forEach(track => {
                track.stop();
            });

        stream = null;
    }

    video.srcObject = null;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    welcome.style.display =
        "flex";

    welcome.classList.remove(
        "hidden"
    );

    statusText.textContent =
        "CAMERA OFFLINE";

    statusDot.classList.remove(
        "online"
    );

    statusDot.classList.remove(
        "loading"
    );

    handCount.textContent =
        "HANDS: 0";

    portalStatus.textContent =
        "WAITING";

    portalDescription.textContent =
        "Bentangkan kedua tangan untuk membuka portal.";

    fpsValue.textContent =
        "--";

    resetTrackingState();
}


/* ============================================================
   RESET TRACKING
   ============================================================ */

function resetTrackingState() {

    lastResults = null;

    smoothedPortal = null;

    portalVisible = false;

    portalEnergy = 0;

    previousPortalCenter = null;

    portalVelocity.x = 0;
    portalVelocity.y = 0;

    portalRotation = 0;
    portalScale = 1;

    pinchState = false;
    peaceState = false;
    fistState = false;

    lastGesture = "NONE";
}


/* ============================================================
   SETUP MEDIAPIPE
   ============================================================ */

function setupMediaPipe() {

    if (
        typeof Hands ===
        "undefined"
    ) {

        console.error(
            "MediaPipe Hands tidak ditemukan."
        );

        portalStatus.textContent =
            "MEDIAPIPE ERROR";

        portalDescription.textContent =
            "Library MediaPipe Hands belum dimuat.";

        return false;
    }

    if (handsDetector) {
        return true;
    }

    handsDetector =
        new Hands({

            locateFile: file => {

                return (
                    "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" +
                    file
                );
            }
        });

    handsDetector.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence:
            0.65,

        minTrackingConfidence:
            0.65
    });

    handsDetector.onResults(
        handleResults
    );

    mediaPipeReady = true;

    return true;
}


/* ============================================================
   START HAND TRACKING
   ============================================================ */

async function startHandTracking() {

    if (!setupMediaPipe()) {
        return;
    }

    processFrame();
}


/* ============================================================
   PROCESS CAMERA FRAME
   ============================================================ */

async function processFrame() {

    if (!cameraRunning) {
        return;
    }

    if (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        handsDetector
    ) {

        try {

            await handsDetector.send({
                image: video
            });

        } catch (error) {

            console.error(
                "MediaPipe error:",
                error
            );
        }
    }

    animationId =
        requestAnimationFrame(
            processFrame
        );
}


/* ============================================================
   CONVERT LANDMARK TO SCREEN COORDINATE
   ------------------------------------------------------------
   Camera is mirrored.
   Therefore x coordinate must be inverted.
   ============================================================ */

function screenPoint(
    landmark,
    width,
    height
) {

    return {
        x:
            width -
            landmark.x * width,

        y:
            landmark.y * height
    };
}


/* ============================================================
   CONVERT WHOLE HAND
   ============================================================ */

function convertHandToScreen(
    landmarks,
    width,
    height
) {

    return landmarks.map(
        landmark =>
            screenPoint(
                landmark,
                width,
                height
            )
    );
}


/* ============================================================
   MEDIAPIPE RESULTS
   ============================================================ */

function handleResults(results) {

    if (!cameraRunning) {
        return;
    }

    const width =
        canvas.width;

    const height =
        canvas.height;

    lastResults = results;

    /* --------------------------------------------------------
       DRAW ORIGINAL MIRRORED CAMERA
       -------------------------------------------------------- */

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.save();

    ctx.translate(
        width,
        0
    );

    ctx.scale(
        -1,
        1
    );

    ctx.drawImage(
        results.image,
        0,
        0,
        width,
        height
    );

    ctx.restore();


    /* --------------------------------------------------------
       HANDS
       -------------------------------------------------------- */

    const rawHands =
        results.multiHandLandmarks ||
        [];

    const screenHands =
        rawHands.map(
            hand =>
                convertHandToScreen(
                    hand,
                    width,
                    height
                )
        );

    handCount.textContent =
        "HANDS: " +
        screenHands.length;


    /* --------------------------------------------------------
       DRAW HAND TRACKING
       -------------------------------------------------------- */

    screenHands.forEach(
        landmarks => {

            drawHand(
                landmarks,
                width,
                height
            );
        }
    );


    /* --------------------------------------------------------
       GESTURES
       -------------------------------------------------------- */

    const gesture =
        detectGestures(
            screenHands,
            width,
            height
        );


    /* --------------------------------------------------------
       PORTAL
       -------------------------------------------------------- */

    if (
        screenHands.length >= 2
    ) {

        const portal =
            calculateDynamicPortal(
                screenHands[0],
                screenHands[1],
                width,
                height
            );

        if (portal) {

            portalVisible = true;

            portalEnergy =
                lerp(
                    portalEnergy,
                    1,
                    0.18
                );

            updatePortalMotion(
                portal
            );

            const dynamicPortal =
                smoothPortal(
                    portal
                );

            drawPortal(
                dynamicPortal,
                width,
                height,
                gesture
            );

            portalStatus.textContent =
                "PORTAL OPEN";

            portalDescription.textContent =
                getPortalDescription(
                    gesture
                );

        } else {

            portalVisible = false;

            portalEnergy =
                lerp(
                    portalEnergy,
                    0,
                    0.2
                );

            portalStatus.textContent =
                "SCANNING";

            portalDescription.textContent =
                "Posisikan kedua tangan agar lebih terlihat.";
        }

    } else {

        portalVisible = false;

        portalEnergy =
            lerp(
                portalEnergy,
                0,
                0.2
            );

        portalStatus.textContent =
            "WAITING";

        portalDescription.textContent =
            "Bentangkan kedua tangan untuk membuka portal.";
    }


    /* --------------------------------------------------------
       FPS
       -------------------------------------------------------- */

    updateFPS();
}


/* ============================================================
   DRAW HAND
   ============================================================ */

function drawHand(
    landmarks,
    width,
    height
) {

    ctx.save();

    ctx.lineWidth = 2;

    ctx.strokeStyle =
        "rgba(255,79,216,0.85)";

    ctx.shadowColor =
        "#ff4fd8";

    ctx.shadowBlur = 5;


    /* --------------------------------------------------------
       CONNECTIONS
       -------------------------------------------------------- */

    HAND_CONNECTIONS.forEach(
        connection => {

            const a =
                landmarks[
                    connection[0]
                ];

            const b =
                landmarks[
                    connection[1]
                ];

            if (!a || !b) {
                return;
            }

            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );

            ctx.stroke();
        }
    );


    /* --------------------------------------------------------
       LANDMARKS
       -------------------------------------------------------- */

    ctx.shadowBlur = 8;

    landmarks.forEach(
        (point, index) => {

            let radius = 3;

            if (
                index === 4 ||
                index === 8 ||
                index === 20
            ) {
                radius = 5;
            }

            ctx.beginPath();

            ctx.arc(
                point.x,
                point.y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                index === 4 ||
                index === 8 ||
                index === 20
                    ? "#ff4fd8"
                    : "#ffffff";

            ctx.fill();
        }
    );

    ctx.restore();
}


/* ============================================================
   CALCULATE DYNAMIC PORTAL
   ------------------------------------------------------------
   Portal is NOT just a rectangle.

   Four corners:
       Thumb 1
       Index 1
       Index 2
       Thumb 2

   This means changing hand shape changes
   the shape of the portal.
   ============================================================ */

function calculateDynamicPortal(
    hand1,
    hand2,
    width,
    height
) {

    if (
        !hand1 ||
        !hand2 ||
        hand1.length < 21 ||
        hand2.length < 21
    ) {
        return null;
    }


    /* --------------------------------------------------------
       MAIN FOUR CORNERS
       -------------------------------------------------------- */

    const p1 =
        hand1[4];

    const p2 =
        hand1[8];

    const p3 =
        hand2[8];

    const p4 =
        hand2[4];


    /* --------------------------------------------------------
       CENTER
       -------------------------------------------------------- */

    const center12 =
        midpoint(
            p1,
            p3
        );

    const center24 =
        midpoint(
            p2,
            p4
        );

    const center =
        midpoint(
            center12,
            center24
        );


    /* --------------------------------------------------------
       WIDTH / HEIGHT
       -------------------------------------------------------- */

    const horizontal1 =
        distance(
            p1,
            p2
        );

    const horizontal2 =
        distance(
            p4,
            p3
        );

    const vertical1 =
        distance(
            p1,
            p4
        );

    const vertical2 =
        distance(
            p2,
            p3
        );

    const portalWidth =
        (
            horizontal1 +
            horizontal2
        ) / 2;

    const portalHeight =
        (
            vertical1 +
            vertical2
        ) / 2;


    /* --------------------------------------------------------
       MINIMUM SIZE
       -------------------------------------------------------- */

    if (
        portalWidth < 45 ||
        portalHeight < 45
    ) {
        return null;
    }


    /* --------------------------------------------------------
       ROTATION

       Rotation is determined by the line connecting
       both index fingers.
       -------------------------------------------------------- */

    const rotation =
        angleBetween(
            p2,
            p3
        );


    /* --------------------------------------------------------
       HAND OPENNESS
       -------------------------------------------------------- */

    const open1 =
        getHandOpenness(
            hand1
        );

    const open2 =
        getHandOpenness(
            hand2
        );

    const openness =
        (
            open1 +
            open2
        ) / 2;


    /* --------------------------------------------------------
       SCALE

       Open hands = larger portal
       Closed hands = smaller portal
       -------------------------------------------------------- */

    const scale =
        clamp(
            0.65 +
            openness * 0.75,
            0.65,
            1.45
        );


    /* --------------------------------------------------------
       ENERGY

       More open hand = stronger portal.
       -------------------------------------------------------- */

    const energy =
        clamp(
            openness,
            0.15,
            1
        );


    return {

        points: [
            p1,
            p2,
            p3,
            p4
        ],

        center,

        width:
            portalWidth * scale,

        height:
            portalHeight * scale,

        rotation,

        scale,

        openness,

        energy
    };
}


/* ============================================================
   HAND OPENNESS
   ------------------------------------------------------------
   Calculates how open the fingers are.
   This is what makes changing hand shapes matter.
   ============================================================ */

function getHandOpenness(hand) {

    if (
        !hand ||
        hand.length < 21
    ) {
        return 0;
    }

    const wrist =
        hand[0];

    const fingerPairs = [
        [8, 5],
        [12, 9],
        [16, 13],
        [20, 17]
    ];

    let score = 0;

    fingerPairs.forEach(
        pair => {

            const tip =
                hand[pair[0]];

            const base =
                hand[pair[1]];

            const tipDistance =
                distance(
                    tip,
                    wrist
                );

            const baseDistance =
                distance(
                    base,
                    wrist
                );

            if (
                tipDistance >
                baseDistance * 1.35
            ) {
                score++;
            }
        }
    );

    /* --------------------------------------------------------
       THUMB
       -------------------------------------------------------- */

    const thumbTip =
        hand[4];

    const indexBase =
        hand[5];

    const thumbDistance =
        distance(
            thumbTip,
            wrist
        );

    const thumbBaseDistance =
        distance(
            indexBase,
            wrist
        );

    if (
        thumbDistance >
        thumbBaseDistance * 1.1
    ) {
        score += 0.5;
    }

    return clamp(
        score / 4.5,
        0,
        1
    );
}


/* ============================================================
   SMOOTH PORTAL
   ------------------------------------------------------------
   Removes jitter from hand tracking.
   ============================================================ */

function smoothPortal(portal) {

    if (!smoothedPortal) {

        smoothedPortal = {

            points:
                portal.points.map(
                    p => ({
                        x: p.x,
                        y: p.y
                    })
                ),

            center: {
                x: portal.center.x,
                y: portal.center.y
            },

            width:
                portal.width,

            height:
                portal.height,

            rotation:
                portal.rotation,

            scale:
                portal.scale,

            openness:
                portal.openness,

            energy:
                portal.energy
        };

        return smoothedPortal;
    }


    const smoothing =
        0.22;


    portal.points.forEach(
        (point, index) => {

            smoothedPortal.points[index].x =
                lerp(
                    smoothedPortal.points[index].x,
                    point.x,
                    smoothing
                );

            smoothedPortal.points[index].y =
                lerp(
                    smoothedPortal.points[index].y,
                    point.y,
                    smoothing
                );
        }
    );


    smoothedPortal.center.x =
        lerp(
            smoothedPortal.center.x,
            portal.center.x,
            smoothing
        );

    smoothedPortal.center.y =
        lerp(
            smoothedPortal.center.y,
            portal.center.y,
            smoothing
        );

    smoothedPortal.width =
        lerp(
            smoothedPortal.width,
            portal.width,
            smoothing
        );

    smoothedPortal.height =
        lerp(
            smoothedPortal.height,
            portal.height,
            smoothing
        );

    smoothedPortal.scale =
        lerp(
            smoothedPortal.scale,
            portal.scale,
            smoothing
        );

    smoothedPortal.openness =
        lerp(
            smoothedPortal.openness,
            portal.openness,
            smoothing
        );

    smoothedPortal.energy =
        lerp(
            smoothedPortal.energy,
            portal.energy,
            smoothing
        );


    /* --------------------------------------------------------
       SMOOTH ANGLE
       -------------------------------------------------------- */

    let angleDifference =
        portal.rotation -
        smoothedPortal.rotation;

    while (
        angleDifference >
        Math.PI
    ) {
        angleDifference -=
            Math.PI * 2;
    }

    while (
        angleDifference <
        -Math.PI
    ) {
        angleDifference +=
            Math.PI * 2;
    }

    smoothedPortal.rotation +=
        angleDifference * 0.18;


    return smoothedPortal;
}


/* ============================================================
   UPDATE PORTAL MOTION
   ============================================================ */

function updatePortalMotion(portal) {

    if (!previousPortalCenter) {

        previousPortalCenter = {
            x: portal.center.x,
            y: portal.center.y
        };

        return;
    }


    portalVelocity.x =
        lerp(
            portalVelocity.x,
            portal.center.x -
            previousPortalCenter.x,
            0.35
        );

    portalVelocity.y =
        lerp(
            portalVelocity.y,
            portal.center.y -
            previousPortalCenter.y,
            0.35
        );


    previousPortalCenter.x =
        portal.center.x;

    previousPortalCenter.y =
        portal.center.y;


    /* --------------------------------------------------------
       Motion influences portal rotation slightly.
       -------------------------------------------------------- */

    portalRotation =
        lerp(
            portalRotation,
            portalVelocity.x * 0.02,
            0.1
        );
}


/* ============================================================
   DRAW PORTAL
   ============================================================ */

function drawPortal(
    portal,
    width,
    height,
    gesture
) {

    if (!portal) {
        return;
    }


    const points =
        portal.points;


    /* --------------------------------------------------------
       PORTAL FILTER
       -------------------------------------------------------- */

    drawFilteredPortal(
        points,
        width,
        height
    );


    /* --------------------------------------------------------
       PORTAL ENERGY
       -------------------------------------------------------- */

    const energy =
        portalEnergy *
        portal.energy;


    /* --------------------------------------------------------
       OUTER GLOW
       -------------------------------------------------------- */

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        points[0].y
    );

    for (
        let i = 1;
        i < points.length;
        i++
    ) {

        ctx.lineTo(
            points[i].x,
            points[i].y
        );
    }

    ctx.closePath();

    ctx.strokeStyle =
        `rgba(255,79,216,${0.18 * energy})`;

    ctx.lineWidth =
        18 +
        portal.width * 0.015;

    ctx.shadowColor =
        "#ff3cac";

    ctx.shadowBlur =
        35 +
        portal.width * 0.04;

    ctx.stroke();

    ctx.restore();


    /* --------------------------------------------------------
       MAIN PORTAL BORDER
       -------------------------------------------------------- */

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        points[0].y
    );

    for (
        let i = 1;
        i < points.length;
        i++
    ) {

        ctx.lineTo(
            points[i].x,
            points[i].y
        );
    }

    ctx.closePath();

    ctx.strokeStyle =
        "#ff4fd8";

    ctx.lineWidth =
        3 +
        energy * 2;

    ctx.shadowColor =
        "#ff4fd8";

    ctx.shadowBlur =
        12 +
        energy * 20;

    ctx.stroke();

    ctx.restore();


    /* --------------------------------------------------------
       INNER PORTAL
       -------------------------------------------------------- */

    drawPortalInnerLines(
        points,
        energy
    );


    /* --------------------------------------------------------
       CORNER ENERGY
       -------------------------------------------------------- */

    drawPortalParticles(
        portal,
        width,
        height,
        energy
    );


    /* --------------------------------------------------------
       3D
       -------------------------------------------------------- */

    if (render3D) {

        draw3DPortal(
            portal,
            width,
            height
        );
    }


    /* --------------------------------------------------------
       GESTURE LABEL
       -------------------------------------------------------- */

    if (
        gesture &&
        gesture !== "NONE"
    ) {

        drawGestureIndicator(
            portal.center,
            gesture
        );
    }
}


/* ============================================================
   FILTERED PORTAL
   ============================================================ */

function drawFilteredPortal(
    points,
    width,
    height
) {

    if (!points || points.length !== 4) {
        return;
    }


    const xs =
        points.map(
            p => p.x
        );

    const ys =
        points.map(
            p => p.y
        );


    const minX =
        clamp(
            Math.floor(
                Math.min(...xs)
            ) - 5,
            0,
            width
        );

    const maxX =
        clamp(
            Math.ceil(
                Math.max(...xs)
            ) + 5,
            0,
            width
        );

    const minY =
        clamp(
            Math.floor(
                Math.min(...ys)
            ) - 5,
            0,
            height
        );

    const maxY =
        clamp(
            Math.ceil(
                Math.max(...ys)
            ) + 5,
            0,
            height
        );


    const cropWidth =
        maxX - minX;

    const cropHeight =
        maxY - minY;


    if (
        cropWidth < 10 ||
        cropHeight < 10
    ) {
        return;
    }


    /* --------------------------------------------------------
       GET CAMERA AREA
       -------------------------------------------------------- */

    let imageData;

    try {

        imageData =
            ctx.getImageData(
                minX,
                minY,
                cropWidth,
                cropHeight
            );

    } catch (error) {

        console.warn(
            "getImageData failed:",
            error
        );

        return;
    }


    /* --------------------------------------------------------
       APPLY FILTER
       -------------------------------------------------------- */

    applyFilter(
        imageData,
        filters[activeFilter].key,
        cropWidth,
        cropHeight
    );


    effectCtx.clearRect(
        0,
        0,
        cropWidth,
        cropHeight
    );

    effectCanvas.width =
        cropWidth;

    effectCanvas.height =
        cropHeight;

    effectCtx.putImageData(
        imageData,
        0,
        0
    );


    /* --------------------------------------------------------
       CLIP TO HAND PORTAL SHAPE
       -------------------------------------------------------- */

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        points[0].y
    );

    for (
        let i = 1;
        i < points.length;
        i++
    ) {

        ctx.lineTo(
            points[i].x,
            points[i].y
        );
    }

    ctx.closePath();

    ctx.clip();


    ctx.globalAlpha =
        0.95;

    ctx.drawImage(
        effectCanvas,
        minX,
        minY
    );

    ctx.restore();
}


/* ============================================================
   FILTER ENGINE
   ============================================================ */

function applyFilter(
    imageData,
    filter,
    width,
    height
) {

    const data =
        imageData.data;


    /* --------------------------------------------------------
       BASIC FILTERS
       -------------------------------------------------------- */

    for (
        let y = 0;
        y < height;
        y++
    ) {

        for (
            let x = 0;
            x < width;
            x++
        ) {

            const index =
                (
                    y *
                    width +
                    x
                ) * 4;

            let r =
                data[index];

            let g =
                data[index + 1];

            let b =
                data[index + 2];


            /* =================================================
               DUAL TONE
               ================================================= */

            if (
                filter ===
                "dual-tone"
            ) {

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                if (gray > 115) {

                    r = 255;
                    g = 145;
                    b = 15;

                } else {

                    r = 220;
                    g = 25;
                    b = 185;
                }
            }


            /* =================================================
               THERMAL
               ================================================= */

            else if (
                filter ===
                "thermal"
            ) {

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                const t =
                    gray / 255;

                r =
                    clamp(
                        255 *
                        Math.min(
                            1,
                            t * 2.2
                        ),
                        0,
                        255
                    );

                g =
                    clamp(
                        255 *
                        Math.sin(
                            t * Math.PI
                        ),
                        0,
                        255
                    );

                b =
                    clamp(
                        255 *
                        (1 - t) *
                        1.5,
                        0,
                        255
                    );
            }


            /* =================================================
               SKETCH
               ================================================= */

            else if (
                filter ===
                "sketch"
            ) {

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                const contrast =
                    clamp(
                        (
                            gray -
                            128
                        ) * 1.8 +
                        128,
                        0,
                        255
                    );

                r = contrast;
                g = contrast;
                b = contrast;
            }


            /* =================================================
               PIXELATE
               ================================================= */

            else if (
                filter ===
                "pixelate"
            ) {

                const block =
                    7;

                const sourceX =
                    Math.floor(
                        x / block
                    ) * block;

                const sourceY =
                    Math.floor(
                        y / block
                    ) * block;

                const sourceIndex =
                    (
                        sourceY *
                        width +
                        sourceX
                    ) * 4;

                r =
                    data[
                        sourceIndex
                    ];

                g =
                    data[
                        sourceIndex + 1
                    ];

                b =
                    data[
                        sourceIndex + 2
                    ];
            }


            /* =================================================
               GLITCH
               ================================================= */

            else if (
                filter ===
                "glitch"
            ) {

                const shiftedX =
                    clamp(
                        x +
                        (
                            Math.random() <
                            0.04
                                ? Math.floor(
                                    Math.random() * 35
                                ) - 17
                                : 0
                        ),
                        0,
                        width - 1
                    );

                const shiftedIndex =
                    (
                        y *
                        width +
                        shiftedX
                    ) * 4;

                r =
                    data[
                        shiftedIndex
                    ];

                g =
                    data[
                        index + 1
                    ];

                b =
                    data[
                        index + 2
                    ];

                if (
                    Math.random() <
                    0.035
                ) {

                    r =
                        255 - r;
                }

                if (
                    Math.random() <
                    0.035
                ) {

                    b =
                        255 - b;
                }
            }


            /* =================================================
               INVERT
               ================================================= */

            else if (
                filter ===
                "invert"
            ) {

                r =
                    255 - r;

                g =
                    255 - g;

                b =
                    255 - b;
            }


            /* =================================================
               RED CHANNEL
               ================================================= */

            else if (
                filter ===
                "red-channel"
            ) {

                g *= 0.08;
                b *= 0.08;

                r =
                    clamp(
                        r * 1.25,
                        0,
                        255
                    );
            }


            /* =================================================
               EDGE
               ================================================= */

            else if (
                filter ===
                "edge"
            ) {

                const rightX =
                    Math.min(
                        width - 1,
                        x + 1
                    );

                const downY =
                    Math.min(
                        height - 1,
                        y + 1
                    );

                const rightIndex =
                    (
                        y *
                        width +
                        rightX
                    ) * 4;

                const downIndex =
                    (
                        downY *
                        width +
                        x
                    ) * 4;

                const currentGray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                const rightGray =
                    0.299 *
                        data[
                            rightIndex
                        ] +
                    0.587 *
                        data[
                            rightIndex + 1
                        ] +
                    0.114 *
                        data[
                            rightIndex + 2
                        ];

                const downGray =
                    0.299 *
                        data[
                            downIndex
                        ] +
                    0.587 *
                        data[
                            downIndex + 1
                        ] +
                    0.114 *
                        data[
                            downIndex + 2
                        ];

                const edge =
                    Math.abs(
                        currentGray -
                        rightGray
                    ) +
                    Math.abs(
                        currentGray -
                        downGray
                    );

                if (edge > 40) {

                    r = 255;
                    g = 50;
                    b = 220;

                } else {

                    r = 5;
                    g = 5;
                    b = 10;
                }
            }


            /* =================================================
               BLUR
               ================================================= */

            else if (
                filter ===
                "blur"
            ) {

                /*
                 * Simple soft average.
                 * The portal itself is clipped,
                 * so only its inside receives the effect.
                 */

                const left =
                    Math.max(
                        0,
                        x - 2
                    );

                const right =
                    Math.min(
                        width - 1,
                        x + 2
                    );

                const top =
                    Math.max(
                        0,
                        y - 2
                    );

                const bottom =
                    Math.min(
                        height - 1,
                        y + 2
                    );

                let sr = 0;
                let sg = 0;
                let sb = 0;
                let count = 0;

                for (
                    let sy = top;
                    sy <= bottom;
                    sy++
                ) {

                    for (
                        let sx = left;
                        sx <= right;
                        sx++
                    ) {

                        const si =
                            (
                                sy *
                                width +
                                sx
                            ) * 4;

                        sr +=
                            data[si];

                        sg +=
                            data[si + 1];

                        sb +=
                            data[si + 2];

                        count++;
                    }
                }

                r =
                    sr / count;

                g =
                    sg / count;

                b =
                    sb / count;
            }


            /* =================================================
               CARTOON
               ================================================= */

            else if (
                filter ===
                "cartoon"
            ) {

                r =
                    Math.round(
                        r / 45
                    ) * 45;

                g =
                    Math.round(
                        g / 45
                    ) * 45;

                b =
                    Math.round(
                        b / 45
                    ) * 45;
            }


            /* =================================================
               RAINBOW WAVE
               ================================================= */

            else if (
                filter ===
                "rainbow-wave"
            ) {

                const wave =
                    Math.sin(
                        x * 0.06 +
                        performance.now() *
                        0.006
                    );

                const wave2 =
                    Math.sin(
                        y * 0.04 +
                        performance.now() *
                        0.004
                    );

                r =
                    clamp(
                        r * 0.35 +
                        (
                            wave + 1
                        ) * 90,
                        0,
                        255
                    );

                g =
                    clamp(
                        g * 0.35 +
                        (
                            wave2 + 1
                        ) * 80,
                        0,
                        255
                    );

                b =
                    clamp(
                        b * 0.45 +
                        120 +
                        (
                            wave -
                            wave2
                        ) * 40,
                        0,
                        255
                    );
            }


            data[index] =
                clamp(
                    r,
                    0,
                    255
                );

            data[index + 1] =
                clamp(
                    g,
                    0,
                    255
                );

            data[index + 2] =
                clamp(
                    b,
                    0,
                    255
                );
        }
    }
}


/* ============================================================
   PORTAL INNER LINES
   ============================================================ */

function drawPortalInnerLines(
    points,
    energy
) {

    ctx.save();

    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        const t =
            i / 6;

        const top =
            interpolatePoint(
                points[0],
                points[1],
                t
            );

        const bottom =
            interpolatePoint(
                points[3],
                points[2],
                t
            );

        ctx.beginPath();

        ctx.moveTo(
            top.x,
            top.y
        );

        ctx.lineTo(
            bottom.x,
            bottom.y
        );

        ctx.strokeStyle =
            `rgba(0,234,255,${0.08 * energy})`;

        ctx.lineWidth = 1;

        ctx.stroke();
    }

    ctx.restore();
}


/* ============================================================
   INTERPOLATE POINT
   ============================================================ */

function interpolatePoint(
    a,
    b,
    t
) {

    return {
        x:
            lerp(
                a.x,
                b.x,
                t
            ),

        y:
            lerp(
                a.y,
                b.y,
                t
            )
    };
}


/* ============================================================
   PORTAL PARTICLES
   ============================================================ */

function drawPortalParticles(
    portal,
    width,
    height,
    energy
) {

    const center =
        portal.center;

    const particleCount =
        Math.floor(
            12 +
            energy * 18
        );

    ctx.save();

    for (
        let i = 0;
        i < particleCount;
        i++
    ) {

        const time =
            performance.now() *
            0.001;

        const angle =
            time *
            (
                0.5 +
                i * 0.035
            ) +
            i;

        const radius =
            (
                portal.width +
                portal.height
            ) *
            0.08 +
            (
                i % 5
            ) * 10;

        const x =
            center.x +
            Math.cos(angle) *
            radius;
  const y =
            center.y +
            Math.sin(angle) *
            radius;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            1 +
            energy * 1.5,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            i % 2 === 0
                ? "#ff4fd8"
                : "#00eaff";

        ctx.shadowColor =
            ctx.fillStyle;

        ctx.shadowBlur =
            8;

        ctx.fill();
    }

    ctx.restore();
}


/* ============================================================
   3D PORTAL
   ============================================================ */

function draw3DPortal(
    portal,
    width,
    height
) {

    const points =
        portal.points;

    ctx.save();

    const layers = 7;

    for (
        let i = 1;
        i <= layers;
        i++
    ) {

        const offset =
            i * 6;

        const alpha =
            0.20 -
            i * 0.022;

        ctx.beginPath();

        points.forEach(
            (point, index) => {

                const x =
                    point.x +
                    offset *
                    Math.cos(
                        portal.rotation
                    );

                const y =
                    point.y +
                    offset *
                    Math.sin(
                        portal.rotation
                    );

                if (
                    index === 0
                ) {

                    ctx.moveTo(
                        x,
                        y
                    );

                } else {

                    ctx.lineTo(
                        x,
                        y
                    );
                }
            }
        );

        ctx.closePath();

        ctx.strokeStyle =
            `rgba(255,79,216,${alpha})`;

        ctx.lineWidth = 2;

        ctx.shadowColor =
            "#ff3cac";

        ctx.shadowBlur =
            10;

        ctx.stroke();
    }

    ctx.restore();
}


/* ============================================================
   GESTURE DETECTION
   ============================================================ */

function detectGestures(
    hands,
    width,
    height
) {

    if (!hands.length) {

        pinchState = false;
        peaceState = false;
        fistState = false;

        lastGesture = "NONE";

        return "NONE";
    }


    const now =
        performance.now();


    /* ========================================================
       PINCH
       ======================================================== */

    let detectedPinch =
        false;

    hands.forEach(
        hand => {

            const thumb =
                hand[4];

            const index =
                hand[8];

            const d =
                distance(
                    thumb,
                    index
                );

            if (
                d <
                Math.min(
                    width,
                    height
                ) * 0.055
            ) {

                detectedPinch = true;
            }
        }
    );


    if (
        detectedPinch &&
        !pinchState &&
        now -
        lastFilterSwitch >
        450
    ) {

        nextFilter();

        lastFilterSwitch =
            now;
    }

    pinchState =
        detectedPinch;


    /* ========================================================
       PEACE
       ======================================================== */

    let detectedPeace =
        false;

    hands.forEach(
        hand => {

            if (
                isPeace(
                    hand
                )
            ) {

                detectedPeace = true;
            }
        }
    );


    if (
        detectedPeace &&
        !peaceState
    ) {

        /*
         * Peace gesture does not immediately
         * change filter.
         *
         * It is used as a visual gesture state.
         */

        lastGesture =
            "PEACE";
    }

    peaceState =
        detectedPeace;


    /* ========================================================
       TWO FISTS = 3D
       ======================================================== */

    let bothFists =
        false;

    if (
        hands.length >= 2
    ) {

        bothFists =
            isFist(hands[0]) &&
            isFist(hands[1]);
    }


    if (
        bothFists &&
        !fistState &&
        now -
        lastModeSwitch >
        1200
    ) {

        toggleMode();

        lastModeSwitch =
            now;
    }

    fistState =
        bothFists;


    /* ========================================================
       GESTURE PRIORITY
       ======================================================== */

    if (bothFists) {

        lastGesture =
            "FIST";

        return "FIST";
    }

    if (detectedPinch) {

        lastGesture =
            "PINCH";

        return "PINCH";
    }

    if (detectedPeace) {

        lastGesture =
            "PEACE";

        return "PEACE";
    }


    lastGesture =
        "OPEN";

    return "OPEN";
}


/* ============================================================
   PEACE DETECTION
   ============================================================ */

function isPeace(hand) {

    if (
        !hand ||
        hand.length < 21
    ) {
        return false;
    }

    const indexOpen =
        fingerIsExtended(
            hand,
            8,
            6
        );

    const middleOpen =
        fingerIsExtended(
            hand,
            12,
            10
        );

    const ringClosed =
        !fingerIsExtended(
            hand,
            16,
            14
        );

    const pinkyClosed =
        !fingerIsExtended(
            hand,
            20,
            18
        );

    return (
        indexOpen &&
        middleOpen &&
        ringClosed &&
        pinkyClosed
    );
}


/* ============================================================
   FINGER EXTENDED
   ============================================================ */

function fingerIsExtended(
    hand,
    tipIndex,
    jointIndex
) {

    const wrist =
        hand[0];

    const tip =
        hand[tipIndex];

    const joint =
        hand[jointIndex];

    const tipDistance =
        distance(
            tip,
            wrist
        );

    const jointDistance =
        distance(
            joint,
            wrist
        );

    return (
        tipDistance >
        jointDistance * 1.22
    );
}


/* ============================================================
   FIST DETECTION
   ============================================================ */

function isFist(hand) {

    if (
        !hand ||
        hand.length < 21
    ) {
        return false;
    }

    const wrist =
        hand[0];

    const tips = [
        hand[8],
        hand[12],
        hand[16],
        hand[20]
    ];

    let average =
        0;

    tips.forEach(
        tip => {

            average +=
                distance(
                    tip,
                    wrist
                );
        }
    );

    average /=
        tips.length;


    return (
        average <
        0.23
    );
}


/* ============================================================
   GESTURE INDICATOR
   ============================================================ */

function drawGestureIndicator(
    center,
    gesture
) {

    if (
        gesture ===
        "OPEN"
    ) {
        return;
    }

    ctx.save();

    ctx.font =
        "bold 11px Courier New";

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        gesture === "PINCH"
            ? "#00eaff"
            : "#ff4fd8";

    ctx.shadowColor =
        ctx.fillStyle;

    ctx.shadowBlur =
        10;

    ctx.fillText(
        gesture,
        center.x,
        center.y - 15
    );

    ctx.restore();
}


/* ============================================================
   PORTAL DESCRIPTION
   ============================================================ */

function getPortalDescription(
    gesture
) {

    if (
        gesture ===
        "PINCH"
    ) {

        return (
            "PINCH TERDETEKSI — FILTER BERIKUTNYA."
        );
    }

    if (
        gesture ===
        "PEACE"
    ) {

        return (
            "PEACE SIGN — PORTAL MENGIKUTI BENTUK TANGAN."
        );
    }

    if (
        gesture ===
        "FIST"
    ) {

        return (
            render3D
                ? "DUA TANGAN MENGEPAL — MODE 3D."
                : "DUA TANGAN MENGEPAL — MODE 2D."
        );
    }

    return (
        render3D
            ? "Portal 3D aktif — gerakkan kedua tangan."
            : "Portal aktif — gerakkan kedua tangan."
    );
}


/* ============================================================
   TOGGLE MODE
   ============================================================ */

function toggleMode() {

    render3D =
        !render3D;

    updateModeUI();
}


/* ============================================================
   UPDATE MODE UI
   ============================================================ */

function updateModeUI() {

    if (mode2D) {

        mode2D.classList.toggle(
            "active",
            !render3D
        );
    }

    if (mode3D) {

        mode3D.classList.toggle(
            "active",
            render3D
        );
    }
}


/* ============================================================
   FPS
   ============================================================ */

function updateFPS() {

    frameCounter++;

    const now =
        performance.now();

    const elapsed =
        now -
        lastFPSUpdate;

    if (
        elapsed >= 1000
    ) {

        fps =
            Math.round(
                frameCounter *
                1000 /
                elapsed
            );

        if (fpsValue) {

            fpsValue.textContent =
                fps;
        }

        frameCounter = 0;

        lastFPSUpdate =
            now;
    }
}


/* ============================================================
   SCREENSHOT
   ============================================================ */

function takeScreenshot() {

    if (!cameraRunning) {

        alert(
            "Nyalakan kamera terlebih dahulu."
        );

        return;
    }

    const link =
        document.createElement(
            "a"
        );

    link.download =
        "retrolens-" +
        Date.now() +
        ".png";

    link.href =
        canvas.toDataURL(
            "image/png"
        );

    link.click();
}


/* ============================================================
   KEYBOARD CONTROLS
   ============================================================ */

document.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        /* ----------------------------------------------------
           NEXT FILTER
           ---------------------------------------------------- */

        if (
            key === "n"
        ) {

            nextFilter();
        }


        /* ----------------------------------------------------
           PREVIOUS FILTER
           ---------------------------------------------------- */

        if (
            key === "p"
        ) {

            previousFilter();
        }


        /* ----------------------------------------------------
           MODE
           ---------------------------------------------------- */

        if (
            key === "c"
        ) {

            toggleMode();
        }


        /* ----------------------------------------------------
           SCREENSHOT
           ---------------------------------------------------- */

        if (
            key === "s"
        ) {

            takeScreenshot();
        }


        /* ----------------------------------------------------
           STOP
           ---------------------------------------------------- */

        if (
            key === "q"
        ) {

            stopCamera();
        }
    }
);


/* ============================================================
   START BUTTON
   ============================================================ */

if (startButton) {

    startButton.addEventListener(
        "click",
        startCamera
    );
}


/* ============================================================
   MODE 2D BUTTON
   ============================================================ */

if (mode2D) {

    mode2D.addEventListener(
        "click",
        () => {

            render3D = false;

            updateModeUI();

            if (portalDescription) {

                portalDescription.textContent =
                    "Mode 2D aktif.";
            }
        }
    );
}


/* ============================================================
   MODE 3D BUTTON
   ============================================================ */

if (mode3D) {

    mode3D.addEventListener(
        "click",
        () => {

            render3D = true;

            updateModeUI();

            if (portalDescription) {

                portalDescription.textContent =
                    "Mode 3D aktif.";
            }
        }
    );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

createFilterButtons();

updateFilterUI();

updateModeUI();


/* ============================================================
   CAMERA SUPPORT CHECK
   ============================================================ */

if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
) {

    statusText.textContent =
        "CAMERA NOT SUPPORTED";

    portalDescription.textContent =
        "Browser ini tidak mendukung akses kamera.";
}


/* ============================================================
   INITIAL STATUS
   ============================================================ */

if (handCount) {

    handCount.textContent =
        "HANDS: 0";
}

if (portalStatus) {

    portalStatus.textContent =
        "WAITING";
}

if (portalDescription) {

    portalDescription.textContent =
        "Bentangkan kedua tangan untuk membuka portal.";
}


/* ============================================================
   END
   ============================================================ */
