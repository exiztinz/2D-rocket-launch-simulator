/**
 * visual-physics-check.mjs
 *
 * Verifies that every physics sample contains internally consistent values that
 * the rendering subsystem depends on.  Failures here mean the renderer could
 * show incorrect attitude, wrong plume state, or a mismatched path.
 *
 * Checks per sample:
 *   1. altitudeM matches sqrt(x²+y²) − EARTH_RADIUS_M  (coordinate consistency)
 *   2. velocityMps matches hypot(vx, vy)               (velocity decomposition)
 *   3. thrustRatio is in [0, 1]                         (plume scale bounds)
 *   4. engineOn ↔ thrustRatio coherence               (plume visibility gate)
 *   5. fuelMassKg >= 0                                  (no negative fuel)
 */

import fs from 'node:fs';
import process from 'node:process';

import { buildTrajectory } from '../src/simulation/trajectory.js';

const EARTH_RADIUS_M = 6371000;

const THRESHOLDS = {
  altitudeTolerance: 1,       // metres  – floating-point accumulated error ceiling
  velocityTolerance: 0.001,   // m/s     – matches hypot rounding
  thrustRatioMin: 0,
  thrustRatioMax: 1.05        // allow slight over-unity from vacuumRecovery boost
};

function checkPreset(preset) {
  const trajectory = buildTrajectory(preset);
  const samples = trajectory.samples;
  const failures = [];

  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];

    // 1. Coordinate consistency: altitude from (x, y) must match stored altitudeM.
    const derivedAlt = Math.max(0, Math.hypot(s.x, s.y) - EARTH_RADIUS_M);
    const altDelta = Math.abs(derivedAlt - s.altitudeM);
    if (altDelta > THRESHOLDS.altitudeTolerance && !s.landed) {
      failures.push({ index: i, tSec: s.tSec, check: 'altitude-coord', delta: altDelta });
    }

    // 2. Velocity decomposition: velocityMps must equal hypot(vx, vy).
    if (Number.isFinite(s.vx) && Number.isFinite(s.vy)) {
      const derivedSpeed = Math.hypot(s.vx, s.vy);
      const velDelta = Math.abs(derivedSpeed - s.velocityMps);
      if (velDelta > THRESHOLDS.velocityTolerance) {
        failures.push({ index: i, tSec: s.tSec, check: 'velocity-decomp', delta: velDelta });
      }
    } else {
      failures.push({ index: i, tSec: s.tSec, check: 'velocity-decomp', delta: 'vx/vy non-finite' });
    }

    // 3. Thrust ratio bounds.
    if (!Number.isFinite(s.thrustRatio) || s.thrustRatio < THRESHOLDS.thrustRatioMin || s.thrustRatio > THRESHOLDS.thrustRatioMax) {
      failures.push({ index: i, tSec: s.tSec, check: 'thrustRatio-bounds', value: s.thrustRatio });
    }

    // 4. Engine-on / thrustRatio coherence.
    if (s.engineOn && s.thrustRatio <= 0) {
      failures.push({ index: i, tSec: s.tSec, check: 'engineOn-thrustRatio', engineOn: true, thrustRatio: s.thrustRatio });
    }
    if (!s.engineOn && s.thrustRatio > 0.01) {
      failures.push({ index: i, tSec: s.tSec, check: 'engineOn-thrustRatio', engineOn: false, thrustRatio: s.thrustRatio });
    }

    // 5. No negative fuel.
    if (s.fuelMassKg < -1e-6) {
      failures.push({ index: i, tSec: s.tSec, check: 'fuel-negative', fuelMassKg: s.fuelMassKg });
    }
  }

  return { presetId: preset.id, sampleCount: samples.length, failures };
}

function main() {
  const presets = JSON.parse(fs.readFileSync('./src/data/launchPresets.json', 'utf8'));
  let overallPass = true;

  console.log('Visual-physics consistency check\n');

  const rows = [];

  for (const preset of presets) {
    const result = checkPreset(preset);
    const status = result.failures.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') overallPass = false;

    rows.push({
      preset: result.presetId,
      status,
      samples: result.sampleCount,
      failures: result.failures.length,
      firstFailure: result.failures.length > 0
        ? `${result.failures[0].check} @ T=${result.failures[0].tSec?.toFixed(2)}s`
        : '-'
    });

    if (result.failures.length > 0) {
      console.log(`  ${result.presetId}: ${result.failures.length} failure(s)`);
      result.failures.slice(0, 3).forEach((f) => console.log('    ', JSON.stringify(f)));
    }
  }

  console.log('');
  console.table(rows);
  console.log(overallPass ? '\nAll checks passed.' : '\nSome checks failed.');

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main();
