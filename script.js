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

let thrustTime = 2000; // milliseconds of burn time
let launchTime = null;

let lastFrameTime = Date.now();
let flightTime = 0;

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (rocket.isLaunched) {
        if (!launchTime) launchTime = Date.now();

        const timeElapsed = Date.now() - launchTime;
        flightTime = timeElapsed;
        if (timeElapsed > thrustTime) {
            rocket.thrust = 0; // simulate engine cutoff
        }

        rocket.acceleration = rocket.thrust + rocket.gravity;
        rocket.velocity += rocket.acceleration * deltaTime;
        rocket.y += rocket.velocity;

        // Stop the rocket from falling below ground
        if (rocket.y + rocket.height > canvas.height) {
            rocket.y = canvas.height - rocket.height;
            rocket.velocity = 0;
            rocket.isLaunched = false;
        }
    }

    drawRocket();

    document.getElementById('altitude').textContent = Math.max(0, Math.round(canvas.height - rocket.y - rocket.height));
    const velocity = rocket.velocity.toFixed(2);
    const velocityDisplay = rocket.velocity < 0 ? `${Math.abs(velocity)} m/s ↑` : `${velocity} m/s ↓`;
    document.getElementById('velocity').textContent = velocityDisplay;
    const acc = rocket.acceleration.toFixed(2);
    const accDisplay = rocket.acceleration < 0 ? `${Math.abs(acc)} m/s² ↑` : `${acc} m/s² ↓`;
    document.getElementById('acceleration').textContent = accDisplay;
    document.getElementById('time').textContent = (flightTime / 1000).toFixed(2) + " s";

    const timeSec = (flightTime / 1000).toFixed(2);
    const altitude = Math.max(0, Math.round(canvas.height - rocket.y - rocket.height));

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