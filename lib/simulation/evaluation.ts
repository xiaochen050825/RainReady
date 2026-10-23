import { createTownship } from "../network/demo.ts";
import { rankNetwork } from "../network/criticality.ts";
import { topological, validateNetwork } from "../network/graph.ts";
import type { Network } from "../network/types.ts";
import { planCrews, type PlanOptions, type Plan } from "../optimization/planner.ts";

export function random(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
// Independent mass-balance toy model: no use of priority P, C, E, weights or value.
// Unitless runoff and capacity; explicitly not hydraulic flood simulation.
export function consequenceTrace(network: Network, rain: number, cleared: Set<string>, model: "connected" | "local" = "connected") {
  validateNetwork(network);
  if (!Number.isFinite(rain) || rain < 0 || network.nodes.some(a => a.blockage === null)) throw new Error("Evaluation requires finite rainfall and complete ground-truth blockage.");
  if ([...cleared].some(id => !network.nodes.some(a => a.id === id))) throw new Error("Unknown cleared asset.");
  const flow = new Map(network.nodes.map(a => [a.id, a.catchment * rain / 40]));
  const byId = new Map(network.nodes.map(a => [a.id, a]));
  let loss = 0;
  const trace = [];
  for (const id of topological(network.nodes.map(a => a.id), network.edges)) {
    const a = byId.get(id)!;
    const capacity = ({ inlet: 2.5, culvert: 9, channel: 18, collector: 24, outlet: 80 })[a.type];
    // Clearance cannot introduce obstruction to an already-clear asset.
    const available = capacity * (1 - (cleared.has(id) ? Math.min(5, a.blockage!) : a.blockage!) / 100);
    const incoming = flow.get(id)!;
    const overflow = Math.max(0, incoming - available);
    const exposure = 1 + a.homes / 20 + a.schools * 8 + a.accessRoutes * 3;
    const contribution = overflow * exposure;
    loss += contribution;
    trace.push({ id, local: a.catchment * rain / 40, incoming, capacity: available, overflow, exposure, loss: contribution });
    const outgoing = network.edges.filter(e => e.from === id);
    if (model === "connected") for (const e of outgoing) flow.set(e.to, flow.get(e.to)! + Math.min(incoming, available) / outgoing.length);
  }
  return { loss, trace, overflow: trace.reduce((s, a) => s + a.overflow, 0) };
}
export function consequence(network: Network, rain: number, cleared: Set<string>) { return consequenceTrace(network, rain, cleared).loss; }
export function measure(network: Network, rain: number, plan: Plan) {
  const tasks = plan.crews.flatMap(c => c.tasks);
  const ids = new Set(tasks.map(t => t.id));
  const before = consequence(network, rain, new Set());
  const addressed = before - consequence(network, rain, ids);
  const critical = network.nodes.filter(a => a.schools > 0 || a.accessRoutes >= 2);
  return { before, after: before - addressed, addressed, addressedPercent: before > 1e-9 ? addressed / before * 100 : null, criticalCoverage: critical.length ? critical.filter(a => ids.has(a.id)).length / critical.length * 100 : null, tasks: tasks.length, travel: tasks.reduce((s, t) => s + t.travel, 0) + plan.crews.reduce((s, c) => s + c.returnTravel, 0), service: tasks.reduce((s, t) => s + t.finish - t.start, 0) };
}
export function compare(network: Network, rain: number, options: Omit<PlanOptions, "method">, truth = network, truthRain = rain) {
  const priorities = rankNetwork(network, rain);
  return (["fixed", "severity", "rainready"] as const).map(method => {
    const plan = planCrews(network, priorities, { ...options, method });
    return { method, ...measure(truth, truthRain, plan) };
  });
}
export function generateScenarios(count = 24, seed = 2026) {
  if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isInteger(seed)) throw new Error("Use 1–10000 scenarios and an integer seed.");
  const rng = random(seed);
  const scenarios = [];
  for (let i = 0; i < count; i++) {
    const truth = createTownship();
    truth.nodes = truth.nodes.map(a => ({ ...a, blockage: 10 + rng() * 85, catchment: a.catchment * (0.6 + rng()), accessible: rng() > 0.05 }));
    const observed = structuredClone(truth);
    const mode = i % 4;
    observed.nodes = observed.nodes.map(a => ({ ...a, blockage: mode === 1 && rng() < 0.25 ? null : Math.max(0, Math.min(100, a.blockage! + (rng() - 0.5) * (mode === 2 ? 60 : 12))), confidence: mode === 2 ? 0.5 : 0.85 }));
    if (mode === 3) observed.edges = observed.edges.filter(() => rng() > 0.2);
    const truthRain = 15 + rng() * 90;
    const rain = Math.max(0, truthRain + (rng() - 0.5) * 30);
    const deadline = [60, 120, 180, 240][Math.floor(i / 4) % 4];
    const crews = Array.from({ length: 1 + i % 3 }, (_, c) => ({ id: `Crew ${c + 1}`, availableFrom: 0, minutes: deadline, equipment: [] }));
    scenarios.push({ scenario: i, condition: ["nominal", "missing conditions", "noisy conditions", "missing connections"][mode], deadline, observed, rain, truth, truthRain, options: { crews, deadline, depot: { lat: 3.079, lon: 101.49 } } });
  }
  return scenarios;
}
export function runBatch(count = 24, seed = 2026) {
  const rows = generateScenarios(count, seed).map(s => ({ scenario: s.scenario, condition: s.condition, deadline: s.deadline, results: compare(s.observed, s.rain, s.options, s.truth, s.truthRain) }));
  const summary = (["fixed", "severity", "rainready"] as const).map(method => {
    const results = rows.map(r => r.results.find(x => x.method === method)!);
    const avg = (key: keyof Omit<typeof results[number], "method">) => { const values = results.map(r => r[key]).filter((v): v is number => v !== null); return values.length ? values.reduce((s,v) => s + v, 0) / values.length : null; };
    return { method, addressedPercent: avg("addressedPercent"), criticalCoverage: avg("criticalCoverage"), tasks: avg("tasks"), travel: avg("travel"), service: avg("service") };
  });
  return { seed, count, summary, rows };
}
