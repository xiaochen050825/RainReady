import type { Network } from "./types.ts";

export function validateNetwork(input: unknown): Network {
  if (!input || typeof input !== "object") throw new Error("Network must be an object.");
  const n = input as Network;
  if (typeof n.name !== "string" || !n.name.trim() || typeof n.synthetic !== "boolean" || !Array.isArray(n.nodes) || !n.nodes.length || n.nodes.length > 500 || !Array.isArray(n.edges) || n.edges.length > 2000) throw new Error("Provide a name, synthetic flag, 1–500 nodes and at most 2000 edges.");
  const ids = new Set<string>();
  for (const a of n.nodes) {
    if (!a || typeof a.id !== "string" || !/^[\w-]{1,40}$/.test(a.id) || ids.has(a.id)) throw new Error("Asset IDs must be unique, 1–40 letters, digits, underscores or hyphens.");
    ids.add(a.id);
    if (typeof a.name !== "string" || typeof a.history !== "string" || !["inlet", "channel", "culvert", "collector", "outlet"].includes(a.type) || typeof a.accessible !== "boolean") throw new Error(`Invalid asset fields: ${a.id}`);
    for (const [key, min, max] of [["lat", -90, 90], ["lon", -180, 180], ["confidence", 0, 1], ["catchment", 0, 10000], ["homes", 0, 100000], ["schools", 0, 1000], ["accessRoutes", 0, 1000], ["duration", 1, 1440]] as const) {
      if (typeof a[key] !== "number" || !Number.isFinite(a[key]) || a[key] < min || a[key] > max) throw new Error(`Invalid ${key} for ${a.id}`);
    }
    if (a.blockage !== null && (typeof a.blockage !== "number" || !Number.isFinite(a.blockage) || a.blockage < 0 || a.blockage > 100)) throw new Error(`Invalid blockage for ${a.id}`);
    if (a.equipment !== undefined && typeof a.equipment !== "string") throw new Error(`Invalid equipment for ${a.id}`);
    if (a.dependsOn !== undefined && (!Array.isArray(a.dependsOn) || a.dependsOn.some(x => typeof x !== "string"))) throw new Error(`Invalid dependencies for ${a.id}`);
  }
  const pairs = new Set<string>();
  for (const e of n.edges) {
    if (!e || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || pairs.has(`${e.from}/${e.to}`)) throw new Error("Connections contain missing references, self-links or duplicates.");
    pairs.add(`${e.from}/${e.to}`);
  }
  topological(n.nodes.map(a => a.id), n.edges);
  const dependencies = n.nodes.flatMap(a => (a.dependsOn ?? []).map(from => ({ from, to: a.id })));
  if (dependencies.some(e => !ids.has(e.from))) throw new Error("Task dependency references a missing asset.");
  topological([...ids], dependencies);
  return n;
}

export function topological(ids: string[], edges: Network["edges"]) {
  const counts = new Map(ids.map(id => [id, 0]));
  const children = new Map(ids.map(id => [id, [] as string[]]));
  for (const e of edges) { counts.set(e.to, counts.get(e.to)! + 1); children.get(e.from)!.push(e.to); }
  const queue = ids.filter(id => counts.get(id) === 0).sort();
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; order.push(id);
    for (const child of children.get(id)!) { counts.set(child, counts.get(child)! - 1); if (!counts.get(child)) queue.push(child); }
  }
  if (order.length !== ids.length) throw new Error("Cyclic connectivity is unsupported. Supply an acyclic directed network.");
  return order;
}

export function upstreamSets(network: Network) {
  const sets = new Map(network.nodes.map(a => [a.id, new Set<string>()]));
  for (const id of topological(network.nodes.map(a => a.id), network.edges)) {
    for (const edge of network.edges.filter(e => e.from === id)) {
      const target = sets.get(edge.to)!; target.add(id);
      for (const ancestor of sets.get(id)!) target.add(ancestor);
    }
  }
  return sets;
}
