const canvas = document.getElementById('rocketCanvas');
const ctx = canvas.getContext('2d');

const chartCtx = document.getElementById('altitudeChart').getContext('2d');
const altitudeChart = new Chart(chartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Altitude (m)',
            data: [],
            borderWidth: 2,
            fill: false
        }]
    },
    options: {
        animation: false,
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
    isLaunched: false
};


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

let thrustTime = 2000; // milliseconds of burn time
let launchTime = null;

let lastFrameTime = Date.now();
let flightTime = 0;
let cameraOffset = 0;
const trackingMargin = 100;
let isTracking = false;

function drawEnvironment() {
    ctx.fillStyle = 'lightblue'; // Sky background
    ctx.fillRect(0, cameraOffset, canvas.width, canvas.height);
}

// Draw rocket
function drawRocket() {
    ctx.fillStyle = 'red';
    ctx.fillRect(rocket.x, rocket.y, rocket.width, rocket.height);
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

    drawEnvironment();

    if (rocket.isLaunched) {
        if (!launchTime) launchTime = Date.now();

        const timeElapsed = Date.now() - launchTime;
        flightTime = timeElapsed;
        if (timeElapsed > thrustTime) {
            rocket.thrust = 0; // simulate engine cutoff
        }

        rocket.acceleration = rocket.thrust + rocket.gravity;
        rocket.velocity += rocket.acceleration * deltaTime;
        rocket.y += rocket.velocity * deltaTime / metersPerPixel;

        // Stop the rocket from falling below ground
        if (rocket.y + rocket.height > canvas.height) {
            rocket.y = canvas.height - rocket.height;
            rocket.velocity = 0;
            rocket.isLaunched = false;
        }
    }

    drawRocket();

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
            ctx.fillStyle = 'gray';
            ctx.fillRect(obj.x, obj.y, 10, 10);
        }

        if (obj.y > cameraOffset + canvas.height + 100) {
            floatingObjects.splice(i, 1);
        }
    }

    ctx.restore();

    const altitude = Math.max(0, ((canvas.height - rocket.y - rocket.height) * metersPerPixel).toFixed(2));
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
        altitudeChart.data.datasets[0].data.push(altitude);
        altitudeChart.update('none');
    }

    requestAnimationFrame(render);
}

function launchRocket() {
    launchTime = null;
    const thrustN = parseFloat(document.getElementById('thrustInput').value); // in Newtons
    const massKg = parseFloat(document.getElementById('massInput').value);    // in kilograms
    const acceleration = thrustN / massKg; // F = ma → a = F / m
    rocket.thrust = -acceleration;
    rocket.velocity = 0;
    rocket.y = canvas.height - rocket.height; // ensures consistent bottom alignment
    rocket.isLaunched = true;
}

render(); // Initial render and start loop