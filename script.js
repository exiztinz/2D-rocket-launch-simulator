const canvas = document.getElementById('rocketCanvas');
const ctx = canvas.getContext('2d');

// Rocket properties
const rocket = {
    x: canvas.width / 2 - 10,
    y: canvas.height - 60,
    width: 20,
    height: 50
};

// Draw rocket
function drawRocket() {
    ctx.fillStyle = 'red';
    ctx.fillRect(rocket.x, rocket.y, rocket.width, rocket.height);
}

// Clear and draw loop
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRocket();
}

render(); // Initial render