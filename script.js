const canvas = document.getElementById('rocketCanvas');
const ctx = canvas.getContext('2d');

const chartCtx = document.getElementById('altitudeChart').getContext('2d');
const altitudeChart = new Chart(chartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Apogee',
                data: [],
                borderColor: 'orange',
                pointBackgroundColor: 'orange',
                pointBorderColor: 'black',
                pointRadius: 15,
                pointHoverRadius: 17,
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
    fuelMass: 50000, // kg
    isp: 300, // seconds, specific impulse of engine
    hasLanded: false,
};

// Gravity selector logic
const gravitySelect = document.getElementById('gravitySelect');
rocket.gravity = parseFloat(gravitySelect.value);
gravitySelect.addEventListener('change', () => {
    rocket.gravity = parseFloat(gravitySelect.value);
});


const metersPerPixel = 0.5; // Adjust this value for realistic scale

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

    const altitude = Math.max(0, ((canvas.height - rocket.y - rocket.height) * metersPerPixel).toFixed(2));
    // Simulate atmosphere density decreasing with altitude
    const atmosphereDensity = Math.max(0.1, 1 - altitude / 100000);
    const isSpace = altitude >= 100000;
    drawEnvironment(isSpace);

    if (rocket.isLaunched) {
        if (!launchTime) launchTime = Date.now();

        const timeElapsed = Date.now() - launchTime;
        flightTime = timeElapsed;
        if (timeElapsed > thrustTime) {
            rocket.thrust = 0; // simulate engine cutoff
        }

        // Apogee detection logic (after drag, before velocity update)
        if (rocket.velocity > -0.1 && rocket.velocity < 0.1 && rocket.thrust === 0 && apogee === null) {
            apogee = altitude;
            console.log("Apogee reached at", altitude, "meters");
        }

        rocket.velocity += rocket.acceleration * deltaTime;
        rocket.y += rocket.velocity * deltaTime / metersPerPixel;

        // Stop the rocket from falling below ground, trigger explosion if high velocity
        if (rocket.y + rocket.height > canvas.height && rocket.isLaunched && !rocket.hasLanded && rocket.velocity > 1) {
            rocket.hasLanded = true;
            rocket.y = canvas.height - rocket.height;
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
            rocket.velocity = 0;
            rocket.isLaunched = false;
        } else if (rocket.velocity > 0 && altitude < 100 && rocket.fuelMass > 0) {
            const downwardVelocity = rocket.velocity;
            const safeAltitude = Math.max(altitude, 1); // meters
            const requiredNetAccel = (downwardVelocity * downwardVelocity) / (2 * safeAltitude);
            const dragCoefficient = 0.002;
            const dragForce = dragCoefficient * rocket.velocity * rocket.velocity * atmosphereDensity;
            rocket.thrust = -(requiredNetAccel + rocket.gravity - dragForce);
        }

        if (rocket.thrust !== 0 && rocket.fuelMass > 0) {
            const g0 = 9.81;
            const thrustN = Math.abs(rocket.thrust * parseFloat(document.getElementById('massInput').value)); // Convert accel back to N
            const burnRate = thrustN / (rocket.isp * g0); // kg/s
            const burnAmount = burnRate * deltaTime;
            rocket.fuelMass -= burnAmount;
            if (rocket.fuelMass <= 0) {
                rocket.fuelMass = 0;
                rocket.thrust = 0;
            }
        }

        rocket.acceleration = rocket.thrust + rocket.gravity;
        const dragCoefficient = 0.002;
        // Include atmosphere density in drag force
        const dragForce = -Math.sign(rocket.velocity) * dragCoefficient * rocket.velocity * rocket.velocity * atmosphereDensity;
        rocket.acceleration += dragForce;
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
        ctx.fillText(`Apogee: ${apogee} m`, rocket.x + rocket.width + 10, apogeeY);
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

    document.getElementById('altitude').textContent = altitude;
    const velocity = rocket.velocity.toFixed(2);
    const velocityDisplay = rocket.velocity < 0 ? `${Math.abs(velocity)} m/s ↑` : `${velocity} m/s ↓`;
    document.getElementById('velocity').textContent = velocityDisplay;
    const acc = rocket.acceleration.toFixed(2);
    const accDisplay = rocket.acceleration < 0 ? `${Math.abs(acc)} m/s² ↑` : `${acc} m/s² ↓`;
    document.getElementById('acceleration').textContent = accDisplay;
    document.getElementById('time').textContent = (flightTime / 1000).toFixed(2) + " s";

    const timeSec = (flightTime / 1000).toFixed(2);

    if (rocket.isLaunched) {
        altitudeChart.data.labels.push(timeSec);
        altitudeChart.data.datasets[1].data.push(altitude);
        if (apogee !== null && altitudeChart.data.datasets[0].data.length === 0) {
            altitudeChart.data.datasets[0].data = Array(altitudeChart.data.labels.length - 1).fill(null).concat([apogee]);
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
    const durationInput = parseFloat(document.getElementById('thrustDurationInput').value);
    thrustTime = durationInput * 1000; // convert seconds to milliseconds

    // Reset graph data
    altitudeChart.data.labels = [];
    altitudeChart.data.datasets[0].data = [];
    altitudeChart.data.datasets[1].data = [];

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

    rocket.y = canvas.height - rocket.height; // ensures consistent bottom alignment
    rocket.fuelMass = parseFloat(document.getElementById('fuelMassInput')?.value) || 50000;

    // Now calculate thrust and mass (after reset)
    const thrustN = parseFloat(document.getElementById('thrustInput').value); // in Newtons
    const massKg = parseFloat(document.getElementById('massInput').value);    // in kilograms
    const acceleration = thrustN / massKg; // F = ma → a = F / m
    rocket.thrust = -acceleration;
}

render(); // Initial render and start loop