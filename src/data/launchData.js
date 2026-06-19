const DATA_URL = new URL('./launchPresets.json', import.meta.url).href;

function normalizeStage(stage, index) {
  return {
    index,
    name: stage.name,
    burnTimeSec: stage.burnTimeSec,
    avgThrustN: stage.avgThrustN,
    startMassKg: stage.startMassKg,
    endMassKg: stage.endMassKg,
    cd: stage.cd,
    areaM2: stage.areaM2,
    events: Array.isArray(stage.events) ? stage.events : []
  };
}

function normalizePreset(rawPreset) {
  return {
    id: rawPreset.id,
    name: rawPreset.name,
    provider: rawPreset.provider,
    vehicle: rawPreset.vehicle,
    mission: rawPreset.mission,
    launchDate: rawPreset.launchDate,
    destination: rawPreset.destination,
    orbitClass: rawPreset.orbitClass,
    source: rawPreset.source || [],
    sourceUrls: rawPreset.sourceUrls || [],
    location: rawPreset.location,
    stages: rawPreset.stages.map((stage, index) => normalizeStage(stage, index)),
    modelHints: rawPreset.modelHints || {}
  };
}

export async function loadLaunchPresets() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Unable to load launch presets from ${DATA_URL}`);
  }
  const payload = await response.json();
  return payload.map(normalizePreset);
}
