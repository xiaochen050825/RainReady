import type { Network } from "../network/types.ts";
import { rankNetwork } from "../network/criticality.ts";
import { planCrews, type PlanOptions } from "./planner.ts";
import { consequenceTrace } from "../simulation/evaluation.ts";
export const ABLATIONS = ["A fixed/common", "B severity/common", "C network/common", "D network/efficiency", "E blind/efficiency", "F network/marginal", "G blind/common"] as const;
// Experimental observed-data surrogate. Shares toy capacity assumptions with evaluation:
// it is NOT an independent prediction of actual flooding or an oracle using hidden truth.
export function observedLoss(network: Network, rain: number, selected: Set<string>) {
  return (consequenceTrace(network, rain, selected).loss + consequenceTrace(network, rain, selected, "local").loss) / 2;
}
export function ablationPlans(network: Network, rain: number, options: Omit<PlanOptions,"method"|"rawPriority"|"marginalGain">) {
  if (network.nodes.length > 80) throw new Error("Advanced comparison is bounded to 80 assets; the standard planner supports larger imports.");
  const priorities = rankNetwork(network, rain);
  const blind = rankNetwork({...network, edges: []}, rain);
  const observed = {...network, nodes: network.nodes.map(a=>({...a, blockage:a.blockage ?? 50}))};
  const cache = new Map<string,number>();
  function loss(ids:Set<string>) { const key=[...ids].sort().join("|");if(!cache.has(key))cache.set(key,observedLoss(observed,rain,ids));return cache.get(key)!; }
  return ABLATIONS.map((method,i)=>{
    const plan=planCrews(network,i===4||i===6?blind:priorities,{...options,method:i===0?"fixed":i===1?"severity":"rainready",rawPriority:i===2||i===6,marginalGain:i===5?(selected,id)=>loss(selected)-loss(new Set([...selected,id])):undefined});
    if(i===5)for(const d of plan.deferred){const ids=new Set(plan.crews.flatMap(c=>c.tasks.map(t=>t.id)));if(loss(ids)-loss(new Set([...ids,d.id]))<=1e-9)d.reason=d.reason.startsWith("Cannot fit") ? "No positive observed mixed-model marginal gain" : d.reason+"; no positive observed mixed-model marginal gain";}
    return {method,plan};
  });
}
