const G0 = 9.80665;

export const VALIDATION_THRESHOLDS = {
  twr: {
    minLiftoff: 1.05,
    maxPlausible: 8
  },
  massRatio: {
    min: 1.05,
    max: 40
  },
  stageContinuity: {
    maxEndToNextStartKg: 0,
    relativeWarningRatio: 0.25
  }
};

export const REGRESSION_THRESHOLDS = {
  maxTotalAccelerationMps2: 280,
  fuelMonotonicToleranceKg: 0.000001
};

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function addIssue(collection, issue) {
  collection.push(issue);
}

function buildIssue(preset, stage, severity, code, message, details = {}) {
  return {
    severity,
    code,
    message,
    presetId: preset.id,
    stageIndex: stage?.index ?? null,
    stageName: stage?.name ?? null,
    details
  };
}

function validateStageNumericFields(preset, stage, errors) {
  if (!isFinitePositive(stage.burnTimeSec)) {
    addIssue(
      errors,
      buildIssue(
        preset,
        stage,
        'error',
        'INVALID_BURN_TIME',
        'Stage burn time must be finite and greater than zero.',
        { burnTimeSec: stage.burnTimeSec }
      )
    );
  }

  if (!isFinitePositive(stage.avgThrustN)) {
    addIssue(
      errors,
      buildIssue(
        preset,
        stage,
        'error',
        'INVALID_THRUST',
        'Stage average thrust must be finite and greater than zero.',
        { avgThrustN: stage.avgThrustN }
      )
    );
  }

  if (!isFinitePositive(stage.startMassKg)) {
    addIssue(
      errors,
      buildIssue(
        preset,
        stage,
        'error',
        'INVALID_START_MASS',
        'Stage start mass must be finite and greater than zero.',
        { startMassKg: stage.startMassKg }
      )
    );
  }

  if (!isFinitePositive(stage.endMassKg)) {
    addIssue(
      errors,
      buildIssue(
        preset,
        stage,
        'error',
        'INVALID_END_MASS',
        'Stage end mass must be finite and greater than zero.',
        { endMassKg: stage.endMassKg }
      )
    );
  }

  if (Number.isFinite(stage.startMassKg) && Number.isFinite(stage.endMassKg) && stage.endMassKg >= stage.startMassKg) {
    addIssue(
      errors,
      buildIssue(
        preset,
        stage,
        'error',
        'NON_DECREASING_STAGE_MASS',
        'Stage end mass must be lower than stage start mass.',
        { startMassKg: stage.startMassKg, endMassKg: stage.endMassKg }
      )
    );
  }
}

function validateProfileField(preset, stage, fieldName, errors) {
  const profile = stage[fieldName];
  if (!Array.isArray(profile)) return;

  let previousUntil = 0;
  for (let i = 0; i < profile.length; i += 1) {
    const entry = profile[i];
    const untilSec = entry?.untilSec;
    const scale = entry?.scale;

    if (!Number.isFinite(untilSec) || untilSec <= 0) {
      addIssue(
        errors,
        buildIssue(
          preset,
          stage,
          'error',
          'INVALID_PROFILE_TIME',
          `${fieldName}[${i}].untilSec must be finite and greater than zero.`,
          { fieldName, index: i, untilSec }
        )
      );
      continue;
    }

    if (!Number.isFinite(scale) || scale <= 0) {
      addIssue(
        errors,
        buildIssue(
          preset,
          stage,
          'error',
          'INVALID_PROFILE_SCALE',
          `${fieldName}[${i}].scale must be finite and greater than zero.`,
          { fieldName, index: i, scale }
        )
      );
    }

    if (untilSec <= previousUntil) {
      addIssue(
        errors,
        buildIssue(
          preset,
          stage,
          'error',
          'NON_MONOTONIC_PROFILE_TIME',
          `${fieldName} untilSec values must be strictly increasing.`,
          { fieldName, index: i, untilSec, previousUntil }
        )
      );
    }

    previousUntil = untilSec;
  }
}

function validateStagePhysicsHeuristics(preset, stage, warnings, thresholds) {
  if (Number.isFinite(stage.avgThrustN) && Number.isFinite(stage.startMassKg) && stage.startMassKg > 0) {
    const twr = stage.avgThrustN / (stage.startMassKg * G0);

    if (twr < thresholds.twr.minLiftoff) {
      addIssue(
        warnings,
        buildIssue(
          preset,
          stage,
          'warning',
          'LOW_TWR_AT_IGNITION',
          'Thrust-to-weight ratio suggests weak or impossible liftoff for this stage.',
          { twr, minimum: thresholds.twr.minLiftoff }
        )
      );
    }

    if (twr > thresholds.twr.maxPlausible) {
      addIssue(
        warnings,
        buildIssue(
          preset,
          stage,
          'warning',
          'HIGH_TWR_AT_IGNITION',
          'Thrust-to-weight ratio is unusually high for this stage.',
          { twr, maximum: thresholds.twr.maxPlausible }
        )
      );
    }
  }

  if (Number.isFinite(stage.startMassKg) && Number.isFinite(stage.endMassKg) && stage.endMassKg > 0) {
    const massRatio = stage.startMassKg / stage.endMassKg;
    if (massRatio < thresholds.massRatio.min || massRatio > thresholds.massRatio.max) {
      addIssue(
        warnings,
        buildIssue(
          preset,
          stage,
          'warning',
          'SUSPICIOUS_MASS_RATIO',
          'Stage mass ratio is outside configured sanity bounds.',
          { massRatio, min: thresholds.massRatio.min, max: thresholds.massRatio.max }
        )
      );
    }
  }
}

function validateStageContinuity(preset, stages, warnings, errors, thresholds) {
  for (let i = 0; i < stages.length - 1; i += 1) {
    const current = stages[i];
    const next = stages[i + 1];

    if (!Number.isFinite(current.endMassKg) || !Number.isFinite(next.startMassKg)) {
      continue;
    }

    if (current.endMassKg < next.startMassKg - thresholds.stageContinuity.maxEndToNextStartKg) {
      addIssue(
        errors,
        buildIssue(
          preset,
          current,
          'error',
          'STAGE_CONTINUITY_BREAK',
          'Stage boundary has end mass lower than next stage start mass.',
          {
            currentEndMassKg: current.endMassKg,
            nextStartMassKg: next.startMassKg,
            nextStageIndex: next.index,
            nextStageName: next.name
          }
        )
      );
      continue;
    }

    const continuityDeltaKg = current.endMassKg - next.startMassKg;
    const continuityRelative = continuityDeltaKg / Math.max(1, current.endMassKg);

    if (continuityRelative > thresholds.stageContinuity.relativeWarningRatio) {
      addIssue(
        warnings,
        buildIssue(
          preset,
          current,
          'warning',
          'LARGE_STAGE_MASS_STEP',
          'Stage boundary mass drop is large and may indicate inconsistent stack accounting.',
          {
            continuityDeltaKg,
            continuityRelative,
            nextStageIndex: next.index,
            nextStageName: next.name
          }
        )
      );
    }
  }
}

export function validatePreset(preset, thresholds = VALIDATION_THRESHOLDS) {
  const errors = [];
  const warnings = [];

  if (!preset || !Array.isArray(preset.stages) || preset.stages.length === 0) {
    addIssue(
      errors,
      buildIssue(
        { id: preset?.id || 'unknown' },
        null,
        'error',
        'MISSING_STAGES',
        'Preset must contain at least one stage.'
      )
    );

    return {
      presetId: preset?.id || 'unknown',
      errors,
      warnings,
      hasErrors: true,
      hasWarnings: warnings.length > 0
    };
  }

  for (const stage of preset.stages) {
    validateStageNumericFields(preset, stage, errors);
    validateProfileField(preset, stage, 'thrustProfile', errors);
    validateProfileField(preset, stage, 'massFlowProfile', errors);
    validateStagePhysicsHeuristics(preset, stage, warnings, thresholds);
  }

  validateStageContinuity(preset, preset.stages, warnings, errors, thresholds);

  return {
    presetId: preset.id,
    errors,
    warnings,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0
  };
}

export function validatePresets(presets, thresholds = VALIDATION_THRESHOLDS) {
  return presets.map((preset) => validatePreset(preset, thresholds));
}
