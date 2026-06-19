function formatNumber(value, fraction = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction
  }).format(value);
}

export class TelemetryPanel {
  constructor() {
    this.altitude = document.getElementById('telemetryAltitude');
    this.velocity = document.getElementById('telemetryVelocity');
    this.totalAcceleration = document.getElementById('telemetryAccelerationTotal');
    this.acceleration = document.getElementById('telemetryAcceleration');
    this.fuelMass = document.getElementById('telemetryFuel');
    this.stage = document.getElementById('telemetryStage');
    this.flightTime = document.getElementById('telemetryTime');
  }

  reset() {
    this.update({
      altitudeM: 0,
      velocityMps: 0,
      accelerationMps2: 0,
      totalAccelerationMps2: 0,
      fuelMassKg: 0,
      stageName: 'Idle',
      tSec: 0
    });
  }

  update(sample, options = {}) {
    const displayTimeSec = options.displayTimeSec ?? sample.tSec;
    this.altitude.textContent = `${formatNumber(sample.altitudeM, 0)} m`;
    this.velocity.textContent = `${formatNumber(sample.velocityMps, 1)} m/s`;
    this.totalAcceleration.textContent = `${formatNumber(sample.totalAccelerationMps2, 2)} m/s²`;
    this.acceleration.textContent = `${formatNumber(sample.accelerationMps2, 2)} m/s²`;
    this.fuelMass.textContent = `${formatNumber(sample.fuelMassKg, 0)} kg`;
    this.stage.textContent = sample.stageName;
    this.flightTime.textContent = `${formatNumber(displayTimeSec, 1)} s`;
  }
}
