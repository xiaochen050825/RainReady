# Release ablation v1

576 scenarios, 8 independently generated DAG layouts, seven methods. Historical Phase 1/2 files are unchanged. See [methodology](../../docs/RELEASE_EXPERIMENT.md).

| Model | Method | Mean % | Median % | P5 % | Pooled % | Negative / valid | Tasks |
|---|---|---:|---:|---:|---:|---:|---:|
| connected | A fixed/common | 1.80 | 0.16 | -8.53 | 1.02 | 76/384 | 5.02 |
| connected | B severity/common | 14.31 | 7.61 | -7.37 | 10.68 | 87/384 | 5.14 |
| connected | C network/common | 18.64 | 11.26 | -5.27 | 13.33 | 60/384 | 5.14 |
| connected | D network/efficiency | 18.01 | 9.02 | -5.27 | 12.95 | 57/384 | 5.49 |
| connected | E blind/efficiency | 15.09 | 7.12 | -6.29 | 10.42 | 76/384 | 5.60 |
| connected | F network/marginal | 18.19 | 9.92 | -5.27 | 13.39 | 68/384 | 2.60 |
| connected | G blind/common | 15.24 | 7.61 | -6.29 | 10.55 | 69/384 | 5.07 |
| local | A fixed/common | 16.74 | 6.29 | 0.00 | 13.36 | 0/384 | 5.02 |
| local | B severity/common | 39.88 | 35.94 | 0.00 | 31.40 | 0/384 | 5.14 |
| local | C network/common | 35.04 | 31.81 | 0.00 | 30.78 | 0/384 | 5.14 |
| local | D network/efficiency | 35.48 | 32.33 | 0.00 | 29.72 | 0/384 | 5.49 |
| local | E blind/efficiency | 40.17 | 40.62 | 0.00 | 34.14 | 0/384 | 5.60 |
| local | F network/marginal | 40.83 | 42.50 | 0.00 | 36.08 | 0/384 | 2.60 |
| local | G blind/common | 41.93 | 44.26 | 0.00 | 35.54 | 0/384 | 5.07 |
| mixed | A fixed/common | 5.46 | 1.59 | 0.00 | 4.53 | 16/384 | 5.02 |
| mixed | B severity/common | 20.17 | 15.60 | 0.00 | 16.57 | 19/384 | 5.14 |
| mixed | C network/common | 22.85 | 17.47 | 0.00 | 18.29 | 15/384 | 5.14 |
| mixed | D network/efficiency | 22.26 | 16.68 | 0.00 | 17.72 | 17/384 | 5.49 |
| mixed | E blind/efficiency | 21.18 | 16.26 | 0.00 | 17.16 | 15/384 | 5.60 |
| mixed | F network/marginal | 23.85 | 18.85 | 0.90 | 19.84 | 11/384 | 2.60 |
| mixed | G blind/common | 21.84 | 18.47 | -0.63 | 17.65 | 23/384 | 5.07 |

## Paired component differences

connected: C network/common minus G blind/common: 3.41 pp; layout bootstrap [-0.33, 7.02]; win rate 42.45%.

connected: D network/efficiency minus C network/common: -0.64 pp; layout bootstrap [-1.52, 0.18]; win rate 23.70%.

connected: D network/efficiency minus E blind/efficiency: 2.92 pp; layout bootstrap [0.57, 5.38]; win rate 47.14%.

connected: F network/marginal minus D network/efficiency: 0.18 pp; layout bootstrap [-2.32, 2.79]; win rate 47.92%.

local: C network/common minus G blind/common: -6.89 pp; layout bootstrap [-10.88, -2.89]; win rate 11.46%.

local: D network/efficiency minus C network/common: 0.44 pp; layout bootstrap [-1.18, 2.42]; win rate 15.10%.

local: D network/efficiency minus E blind/efficiency: -4.68 pp; layout bootstrap [-8.19, -0.67]; win rate 16.93%.

local: F network/marginal minus D network/efficiency: 5.34 pp; layout bootstrap [1.42, 9.90]; win rate 55.73%.

mixed: C network/common minus G blind/common: 1.00 pp; layout bootstrap [-2.25, 4.26]; win rate 34.64%.

mixed: D network/efficiency minus C network/common: -0.58 pp; layout bootstrap [-1.27, 0.07]; win rate 21.61%.

mixed: D network/efficiency minus E blind/efficiency: 1.08 pp; layout bootstrap [-1.46, 3.72]; win rate 36.20%.

mixed: F network/marginal minus D network/efficiency: 1.59 pp; layout bootstrap [-0.96, 4.29]; win rate 54.43%.

All critical coverage, resource time, win/tie rates and data-quality/rain/budget/crew strata are retained in summary.json. Zero-baseline cases remain in raw results with null percentages.
