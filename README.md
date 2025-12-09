# 2D Rocket Launch Simulator
A real-time 2D physics simulation of a rocket launch, built from scratch in JavaScript.

This project models realistic rocket flight dynamics—thrust, gravity, drag, mass depletion, and fuel burn—while rendering smooth motion and live telemetry graphs. It serves as an educational tool and a demonstration of simulation architecture, performance optimization, and real-time visualization in the browser.

Live Demo: https://twod-rocket-launch-simulator.onrender.com/
Source Code: This repository

---

## Key Features

Interactive Launch Environment:
- Launch and reset controls
- Real-time flight feedback
- Adjustable rocket parameters (thrust curve, mass, burn rate, drag coefficient)

Realistic Flight Physics:
- Thrust force
- Gravity
- Aerodynamic drag
- Mass depletion over time
- Accurate apogee detection using velocity zero-crossing

Live Telemetry Charts (Chart.js):
- Altitude
- Velocity
- Acceleration
- Fuel remaining
- Smooth updates every simulation tick

Flight Events and States:
- Fuel depletion shutdown
- Stage-separation–ready architecture
- Atmospheric drag simulation
- Smooth state transitions

---

## Architecture Overview

Physics Engine (physics.js):
- Computes net force, acceleration, velocity, and altitude
- Models drag, thrust, mass changes, and gravity
- Performs time-step integration for stable motion

Renderer (render.js):
- Draws rocket on HTML5 Canvas
- Uses requestAnimationFrame for smooth animation
- Renders trajectory, plume, and rocket body

Simulation Controller (sim.js):
- Manages Idle → Launch → Coast → Apogee → Descent
- Sends telemetry to UI and graphs
- Ensures deterministic simulation timing

UI Layer (index.html, ui.js):
- Launch/reset buttons
- Optional parameter inputs
- Live telemetry indicators

---

## Physics Model (No Code Blocks)

Net Force Equation:  
F_net = F_thrust(t) - F_drag(v) - m * g

Drag Equation:  
F_drag = 0.5 * rho * C_d * A * v^2

Mass Depletion:  
m(t) = m_dry + m_fuel(t)

Numerical Integration:  
v = v + a * dt  
y = y + v * dt

---

## Screenshots

Example:  
![Launch Screenshot](./assets/launch.png)  
![Telemetry Graph](./assets/telemetry.png)

---

## Try It Yourself

Clone the repository:  
git clone https://github.com/exiztinz/2D-rocket-launch-simulator  
cd 2D-rocket-launch-simulator

Open:  
index.html

For best results, run with a static server (such as VS Code Live Server).

---

## Tech Stack

- JavaScript  
- HTML5 Canvas  
- CSS  
- Chart.js  
- requestAnimationFrame  

---

## What I Learned

- How to build a custom physics engine  
- Techniques for stable numerical integration  
- Real-time rendering optimization  
- Modular JavaScript architecture  
- Dynamic, real-time telemetry visualization  
- Balancing realism and performance in simulations  
- Designing interactive scientific tools for the browser  

---

## Future Enhancements

Planned:
- Multi-stage rocket support  
- PID guidance system  
- Atmospheric density model  
- Wind/turbulence simulation  
- CSV/JSON telemetry export  
- Improved mobile UI  

Experimental:
- WebGL rendering  
- GPU-accelerated physics  
- Machine learning thrust optimization  

---

## Contributions
Pull requests and suggestions are welcome. Open an issue if you'd like to collaborate.

---

## License
MIT License — free to use, modify, and distribute.
