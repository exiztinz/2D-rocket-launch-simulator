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
                borderColor: 'blue',
                borderWidth: 2,
                order: 1
            }
        ]
    },
    options: {
        animation: false,
        interaction: {
            mode: 'nearest',
            intersect: true
        },
        scales: {
            x: { title: { display: true, text: 'Time (s)' } },
            y: { title: { display: true, text: 'Altitude (m)' } }
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
});


const metersPerPixel = 0.5; // Adjust this value for realistic scale

// For ramped landing burn
let rampStartTime = null;
const rampUpTime = 4; // seconds
let fullProgress = false;
let reached = false;

// --- Dynamic-ramp helpers ---
function getEffectiveRampUp(maxAccel) {
    return rampUpTime * (maxAccel / 50);
}
function getBuffer(v0) {
    return 0.5 * v0;
}

// Array to hold floating atmospheric elements (clouds, debris, etc)
const floatingObjects = [];
// Helper to generate a floating object (cloud or debris)
function generateFloatingObject(yOffset) {
    return {
        x: Math.random() * canvas.width,
        y: rocket.y + yOffset,
        type: Math.random() > 0.5 ? 'cloud' : 'debris'
    };
}

let thrustTime = 0; // milliseconds of burn time set via user input
let launchTime = null;

let lastFrameTime = Date.now();
let flightTime = 0;
let cameraOffset = 0;
const trackingMargin = 100;
let isTracking = false;

let apogee = null;
let apogeeIndex = null;

// Data arrays for chart metrics
const altitudeData = [];
const velocityData = [];
const accelerationData = [];
let selectedMetric = 'altitude';

function drawEnvironment(isSpace) {
    ctx.fillStyle = isSpace ? 'black' : 'lightblue';
    ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
}

// Draw rocket with nose cone, body, and fins
function drawRocket() {
    ctx.fillStyle = 'gray';
    ctx.beginPath();
    // Nose cone
    ctx.moveTo(rocket.x, rocket.y + 10);
    ctx.lineTo(rocket.x + rocket.width / 2, rocket.y);
    ctx.lineTo(rocket.x + rocket.width, rocket.y + 10);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = 'red';
    ctx.fillRect(rocket.x, rocket.y + 10, rocket.width, rocket.height - 10);

    // Fins
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(rocket.x, rocket.y + rocket.height - 5);
    ctx.lineTo(rocket.x - 10, rocket.y + rocket.height + 10);
    ctx.lineTo(rocket.x, rocket.y + rocket.height);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(rocket.x + rocket.width, rocket.y + rocket.height - 5);
    ctx.lineTo(rocket.x + rocket.width + 10, rocket.y + rocket.height + 10);
    ctx.lineTo(rocket.x + rocket.width, rocket.y + rocket.height);
    ctx.closePath();
    ctx.fill();
}

// Clear and draw loop
function render() {
    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000; // in seconds
    lastFrameTime = now;

    // Spawn new floating objects periodically when rocket is launched
    if (rocket.isLaunched && Math.random() < 0.1) {
        floatingObjects.push(generateFloatingObject(-canvas.height));
    }

    ctx.save();
    if (rocket.isLaunched) {
        if (!isTracking && rocket.y < canvas.height / 2) {
            isTracking = true;
        } else {
            isTracking = false;
        }

        if (isTracking) {
            // Adjust cameraOffset so the rocket is always centered vertically
            cameraOffset = rocket.y - canvas.height / 2;
        }
    } else {
        isTracking = false;
        cameraOffset = 0;
    }

    ctx.translate(0, -cameraOffset);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const altitude = Math.max(0, (canvas.height - rocket.y - rocket.height) * metersPerPixel);
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
    const isSpace = altitude >= 100000;
    if (isSpace) {
        atmosphereDensity = 0;
    }
    // Determine environment and update background and status
    const gravity = rocket.gravity;
    if (isSpace) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
        document.getElementById('spaceStatus').textContent = "Status: In Space";
    } else if (gravity === 3.71) {
        ctx.fillStyle = 'orange';
        ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
        document.getElementById('spaceStatus').textContent = "Status: On Mars";
    } else if (gravity === 1.62) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
        document.getElementById('spaceStatus').textContent = "Status: On Moon";
    } else {
        drawEnvironment(isSpace);  // Default to Earth sky color
    }

    if (rocket.isLaunched) {
        if (!launchTime) launchTime = Date.now();

        const totalMass = parseFloat(document.getElementById('massInput').value) + rocket.fuelMass;
        const thrustN = parseFloat(document.getElementById('thrustInput').value);

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

        // Apogee detection logic (after drag, before velocity update)
        if (rocket.velocity > -0.5 && rocket.velocity < 0.5 && rocket.thrust === 0 && apogee === null) {
            apogee = altitude;
            apogeeIndex = altitudeChart.data.labels.length - 1;
            console.log("Apogee reached at", altitude, "meters");
        }

        rocket.velocity += rocket.acceleration * deltaTime;
        rocket.y += rocket.velocity * deltaTime / metersPerPixel;

        // Stop the rocket from falling below ground, trigger explosion if high velocity
        if (rocket.y + rocket.height > canvas.height && rocket.isLaunched && !rocket.hasLanded && rocket.velocity > 1) {
            rocket.hasLanded = true;
            rocket.y = canvas.height - rocket.height;
            // Reset ramping state on landing (success or crash)
            rampStartTime = null;
            fullProgress = false;
            reached = false;
            if (rocket.velocity > 10) {
                for (let i = 0; i < 20; i++) {
                    floatingObjects.push({
                        x: rocket.x + rocket.width / 2 + (Math.random() - 0.5) * 40,
                        y: rocket.y + rocket.height / 2 + (Math.random() - 0.5) * 40,
                        type: 'debris',
                        vx: (Math.random() - 0.5) * 200,
                        vy: (Math.random() - 0.5) * 200,
                        ttl: 60
                    });
                }
                alert('🚨 Crash Landing! The rocket landed too hard.');
            } else {
                alert('✅ Successful Landing! Well done.');
            }
            document.getElementById('launchButton').disabled = false;
            rocket.velocity = 0;
            rocket.isLaunched = false;
            document.getElementById('thrustInput').disabled = false;
            document.getElementById('massInput').disabled = false;
            document.getElementById('fuelMassInput').disabled = false;
            document.getElementById('thrustDurationInput').disabled = false;
            document.getElementById('gravitySelect').disabled = false;
            document.getElementById('spaceStatus').textContent = "Status: On Earth";
        } else if (rocket.fuelMass > 0 && rocket.thrust === 0 && rocket.velocity > 1) {
            const thrustN = parseFloat(document.getElementById('thrustInput').value);
            const totalMass = parseFloat(document.getElementById('massInput').value) + rocket.fuelMass;

            const g = rocket.gravity;
            const v0 = rocket.velocity;
            const vTarget = 5;

            const maxThrustAccel = Math.min(thrustN / totalMass, 50);
            const effectiveRamp = getEffectiveRampUp(maxThrustAccel);

            const dragAccel = 0.5 * realCd * crossSectionArea * atmosphereDensity * v0 * v0 / totalMass;
            const netAccel = maxThrustAccel - g + dragAccel;

            hMin = (v0 * v0 - vTarget * vTarget) / (2 * netAccel);
            if (!fullProgress) {
                const avgRampAccel = 0.5 * netAccel; //needs to be tested
                hMin += v0 * effectiveRamp + 0.5 * avgRampAccel * effectiveRamp * effectiveRamp;
                // hMin += v0 * effectiveRamp;
            }

            const buffer = getBuffer(v0);
            
            if (altitude <= hMin + buffer) {
                reached = true;
            }
            if (reached) {
                if (rampStartTime === null) {
                    rampStartTime = Date.now();
                }

                const rampElapsed = (Date.now() - rampStartTime) / 1000;
                const rampProgress = Math.min(1, rampElapsed / effectiveRamp);
                if (rampProgress === 1) {
                    fullProgress = true;
                }
                let rampedAccel
                if (!fullProgress) {
                    rampedAccel = maxThrustAccel * rampProgress;
                } else {
                    rampedAccel = ((v0 ** 2 - vTarget ** 2) / (2 * altitude)) + g - dragAccel;
                }
                rocket.thrust = -rampedAccel;
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

    drawRocket();

    if (apogee !== null) {
        const apogeeY = canvas.height - (apogee / metersPerPixel) - rocket.height;
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(rocket.x + rocket.width / 2, apogeeY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText(`Apogee: ${apogee.toFixed(2)} m`, rocket.x + rocket.width + 10, apogeeY);
    }

    // Draw and update floating atmospheric objects (clouds, debris)
    for (let i = floatingObjects.length - 1; i >= 0; i--) {
        const obj = floatingObjects[i];
        if (isTracking) {
            obj.y += -rocket.velocity * deltaTime / metersPerPixel;
        }

        if (obj.type === 'cloud') {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 15, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'orange';
            ctx.fillRect(obj.x, obj.y, 6, 6);

            if (obj.vx !== undefined) {
                obj.x += obj.vx * deltaTime;
                obj.y += obj.vy * deltaTime;
                obj.vy += 100 * deltaTime;
                obj.ttl -= 1;
                if (obj.ttl <= 0) floatingObjects.splice(i, 1);
            }
        }

        if (obj.y > cameraOffset + canvas.height + 100) {
            floatingObjects.splice(i, 1);
        }
    }

    ctx.restore();

    document.getElementById('altitude').textContent = altitude.toFixed(2);
    if (altitude >= 100000) {
        document.getElementById('spaceStatus').textContent = "Status: In Space";
    } else if (altitude > 0) {
        document.getElementById('spaceStatus').textContent = "Status: In Air";
    } else {
        const gravity = rocket.gravity;
        if (gravity === 3.71) {
            document.getElementById('spaceStatus').textContent = "Status: On Mars";
        } else if (gravity === 1.62) {
            document.getElementById('spaceStatus').textContent = "Status: On Moon";
        } else {
            document.getElementById('spaceStatus').textContent = "Status: On Earth";
        }
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
    timeElapsed = 0;
    flightTime = 0;
    rocket.velocity = 0;
    rocket.acceleration = 0;
    apogee = null;
    apogeeIndex = null;

    rocket.y = canvas.height - rocket.height; // ensures consistent bottom alignment
    rocket.fuelMass = parseFloat(document.getElementById('fuelMassInput')?.value) || 518500;

    // Immediately initialize chart dataset based on selected metric
    if (selectedMetric === 'altitude') {
        altitudeChart.data.datasets[1].data = altitudeData;
        altitudeChart.data.datasets[1].label = 'Altitude (m)';
        altitudeChart.data.datasets[1].borderColor = 'blue';
        altitudeChart.options.scales.y.title.text = 'Altitude (m)';
    } else if (selectedMetric === 'velocity') {
        altitudeChart.data.datasets[1].data = velocityData;
        altitudeChart.data.datasets[1].label = 'Velocity (m/s)';
        altitudeChart.data.datasets[1].borderColor = 'green';
        altitudeChart.options.scales.y.title.text = 'Velocity (m/s)';
    } else if (selectedMetric === 'acceleration') {
        altitudeChart.data.datasets[1].data = accelerationData;
        altitudeChart.data.datasets[1].label = 'Acceleration (m/s²)';
        altitudeChart.data.datasets[1].borderColor = 'red';
        altitudeChart.options.scales.y.title.text = 'Acceleration (m/s²)';
    }
    // Apogee marker visibility control
    altitudeChart.data.datasets[0].label = selectedMetric === 'altitude' ? 'Apogee' : '';
    altitudeChart.data.datasets[0].borderColor = selectedMetric === 'altitude' ? 'orange' : 'transparent';
    altitudeChart.data.datasets[0].pointBackgroundColor = selectedMetric === 'altitude' ? 'orange' : 'transparent';
    altitudeChart.data.datasets[0].pointBorderColor = selectedMetric === 'altitude' ? 'black' : 'transparent';
    altitudeChart.data.datasets[0].pointRadius = selectedMetric === 'altitude' ? 15 : 0;
    altitudeChart.data.datasets[0].pointHoverRadius = selectedMetric === 'altitude' ? 17 : 0;
    altitudeChart.update();

    // Now calculate thrust and mass (after reset)
    const thrustN = parseFloat(document.getElementById('thrustInput').value); // in Newtons
    const massKg = parseFloat(document.getElementById('massInput').value) + rocket.fuelMass;    // in kilograms
    const acceleration = thrustN / massKg; // F = ma → a = F / m
    rocket.thrust = -acceleration;
    fullProgress = false;
    reached = false;
}

function resetSimulation() {
    rocket.x = canvas.width / 2 - 10;
    rocket.y = canvas.height - rocket.height;
    rocket.velocity = 0;
    rocket.acceleration = 0;
    rocket.thrust = 0;
    rocket.isLaunched = false;
    rocket.hasLanded = false;
    rocket.fuelMass = 518500;
    flightTime = 0;
    launchTime = null;
    cameraOffset = 0;
    isTracking = false;
    apogee = null;
    apogeeIndex = null;

    altitudeData.length = 0;
    velocityData.length = 0;
    accelerationData.length = 0;
    altitudeChart.data.labels = [];
    altitudeChart.data.datasets[0].data = [];
    altitudeChart.data.datasets[1].data = [];

    document.getElementById('launchButton').disabled = false;
    document.getElementById('thrustInput').disabled = false;
    document.getElementById('massInput').disabled = false;
    document.getElementById('fuelMassInput').disabled = false;
    document.getElementById('thrustDurationInput').disabled = false;
    document.getElementById('gravitySelect').disabled = false;

    document.getElementById('spaceStatus').textContent = "Status: On Earth";

    floatingObjects.length = 0;

    altitudeChart.update();
    // Reset ramping state on simulation reset
    rampStartTime = null;
}

// Chart selector dropdown event listener
document.getElementById('chartSelector').addEventListener('change', (e) => {
    selectedMetric = e.target.value;
    const dataset = altitudeChart.data.datasets[1];
    if (selectedMetric === 'altitude') {
        dataset.label = 'Altitude (m)';
        dataset.borderColor = 'blue';
        dataset.data = altitudeData;
        altitudeChart.options.scales.y.title.text = 'Altitude (m)';
    } else if (selectedMetric === 'velocity') {
        dataset.label = 'Velocity (m/s)';
        dataset.borderColor = 'green';
        dataset.data = velocityData;
        altitudeChart.options.scales.y.title.text = 'Velocity (m/s)';
    } else if (selectedMetric === 'acceleration') {
        dataset.label = 'Acceleration (m/s²)';
        dataset.borderColor = 'red';
        dataset.data = accelerationData;
        altitudeChart.options.scales.y.title.text = 'Acceleration (m/s²)';
    }
    altitudeChart.data.datasets[0].label = selectedMetric === 'altitude' ? 'Apogee' : '';
    altitudeChart.data.datasets[0].borderColor = selectedMetric === 'altitude' ? 'orange' : 'transparent';
    altitudeChart.data.datasets[0].pointBackgroundColor = selectedMetric === 'altitude' ? 'orange' : 'transparent';
    altitudeChart.data.datasets[0].pointBorderColor = selectedMetric === 'altitude' ? 'black' : 'transparent';
    altitudeChart.data.datasets[0].pointRadius = selectedMetric === 'altitude' ? 15 : 0;
    altitudeChart.data.datasets[0].pointHoverRadius = selectedMetric === 'altitude' ? 17 : 0;
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

render(); // Initial render and start loop

// Ensure apogee label and legend show on load if viewing altitude
if (selectedMetric === 'altitude') {
    altitudeChart.data.datasets[0].label = 'Apogee';
    altitudeChart.data.datasets[0].borderColor = 'orange';
    altitudeChart.data.datasets[0].pointBackgroundColor = 'orange';
    altitudeChart.data.datasets[0].pointBorderColor = 'black';
    altitudeChart.data.datasets[0].pointRadius = 15;
    altitudeChart.data.datasets[0].pointHoverRadius = 17;
    altitudeChart.update();
}