# RainReady reproducible comparison

Phase 2 adds the [technical audit](../docs/PHASE2_AUDIT.md), [complete formulas and worked traces](audit/AUDIT_RESULTS.md), all 29 original negative cases, and a 675-case stress evaluation. Run `npm run audit:simulation` to reproduce them. The alternative local-only model favours severity-first; the connected-model advantage is conditional on its assumptions.

Run `npm run evaluate:rainready -- 96 2026` (count, seed). The maximum configurable batch is 10,000. The UI quick demo executes 24 scenarios with seed 2026. Output: `evaluation/rainready-results.json`. The benchmark's inherited image-classifier results are a separate experiment and do not establish network-planning performance.

## Fair scheduling inputs

All three policies receive the same observed assets, available crews, depot, deadline, access restrictions, durations, dependencies, equipment and travel approximation. Each uses the same candidate feasibility rules, tie breaking, return-to-depot reserve and schedule builder. Fixed schedule ranks by the original node-array order; severity-first ranks by observed local blockage; RainReady ranks by network intervention value per incremental resource minute. The difference includes prioritisation and resource-efficiency ranking, not different routing machinery. No planner sees hidden true blockage or true rainfall. Original scenarios expose exact catchment and exposure values to every method; this optimistic assumption is examined in Phase 2.

## Independent outcome model

The seeded scenario generator creates true conditions and then noisy/missing observations. True blockage spans 10–95%; catchments vary 0.6–1.6 times the fixture. Rainfall spans 15–105 mm; observed rain differs by up to 15 mm. All scenarios may contain random inaccessible assets. Missing-condition scenarios hide 25% of observed blockage values; noisy scenarios add up to ±30 percentage points; missing-connectivity scenarios drop 20% of observed edges. The true graph is retained for evaluation.

The independent evaluator uses a toy mass balance. Local inflow is catchment × rainfall / 40. Nominal capacities by asset type are inlet=2.5, culvert=9, channel=18, collector=24, outlet=80 arbitrary units. Capacity is multiplied by (1 − true blockage/100). A completed clearance sets remaining blockage to min(5%, original blockage), never worsening an already-clear asset. Excess inflow incurs `excess × (1 + homes/20 + schools×8 + accessRoutes×3)` consequence units. Transmitted flow is limited by capacity and divided equally among outgoing connections. This evaluator does not consume V, P, C, E or ranking weights.

Consequence addressed is before minus after consequence, divided by before. A zero baseline produces null (displayed N/A), not a fabricated zero percentage. Negative values are allowed: upstream clearance can transfer load downstream. This is a simplified stress test, not hydraulic modelling, real flood loss, prevented property damage or empirical evidence. Capacity constants, equal splits, absence of storage/backwater and exposure assumptions strongly affect results. The independent formula reduces circular evaluation but is still designed by the same team and requires independent field validation.

## Metrics and sensitivity

Report mean percentage consequence addressed, coverage of assets with schools or ≥2 access routes, number of completed tasks, travel minutes and service minutes. Batch rows retain each method's raw results. Deadlines cycle through 60/120/180/240 minutes; crews cycle through 1/2/3. Four condition regimes cover nominal error, missing data, severity noise and graph error. Compare paired method differences on each row; report negative outcomes and failures, not just wins. The code and frozen seed make all results reproducible; no presentation figures are hard-coded.

Use the generated JSON as the source of numeric claims. The UI comparison evaluates the current scenario as ground truth; the seeded batch additionally tests hidden truth versus imperfect observations. These two displays answer different questions and are labelled accordingly.
