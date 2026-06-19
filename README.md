# 3D Launch Trajectory Explorer

A static, data-driven launch visualization built with Three.js and Chart.js.

This refactor replaces the original 2D manual-input simulator with a preset-based historical mission explorer. It renders an Earth-to-space 3D scene, replaying approximate ascent trajectories from publicly available launch data.

## What Changed

- Rendering migrated from 2D canvas to Three.js.
- Layout changed to sim-dominant composition:
	- Left/main: large 3D launch viewport.
	- Right/sidebar: compact telemetry + mini charts.
- Mission setup changed from free numeric controls to historical presets.
- Telemetry now includes mission events and stage timeline markers.

## Features

- Three.js 3D scene with:
	- Earth sphere and atmospheric glow.
	- Launch pad region and rocket model.
	- Engine plume and evolving trajectory path.
	- Camera modes: Follow Rocket, Ground Observer, Wide Orbit.
- Historical preset selector with at least 3 missions:
	- Saturn V - Apollo 11 class profile.
	- Space Shuttle - STS-1 class profile.
	- Falcon 9 - Starlink class profile.
- Compact telemetry cards:
	- Altitude, velocity, acceleration, fuel estimate, stage, flight time.
- Mini charts (Chart.js):
	- Altitude, velocity, acceleration.
	- Event markers (Max-Q, MECO, Stage Separation, SECO, etc.).
- Launch countdown and replay reset.

## Project Structure

- `index.html` UI shell and app mounting points.
- `style.css` responsive layout and visual design.
- `src/app.js` app controller and playback loop.
- `src/scene/threeScene.js` Three.js scene, camera, and rendering logic.
- `src/simulation/trajectory.js` approximate trajectory model and event timeline.
- `src/data/launchPresets.json` normalized historical mission presets.
- `src/data/launchData.js` preset loading and normalization.
- `src/data/schema.md` dataset field documentation.
- `src/ui/charts.js` mini telemetry chart rendering and event markers.
- `src/ui/telemetry.js` telemetry value formatting and updates.

## Data Model

Each preset includes:

- Mission metadata: provider, vehicle, mission, launch date, site.
- Stage-level parameters: burn time, average thrust, mass endpoints, drag proxies.
- Event timeline labels.
- Model hints for pitch program and target orbit estimates.

See `src/data/schema.md` for field-level details.

## Modeling Notes

The trajectory is an educational approximation, not a certified flight dynamics solver.

Implemented simplifications:

- Piecewise constant stage thrust.
- Exponential atmosphere density model.
- Gravity decreases with altitude via inverse-square relationship.
- Guidance/pitch represented by smooth heuristic program.
- Drag uses a single effective coefficient/area per stage.

## Public Data Sources

Preset records were assembled from public references and cross-checked where possible:

- NASA Apollo mission pages and Saturn V historical documents.
- NASA Space Shuttle mission summaries and reference material.
- SpaceX mission pages and publicly released launch information.
- FAA launch licensing references (public).
- Public technical summaries for cross-checking values.

Source links are included per mission in the app sidebar and in `src/data/launchPresets.json`.

## Assumptions And Inferred Values

- Some thrust, mass, and timing values are averaged or inferred from open literature.
- Event times are normalized into a staged replay timeline.
- Falcon 9 profile is modeled as a representative Starlink-class mission, not one exact full-fidelity flight.
- Orbital targets are treated as approximate reference values for visualization context.

## Run Locally

Use any static server (recommended). Example with VS Code Live Server:

1. Open the repository folder.
2. Start Live Server on `index.html`.
3. Use the mission preset dropdown and press Launch.

Direct `file://` opening can fail due to browser module and fetch restrictions.

## Known Limitations

- Rocket and Earth visuals are stylized and lightweight, not photoreal.
- No real-time external API ingestion in this version.
- No full multi-body orbital mechanics or guidance/control loop.
- Stage reentry/landing behavior is not modeled.
- Mobile devices may reduce frame rate during long replays.

## Next Improvements

- Add optional Cesium/real map context for launch sites.
- Add mission export (CSV/JSON telemetry snapshots).
- Add finer stage-specific events (fairing sep, boostback, relight).
- Add uncertainty bands for inferred parameters.
- Add adaptive quality scaling for low-power devices.

## License

MIT License.
