import fs from "node:fs";
import { buildTrajectory } from "../src/simulation/trajectory.js";

const presets = JSON.parse(fs.readFileSync("./src/data/launchPresets.json", "utf8"));
const output = {};

for (const p of presets) {
  const tr = buildTrajectory(p);
  const s = tr.samples;
  output[p.id] = {
    maxAlt: Math.max(...s.map((v) => v.altitudeM)),
    maxVel: Math.max(...s.map((v) => v.velocityMps)),
    maxAcc: Math.max(...s.map((v) => v.totalAccelerationMps2)),
    events: tr.events.map((e) => ({ label: e.label, timeSec: Number(e.timeSec.toFixed(2)) }))
  };
}

fs.writeFileSync("./docs/baseline-before.json", JSON.stringify(output, null, 2));
console.log("Wrote docs/baseline-before.json");
