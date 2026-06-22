const G0 = 9.80665;
const EARTH_RADIUS_M = 6371000;
const EARTH_MU = G0 * EARTH_RADIUS_M * EARTH_RADIUS_M;
const DT = 0.05;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function atmosphereDensity(altitudeM) {
  // Exponential approximation for near-Earth density falloff.
  return Math.max(0, 1.225 * Math.exp(-Math.max(0, altitudeM) / 8500));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildTimeline(stages) {
  let cumulative = 0;
  const timeline = [];
  for (const stage of stages) {
    const startSec = cumulative;
    const endSec = cumulative + stage.burnTimeSec;
    timeline.push({ ...stage, startSec, endSec });
    cumulative = endSec;
  }
  return timeline;
}

function normalizeStagesForSimulation(rawStages) {
  const stages = rawStages.map((stage) => ({ ...stage }));

  return stages.map((stage) => {
    const startMassKg = Math.max(1, stage.startMassKg);
    const endMassKg = clamp(stage.endMassKg, 1, startMassKg);
    const burnTimeSec = Math.max(0.001, stage.burnTimeSec);
    return {
      ...stage,
      startMassKg,
      endMassKg,
      burnTimeSec,
      thrustProfileNormalized: normalizeProfile(stage.thrustProfile),
      massFlowProfileNormalized: normalizeProfile(stage.massFlowProfile)
    };
  });
}

function normalizeProfile(profile) {
  if (!Array.isArray(profile) || profile.length === 0) return null;
  const sorted = [...profile]
    .filter((entry) => Number.isFinite(entry.untilSec) && Number.isFinite(entry.scale) && entry.untilSec > 0 && entry.scale > 0)
    .sort((a, b) => a.untilSec - b.untilSec);
  return sorted.length > 0 ? sorted : null;
}

function scaleFromProfile(profile, elapsedSec, defaultScale = 1) {
  if (!profile) return defaultScale;
  for (const entry of profile) {
    if (elapsedSec <= entry.untilSec) {
      return entry.scale;
    }
  }
  return profile[profile.length - 1].scale;
}

function weightedBurnProgress(profile, elapsedSec, burnTimeSec) {
  if (!profile) {
    return clamp(elapsedSec / burnTimeSec, 0, 1);
  }

  const clampedElapsed = clamp(elapsedSec, 0, burnTimeSec);
  let totalWeighted = 0;
  let consumedWeighted = 0;
  let startSec = 0;

  for (const entry of profile) {
    const endSec = clamp(entry.untilSec, startSec, burnTimeSec);
    const segmentDuration = Math.max(0, endSec - startSec);
    const weightedDuration = segmentDuration * entry.scale;
    totalWeighted += weightedDuration;

    const consumedEnd = clamp(clampedElapsed, startSec, endSec);
    const consumedDuration = Math.max(0, consumedEnd - startSec);
    consumedWeighted += consumedDuration * entry.scale;

    startSec = endSec;
    if (startSec >= burnTimeSec) break;
  }

  if (startSec < burnTimeSec) {
    const tailDuration = burnTimeSec - startSec;
    totalWeighted += tailDuration;
    const consumedTail = Math.max(0, clampedElapsed - startSec);
    consumedWeighted += consumedTail;
  }

  if (totalWeighted <= 0) return 0;
  return clamp(consumedWeighted / totalWeighted, 0, 1);
}

function lookupStage(timeline, tSec) {
  return timeline.find((stage) => tSec >= stage.startSec && tSec < stage.endSec) || null;
}

function stageMassAt(stage, tSec) {
  if (!stage) return 0;
  const localTimeSec = tSec - stage.startSec;
  const stageProgress = weightedBurnProgress(stage.massFlowProfileNormalized, localTimeSec, stage.burnTimeSec);
  return lerp(stage.startMassKg, stage.endMassKg, stageProgress);
}

function fuelMassRemainingKg(timeline, tSec) {
  let remainingKg = 0;
  for (const stage of timeline) {
    const propMassKg = Math.max(0, stage.startMassKg - stage.endMassKg);
    if (tSec <= stage.startSec) {
      remainingKg += propMassKg;
      continue;
    }
    if (tSec >= stage.endSec) {
      continue;
    }
    const currentMassKg = stageMassAt(stage, tSec);
    remainingKg += Math.max(0, currentMassKg - stage.endMassKg);
  }
  return remainingKg;
}

function guidancePitchRad(timeSec, hints) {
  const pitchProgramSec = hints.pitchProgramSec || 12;
  const maxPitchDeg = hints.maxPitchDeg || 72;
  const progress = clamp((timeSec - pitchProgramSec) / 220, 0, 1);
  const pitchDeg = progress * maxPitchDeg;
  return (pitchDeg * Math.PI) / 180;
}

function throttleFactor(timeSec, altitudeM) {
  // Quick startup ramp so t=0 represents near-liftoff conditions.
  const startupRamp = smoothstep(0, 1.1, timeSec);

  // Approximate max-Q throttle bucket: reduce throttle in lower atmosphere around 60-85 s.
  const maxQWindow = smoothstep(52, 66, timeSec) * (1 - smoothstep(84, 98, timeSec));
  const bucket = 1 - maxQWindow * 0.27;

  // Near-vacuum throttle recovery.
  const vacuumRecovery = smoothstep(35000, 75000, altitudeM);
  const recoveryBoost = 1 + vacuumRecovery * 0.04;

  return startupRamp * bucket * recoveryBoost;
}

function collectEvents(preset, stageTimeline) {
  const events = [];
  for (const stage of stageTimeline) {
    for (const event of stage.events) {
      events.push({
        timeSec: stage.startSec + event.timeSec,
        label: event.label
      });
    }
  }
  events.sort((a, b) => a.timeSec - b.timeSec);
  events.push({
    timeSec: stageTimeline[stageTimeline.length - 1].endSec + 120,
    label: 'Orbital Coast'
  });
  return events;
}

export function buildTrajectory(preset) {
  const normalizedStages = normalizeStagesForSimulation(preset.stages);
  const stageTimeline = buildTimeline(normalizedStages);
  const events = collectEvents(preset, stageTimeline);
  const burnoutSec = stageTimeline[stageTimeline.length - 1].endSec;
  const returnProfile = preset.modelHints?.returnsToEarth ? preset.modelHints?.returnProfile || {} : null;
  const returnStartSec = returnProfile ? burnoutSec + (returnProfile.coastBeforeReturnSec || 2400) : null;
  const entryStartSec = returnProfile ? returnStartSec + (returnProfile.entryLeadSec || 900) : null;
  const returnDurationSec = returnProfile ? returnProfile.descentDurationSec || 3600 : 0;
  const maxDurationSec = returnProfile
    ? returnStartSec + returnDurationSec + 1800
    : burnoutSec + (preset.modelHints?.coastDurationSec || 900);
  const minReturnCheckSec = returnProfile ? returnStartSec + 300 : burnoutSec + 60;

  if (returnProfile) {
    events.push(
      { timeSec: returnStartSec, label: 'Deorbit Burn' },
      { timeSec: entryStartSec, label: 'Entry Interface' },
      { timeSec: returnStartSec + returnDurationSec, label: 'Landing' }
    );
    events.sort((a, b) => a.timeSec - b.timeSec);
  }

  const samples = [];
  let altitudeM = 0;
  let thetaRad = 0;
  let velocityVertical = 0;
  let velocityHorizontal = 0;
  let accelerationMps2 = 0;
  let totalDurationSec = 0;
  let previousX = 0;
  let previousY = EARTH_RADIUS_M;

  for (let tSec = 0; tSec <= maxDurationSec; tSec += DT) {
    const stage = lookupStage(stageTimeline, tSec);
    const pitchRad = guidancePitchRad(tSec, preset.modelHints);

    const radiusM = EARTH_RADIUS_M + altitudeM;
    const massKg = stage ? stageMassAt(stage, tSec) : normalizedStages[normalizedStages.length - 1].endMassKg;
    const stageElapsedSec = stage ? tSec - stage.startSec : 0;
    const thrustScale = stage ? scaleFromProfile(stage.thrustProfileNormalized, stageElapsedSec, 1) : 0;
    const rawThrustN = stage ? stage.avgThrustN * thrustScale : 0;
    const thrustN = rawThrustN * throttleFactor(tSec, altitudeM);
    let area = stage ? stage.areaM2 : 2.5;
    let cd = stage ? stage.cd : 0.12;

    let deorbitFactor = 0;
    let entryFactor = 0;
    if (returnProfile && tSec >= returnStartSec) {
      deorbitFactor = smoothstep(returnStartSec, returnStartSec + 240, tSec);
      entryFactor = smoothstep(entryStartSec, entryStartSec + 720, tSec);
      area *= 1 + entryFactor * 0.9;
      cd *= 1 + entryFactor * 2.1;
    }

    const density = atmosphereDensity(altitudeM);
    const speed = Math.hypot(velocityVertical, velocityHorizontal);

    const speedOfSound = Math.max(250, 340 - Math.min(120, altitudeM / 1000) * 0.6);
    const mach = speed / speedOfSound;
    const transonicBump = 1 + 0.22 * Math.exp(-Math.pow((mach - 1.05) / 0.22, 2));
    const effectiveCd = cd * transonicBump;
    const dragN = 0.5 * density * effectiveCd * area * speed * speed;

    const gravity = EARTH_MU / (radiusM * radiusM);
    const thrustVerticalN = thrustN * Math.cos(pitchRad);
    const thrustHorizontalN = thrustN * Math.sin(pitchRad);

    const dragVerticalN = speed > 0 ? dragN * (velocityVertical / speed) : 0;
    const dragHorizontalN = speed > 0 ? dragN * (velocityHorizontal / speed) : 0;

    const netVerticalN = thrustVerticalN - dragVerticalN - massKg * gravity;
    const netHorizontalN = thrustHorizontalN - dragHorizontalN;

    const safeMassKg = Math.max(1, massKg);
    let accelVertical = (netVerticalN / safeMassKg) + ((velocityHorizontal * velocityHorizontal) / radiusM);
    let accelHorizontal = (netHorizontalN / safeMassKg) - ((velocityVertical * velocityHorizontal) / radiusM);

    if (returnProfile && tSec >= returnStartSec) {
      accelVertical -= 0.55 * deorbitFactor + 2.2 * entryFactor;
      accelHorizontal *= 1 - Math.min(0.75, entryFactor * 0.6);
    }

    accelerationMps2 = accelVertical;

    const liftoffCapable = thrustVerticalN > massKg * gravity;
    const holdDown = altitudeM <= 0.05 && velocityVertical <= 0 && !liftoffCapable;
    const engineOn = thrustN > 1000 && !holdDown;

    if (holdDown) {
      velocityVertical = 0;
      velocityHorizontal = 0;
      accelerationMps2 = 0;
    } else {
      velocityVertical += accelVertical * DT;
      velocityHorizontal += accelHorizontal * DT;
      if (returnProfile && tSec >= returnStartSec) {
        velocityHorizontal *= 1 - (0.00035 + entryFactor * 0.0011);
      }
      if (altitudeM <= 0.05 && velocityVertical < 0) {
        velocityVertical = 0;
      }
    }

    const updatedRadiusM = Math.max(EARTH_RADIUS_M, radiusM + velocityVertical * DT);
    altitudeM = updatedRadiusM - EARTH_RADIUS_M;
    thetaRad += (velocityHorizontal / Math.max(EARTH_RADIUS_M, updatedRadiusM)) * DT;

    const x = Math.sin(thetaRad) * updatedRadiusM;
    const y = Math.cos(thetaRad) * updatedRadiusM;

    // Velocity components in 2D Cartesian scene frame (radial + tangential decomposition).
    const vx = velocityVertical * Math.sin(thetaRad) + velocityHorizontal * Math.cos(thetaRad);
    const vy = velocityVertical * Math.cos(thetaRad) - velocityHorizontal * Math.sin(thetaRad);

    // Normalised thrust 0–1 so the renderer can scale plume intensity correctly.
    const thrustRatio = engineOn && stage ? clamp(thrustN / Math.max(1, stage.avgThrustN), 0, 1) : 0;

    const reachedGround = tSec >= minReturnCheckSec && altitudeM <= 0.1 && velocityVertical <= 0;

    if (reachedGround) {
      samples.push({
        tSec,
        altitudeM: 0,
        velocityMps: 0,
        accelerationMps2: 0,
        totalAccelerationMps2: 0,
        fuelMassKg: fuelMassRemainingKg(stageTimeline, tSec),
        x,
        y: EARTH_RADIUS_M,
        headingX: x - previousX,
        headingY: EARTH_RADIUS_M - previousY,
        vx: 0,
        vy: 0,
        thrustRatio: 0,
        stageName: 'Landed',
        engineOn: false,
        landed: true
      });
      totalDurationSec = tSec;
      break;
    }

    samples.push({
      tSec,
      altitudeM,
      velocityMps: Math.hypot(velocityVertical, velocityHorizontal),
      accelerationMps2: accelerationMps2,
      totalAccelerationMps2: Math.hypot(accelVertical, accelHorizontal),
      fuelMassKg: fuelMassRemainingKg(stageTimeline, tSec),
      x,
      y,
      headingX: x - previousX,
      headingY: y - previousY,
      vx,
      vy,
      thrustRatio,
      stageName: stage ? stage.name : 'Coast',
      engineOn,
      landed: false
    });

    previousX = x;
    previousY = y;

    totalDurationSec = tSec;
  }

  const apogeeM = Math.max(...samples.map((item) => item.altitudeM));
  return {
    samples,
    events,
    stats: {
      apogeeM,
      durationSec: totalDurationSec,
      targetApogeeM: preset.modelHints.targetApogeeM,
      targetPerigeeM: preset.modelHints.targetPerigeeM
    }
  };
}
