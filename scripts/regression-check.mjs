import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildTrajectory } from '../src/simulation/trajectory.js';
import { REGRESSION_THRESHOLDS, validatePreset } from '../src/data/presetValidation.js';

function parseArgs(argv) {
  const options = {
    maxAccel: REGRESSION_THRESHOLDS.maxTotalAccelerationMps2,
    fuelTolerance: REGRESSION_THRESHOLDS.fuelMonotonicToleranceKg
  };

  for (const arg of argv) {
    if (arg.startsWith('--max-accel=')) {
      const value = Number(arg.slice('--max-accel='.length));
      if (Number.isFinite(value) && value > 0) {
        options.maxAccel = value;
      }
    }

    if (arg.startsWith('--fuel-tolerance=')) {
      const value = Number(arg.slice('--fuel-tolerance='.length));
      if (Number.isFinite(value) && value >= 0) {
        options.fuelTolerance = value;
      }
    }
  }

  return options;
}

function loadPresets() {
  const presetPath = path.resolve(process.cwd(), 'src/data/launchPresets.json');
  const payload = fs.readFileSync(presetPath, 'utf8');
  return JSON.parse(payload);
}

function hasNonFiniteSample(sample) {
  return !Number.isFinite(sample.altitudeM)
    || !Number.isFinite(sample.velocityMps)
    || !Number.isFinite(sample.accelerationMps2)
    || !Number.isFinite(sample.totalAccelerationMps2)
    || !Number.isFinite(sample.fuelMassKg);
}

function runPresetChecks(preset, options) {
  const reasons = [];
  const validation = validatePreset(preset);

  if (validation.hasErrors) {
    reasons.push(`validator errors: ${validation.errors.length}`);
  }

  let trajectory;
  try {
    trajectory = buildTrajectory(preset);
  } catch (error) {
    reasons.push(`trajectory build failure: ${error.message}`);
    return {
      presetId: preset.id,
      status: 'FAIL',
      reasons,
      sampleCount: 0,
      maxTotalAccelerationMps2: NaN
    };
  }

  const samples = trajectory.samples || [];
  let maxTotalAccelerationMps2 = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];

    if (hasNonFiniteSample(sample)) {
      reasons.push(`non-finite sample at index ${i}`);
      break;
    }

    if (sample.totalAccelerationMps2 > maxTotalAccelerationMps2) {
      maxTotalAccelerationMps2 = sample.totalAccelerationMps2;
    }

    if (i > 0) {
      const prev = samples[i - 1];
      if (sample.fuelMassKg > prev.fuelMassKg + options.fuelTolerance) {
        reasons.push(`fuel increased at index ${i}`);
        break;
      }
    }
  }

  if (maxTotalAccelerationMps2 > options.maxAccel) {
    reasons.push(`max total acceleration ${maxTotalAccelerationMps2.toFixed(2)} > bound ${options.maxAccel.toFixed(2)}`);
  }

  return {
    presetId: preset.id,
    status: reasons.length === 0 ? 'PASS' : 'FAIL',
    reasons,
    sampleCount: samples.length,
    maxTotalAccelerationMps2
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const presets = loadPresets();

  const rows = presets.map((preset) => runPresetChecks(preset, options));
  const passCount = rows.filter((row) => row.status === 'PASS').length;
  const failCount = rows.length - passCount;

  console.log('Regression thresholds:', {
    maxTotalAccelerationMps2: options.maxAccel,
    fuelMonotonicToleranceKg: options.fuelTolerance
  });

  console.table(rows.map((row) => ({
    preset: row.presetId,
    status: row.status,
    samples: row.sampleCount,
    maxAccel: Number.isFinite(row.maxTotalAccelerationMps2)
      ? row.maxTotalAccelerationMps2.toFixed(2)
      : 'n/a',
    reasons: row.reasons.join(' | ') || '-'
  })));

  console.log(`Summary: ${passCount} pass, ${failCount} fail, total ${rows.length}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main();
