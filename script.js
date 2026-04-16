const canvas = document.getElementById('rocketCanvas');
const ctx = canvas.getContext('2d');

const chartCtx = document.getElementById('altitudeChart').getContext('2d');
const altitudeChart = new Chart(chartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: '',
                data: [],
                borderColor: 'transparent',
                pointBackgroundColor: 'transparent',
                pointBorderColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                pointStyle: 'circle',
                showLine: false,
                order: 0
            },
            {
                label: 'Altitude (m)',
                data: [],
                borderColor: '#54d5ff',
                backgroundColor: 'rgba(84, 213, 255, 0.16)',
                borderWidth: 2.5,
                tension: 0.28,
                fill: true,
                pointRadius: 0,
                pointHitRadius: 10,
                order: 1
            }
        ]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'nearest',
            intersect: true
        },
        plugins: {
            legend: {
                labels: {
                    color: '#d9eeff',
                    font: {
                        family: 'Exo 2'
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(9, 20, 36, 0.92)',
                borderColor: 'rgba(111, 199, 255, 0.5)',
                borderWidth: 1,
                titleColor: '#d9eeff',
                bodyColor: '#d9eeff'
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Time (s)', color: '#bdd9ef' },
                ticks: { color: '#bdd9ef' },
                grid: { color: 'rgba(172, 219, 255, 0.12)' }
            },
            y: {
                title: { display: true, text: 'Altitude (m)', color: '#bdd9ef' },
                ticks: { color: '#bdd9ef' },
                grid: { color: 'rgba(172, 219, 255, 0.12)' }
            }
        }
    }
});


// Rocket properties
const rocket = {
    x: canvas.width / 2 - 10,
    y: canvas.height - 50, // start at bottom assuming rocket height is 50
    width: 20,
    height: 50,
    velocity: 0,
    acceleration: 0,
    thrust: 0,
    gravity: 9.81,
    isLaunched: false,
    fuelMass: 518500, // kg
    isp: 300, // seconds, specific impulse of engine
    hasLanded: false,
};

// Realistic drag constants for Falcon 9-like rocket
const realCd = 0.3; // dimensionless drag coefficient
const crossSectionArea = Math.PI * Math.pow(3.66 / 2, 2); // Falcon 9 cross-sectional area in m² (~10.5)

// Drag coefficient slider logic
// let dragCoefficient = parseFloat(document.getElementById('dragSlider').value);
// document.getElementById('dragSlider').addEventListener('input', (e) => {
//     dragCoefficient = parseFloat(e.target.value);
//     document.getElementById('dragValue').textContent = dragCoefficient.toFixed(4);
// });

// Gravity selector logic
const gravitySelect = document.getElementById('gravitySelect');
rocket.gravity = parseFloat(gravitySelect.value);
gravitySelect.addEventListener('change', () => {
    rocket.gravity = parseFloat(gravitySelect.value);
    if (!rocket.isLaunched) {
        document.getElementById('spaceStatus').textContent = getGroundStatus(rocket.gravity);
    }
});


const metersPerPixel = 0.5; // Adjust this value for realistic scale

const groundHeight = 42;
const spaceBoundaryMeters = 100000; // 100 km Karman line
const renderRocketSettleRate = 7;
const visualSpaceCeilingRatio = 0.14;
const ascentVisualBoostFactor = 0.045;
const ascentVisualBoostMaxPx = 105;
const descentVisualBoostFactor = 0.035;
const descentVisualBoostMaxPx = 95;
const apogeeFadeStartDropM = 0;
const apogeeFadeEndDropM = 10;

function getGroundTopY() {
    return canvas.height - groundHeight;
}

function getRocketPadY() {
    return getGroundTopY() - rocket.height;
}

rocket.y = getRocketPadY();

function getGroundStatus(gravity) {
    if (gravity === 3.71) return 'Status: On Mars';
    if (gravity === 1.62) return 'Status: On Moon';
    return 'Status: On Earth';
}

function getVisualAnchorY(altitude) {
    const padY = getRocketPadY();
    const lowAirY = canvas.height * 0.62;
    const midAirY = canvas.height * 0.54;
    const upperAirY = canvas.height * 0.45;
    const nearSpaceY = canvas.height * 0.28;
    const deepSpaceY = canvas.height * visualSpaceCeilingRatio;

    if (altitude <= 200) {
        const tLand = Math.max(0, Math.min(1, altitude / 200));
        return padY + (lowAirY - padY) * tLand;
    }

    // Start noticeable vertical parallax immediately above 200 m.
    if (altitude <= 5000) {
        const tLow = Math.max(0, Math.min(1, (altitude - 200) / 4800));
        return lowAirY + (midAirY - lowAirY) * tLow;
    }

    if (altitude <= 20000) {
        const tMid = Math.max(0, Math.min(1, (altitude - 5000) / 15000));
        return midAirY + (upperAirY - midAirY) * tMid;
    }

    if (altitude <= spaceBoundaryMeters) {
        const tAir = Math.max(0, Math.min(1, (altitude - 20000) / (spaceBoundaryMeters - 20000)));
        return upperAirY + (nearSpaceY - upperAirY) * tAir;
    }

    const extra = altitude - spaceBoundaryMeters;
    const tUpper = Math.max(0, Math.min(1, extra / 120000));
    const highSpaceY = nearSpaceY + (upperAirY - nearSpaceY) * tUpper;
    const tDeep = Math.max(0, Math.min(1, extra / 320000));
    return highSpaceY + (deepSpaceY - highSpaceY) * tDeep;
}

function createStarField(count) {
    return Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.6 + Math.random() * 1.2,
        alpha: 0.35 + Math.random() * 0.65,
        pulse: 0.4 + Math.random() * 0.8
    }));
}

function createCloudBank(count, minY, maxY, minW, maxW) {
    return Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: minY + Math.random() * (maxY - minY),
        w: minW + Math.random() * (maxW - minW),
        h: 18 + Math.random() * 28,
        drift: 4 + Math.random() * 8,
        baseAlpha: 0.2 + Math.random() * 0.22
    }));
}

function createAtmosObjects(count) {
    const types = ['bird', 'balloon', 'jet'];
    return Array.from({ length: count }, () => {
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type,
            x: Math.random() * canvas.width,
            y: 40 + Math.random() * (canvas.height * 0.62),
            speed: 8 + Math.random() * 16,
            size: 0.5 + Math.random() * 0.85,
            phase: Math.random() * Math.PI * 2,
            alpha: 0.3 + Math.random() * 0.45
        };
    });
}

function createOrbitObjects(count) {
    return Array.from({ length: count }, () => ({
        type: Math.random() > 0.5 ? 'satellite' : 'meteor',
        x: Math.random() * canvas.width,
        y: 20 + Math.random() * (canvas.height * 0.45),
        speed: 18 + Math.random() * 36,
        size: 0.7 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.45
    }));
}

let stars = createStarField(140);
let lowClouds = createCloudBank(16, 70, canvas.height * 0.7, 90, 200);
let highClouds = createCloudBank(14, 20, canvas.height * 0.45, 70, 160);
let atmosObjects = createAtmosObjects(14);
let orbitObjects = createOrbitObjects(9);

// Array to hold crash debris particles
const floatingObjects = [];

function resizeCanvases() {
    const container = canvas.parentElement;
    if (!container) return;

    const target = Math.min(600, Math.max(300, Math.floor(container.clientWidth - 24)));
    const sizeUnchanged = canvas.width === target && canvas.height === target;

    if (!sizeUnchanged) {
        canvas.width = target;
        canvas.height = target;
    }
    rocket.x = canvas.width / 2 - rocket.width / 2;
    if (!rocket.isLaunched) {
        rocket.y = getRocketPadY();
        renderRocketY = rocket.y;
    }

    if (sizeUnchanged) {
        return;
    }

    stars = createStarField(140);
    lowClouds = createCloudBank(16, 70, canvas.height * 0.7, 90, 200);
    highClouds = createCloudBank(14, 20, canvas.height * 0.45, 70, 160);
    atmosObjects = createAtmosObjects(14);
    orbitObjects = createOrbitObjects(9);
}

window.addEventListener('resize', resizeCanvases);

let thrustTime = 0; // milliseconds of burn time set via user input
let launchTime = null;

let lastFrameTime = Date.now();
let flightTime = 0;
let cameraOffset = 0;
let renderRocketY = rocket.y;
let sceneMotionDirection = 1; // 1: background moves downward, -1: background moves upward
let starDriftOffsetY = 0;
let glowDriftOffsetY = 0;

let apogee = null;
let apogeeIndex = null;
let previousVelocity = 0;

// Data arrays for chart metrics
const altitudeData = [];
const velocityData = [];
const accelerationData = [];
let selectedMetric = 'altitude';

function getMetricVisuals(metric) {
    if (metric === 'velocity') {
        return {
            label: 'Velocity (m/s)',
            yTitle: 'Velocity (m/s)',
            border: '#7df57d',
            fill: 'rgba(125, 245, 125, 0.15)'
        };
    }
    if (metric === 'acceleration') {
        return {
            label: 'Acceleration (m/s²)',
            yTitle: 'Acceleration (m/s²)',
            border: '#ffb866',
            fill: 'rgba(255, 184, 102, 0.15)'
        };
    }
    return {
        label: 'Altitude (m)',
        yTitle: 'Altitude (m)',
        border: '#54d5ff',
        fill: 'rgba(84, 213, 255, 0.16)'
    };
}

function getMetricData(metric) {
    if (metric === 'velocity') return velocityData;
    if (metric === 'acceleration') return accelerationData;
    return altitudeData;
}

function applyChartMetricStyle(metric) {
    const style = getMetricVisuals(metric);
    const dataset = altitudeChart.data.datasets[1];
    dataset.label = style.label;
    dataset.borderColor = style.border;
    dataset.backgroundColor = style.fill;
    dataset.borderWidth = 2.5;
    dataset.tension = 0.28;
    dataset.fill = true;
    dataset.pointRadius = 0;
    dataset.pointHitRadius = 10;
    dataset.data = getMetricData(metric);
    altitudeChart.options.scales.y.title.text = style.yTitle;
}

function applyApogeeStyle() {
    const marker = altitudeChart.data.datasets[0];
    marker.label = selectedMetric === 'altitude' ? 'Apogee' : '';
    marker.borderColor = selectedMetric === 'altitude' ? '#ffdc73' : 'transparent';
    marker.pointBackgroundColor = selectedMetric === 'altitude' ? '#ffdc73' : 'transparent';
    marker.pointBorderColor = selectedMetric === 'altitude' ? '#2b2500' : 'transparent';
    marker.pointRadius = selectedMetric === 'altitude' ? 8 : 0;
    marker.pointHoverRadius = selectedMetric === 'altitude' ? 10 : 0;
}

function drawCloud(obj, tint) {
    ctx.fillStyle = tint;
    ctx.globalAlpha = obj.baseAlpha;
    ctx.beginPath();
    ctx.ellipse(obj.x, obj.y, obj.w * 0.5, obj.h * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(obj.x - obj.w * 0.25, obj.y + 6, obj.w * 0.35, obj.h * 0.45, 0, 0, Math.PI * 2);
    ctx.ellipse(obj.x + obj.w * 0.24, obj.y + 4, obj.w * 0.3, obj.h * 0.43, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawAtmosObject(obj, nowSec) {
    ctx.save();
    ctx.globalAlpha = obj.alpha;

    if (obj.type === 'bird') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.3 * obj.size;
        ctx.beginPath();
        ctx.arc(obj.x - 5 * obj.size, obj.y, 5 * obj.size, Math.PI * 1.05, Math.PI * 1.95);
        ctx.arc(obj.x + 5 * obj.size, obj.y, 5 * obj.size, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
    } else if (obj.type === 'balloon') {
        ctx.fillStyle = 'rgba(255, 194, 116, 0.88)';
        ctx.beginPath();
        ctx.ellipse(obj.x, obj.y, 6 * obj.size, 8 * obj.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230, 240, 255, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y + 8 * obj.size);
        ctx.lineTo(obj.x, obj.y + 15 * obj.size + Math.sin(nowSec + obj.phase) * 2);
        ctx.stroke();
    } else {
        ctx.fillStyle = 'rgba(210, 228, 255, 0.85)';
        ctx.fillRect(obj.x - 9 * obj.size, obj.y - 2 * obj.size, 18 * obj.size, 4 * obj.size);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(obj.x - 28 * obj.size, obj.y - 1 * obj.size, 16 * obj.size, 2 * obj.size);
    }

    ctx.restore();
}

function drawOrbitObject(obj, nowSec) {
    ctx.save();
    const twinkle = 0.55 + 0.45 * Math.sin(nowSec * 2 + obj.phase);
    ctx.globalAlpha = obj.alpha * twinkle;

    if (obj.type === 'satellite') {
        ctx.fillStyle = 'rgba(201, 223, 255, 0.9)';
        ctx.fillRect(obj.x - 4 * obj.size, obj.y - 2 * obj.size, 8 * obj.size, 4 * obj.size);
        ctx.fillStyle = 'rgba(122, 184, 255, 0.85)';
        ctx.fillRect(obj.x - 11 * obj.size, obj.y - 1.5 * obj.size, 5 * obj.size, 3 * obj.size);
        ctx.fillRect(obj.x + 6 * obj.size, obj.y - 1.5 * obj.size, 5 * obj.size, 3 * obj.size);
    } else {
        ctx.strokeStyle = 'rgba(166, 214, 255, 0.85)';
        ctx.lineWidth = 1.4 * obj.size;
        ctx.beginPath();
        ctx.moveTo(obj.x - 12 * obj.size, obj.y - 5 * obj.size);
        ctx.lineTo(obj.x + 8 * obj.size, obj.y + 3 * obj.size);
        ctx.stroke();
    }

    ctx.restore();
}

function drawEnvironment(altitude, gravity, nowSec, deltaTime) {
    const isSceneInMotion = rocket.isLaunched;

    if (isSceneInMotion) {
        starDriftOffsetY += 0.35 * deltaTime * sceneMotionDirection;
        glowDriftOffsetY += 6 * deltaTime * sceneMotionDirection;
    }
    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    function smoothstep(edge0, edge1, x) {
        const t = clamp01((x - edge0) / (edge1 - edge0));
        return t * t * (3 - 2 * t);
    }

    function mix(a, b, t) {
        return a + (b - a) * t;
    }

    function mixColor(c1, c2, t) {
        return [
            Math.round(mix(c1[0], c2[0], t)),
            Math.round(mix(c1[1], c2[1], t)),
            Math.round(mix(c1[2], c2[2], t))
        ];
    }

    function colorToRgba(c, a = 1) {
        return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
    }

    const layersEarth = [
        { h: 0, top: [82, 152, 220], bottom: [162, 204, 242] },
        { h: 12000, top: [56, 126, 204], bottom: [132, 180, 228] },
        { h: 25000, top: [44, 98, 176], bottom: [104, 156, 214] },
        { h: 45000, top: [38, 72, 146], bottom: [84, 126, 196] },
        { h: 70000, top: [24, 40, 92], bottom: [48, 72, 128] },
        { h: 100000, top: [12, 18, 40], bottom: [22, 30, 62] },
        { h: 180000, top: [7, 10, 24], bottom: [12, 16, 34] }
    ];
    const layersMars = [
        { h: 0, top: [204, 128, 88], bottom: [228, 162, 124] },
        { h: 18000, top: [170, 98, 72], bottom: [204, 132, 96] },
        { h: 45000, top: [112, 62, 50], bottom: [148, 90, 68] },
        { h: 100000, top: [34, 22, 32], bottom: [58, 36, 50] },
        { h: 180000, top: [16, 12, 22], bottom: [24, 18, 30] }
    ];
    const layersMoon = [
        { h: 0, top: [172, 181, 194], bottom: [214, 220, 230] },
        { h: 8000, top: [130, 142, 162], bottom: [176, 188, 208] },
        { h: 30000, top: [72, 86, 118], bottom: [112, 126, 156] },
        { h: 100000, top: [20, 24, 44], bottom: [40, 46, 72] },
        { h: 180000, top: [10, 12, 24], bottom: [18, 20, 34] }
    ];

    const layers = gravity === 3.71 ? layersMars : gravity === 1.62 ? layersMoon : layersEarth;

    function sampleLayerColors(h) {
        if (h <= layers[0].h) {
            return { top: layers[0].top, bottom: layers[0].bottom };
        }
        for (let i = 0; i < layers.length - 1; i++) {
            const a = layers[i];
            const b = layers[i + 1];
            if (h >= a.h && h <= b.h) {
                const t = smoothstep(a.h, b.h, h);
                return {
                    top: mixColor(a.top, b.top, t),
                    bottom: mixColor(a.bottom, b.bottom, t)
                };
            }
        }
        const last = layers[layers.length - 1];
        return { top: last.top, bottom: last.bottom };
    }

    const scene = sampleLayerColors(altitude);
    const gradient = ctx.createLinearGradient(0, cameraOffset, 0, cameraOffset + canvas.height);
    gradient.addColorStop(0, colorToRgba(scene.top));
    gradient.addColorStop(1, colorToRgba(scene.bottom));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);

    // Add soft atmospheric bands that slide with altitude for seamless top-to-bottom transitions.
    const bandShift = (isSceneInMotion ? altitude : 0) / 9000 % 1;
    const lowAltBoost = 1 - smoothstep(0, 45000, altitude);
    for (let i = 0; i < 4; i++) {
        const bandTop = ((i * 0.34 + bandShift) % 1) * canvas.height;
        const bandHeight = canvas.height * 0.34;
        const bandAlpha = (1 - smoothstep(90000, 170000, altitude)) * (0.11 - i * 0.016) * (0.72 + lowAltBoost * 0.9);
        if (bandAlpha <= 0.003) continue;

        const darkBand = mixColor(scene.top, [8, 18, 38], 0.28 + lowAltBoost * 0.18);
        const bandGrad = ctx.createLinearGradient(0, cameraOffset + bandTop, 0, cameraOffset + bandTop + bandHeight);
        bandGrad.addColorStop(0, colorToRgba(darkBand, bandAlpha));
        bandGrad.addColorStop(1, colorToRgba(scene.top, 0));
        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, cameraOffset + bandTop, canvas.width, bandHeight);

        const lightTop = (bandTop + bandHeight * 0.42) % canvas.height;
        const lightHeight = bandHeight * 0.38;
        const lightBand = mixColor(scene.bottom, [255, 255, 255], 0.2 + lowAltBoost * 0.16);
        const lightAlpha = bandAlpha * (0.46 + lowAltBoost * 0.34);
        const lightGrad = ctx.createLinearGradient(0, cameraOffset + lightTop, 0, cameraOffset + lightTop + lightHeight);
        lightGrad.addColorStop(0, colorToRgba(lightBand, lightAlpha));
        lightGrad.addColorStop(1, colorToRgba(scene.bottom, 0));
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, cameraOffset + lightTop, canvas.width, lightHeight);
    }

    const spaceMotion = smoothstep(26000, 90000, altitude);
    if (spaceMotion > 0.01) {
        const verticalShift = Math.sin(nowSec * 0.22) * 22 * spaceMotion;
        const glow1 = ctx.createRadialGradient(
            canvas.width * 0.18,
            cameraOffset + canvas.height * 0.23 + verticalShift * 0.4 + glowDriftOffsetY,
            0,
            canvas.width * 0.18,
            cameraOffset + canvas.height * 0.23 + verticalShift * 0.4 + glowDriftOffsetY,
            canvas.height * 0.45
        );
        glow1.addColorStop(0, `rgba(115, 163, 255, ${0.12 * spaceMotion})`);
        glow1.addColorStop(1, 'rgba(115, 163, 255, 0)');
        ctx.fillStyle = glow1;
        ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);

        const glow2 = ctx.createRadialGradient(
            canvas.width * 0.82,
            cameraOffset + canvas.height * 0.34 + verticalShift * 0.65 + glowDriftOffsetY,
            0,
            canvas.width * 0.82,
            cameraOffset + canvas.height * 0.34 + verticalShift * 0.65 + glowDriftOffsetY,
            canvas.height * 0.38
        );
        glow2.addColorStop(0, `rgba(167, 115, 255, ${0.08 * spaceMotion})`);
        glow2.addColorStop(1, 'rgba(167, 115, 255, 0)');
        ctx.fillStyle = glow2;
        ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
    }

    const starAlphaRaw = Math.min(1, Math.max(0, (altitude - 18000) / 70000));
    const starAlpha = starAlphaRaw * starAlphaRaw;
    if (starAlpha > 0.01) {
        ctx.globalAlpha = starAlpha;
        const verticalShift = isSceneInMotion ? Math.sin(nowSec * 0.2) * 4 : 0;
        const uniformDriftY = isSceneInMotion ? starDriftOffsetY : 0;

        function wrap(value, max) {
            return ((value % max) + max) % max;
        }

        for (const star of stars) {
            const twinkle = star.alpha * (0.65 + Math.sin(nowSec * star.pulse + star.x * 0.02) * 0.35);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, twinkle)})`;

            const starX = star.x;
            const starY = wrap(star.y + verticalShift + uniformDriftY, canvas.height);

            ctx.beginPath();
            ctx.arc(starX, cameraOffset + starY, star.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    const cloudFade = 1 - smoothstep(7000, 9000, altitude);
    if (cloudFade > 0.02 && gravity !== 1.62) {
        for (const cloud of highClouds) {
            if (isSceneInMotion) {
                cloud.y += cloud.drift * deltaTime * 0.6 * sceneMotionDirection;
                if (sceneMotionDirection > 0 && cloud.y - cloud.h > canvas.height) {
                    cloud.y = -cloud.h;
                    cloud.x = Math.random() * canvas.width;
                } else if (sceneMotionDirection < 0 && cloud.y + cloud.h < 0) {
                    cloud.y = canvas.height + cloud.h;
                    cloud.x = Math.random() * canvas.width;
                }
            }
            const originalAlpha = cloud.baseAlpha;
            cloud.baseAlpha = originalAlpha * cloudFade;
            drawCloud(cloud, gravity === 3.71 ? 'rgba(243, 189, 154, 0.9)' : 'rgba(241, 250, 255, 0.92)');
            cloud.baseAlpha = originalAlpha;
        }
        for (const cloud of lowClouds) {
            if (isSceneInMotion) {
                cloud.y += cloud.drift * deltaTime * sceneMotionDirection;
                if (sceneMotionDirection > 0 && cloud.y - cloud.h > canvas.height) {
                    cloud.y = -cloud.h;
                    cloud.x = Math.random() * canvas.width;
                } else if (sceneMotionDirection < 0 && cloud.y + cloud.h < 0) {
                    cloud.y = canvas.height + cloud.h;
                    cloud.x = Math.random() * canvas.width;
                }
            }
            const originalAlpha = cloud.baseAlpha;
            cloud.baseAlpha = originalAlpha * cloudFade;
            drawCloud(cloud, gravity === 3.71 ? 'rgba(232, 162, 124, 0.95)' : 'rgba(255, 255, 255, 0.95)');
            cloud.baseAlpha = originalAlpha;
        }

        const objectFade = 1 - smoothstep(6000, 9000, altitude);
        for (const obj of atmosObjects) {
            if (isSceneInMotion) {
                obj.y += obj.speed * deltaTime * (obj.type === 'jet' ? 1.4 : 1) * sceneMotionDirection;
                obj.x += Math.sin(nowSec * 0.9 + obj.phase) * deltaTime * (obj.type === 'balloon' ? 5 : 2);
                if (sceneMotionDirection > 0 && obj.y > canvas.height + 40) {
                    obj.y = -40;
                    obj.x = 30 + Math.random() * (canvas.width * 0.9);
                } else if (sceneMotionDirection < 0 && obj.y < -40) {
                    obj.y = canvas.height + 40;
                    obj.x = 30 + Math.random() * (canvas.width * 0.9);
                }
            }
            const prevAlpha = obj.alpha;
            obj.alpha = prevAlpha * objectFade;
            drawAtmosObject(obj, nowSec);
            obj.alpha = prevAlpha;
        }
    }

    const orbitFade = Math.min(1, Math.max(0, (altitude - 18000) / 45000));
    if (orbitFade > 0.01) {
        for (const obj of orbitObjects) {
            if (isSceneInMotion) {
                obj.y += obj.speed * deltaTime * sceneMotionDirection;
                if (sceneMotionDirection > 0 && obj.y > canvas.height + 60) {
                    obj.y = -60;
                    obj.x = 16 + Math.random() * (canvas.width * 0.9);
                } else if (sceneMotionDirection < 0 && obj.y < -60) {
                    obj.y = canvas.height + 60;
                    obj.x = 16 + Math.random() * (canvas.width * 0.9);
                }
            }
            const prevAlpha = obj.alpha;
            obj.alpha = prevAlpha * orbitFade;
            drawOrbitObject(obj, nowSec);
            obj.alpha = prevAlpha;
        }
    }

    const groundGradient = ctx.createLinearGradient(0, canvas.height - groundHeight, 0, canvas.height);
    if (gravity === 3.71) {
        groundGradient.addColorStop(0, '#8a4c32');
        groundGradient.addColorStop(1, '#5b2e1f');
    } else if (gravity === 1.62) {
        groundGradient.addColorStop(0, '#9ea5ad');
        groundGradient.addColorStop(1, '#7d858f');
    } else {
        groundGradient.addColorStop(0, '#315b36');
        groundGradient.addColorStop(1, '#204423');
    }
    const groundAlpha = 1 - smoothstep(20, 180, altitude);
    if (groundAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = groundAlpha;
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
        ctx.restore();
    }
}

function drawRocketFlame(strength, yPos) {
    const baseX = rocket.x + rocket.width / 2;
    const baseY = yPos + rocket.height;
    const flameLength = 20 + strength * 45 + Math.random() * 8;
    const flameWidth = 9 + strength * 12;

    ctx.fillStyle = 'rgba(255, 167, 67, 0.76)';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + flameLength);
    ctx.quadraticCurveTo(baseX - flameWidth, baseY + flameLength * 0.35, baseX - 5, baseY);
    ctx.quadraticCurveTo(baseX, baseY + 3, baseX + 5, baseY);
    ctx.quadraticCurveTo(baseX + flameWidth, baseY + flameLength * 0.35, baseX, baseY + flameLength);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 231, 150, 0.86)';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + flameLength * 0.65);
    ctx.quadraticCurveTo(baseX - flameWidth * 0.35, baseY + flameLength * 0.2, baseX - 2, baseY + 2);
    ctx.quadraticCurveTo(baseX, baseY + 6, baseX + 2, baseY + 2);
    ctx.quadraticCurveTo(baseX + flameWidth * 0.35, baseY + flameLength * 0.2, baseX, baseY + flameLength * 0.65);
    ctx.fill();
}

// Draw rocket with metallic body, window, and fins
function drawRocket(yPos) {
    ctx.fillStyle = '#d9dce2';
    ctx.beginPath();
    ctx.moveTo(rocket.x, yPos + 10);
    ctx.lineTo(rocket.x + rocket.width / 2, yPos);
    ctx.lineTo(rocket.x + rocket.width, yPos + 10);
    ctx.closePath();
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(rocket.x, yPos, rocket.x + rocket.width, yPos);
    bodyGradient.addColorStop(0, '#f8fbff');
    bodyGradient.addColorStop(0.5, '#d2d8df');
    bodyGradient.addColorStop(1, '#b2bac5');
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(rocket.x, yPos + 10, rocket.width, rocket.height - 10);

    ctx.fillStyle = '#313945';
    ctx.beginPath();
    ctx.moveTo(rocket.x, yPos + rocket.height - 5);
    ctx.lineTo(rocket.x - 9, yPos + rocket.height + 10);
    ctx.lineTo(rocket.x, yPos + rocket.height);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(rocket.x + rocket.width, yPos + rocket.height - 5);
    ctx.lineTo(rocket.x + rocket.width + 9, yPos + rocket.height + 10);
    ctx.lineTo(rocket.x + rocket.width, yPos + rocket.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5ca6da';
    ctx.beginPath();
    ctx.arc(rocket.x + rocket.width / 2, yPos + 21, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d43f3f';
    ctx.fillRect(rocket.x + rocket.width * 0.12, yPos + rocket.height * 0.4, rocket.width * 0.76, 4);
}

// Clear and draw loop
function render() {
    const now = Date.now();
    const frameDeltaTime = (now - lastFrameTime) / 1000;
    const deltaTime = Math.min(0.12, frameDeltaTime); // physics step (avoid huge tab-switch spikes)
    const cameraDeltaTime = Math.min(0.033, frameDeltaTime); // visual smoothing only
    const nowSec = now / 1000;
    lastFrameTime = now;

    const groundTopY = getGroundTopY();
    const altitude = Math.max(0, (groundTopY - (rocket.y + rocket.height)) * metersPerPixel);

    if (!rocket.isLaunched) {
        sceneMotionDirection = 1;
    } else if (rocket.velocity < -0.2) {
        sceneMotionDirection = 1;
    } else if (rocket.velocity > 0.2) {
        sceneMotionDirection = -1;
    }

    // Single deterministic visual controller: altitude -> render position.
    // Physics remains authoritative for telemetry and calculations.
    if (rocket.isLaunched) {
        const anchorY = getVisualAnchorY(altitude);
        if (rocket.velocity < 0) {
            const ascentBoost = Math.min(ascentVisualBoostMaxPx, Math.abs(rocket.velocity) * ascentVisualBoostFactor);
            const topLimit = canvas.height * visualSpaceCeilingRatio;
            renderRocketY = Math.max(topLimit, anchorY - ascentBoost);
        } else if (rocket.velocity > 0) {
            const descentBoost = Math.min(descentVisualBoostMaxPx, rocket.velocity * descentVisualBoostFactor);
            renderRocketY = Math.min(getRocketPadY(), anchorY + descentBoost);
        } else {
            renderRocketY = anchorY;
        }
    } else {
        const settleAlpha = 1 - Math.exp(-renderRocketSettleRate * cameraDeltaTime);
        renderRocketY += (rocket.y - renderRocketY) * settleAlpha;
    }

    ctx.save();
    cameraOffset = 0;

    ctx.translate(0, -cameraOffset);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Simulate atmosphere density decreasing with altitude, using realistic Mars, Moon, and Earth models
    let atmosphereDensity;
    if (rocket.gravity === 3.71) {
        // Mars: ~0.020 kg/m³ at surface, realistic scale height
        atmosphereDensity = Math.max(0.00001, 0.020 * Math.exp(-altitude / 11100));
    } else if (rocket.gravity === 1.62) {
        // Moon: extremely thin exosphere
        atmosphereDensity = 0.0000000003;
    } else {
        // Earth: 1.225 kg/m³ at sea level, scale height 8500 m
        atmosphereDensity = Math.max(0.00001, 1.225 * Math.exp(-altitude / 8500));
    }
    const isSpace = altitude >= spaceBoundaryMeters;
    if (isSpace) {
        atmosphereDensity = 0;
    }

    drawEnvironment(altitude, rocket.gravity, nowSec, deltaTime);

    if (rocket.isLaunched) {
        if (!launchTime) launchTime = Date.now();

        const totalMass = parseFloat(document.getElementById('massInput').value) + rocket.fuelMass;
        const thrustN = parseFloat(document.getElementById('thrustInput').value);
        const maxThrustAccel = Math.min(thrustN / totalMass, 50);
        const dragAccelNow = -0.5 * realCd * crossSectionArea * atmosphereDensity * rocket.velocity * Math.abs(rocket.velocity) / totalMass;

        const timeElapsed = Date.now() - launchTime;
        flightTime = timeElapsed;
        if (timeElapsed > thrustTime || rocket.fuelMass <= 0) {
            rocket.thrust = 0; // simulate engine cutoff
        } else {
            const thrustProfile = 1;
            const rawThrustAccel = thrustProfile * thrustN / totalMass;
            const cappedThrustAccel = Math.min(rawThrustAccel, 50); // cap at 50 m/s² (~3g)
            rocket.thrust = -cappedThrustAccel;
        }

        rocket.velocity += rocket.acceleration * deltaTime;
        rocket.y += rocket.velocity * deltaTime / metersPerPixel;

        // Robust apogee detection: detect transition from upward motion (negative)
        // to downward motion (positive) after propulsion phase.
        if (apogee === null && rocket.thrust === 0 && previousVelocity < 0 && rocket.velocity >= 0) {
            const apogeeAltitude = Math.max(0, (groundTopY - (rocket.y + rocket.height)) * metersPerPixel);
            apogee = apogeeAltitude;
            apogeeIndex = altitudeChart.data.labels.length;
            console.log("Apogee reached at", apogeeAltitude, "meters");
        }
        previousVelocity = rocket.velocity;

        // Stop the rocket from falling below ground, trigger explosion if high velocity
        if (rocket.y + rocket.height > groundTopY && rocket.isLaunched && !rocket.hasLanded && rocket.velocity > 1) {
            rocket.hasLanded = true;
            rocket.y = getRocketPadY();
            if (rocket.velocity > 10) {
                for (let i = 0; i < 20; i++) {
                    floatingObjects.push({
                        x: rocket.x + rocket.width / 2 + (Math.random() - 0.5) * 40,
                        y: rocket.y + rocket.height / 2 + (Math.random() - 0.5) * 40,
                        type: 'debris',
                        vx: (Math.random() - 0.5) * 200,
                        vy: (Math.random() - 0.5) * 200,
                        ttl: 1.4,
                        maxTtl: 1.4,
                        size: 1 + Math.random() * 3
                    });
                }
                alert('🚨 Crash Landing! The rocket landed too hard.');
            } else {
                alert('✅ Successful Landing! Well done.');
            }
            document.getElementById('launchButton').disabled = false;
            rocket.velocity = 0;
            rocket.isLaunched = false;
            cameraOffset = 0;
            renderRocketY = rocket.y;
            starDriftOffsetY = 0;
            glowDriftOffsetY = 0;
            previousVelocity = 0;
            document.getElementById('thrustInput').disabled = false;
            document.getElementById('massInput').disabled = false;
            document.getElementById('fuelMassInput').disabled = false;
            document.getElementById('thrustDurationInput').disabled = false;
            document.getElementById('gravitySelect').disabled = false;
            document.getElementById('spaceStatus').textContent = getGroundStatus(rocket.gravity);
        } else if (rocket.fuelMass > 0 && rocket.velocity > 0.5 && timeElapsed >= thrustTime) {
            const vTarget = 1.8;
            const safeAltitude = Math.max(altitude, 0.5);
            const dragUpAccel = Math.max(0, -dragAccelNow);
            const maxDecel = maxThrustAccel + dragUpAccel - rocket.gravity;

            if (maxDecel > 0) {
                const stoppingDistance = Math.max(0, (rocket.velocity * rocket.velocity - vTarget * vTarget) / (2 * maxDecel));
                const ignitionMargin = Math.max(10, rocket.velocity * 0.9);
                const shouldIgnite = altitude <= stoppingDistance + ignitionMargin;

                if (shouldIgnite || rocket.thrust < 0) {
                    const requiredNetUp = Math.max(0, (rocket.velocity * rocket.velocity - vTarget * vTarget) / (2 * safeAltitude));
                    const requiredThrustAccel = requiredNetUp + rocket.gravity - dragUpAccel;
                    const commandedThrustAccel = Math.min(maxThrustAccel, Math.max(0, requiredThrustAccel));
                    rocket.thrust = -commandedThrustAccel;
                }
            }
        }

        if (rocket.thrust !== 0 && rocket.fuelMass > 0) {
            const g0 = 9.81;
            const thrustN = Math.abs(rocket.thrust * (parseFloat(document.getElementById('massInput').value)+rocket.fuelMass)); // Convert accel back to N
            const burnRate = thrustN / (rocket.isp * g0); // kg/s
            const burnAmount = burnRate * deltaTime;
            rocket.fuelMass -= burnAmount;
            if (rocket.fuelMass <= 0) {
                rocket.fuelMass = 0;
                rocket.thrust = 0;
            }
        }
        // Include atmosphere density in drag force for main flight
        // Use realistic drag constants; this runs regardless of planet, using correct atmosphereDensity
        const dragAccel = -0.5 * realCd * crossSectionArea * atmosphereDensity * rocket.velocity * Math.abs(rocket.velocity) / totalMass;
        rocket.acceleration = rocket.thrust + rocket.gravity + dragAccel;
    }

    if (rocket.thrust < -0.15 && rocket.fuelMass > 0) {
        drawRocketFlame(Math.min(1, Math.abs(rocket.thrust) / 50), renderRocketY);
    }
    drawRocket(renderRocketY);

    if (apogee !== null) {
        const descentSinceApogee = Math.max(0, apogee - altitude);
        let apogeeAlpha = 1;
        if (descentSinceApogee > apogeeFadeStartDropM) {
            const fadeT = Math.min(1, (descentSinceApogee - apogeeFadeStartDropM) / (apogeeFadeEndDropM - apogeeFadeStartDropM));
            apogeeAlpha = 1 - fadeT;
        }

        if (apogeeAlpha > 0) {
            const markerY = renderRocketY;
            ctx.save();
            ctx.globalAlpha = apogeeAlpha;
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(rocket.x + rocket.width / 2, markerY, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(`Apogee: ${apogee.toFixed(2)} m`, rocket.x + rocket.width + 10, markerY);
            ctx.restore();
        }
    }

    // Draw and update crash debris particles
    for (let i = floatingObjects.length - 1; i >= 0; i--) {
        const obj = floatingObjects[i];
        if (obj.type !== 'debris') {
            continue;
        }

        obj.x += obj.vx * deltaTime;
        obj.y += obj.vy * deltaTime;
        obj.vy += 100 * deltaTime;
        obj.ttl -= deltaTime;

        if (obj.ttl <= 0) {
            floatingObjects.splice(i, 1);
            continue;
        }

        const alpha = obj.maxTtl ? Math.max(0, obj.ttl / obj.maxTtl) : 0.6;
        ctx.fillStyle = `rgba(255, 170, 84, ${alpha})`;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.size || 2, 0, Math.PI * 2);
        ctx.fill();

        if (obj.y > cameraOffset + canvas.height + 100) {
            floatingObjects.splice(i, 1);
        }
    }

    ctx.restore();

    document.getElementById('altitude').textContent = altitude.toFixed(2);
    if (altitude >= spaceBoundaryMeters) {
        document.getElementById('spaceStatus').textContent = "Status: In Space";
    } else if (altitude > 0) {
        document.getElementById('spaceStatus').textContent = "Status: In Air";
    } else {
        document.getElementById('spaceStatus').textContent = getGroundStatus(rocket.gravity);
    }
    const velocity = rocket.velocity.toFixed(2);
    const velocityDisplay = rocket.velocity < 0 ? `${Math.abs(velocity)} m/s ↑` : `${velocity} m/s ↓`;
    document.getElementById('velocity').textContent = velocityDisplay;
    const acc = rocket.acceleration.toFixed(2);
    const accDisplay = rocket.acceleration < 0 ? `${Math.abs(acc)} m/s² ↑` : `${acc} m/s² ↓`;
    document.getElementById('acceleration').textContent = accDisplay;
    // Insert currentDragForce calculation just before debugThrust
    // let currentDragForce = rocket.isLaunched ? (
    //     -Math.sign(rocket.velocity) * dragCoefficient * rocket.velocity * rocket.velocity * Math.max(0.001, Math.exp(-((canvas.height - rocket.y - rocket.height) * metersPerPixel) / 8500))
    // ) : 0;
    // document.getElementById('debugThrust').textContent = `Thrust: ${rocket.thrust.toFixed(2)} m/s²`;
    // document.getElementById('debugDrag').textContent = `Drag: ${currentDragForce.toFixed(2)} m/s²`;
    // document.getElementById('debugAccel').textContent = `Net Accel: ${(rocket.thrust + rocket.gravity + currentDragForce).toFixed(2)} m/s²`;
    document.getElementById('time').textContent = (flightTime / 1000).toFixed(2) + " s";

    const timeSec = (flightTime / 1000).toFixed(2);

    if (rocket.isLaunched) {
        altitudeChart.data.labels.push(timeSec);
        altitudeData.push(altitude);
        velocityData.push(parseFloat((-rocket.velocity).toFixed(2)));
        accelerationData.push(parseFloat((-rocket.acceleration).toFixed(2)));

        // Dynamically set the dataset based on selected metric
        if (selectedMetric === 'altitude') {
            altitudeChart.data.datasets[1].data = altitudeData;
        } else if (selectedMetric === 'velocity') {
            altitudeChart.data.datasets[1].data = velocityData;
        } else if (selectedMetric === 'acceleration') {
            altitudeChart.data.datasets[1].data = accelerationData;
        }

        if (
            apogee !== null &&
            apogeeIndex !== null &&
            selectedMetric === 'altitude'
        ) {
            const apogeeData = new Array(altitudeChart.data.labels.length).fill(null);
            if (apogeeIndex < apogeeData.length) {
                apogeeData[apogeeIndex] = parseFloat(apogee.toFixed(2));
            }
            altitudeChart.data.datasets[0].data = apogeeData;

            // Keep chart focused around apogee while in-flight on altitude view.
            const xScale = altitudeChart.options.scales.x;
            const focusWindow = 220;
            xScale.min = Math.max(0, apogeeIndex - focusWindow);
            xScale.max = Math.min(altitudeChart.data.labels.length - 1, apogeeIndex + focusWindow);
        } else {
            altitudeChart.options.scales.x.min = undefined;
            altitudeChart.options.scales.x.max = undefined;
        }
        altitudeChart.update('none');
    }

    const fuelMassDisplay = document.getElementById('fuelMass');
    if (fuelMassDisplay) {
        fuelMassDisplay.textContent = rocket.fuelMass.toFixed(1) + " kg";
    }

    requestAnimationFrame(render);
}

function launchRocket() {
    document.getElementById('launchButton').disabled = true;
    document.getElementById('thrustInput').disabled = true;
    document.getElementById('massInput').disabled = true;
    document.getElementById('fuelMassInput').disabled = true;
    document.getElementById('thrustDurationInput').disabled = true;
    document.getElementById('gravitySelect').disabled = true;

    const durationInput = parseFloat(document.getElementById('thrustDurationInput').value);
    thrustTime = durationInput * 1000; // convert seconds to milliseconds

    // Reset graph data
    altitudeChart.data.labels = [];
    altitudeChart.data.datasets[0].data = [];
    altitudeChart.data.datasets[1].data = [];
    altitudeData.length = 0;
    velocityData.length = 0;
    accelerationData.length = 0;

    // Clear previous floating objects
    floatingObjects.length = 0;

    launchTime = null;
    rocket.hasLanded = false;
    rocket.isLaunched = true;
    // Reset flight state for a fresh simulation
    flightTime = 0;
    rocket.velocity = 0;
    rocket.acceleration = 0;
    apogee = null;
    apogeeIndex = null;
    previousVelocity = 0;
    cameraOffset = 0;

    rocket.y = getRocketPadY();
    renderRocketY = rocket.y;
    rocket.fuelMass = parseFloat(document.getElementById('fuelMassInput')?.value) || 518500;
    starDriftOffsetY = 0;
    glowDriftOffsetY = 0;

    // Immediately initialize chart dataset based on selected metric
    applyChartMetricStyle(selectedMetric);
    applyApogeeStyle();
    altitudeChart.update();

    // Now calculate thrust and mass (after reset)
    const thrustN = parseFloat(document.getElementById('thrustInput').value); // in Newtons
    const massKg = parseFloat(document.getElementById('massInput').value) + rocket.fuelMass;    // in kilograms
    const acceleration = thrustN / massKg; // F = ma → a = F / m
    rocket.thrust = -acceleration;
}

function resetSimulation() {
    rocket.x = canvas.width / 2 - rocket.width / 2;
    rocket.y = getRocketPadY();
    renderRocketY = rocket.y;
    rocket.velocity = 0;
    rocket.acceleration = 0;
    rocket.thrust = 0;
    rocket.isLaunched = false;
    rocket.hasLanded = false;
    rocket.fuelMass = 518500;
    flightTime = 0;
    launchTime = null;
    cameraOffset = 0;
    apogee = null;
    apogeeIndex = null;
    previousVelocity = 0;
    starDriftOffsetY = 0;
    glowDriftOffsetY = 0;

    altitudeData.length = 0;
    velocityData.length = 0;
    accelerationData.length = 0;
    altitudeChart.data.labels = [];
    altitudeChart.data.datasets[0].data = [];
    altitudeChart.data.datasets[1].data = [];
    applyChartMetricStyle(selectedMetric);
    applyApogeeStyle();

    document.getElementById('launchButton').disabled = false;
    document.getElementById('thrustInput').disabled = false;
    document.getElementById('massInput').disabled = false;
    document.getElementById('fuelMassInput').disabled = false;
    document.getElementById('thrustDurationInput').disabled = false;
    document.getElementById('gravitySelect').disabled = false;

    document.getElementById('spaceStatus').textContent = getGroundStatus(rocket.gravity);

    floatingObjects.length = 0;

    altitudeChart.update();
}

// Chart selector dropdown event listener
document.getElementById('chartSelector').addEventListener('change', (e) => {
    selectedMetric = e.target.value;
    applyChartMetricStyle(selectedMetric);
    applyApogeeStyle();
    altitudeChart.update();
    // Force re-render of apogee marker if metric is altitude
    if (selectedMetric === 'altitude' && apogee !== null && apogeeIndex !== null) {
        const apogeeData = new Array(altitudeChart.data.labels.length).fill(null);
        if (apogeeIndex < apogeeData.length) {
            apogeeData[apogeeIndex] = parseFloat(apogee.toFixed(2));
        }
        altitudeChart.data.datasets[0].data = apogeeData;
        altitudeChart.update();
    } else {
        altitudeChart.data.datasets[0].data = [];
        altitudeChart.update(); // Force update to re-scale y-axis without apogee
    }
});

resizeCanvases();
render(); // Initial render and start loop

// Ensure apogee label and legend show on load if viewing altitude
if (selectedMetric === 'altitude') {
    applyChartMetricStyle(selectedMetric);
    applyApogeeStyle();
    altitudeChart.update();
}