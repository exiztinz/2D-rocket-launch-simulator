import { loadLaunchPresets } from './data/launchData.js';
import { buildTrajectory } from './simulation/trajectory.js';
import { LaunchScene } from './scene/threeScene.js';
import { TelemetryCharts } from './ui/charts.js';
import { TelemetryPanel } from './ui/telemetry.js';

const state = {
  presets: [],
  selectedPreset: null,
  trajectory: null,
  frameIndex: 0,
  completedSample: null,
  completedTimeSec: null,
  isPlaying: false,
  countdown: 0,
  countdownStartMs: 0,
  rafId: 0,
  lastFrameMs: 0,
  timelineCursor: 0,
  seenEvents: [],
  playbackRate: 1
};

const dom = {
  presetSelect: document.getElementById('presetSelect'),
  launchButton: document.getElementById('launchButton'),
  resetButton: document.getElementById('resetButton'),
  fastForwardButton: document.getElementById('fastForwardButton'),
  speedBadge: document.getElementById('speedBadge'),
  cameraSelect: document.getElementById('cameraSelect'),
  countdownLabel: document.getElementById('countdownLabel'),
  missionName: document.getElementById('missionName'),
  missionMeta: document.getElementById('missionMeta'),
  missionSource: document.getElementById('missionSource'),
  missionOrbit: document.getElementById('missionOrbit'),
  missionLocation: document.getElementById('missionLocation'),
  missionDate: document.getElementById('missionDate'),
  simCanvas: document.getElementById('sim3dCanvas')
};

const scene = new LaunchScene(dom.simCanvas);
const charts = new TelemetryCharts({
  altitudeCanvasId: 'altitudeChart',
  velocityCanvasId: 'velocityChart',
  accelCanvasId: 'accelChart'
});
const telemetry = new TelemetryPanel();

function updateSpeedBadge() {
  dom.speedBadge.textContent = `Speed: ${state.playbackRate}x`;
  dom.fastForwardButton.textContent = state.playbackRate > 1 ? 'Speed 1x' : 'Fast Forward 8x';
}

function interpolateSample(samples, timeSec) {
  if (!samples || samples.length === 0) return null;
  if (timeSec <= samples[0].tSec) return samples[0];
  if (timeSec >= samples[samples.length - 1].tSec) return samples[samples.length - 1];

  let high = 1;
  while (high < samples.length && samples[high].tSec < timeSec) {
    high += 1;
  }

  const a = samples[high - 1];
  const b = samples[high];
  const span = Math.max(0.0001, b.tSec - a.tSec);
  const t = (timeSec - a.tSec) / span;

  return {
    tSec: timeSec,
    altitudeM: a.altitudeM + (b.altitudeM - a.altitudeM) * t,
    velocityMps: a.velocityMps + (b.velocityMps - a.velocityMps) * t,
    accelerationMps2: a.accelerationMps2 + (b.accelerationMps2 - a.accelerationMps2) * t,
    totalAccelerationMps2: a.totalAccelerationMps2 + (b.totalAccelerationMps2 - a.totalAccelerationMps2) * t,
    fuelMassKg: a.fuelMassKg + (b.fuelMassKg - a.fuelMassKg) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    headingX: a.headingX + (b.headingX - a.headingX) * t,
    headingY: a.headingY + (b.headingY - a.headingY) * t,
    stageName: t < 0.5 ? a.stageName : b.stageName,
    engineOn: t < 0.5 ? a.engineOn : b.engineOn,
    landed: t >= 0.5 ? Boolean(b.landed) : Boolean(a.landed)
  };
}

function renderMissionMetadata(preset) {
  dom.missionName.textContent = preset.name;
  dom.missionMeta.textContent = `${preset.provider} • ${preset.vehicle} • ${preset.destination}`;
  dom.missionOrbit.textContent = preset.orbitClass;
  dom.missionLocation.textContent = `${preset.location.site} (${preset.location.lat.toFixed(2)}, ${preset.location.lon.toFixed(2)})`;
  dom.missionDate.textContent = preset.launchDate;
  dom.missionSource.innerHTML = preset.sourceUrls
    .map((url, index) => `<a href="${url}" target="_blank" rel="noreferrer">Source ${index + 1}</a>`)
    .join(' • ');
}

function setPreset(presetId) {
  const preset = state.presets.find((item) => item.id === presetId);
  if (!preset) return;

  state.selectedPreset = preset;
  state.trajectory = buildTrajectory(preset);
  state.frameIndex = 0;
  state.timelineCursor = 0;
  state.completedSample = null;
  state.completedTimeSec = null;
  state.seenEvents = [];

  charts.reset();
  telemetry.reset();
  scene.resetPath();
  renderMissionMetadata(preset);

  charts.applyEvents(state.trajectory.samples, state.seenEvents);
}

function populatePresetSelect() {
  dom.presetSelect.innerHTML = state.presets
    .map((preset) => `<option value="${preset.id}">${preset.name}</option>`)
    .join('');
}

function beginCountdown() {
  state.countdown = 5;
  state.countdownStartMs = performance.now();
  dom.countdownLabel.textContent = 'T-5';
}

function updateCountdown(nowMs) {
  const elapsedSec = (nowMs - state.countdownStartMs) / 1000;
  const remaining = Math.max(0, 5 - elapsedSec);
  const rounded = Math.ceil(remaining);

  if (remaining <= 0) {
    dom.countdownLabel.textContent = 'LIFTOFF';
    state.countdown = 0;
    return true;
  }

  dom.countdownLabel.textContent = `T-${rounded}`;
  return false;
}

function isTerminalSample(sample) {
  return Boolean(sample?.landed)
    || (sample?.tSec > 1 && sample?.altitudeM <= 0.1 && sample?.velocityMps <= 0.1);
}

function animate(nowMs) {
  state.rafId = requestAnimationFrame(animate);
  scene.render();

  if (!state.isPlaying || !state.trajectory) {
    if (state.completedSample) {
      telemetry.update(state.completedSample, { displayTimeSec: state.completedTimeSec ?? state.completedSample.tSec });
    }
    return;
  }

  if (state.countdown > 0) {
    const launched = updateCountdown(nowMs);
    if (!launched) {
      return;
    }
  }

  const deltaMs = Math.min(120, nowMs - (state.lastFrameMs || nowMs));
  state.lastFrameMs = nowMs;
  state.timelineCursor += (deltaMs / 1000) * state.playbackRate;

  const samples = state.trajectory.samples;
  const missionEndSec = state.trajectory.stats?.durationSec ?? samples[samples.length - 1]?.tSec ?? 0;
  if (state.timelineCursor >= missionEndSec) {
    state.timelineCursor = missionEndSec;
  }
  const newlyReached = state.trajectory.events.filter((event) => event.timeSec <= state.timelineCursor);
  if (newlyReached.length !== state.seenEvents.length) {
    state.seenEvents = newlyReached;
    charts.applyEvents(samples, state.seenEvents);
  }

  while (state.frameIndex < samples.length && samples[state.frameIndex].tSec <= state.timelineCursor) {
    const sample = samples[state.frameIndex];
    scene.updateFromSample(sample, { appendPath: true });
    telemetry.update(sample, { displayTimeSec: sample.tSec });
    charts.pushSample(sample);
    state.frameIndex += 1;

    if (isTerminalSample(sample)) {
      state.completedSample = sample;
      state.completedTimeSec = sample.tSec;
      state.timelineCursor = sample.tSec;
      state.isPlaying = false;
      dom.countdownLabel.textContent = 'COMPLETE';
      telemetry.update(sample, { displayTimeSec: state.completedTimeSec });
      charts.render();
      return;
    }
  }

  const visualSample = interpolateSample(samples, state.timelineCursor);
  if (visualSample) {
    scene.updateFromSample(visualSample, { appendPath: false });
  }

  charts.render();

  if (state.frameIndex >= samples.length || state.timelineCursor >= missionEndSec) {
    const finalSample = samples[Math.max(0, samples.length - 1)];
    if (finalSample) {
      state.completedSample = finalSample;
      state.completedTimeSec = finalSample.tSec;
      state.timelineCursor = finalSample.tSec;
      scene.updateFromSample(finalSample, { appendPath: false });
      telemetry.update(finalSample, { displayTimeSec: state.completedTimeSec });
    }
    state.isPlaying = false;
    dom.countdownLabel.textContent = 'COMPLETE';
  }
}

function launch() {
  if (!state.trajectory) return;
  state.frameIndex = 0;
  state.timelineCursor = 0;
  state.completedSample = null;
  state.completedTimeSec = null;
  state.lastFrameMs = 0;
  state.seenEvents = [];
  state.playbackRate = 1;
  state.isPlaying = true;
  charts.reset();
  telemetry.reset();
  scene.resetPath();
  beginCountdown();
  updateSpeedBadge();

  const first = state.trajectory.samples[0];
  if (first) {
    scene.updateFromSample(first, { appendPath: false, snapCamera: true });
  }
}

function reset() {
  state.isPlaying = false;
  state.frameIndex = 0;
  state.timelineCursor = 0;
  state.completedSample = null;
  state.completedTimeSec = null;
  state.seenEvents = [];
  state.countdown = 0;
  state.playbackRate = 1;
  dom.countdownLabel.textContent = 'READY';
  charts.reset();
  if (state.trajectory) {
    charts.applyEvents(state.trajectory.samples, state.seenEvents);
  }
  telemetry.reset();
  scene.resetPath();
  updateSpeedBadge();

  const first = state.trajectory?.samples[0];
  if (first) {
    scene.updateFromSample(first, { appendPath: false, snapCamera: true });
    scene.render();
  }
}

async function init() {
  state.presets = await loadLaunchPresets();
  populatePresetSelect();

  setPreset(state.presets[0].id);
  reset();

  dom.presetSelect.addEventListener('change', (event) => {
    setPreset(event.target.value);
    reset();
  });

  dom.launchButton.addEventListener('click', launch);
  dom.resetButton.addEventListener('click', reset);

  dom.fastForwardButton.addEventListener('click', () => {
    state.playbackRate = state.playbackRate === 1 ? 8 : 1;
    updateSpeedBadge();
  });

  dom.cameraSelect.addEventListener('change', (event) => {
    scene.setCameraMode(event.target.value);
  });

  dom.simCanvas.addEventListener('pointerdown', () => {
    if (dom.cameraSelect.value !== 'free') {
      dom.cameraSelect.value = 'free';
      scene.setCameraMode('free');
    }
  });

  updateSpeedBadge();

  requestAnimationFrame(animate);
}

init().catch((error) => {
  console.error(error);
  dom.countdownLabel.textContent = 'ERROR';
  dom.missionMeta.textContent = `Load failed: ${error.message || 'Unknown startup error'}`;
});
