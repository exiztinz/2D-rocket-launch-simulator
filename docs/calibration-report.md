# Calibration Report

Generated: 2026-06-21T19:07:16.191Z

## Before/After Simulation Deltas

| Mission | Delta Apogee (m) | Delta Max Velocity (m/s) | Delta Max Accel (m/s^2) | Delta MECO Time (s) | Delta Stage Sep Time (s) |
|---|---:|---:|---:|---:|---:|
| falcon-9-starlink | -5587748 | -5484.4 | -175.63 | 0.0 | 0.0 |
| space-shuttle-sts-1 | 153383 | 1464.2 | -2.45 | 0.0 | 0.0 |
| saturn-v-apollo-11 | -7141070 | -4218.4 | -30.62 | -7.0 | -6.0 |

## Historical Milestone Error

| Mission | Confidence | Sim MECO (s) | Hist MECO (s) | MECO Error % | Sim Stage Sep (s) | Hist Stage Sep (s) | Stage Sep Error % | Sim Orbit Alt (m) | Hist Orbit Alt (m) | Orbit Alt Error % | Sim Orbit Vel (m/s) | Hist Orbit Vel (m/s) | Orbit Vel Error % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| falcon-9-starlink | medium | 162.0 | 162.0 | 0.00 | 165.0 | 165.0 | 0.00 | 433556 | 440000 | -1.46 | 7920.5 | 7600.0 | 4.22 |
| space-shuttle-sts-1 | medium | 514.0 | 514.0 | 0.00 | 124.0 | 124.0 | 0.00 | 119161 | 120000 | -0.70 | 7874.6 | 7800.0 | 0.96 |
| saturn-v-apollo-11 | high | 161.0 | 161.0 | 0.00 | 162.0 | 162.0 | 0.00 | 146616 | 190000 | -22.83 | 8220.9 | 7800.0 | 5.40 |

## Source Notes

### Saturn V - Apollo 11
- Confidence: high
- Stage burn timing and staging sequence are sourced from Apollo 11 launch timelines.
- Stage masses are stack-level approximations constrained to preserve continuity in a 2D educational model.
- Thrust and mass-flow profiles are inferred piecewise approximations of known throttle/tailoff behavior.
- The simplified constant-pitch heuristic (82 deg max) cannot fully replicate the Saturn V gravity-turn trajectory. The S-IVB burn-end altitude is ~35 km below historical due to net-downward force during the near-horizontal S-IVB phase; insertion velocity error is ~5% high for the same reason. Both are residual structural limitations of the heuristic guidance model.
- Source: https://www.nasa.gov/mission_pages/apollo/missions/apollo11.html
- Source: https://history.nasa.gov/SP-4029/Apollo_11a_Saturn_V.htm
- Source: https://history.nasa.gov/afj/ap11fj/01launch.html

### Space Shuttle - STS-1
- Confidence: medium
- Major ascent milestones (SRB sep and MECO timing) are sourced from NASA mission chronologies.
- Integrated stack masses are approximated for a two-stage educational abstraction.
- Piecewise profile captures throttle bucket and end-of-burn tailoff behavior heuristically.
- Source: https://www.nasa.gov/mission_pages/shuttle/shuttlemissions/archives/sts-1.html
- Source: https://www.nasa.gov/reference/space-shuttle/
- Source: https://science.ksc.nasa.gov/shuttle/missions/sts-1/mission-sts-1.html

### Falcon 9 - Starlink Class
- Confidence: medium
- Mission timing is based on a representative Starlink-class Falcon 9 ascent profile.
- Second-stage depletion state is inferred to preserve realistic mass ratio and continuity.
- Throttle and flow profiles are inferred from public webcast timing patterns and technical summaries.
- This model uses a single upper-stage burn. Real Starlink missions use two MVac burns: SECO-1 into a parking orbit (~150 km) then SECO-2 to circularise at ~550 km. The historical milestone reflects the SECO-1 parking-orbit conditions achievable with the single-burn simplified model.
- Source: https://www.spacex.com/launches/
- Source: https://www.faa.gov/space/licensing
- Source: https://everydayastronaut.com/falcon-9-block-5/
