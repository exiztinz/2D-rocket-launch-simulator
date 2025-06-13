const canvas = document.getElementById('rocketCanvas');
const ctx = canvas.getContext('2d');

// Rocket properties
const rocket = {
    x: canvas.width / 2 - 10,
    y: canvas.height - 60,
    width: 20,
    height: 50,
    velocity: 0,
    acceleration: 0,
    thrust: -0.3,
    gravity: 0.1,
    isLaunched: true
};

// Draw rocket
function drawRocket() {
    ctx.fillStyle = 'red';
    ctx.fillRect(rocket.x, rocket.y, rocket.width, rocket.height);
}

// Clear and draw loop
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (rocket.isLaunched) {
        rocket.acceleration = rocket.thrust + rocket.gravity;
        rocket.velocity += rocket.acceleration;
        rocket.y += rocket.velocity;

        // Stop the rocket from falling below ground
        if (rocket.y + rocket.height > canvas.height) {
            rocket.y = canvas.height - rocket.height;
            rocket.velocity = 0;
            rocket.isLaunched = false;
        }
    }

    drawRocket();
    requestAnimationFrame(render);
}

render(); // Initial render and start loop