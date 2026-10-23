# RainReady executed simulation results

Seed **2026**; **96** scenarios. Regenerate with `npm run evaluate:rainready -- 96 2026`.

These are synthetic toy-model results, not verified flood mitigation or real-world maintenance outcomes. See [methodology](RAINREADY_README.md).

| Method | Mean consequence addressed | Critical coverage | Tasks | Travel min | Service min |
| --- | ---: | ---: | ---: | ---: | ---: |
| fixed | -6.27% | 5.00% | 9.45 | 25.54 | 250.05 |
| severity | -4.27% | 28.75% | 8.29 | 36.93 | 248.55 |
| rainready | 18.70% | 65.00% | 6.73 | 33.56 | 254.75 |

RainReady exceeds severity-first in 63/96 paired scenarios. RainReady has negative consequence addressed in 29/96 scenarios. Mean paired difference: **22.97 percentage points**. Negative outcomes represent downstream overload transfer in this toy model; they are not clipped.

## Sensitivity by observation regime

| Regime | Count | Fixed | Severity | RainReady |
| --- | ---: | ---: | ---: | ---: |
| nominal | 24 | -7.66% | -18.04% | 11.02% |
| missing conditions | 24 | -7.07% | 1.90% | 15.85% |
| noisy conditions | 24 | -6.78% | 2.17% | 28.74% |
| missing connections | 24 | -3.56% | -3.11% | 19.20% |

## Sensitivity by deadline

| Deadline min | Count | Fixed | Severity | RainReady |
| --- | ---: | ---: | ---: | ---: |
| 60 | 24 | -2.86% | -17.38% | 23.74% |
| 120 | 24 | -3.41% | -3.44% | 11.09% |
| 180 | 24 | -8.41% | -1.32% | 25.49% |
| 240 | 24 | -10.41% | 5.04% | 14.49% |

Each cell is mean percentage consequence addressed. The same seeded underlying scenarios and resource constraints are used for all methods. Summary differences are sensitive to capacity and exposure assumptions, observation errors, topology and resource budgets. No statistical generalisation to real townships is justified by this batch.
