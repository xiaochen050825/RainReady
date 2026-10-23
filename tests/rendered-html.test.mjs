import assert from "node:assert/strict";
import {access,readFile} from "node:fs/promises";
import test from "node:test";
import {inspectionDecision,passesCleanupVerification} from "../lib/decisions.js";

// The old tests matched obsolete JSX labels rather than rendered output.
// Check the actual built landing page; runtime flows are exercised in the browser.
test("production output contains the approved landing hierarchy and workspace entry",async()=>{
 await access(new URL('../dist/server/index.js',import.meta.url));
 const response=await fetch((process.env.RAINREADY_TEST_ORIGIN||'http://127.0.0.1:5174')+'/');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/A clearer plan/);assert.match(html,/Before the rain/);
 assert.match(html,/Open workspace/);assert.match(html,/Crew schedule/);
 assert.match(html,/Limited time/);assert.match(html,/Keep the decision with your team/);
 assert.doesNotMatch(html,/Your site is taking shape|codex-preview/);
});
test("landing discloses the synthetic demonstration and includes every default task",async()=>{
 const response=await fetch((process.env.RAINREADY_TEST_ORIGIN||'http://127.0.0.1:5174')+'/');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/illustrative assets/);assert.match(html,/estimated travel/);assert.match(html,/<video/);assert.match(html,/rainready-en.vtt/);
 for(const id of ['RR-027','RR-028','RR-012','RR-006','RR-001'])assert.ok(html.includes(id));
});
test("bundled walkthrough and local fonts are available for offline UI chrome",async()=>{
 for(const file of ['design-media/rainready-web-v1.mp4','design-media/rainready-launch.mp4','design-media/launch-poster.jpg','design-media/fonts/InterVariable.woff2','design-media/rainready-en.vtt'])await access(new URL('../public/'+file,import.meta.url));
});
test("passes all 12 documented decision regression cases", () => {
  const cases = [
    ["blocked control A", "Dispatch now", inspectionDecision({ drainConfidence: 81, risk: 88 })],
    ["blocked control B", "Inspect today", inspectionDecision({ drainConfidence: 74, risk: 72 })],
    ["blocked control C", "Monitor", inspectionDecision({ drainConfidence: 66, risk: 54 })],
    ["clear control A", "Monitor", inspectionDecision({ drainConfidence: 79, risk: 34 })],
    ["clear control B", "Monitor", inspectionDecision({ drainConfidence: 71, risk: 25 })],
    ["clear control C", "Monitor", inspectionDecision({ drainConfidence: 63, risk: 18 })],
    ["same drain cleaned A", true, passesCleanupVerification({ sameDrain: true, drainConfidence: 82, blockage: 31, litter: 28, reduction: 41 })],
    ["same drain cleaned B", true, passesCleanupVerification({ sameDrain: true, drainConfidence: 75, blockage: 44, litter: 39, reduction: 18 })],
    ["unchanged after", false, passesCleanupVerification({ sameDrain: true, drainConfidence: 82, blockage: 76, litter: 62, reduction: 0 })],
    ["different scene A", false, passesCleanupVerification({ sameDrain: false, drainConfidence: 81, blockage: 22, litter: 20, reduction: 60 })],
    ["different scene B", false, passesCleanupVerification({ sameDrain: false, drainConfidence: 76, blockage: 35, litter: 31, reduction: 36 })],
    ["non-drain input", "Needs review", inspectionDecision({ drainConfidence: 55, risk: 84 })],
  ];
  for (const [name, expected, actual] of cases) assert.equal(actual, expected, name);
});

