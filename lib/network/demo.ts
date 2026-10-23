import type { Asset, Network } from "./types.ts";
export const DEMO_NOTICE = "Demonstration data only — Not official Sime Darby Property drainage records.";
export function createTownship(): Network {
  const nodes: Asset[] = [];
  const edges: Network["edges"] = [];
  const names = ["Meranti", "Cengal", "Angsana", "Melur"];
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 6; i++) {
      const id = `RR-${String(b * 6 + i + 1).padStart(3, "0")}`;
      nodes.push({ id, name: `${names[b]} ${i === 5 ? "collector" : `residential lane ${i + 1}`}`, lat: 3.08 + i * 0.0013, lon: 101.49 + b * 0.003 + i * 0.0003, type: i === 5 ? "collector" : i === 4 ? "culvert" : "inlet", blockage: b === 0 && i === 0 ? 96 : i === 5 ? 58 : 25 + (b * 17 + i * 13) % 60, confidence: 0.85, catchment: i === 5 ? 2 : 0.7 + i * 0.3, homes: i === 5 ? 80 : 6 + i * 3, schools: b === 1 && i === 5 ? 1 : 0, accessRoutes: i >= 4 ? 1 : 0, duration: i === 5 ? 42 : 18 + i * 4, accessible: true, history: "Synthetic condition survey · 21 Oct 2026" });
      if (i > 0) edges.push({ from: `RR-${String(b * 6 + i).padStart(3, "0")}`, to: id });
    }
  }
  for (let i = 25; i <= 28; i++) nodes.push({ id: `RR-${i.toString().padStart(3, "0")}`, name: ["East trunk channel", "West trunk channel", "Township collector", "Demonstration outlet"][i - 25], lat: 3.088 + (i - 25) * 0.0013, lon: 101.495 + (i % 2) * 0.003, type: i === 28 ? "outlet" : i === 27 ? "collector" : "channel", blockage: i === 27 ? 62 : 35, confidence: 0.8, catchment: 3, homes: i === 27 ? 150 : 30, schools: i === 27 ? 1 : 0, accessRoutes: 2, duration: 45, accessible: true, history: "Synthetic condition survey · 21 Oct 2026" });
  edges.push({ from: "RR-006", to: "RR-025" }, { from: "RR-012", to: "RR-025" }, { from: "RR-018", to: "RR-026" }, { from: "RR-024", to: "RR-026" }, { from: "RR-025", to: "RR-027" }, { from: "RR-026", to: "RR-027" }, { from: "RR-027", to: "RR-028" });
  return { name: "Taman Rintis · synthetic Malaysian township", synthetic: true, nodes, edges };
}
