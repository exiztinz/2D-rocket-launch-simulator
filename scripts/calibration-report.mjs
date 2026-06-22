import fs from 'node:fs';
import path from 'node:path';

import { buildTrajectory } from '../src/simulation/trajectory.js';

const BASELINE_PATH = path.resolve(process.cwd(), 'docs/baseline-before.json');
const REPORT_PATH = path.resolve(process.cwd(), 'docs/calibration-report.md');
const PRESET_PATH = path.resolve(process.cwd(), 'src/data/launchPresets.json');

function pctError(simulated, historical) {
  if (!Number.isFinite(simulated) || !Number.isFinite(historical) || historical === 0) {
    return null;
  }
  return ((simulated - historical) / historical) * 100;
}

function formatNum(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function findEventTime(events, matcher) {
  const match = events.find((event) => matcher(event.label));
  return match ? match.timeSec : null;
}

function nearestSample(samples, targetTimeSec) {
  if (!Array.isArray(samples) || samples.length === 0 || !Number.isFinite(targetTimeSec)) {
    return null;
  }

  let nearest = samples[0];
  let minDelta = Math.abs(samples[0].tSec - targetTimeSec);
  for (let i = 1; i < samples.length; i += 1) {
    const delta = Math.abs(samples[i].tSec - targetTimeSec);
    if (delta < minDelta) {
      minDelta = delta;
      nearest = samples[i];
    }
  }
  return nearest;
}

function extractBurnEventTimes(events) {
  const meco = findEventTime(events, (label) => /\bMECO\b|cutoff/i.test(label));
  const stageSep = findEventTime(events, (label) => /stage\s*sep|separation/i.test(label));
  return { meco, stageSep };
}

function buildCurrentMetrics(preset) {
  const trajectory = buildTrajectory(preset);
  const samples = trajectory.samples;
  const events = trajectory.events;

  const maxAlt = Math.max(...samples.map((sample) => sample.altitudeM));
  const maxVel = Math.max(...samples.map((sample) => sample.velocityMps));
  const maxAcc = Math.max(...samples.map((sample) => sample.totalAccelerationMps2));
  const burnEvents = extractBurnEventTimes(events);

  const milestone = preset.modelHints?.historicalMilestones || {};
  const orbitEventLabel = milestone.orbitInsertionEventLabel;
  const orbitEvent = orbitEventLabel
    ? events.find((event) => event.label === orbitEventLabel)
    : null;
  const orbitSample = orbitEvent ? nearestSample(samples, orbitEvent.timeSec) : null;

  return {
    maxAlt,
    maxVel,
    maxAcc,
    burnEvents,
    orbitInsertion: {
      eventLabel: orbitEventLabel || null,
      eventTimeSec: orbitEvent?.timeSec ?? null,
      altitudeM: orbitSample?.altitudeM ?? null,
      velocityMps: orbitSample?.velocityMps ?? null
    },
    events: events.map((event) => ({ label: event.label, timeSec: event.timeSec }))
  };
}

function main() {
  const baseline = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
    : {};

  const presets = JSON.parse(fs.readFileSync(PRESET_PATH, 'utf8'));
  const now = new Date().toISOString();

  const reportLines = [];
  reportLines.push('# Calibration Report');
  reportLines.push('');
  reportLines.push(`Generated: ${now}`);
  reportLines.push('');
  reportLines.push('## Before/After Simulation Deltas');
  reportLines.push('');
  reportLines.push('| Mission | Delta Apogee (m) | Delta Max Velocity (m/s) | Delta Max Accel (m/s^2) | Delta MECO Time (s) | Delta Stage Sep Time (s) |');
  reportLines.push('|---|---:|---:|---:|---:|---:|');

  reportLines.push('');
  reportLines.push('## Historical Milestone Error');
  reportLines.push('');
  reportLines.push('| Mission | Confidence | Sim MECO (s) | Hist MECO (s) | MECO Error % | Sim Stage Sep (s) | Hist Stage Sep (s) | Stage Sep Error % | Sim Orbit Alt (m) | Hist Orbit Alt (m) | Orbit Alt Error % | Sim Orbit Vel (m/s) | Hist Orbit Vel (m/s) | Orbit Vel Error % |');
  reportLines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  const deltaRows = [];
  const milestoneRows = [];

  for (const preset of presets) {
    const missionId = preset.id;
    const current = buildCurrentMetrics(preset);
    const previous = baseline[missionId] || null;

    const currentMeco = current.burnEvents.meco;
    const currentSep = current.burnEvents.stageSep;

    const previousMeco = previous
      ? findEventTime(previous.events || [], (label) => /\bMECO\b|cutoff/i.test(label))
      : null;
    const previousSep = previous
      ? findEventTime(previous.events || [], (label) => /stage\s*sep|separation/i.test(label))
      : null;

    const deltaApogee = previous ? current.maxAlt - previous.maxAlt : null;
    const deltaMaxVel = previous ? current.maxVel - previous.maxVel : null;
    const deltaMaxAcc = previous ? current.maxAcc - previous.maxAcc : null;
    const deltaMeco = Number.isFinite(previousMeco) && Number.isFinite(currentMeco) ? currentMeco - previousMeco : null;
    const deltaSep = Number.isFinite(previousSep) && Number.isFinite(currentSep) ? currentSep - previousSep : null;

    deltaRows.push({
      missionId,
      deltaApogee,
      deltaMaxVel,
      deltaMaxAcc,
      deltaMeco,
      deltaSep
    });

    const historical = preset.modelHints?.historicalMilestones || {};

    const mecoErr = pctError(currentMeco, historical.mecoTimeSec);
    const sepErr = pctError(currentSep, historical.stageSeparationTimeSec);
    const orbitAltErr = pctError(current.orbitInsertion.altitudeM, historical.orbitInsertionAltitudeM);
    const orbitVelErr = pctError(current.orbitInsertion.velocityMps, historical.orbitInsertionVelocityMps);

    milestoneRows.push({
      missionId,
      confidence: preset.historicalConfidence || 'low',
      simMeco: currentMeco,
      histMeco: historical.mecoTimeSec,
      mecoErr,
      simSep: currentSep,
      histSep: historical.stageSeparationTimeSec,
      sepErr,
      simOrbitAlt: current.orbitInsertion.altitudeM,
      histOrbitAlt: historical.orbitInsertionAltitudeM,
      orbitAltErr,
      simOrbitVel: current.orbitInsertion.velocityMps,
      histOrbitVel: historical.orbitInsertionVelocityMps,
      orbitVelErr
    });
  }

  for (const row of deltaRows) {
    reportLines.splice(8, 0,
      `| ${row.missionId} | ${formatNum(row.deltaApogee, 0)} | ${formatNum(row.deltaMaxVel, 1)} | ${formatNum(row.deltaMaxAcc, 2)} | ${formatNum(row.deltaMeco, 1)} | ${formatNum(row.deltaSep, 1)} |`
    );
  }

  const milestoneInsertStart = reportLines.findIndex((line) => line.includes('| Mission | Confidence |')) + 2;
  for (const row of milestoneRows) {
    reportLines.splice(milestoneInsertStart, 0,
      `| ${row.missionId} | ${row.confidence} | ${formatNum(row.simMeco, 1)} | ${formatNum(row.histMeco, 1)} | ${formatNum(row.mecoErr, 2)} | ${formatNum(row.simSep, 1)} | ${formatNum(row.histSep, 1)} | ${formatNum(row.sepErr, 2)} | ${formatNum(row.simOrbitAlt, 0)} | ${formatNum(row.histOrbitAlt, 0)} | ${formatNum(row.orbitAltErr, 2)} | ${formatNum(row.simOrbitVel, 1)} | ${formatNum(row.histOrbitVel, 1)} | ${formatNum(row.orbitVelErr, 2)} |`
    );
  }

  reportLines.push('');
  reportLines.push('## Source Notes');
  reportLines.push('');
  for (const preset of presets) {
    reportLines.push(`### ${preset.name}`);
    reportLines.push(`- Confidence: ${preset.historicalConfidence || 'low'}`);
    for (const note of preset.historicalNotes || []) {
      reportLines.push(`- ${note}`);
    }
    for (const url of preset.sourceUrls || []) {
      reportLines.push(`- Source: ${url}`);
    }
    reportLines.push('');
  }

  fs.writeFileSync(REPORT_PATH, reportLines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);

  console.table(milestoneRows.map((row) => ({
    mission: row.missionId,
    confidence: row.confidence,
    mecoErrPct: formatNum(row.mecoErr, 2),
    stageSepErrPct: formatNum(row.sepErr, 2),
    orbitAltErrPct: formatNum(row.orbitAltErr, 2),
    orbitVelErrPct: formatNum(row.orbitVelErr, 2)
  })));
}

main();
