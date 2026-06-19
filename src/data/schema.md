# Launch Preset Schema

Each launch preset follows this normalized shape:

- id: unique preset id
- name: display title
- provider: launch organization
- vehicle: launch vehicle
- mission: mission label
- launchDate: ISO date string
- destination: mission destination summary
- orbitClass: target orbit class
- source: source label array
- sourceUrls: reference URL array
- location: object with site, lat, lon

stages: array of
- name: stage label
- burnTimeSec: stage burn duration
- avgThrustN: average thrust estimate
- startMassKg: mass at stage ignition
- endMassKg: mass at stage cutoff
- cd: effective drag coefficient for that phase
- areaM2: effective cross-sectional area
- events: array of { timeSec, label }

modelHints:
- pitchProgramSec: seconds to begin major pitch-over
- maxPitchDeg: maximum pitch angle from vertical heuristic
- targetApogeeM: target apogee estimate (meters)
- targetPerigeeM: target perigee estimate (meters)
- peakAltitudeM: approximate peak altitude for UI context
