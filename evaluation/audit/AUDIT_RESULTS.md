# RainReady Phase 2 numerical audit

Reproduce: `npm run audit:simulation`. Frozen baseline seed 2026, 96 rows, all 288 method percentages and task counts reproduced within 1e-9. No ranking coefficients were tuned during this audit.

## Metric definitions

For asset i: local inflow L_i = catchment_i × rain / 40; B_i = nominal capacity(type_i) × (1 − blockage_i/100); incoming F_i = L_i + sum of transmitted parent flow; O_i = max(0,F_i − B_i); W_i = 1 + homes_i/20 + 8×schools_i + 3×accessRoutes_i. Connected loss C = sum O_i W_i. Each parent transmits min(F_i,B_i), equally split among outgoing links. Clearance changes blockage to min(original,5). Nominal capacities: inlet 2.5, culvert 9, channel 18, collector 24, outlet 80.

Addressed units = C_before − C_after. Percent addressed = 100×(C_before−C_after)/C_before, undefined (null/N/A) when C_before≤1e-9. Each paired method has exactly the same denominator. Denominators differ between scenarios: unweighted mean percentages are NOT pooled reduction. Pooled = 100×sum(addressed)/sum(before). Negative percentages are unbounded below; positive values cannot exceed 100%. Small denominators can dominate the mean.

Local-only evaluator drops transmitted parent flow, retaining only each asset's own catchment and exposure; it tests the alternative assumption of isolated local ponding. Unweighted evaluator reports overflow volume proxy with W_i=1. Neither uses V, P, C or E ranking factors. These are independent formulas, not independent authorship or empirical validation. Tasks, service/travel and blockage points removed are operational quantities, not avoided damage.

## Reproduced original results, with alternative outcomes

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -6.271 | -4.034 | 20.203 | 0.070 | 96 | 93 | 9.448 | 25.542 | 250.052 | 451.755 |
| severity | -4.273 | 1.630 | 52.479 | 12.199 | 96 | 62 | 8.292 | 36.927 | 248.552 | 562.938 |
| rainready | 18.700 | 14.808 | 39.440 | 21.564 | 96 | 29 | 6.729 | 33.563 | 254.750 | 403.483 |

## All 29 original negative RainReady scenarios

IDs are zero-based original scenario indexes. Full source networks, observations, plans and asset changes are in [negative-29.json](negative-29.json).

| ID | Regime | True rain mm | Crews/minutes | Before | After | Addressed % | Largest loss increase and cleared ancestors |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| 4 | nominal | 53.750 | 2/120 | 410.669 | 429.296 | -4.536 | RR-027: +239.140; upstream cleared RR-025, RR-026 |
| 5 | missing conditions | 82.055 | 3/120 | 855.265 | 1134.554 | -32.655 | RR-027: +406.527; upstream cleared RR-025, RR-026, RR-018, RR-016, RR-024, RR-023 |
| 6 | noisy conditions | 96.988 | 1/120 | 630.012 | 801.637 | -27.242 | RR-027: +275.826; upstream cleared RR-026 |
| 8 | nominal | 77.790 | 3/180 | 515.635 | 618.410 | -19.932 | RR-027: +317.263; upstream cleared RR-025, RR-006, RR-005, RR-012, RR-011, RR-010, RR-026, RR-018, RR-024, RR-021 |
| 14 | noisy conditions | 66.724 | 3/240 | 353.801 | 477.239 | -34.889 | RR-027: +332.169; upstream cleared RR-025, RR-006, RR-005, RR-001, RR-011, RR-009, RR-008, RR-007, RR-026, RR-018, RR-017, RR-016, RR-024, RR-023, RR-021, RR-020, RR-019 |
| 15 | missing connections | 50.949 | 1/240 | 286.383 | 319.154 | -11.443 | RR-027: +197.225; upstream cleared RR-012, RR-010, RR-026, RR-024 |
| 17 | missing conditions | 83.803 | 3/60 | 368.243 | 424.953 | -15.400 | RR-027: +158.095; upstream cleared RR-026 |
| 20 | nominal | 81.630 | 3/120 | 385.617 | 540.358 | -40.128 | RR-027: +221.873; upstream cleared RR-005, RR-012, RR-009, RR-026, RR-017, RR-016, RR-024 |
| 24 | nominal | 78.216 | 1/180 | 711.338 | 1048.961 | -47.463 | RR-027: +591.172; upstream cleared RR-025, RR-003, RR-026 |
| 35 | missing connections | 94.145 | 3/60 | 883.408 | 1047.770 | -18.605 | RR-027: +262.998; upstream cleared RR-025, RR-006 |
| 37 | missing conditions | 46.586 | 2/120 | 473.766 | 699.145 | -47.572 | RR-027: +361.243; upstream cleared RR-025, RR-006, RR-001, RR-024 |
| 38 | noisy conditions | 83.819 | 3/120 | 477.055 | 571.814 | -19.863 | RR-027: +385.580; upstream cleared RR-025, RR-006, RR-008, RR-026, RR-018 |
| 40 | nominal | 86.242 | 2/180 | 491.297 | 665.397 | -35.437 | RR-027: +368.154; upstream cleared RR-025, RR-005, RR-011, RR-009, RR-026, RR-018, RR-024 |
| 45 | missing conditions | 61.511 | 1/240 | 263.624 | 485.008 | -83.977 | RR-027: +351.162; upstream cleared RR-025, RR-011, RR-026, RR-018 |
| 47 | missing connections | 102.778 | 3/240 | 798.551 | 851.467 | -6.627 | RR-027: +176.108; upstream cleared RR-025, RR-006, RR-005, RR-002, RR-010, RR-008, RR-007, RR-026, RR-018, RR-017, RR-015, RR-014, RR-024, RR-023, RR-022, RR-020, RR-019 |
| 52 | nominal | 77.051 | 2/120 | 391.791 | 512.104 | -30.708 | RR-027: +231.351; upstream cleared RR-025, RR-006, RR-012, RR-007 |
| 53 | missing conditions | 42.000 | 3/120 | 259.696 | 289.860 | -11.615 | RR-027: +259.911; upstream cleared RR-025, RR-006, RR-026, RR-018, RR-013 |
| 54 | noisy conditions | 94.426 | 1/120 | 592.903 | 640.365 | -8.005 | RR-027: +134.008; upstream cleared RR-025 |
| 59 | missing connections | 80.674 | 3/180 | 408.361 | 527.108 | -29.079 | RR-027: +354.631; upstream cleared RR-025, RR-006, RR-005, RR-004, RR-012, RR-007, RR-026, RR-015, RR-014, RR-024, RR-023 |
| 61 | missing conditions | 92.949 | 2/240 | 737.171 | 755.867 | -2.536 | RR-027: +235.618; upstream cleared RR-025, RR-006, RR-012, RR-011, RR-026, RR-017, RR-024, RR-023, RR-021 |
| 63 | missing connections | 55.145 | 1/240 | 389.402 | 421.439 | -8.227 | RR-027: +96.493; upstream cleared RR-025, RR-012, RR-007, RR-017, RR-023 |
| 67 | missing connections | 49.673 | 2/60 | 314.739 | 318.947 | -1.337 | RR-025: +9.935; upstream cleared RR-011 |
| 72 | nominal | 46.463 | 1/180 | 258.687 | 263.982 | -2.047 | RR-027: +133.709; upstream cleared RR-007, RR-026 |
| 80 | nominal | 82.582 | 3/60 | 459.370 | 538.650 | -17.258 | RR-027: +260.422; upstream cleared RR-025, RR-026 |
| 85 | missing conditions | 56.814 | 2/120 | 331.339 | 504.259 | -52.188 | RR-027: +423.649; upstream cleared RR-025, RR-001, RR-012, RR-026 |
| 86 | noisy conditions | 85.780 | 3/120 | 642.354 | 672.755 | -4.733 | RR-027: +235.267; upstream cleared RR-025, RR-001, RR-012, RR-007, RR-026, RR-018 |
| 89 | missing conditions | 72.647 | 3/180 | 498.020 | 618.327 | -24.157 | RR-027: +320.298; upstream cleared RR-025, RR-006, RR-005, RR-004, RR-012, RR-009, RR-026, RR-018, RR-017, RR-024 |
| 92 | nominal | 32.498 | 3/240 | 135.031 | 167.870 | -24.320 | RR-027: +83.769; upstream cleared RR-025, RR-006, RR-005, RR-004, RR-003, RR-002, RR-001, RR-012, RR-010, RR-009, RR-008, RR-018, RR-017, RR-016, RR-014, RR-024, RR-023 |
| 94 | noisy conditions | 99.026 | 2/240 | 759.659 | 794.078 | -4.531 | RR-027: +214.777; upstream cleared RR-025, RR-012, RR-011, RR-009, RR-026, RR-018, RR-017, RR-024, RR-022 |

## Worked numerical examples

### Scenario 0: positive

Regime: nominal. True rainfall 56.697 mm; 1 crews; 60 minutes.

Tasks: Crew 1: RR-027 [7–52]; return 7 min.

C_before = 592.066, C_after = 204.481. Addressed = 592.066 − 204.481 = 387.585 proxy units. Percentage = 100 × (387.585) / 592.066 = **65.463%**. Rounding here is display-only.

| Asset | Incoming before → after | Capacity before → after | Overflow before → after | Exposure weight | Loss before → after |
| --- | --- | --- | --- | ---: | --- |
| RR-001 | 0.639 → 0.639 | 2.205 → 2.205 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-007 | 0.856 → 0.856 | 1.579 → 1.579 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-013 | 1.138 → 1.138 | 2.190 → 2.190 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-019 | 1.186 → 1.186 | 1.964 → 1.964 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-002 | 2.404 → 2.404 | 0.841 → 0.841 | 1.563 → 1.563 | 1.450 | 2.266 → 2.266 |
| RR-008 | 2.120 → 2.120 | 0.480 → 0.480 | 1.640 → 1.640 | 1.450 | 2.378 → 2.378 |
| RR-014 | 2.376 → 2.376 | 1.381 → 1.381 | 0.995 → 0.995 | 1.450 | 1.442 → 1.442 |
| RR-020 | 3.449 → 3.449 | 1.759 → 1.759 | 1.690 → 1.690 | 1.450 | 2.451 → 2.451 |
| RR-003 | 3.358 → 3.358 | 0.922 → 0.922 | 2.436 → 2.436 | 1.600 | 3.897 → 3.897 |
| RR-009 | 2.276 → 2.276 | 0.422 → 0.422 | 1.854 → 1.854 | 1.600 | 2.966 → 2.966 |
| RR-015 | 3.268 → 3.268 | 1.583 → 1.583 | 1.685 → 1.685 | 1.600 | 2.695 → 2.695 |
| RR-021 | 4.271 → 4.271 | 0.153 → 0.153 | 4.118 → 4.118 | 1.600 | 6.589 → 6.589 |
| RR-004 | 2.385 → 2.385 | 0.184 → 0.184 | 2.201 → 2.201 | 1.750 | 3.852 → 3.852 |
| RR-010 | 2.271 → 2.271 | 0.749 → 0.749 | 1.523 → 1.523 | 1.750 | 2.664 → 2.664 |
| RR-016 | 3.841 → 3.841 | 1.488 → 1.488 | 2.353 → 2.353 | 1.750 | 4.119 → 4.119 |
| RR-022 | 1.772 → 1.772 | 1.874 → 1.874 | 0.000 → 0.000 | 1.750 | 0.000 → 0.000 |
| RR-005 | 2.520 → 2.520 | 2.480 → 2.480 | 0.041 → 0.041 | 4.900 | 0.199 → 0.199 |
| RR-011 | 3.172 → 3.172 | 1.763 → 1.763 | 1.409 → 1.409 | 4.900 | 6.904 → 6.904 |
| RR-017 | 5.524 → 5.524 | 2.195 → 2.195 | 3.329 → 3.329 | 4.900 | 16.313 → 16.313 |
| RR-023 | 4.491 → 4.491 | 3.721 → 3.721 | 0.771 → 0.771 | 4.900 | 3.775 → 3.775 |
| RR-006 | 7.010 → 7.010 | 4.797 → 4.797 | 2.213 → 2.213 | 8.000 | 17.705 → 17.705 |
| RR-012 | 3.665 → 3.665 | 2.670 → 2.670 | 0.996 → 0.996 | 16.000 | 15.929 → 15.929 |
| RR-018 | 4.154 → 4.154 | 18.192 → 18.192 | 0.000 → 0.000 | 8.000 | 0.000 → 0.000 |
| RR-024 | 7.548 → 7.548 | 17.997 → 17.997 | 0.000 → 0.000 | 8.000 | 0.000 → 0.000 |
| RR-025 | 11.065 → 11.065 | 13.955 → 13.955 | 0.000 → 0.000 | 8.500 | 0.000 → 0.000 |
| RR-026 | 16.530 → 16.530 | 3.785 → 3.785 | 12.746 → 12.746 | 8.500 | 108.337 → 108.337 |
| RR-027 | 19.157 → 19.157 | 1.931 → 22.800 | 17.226 → 0.000 | 22.500 | 387.585 → 0.000 |
| RR-028 | 5.770 → 22.995 | 35.075 → 35.075 | 0.000 → 0.000 | 8.500 | 0.000 → 0.000 |

The reductions in weighted local overflow exceed any additional downstream loss.

### Scenario 4: negative

Regime: nominal. True rainfall 53.750 mm; 2 crews; 120 minutes.

Tasks: Crew 1: RR-027 [7–52], RR-025 [54–99]; return 6 min; Crew 2: RR-026 [6–51], RR-028 [53–98]; return 7 min.

C_before = 410.669, C_after = 429.296. Addressed = 410.669 − 429.296 = -18.627 proxy units. Percentage = 100 × (-18.627) / 410.669 = **-4.536%**. Rounding here is display-only.

| Asset | Incoming before → after | Capacity before → after | Overflow before → after | Exposure weight | Loss before → after |
| --- | --- | --- | --- | ---: | --- |
| RR-001 | 1.490 → 1.490 | 1.517 → 1.517 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-007 | 0.933 → 0.933 | 0.191 → 0.191 | 0.742 → 0.742 | 1.300 | 0.965 → 0.965 |
| RR-013 | 1.474 → 1.474 | 1.113 → 1.113 | 0.360 → 0.360 | 1.300 | 0.468 → 0.468 |
| RR-019 | 0.913 → 0.913 | 1.590 → 1.590 | 0.000 → 0.000 | 1.300 | 0.000 → 0.000 |
| RR-002 | 2.483 → 2.483 | 0.941 → 0.941 | 1.542 → 1.542 | 1.450 | 2.236 → 2.236 |
| RR-008 | 2.192 → 2.192 | 1.284 → 1.284 | 0.908 → 0.908 | 1.450 | 1.316 → 1.316 |
| RR-014 | 2.168 → 2.168 | 2.068 → 2.068 | 0.100 → 0.100 | 1.450 | 0.145 → 0.145 |
| RR-020 | 2.131 → 2.131 | 1.505 → 1.505 | 0.625 → 0.625 | 1.450 | 0.907 → 0.907 |
| RR-003 | 3.029 → 3.029 | 0.710 → 0.710 | 2.319 → 2.319 | 1.600 | 3.710 → 3.710 |
| RR-009 | 2.690 → 2.690 | 0.752 → 0.752 | 1.937 → 1.937 | 1.600 | 3.100 → 3.100 |
| RR-015 | 4.583 → 4.583 | 1.488 → 1.488 | 3.095 → 3.095 | 1.600 | 4.952 → 4.952 |
| RR-021 | 4.147 → 4.147 | 2.194 → 2.194 | 1.954 → 1.954 | 1.600 | 3.126 → 3.126 |
| RR-004 | 2.683 → 2.683 | 2.049 → 2.049 | 0.634 → 0.634 | 1.750 | 1.109 → 1.109 |
| RR-010 | 2.365 → 2.365 | 0.707 → 0.707 | 1.657 → 1.657 | 1.750 | 2.901 → 2.901 |
| RR-016 | 4.889 → 4.889 | 2.086 → 2.086 | 2.804 → 2.804 | 1.750 | 4.907 → 4.907 |
| RR-022 | 4.537 → 4.537 | 1.454 → 1.454 | 3.083 → 3.083 | 1.750 | 5.396 → 5.396 |
| RR-005 | 5.011 → 5.011 | 4.993 → 4.993 | 0.018 → 0.018 | 4.900 | 0.090 → 0.090 |
| RR-011 | 4.062 → 4.062 | 6.689 → 6.689 | 0.000 → 0.000 | 4.900 | 0.000 → 0.000 |
| RR-017 | 4.697 → 4.697 | 7.942 → 7.942 | 0.000 → 0.000 | 4.900 | 0.000 → 0.000 |
| RR-023 | 3.960 → 3.960 | 6.921 → 6.921 | 0.000 → 0.000 | 4.900 | 0.000 → 0.000 |
| RR-006 | 9.007 → 9.007 | 13.346 → 13.346 | 0.000 → 0.000 | 8.000 | 0.000 → 0.000 |
| RR-012 | 6.495 → 6.495 | 10.451 → 10.451 | 0.000 → 0.000 | 16.000 | 0.000 → 0.000 |
| RR-018 | 7.821 → 7.821 | 13.719 → 13.719 | 0.000 → 0.000 | 8.000 | 0.000 → 0.000 |
| RR-024 | 7.718 → 7.718 | 19.488 → 19.488 | 0.000 → 0.000 | 8.000 | 0.000 → 0.000 |
| RR-025 | 19.915 → 19.915 | 3.139 → 17.100 | 16.776 → 2.815 | 8.500 | 142.596 → 23.929 |
| RR-026 | 21.623 → 21.623 | 5.118 → 17.100 | 16.505 → 4.523 | 8.500 | 140.295 → 38.449 |
| RR-027 | 11.595 → 37.537 | 7.486 → 22.800 | 4.109 → 14.737 | 22.500 | 92.451 → 331.591 |
| RR-028 | 12.083 → 27.398 | 65.451 → 76.000 | 0.000 → 0.000 | 8.500 | 0.000 → 0.000 |

Clearing upstream capacity transmits additional flow into downstream assets. The extra weighted downstream overflow exceeds the reductions elsewhere. No negative overflow or clipped negative score is used.

## Stress matrix

675 paired cases: seeds 42,2026,8701 × five observation regimes × true rainfall 0,8,24,64,120 mm × crews 0,1,2 × deadlines 15,45,120 minutes. Later crews start 15 minutes later. Three truth topology variants; observed wrong links and severe missing/noisy conditions are separate from truth. Missing observed rainfall uses the disclosed planning prior, never an invented forecast. The evaluator always has complete generated truth. Every returned plan is independently checked for timing, uniqueness, access, equipment and dependencies.

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 540 | 180 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 5.047 | 3.832 | 14.660 | 6.159 | 540 | 162 | 1.341 | 7.052 | 39.111 | 101.740 |
| rainready | 10.261 | 8.893 | 6.687 | 6.921 | 540 | 98 | 1.040 | 7.123 | 39.450 | 72.111 |

### nominal

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 108 | 36 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 3.620 | 2.475 | 17.486 | 5.970 | 108 | 36 | 1.259 | 6.741 | 38.889 | 103.717 |
| rainready | 10.324 | 9.132 | 8.199 | 7.260 | 108 | 19 | 1.000 | 7.096 | 39.474 | 70.599 |

### severe severity noise

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 108 | 36 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 2.822 | 2.258 | 4.137 | 2.823 | 108 | 30 | 1.556 | 6.778 | 39.481 | 91.618 |
| rainready | 11.578 | 10.351 | 5.240 | 7.149 | 108 | 15 | 1.074 | 6.852 | 39.852 | 70.304 |

### missing conditions

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 108 | 36 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 8.920 | 6.991 | 16.001 | 8.274 | 108 | 28 | 1.370 | 7.667 | 39.407 | 104.873 |
| rainready | 10.538 | 9.743 | 7.400 | 6.940 | 108 | 20 | 1.000 | 7.296 | 39.074 | 68.872 |

### wrong connections

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 108 | 36 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 3.620 | 2.475 | 17.486 | 5.970 | 108 | 36 | 1.259 | 6.741 | 38.889 | 103.717 |
| rainready | 9.137 | 7.372 | 7.815 | 6.503 | 108 | 23 | 1.044 | 7.296 | 39.319 | 75.202 |

### wrong catchment/exposure

| Method | Connected mean % | Pooled % | Local-only mean % | Unweighted mean % | Valid % denominators | Negative | Tasks | Travel min | Service min | Blockage points removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | -0.346 | -0.984 | 4.486 | 0.967 | 108 | 36 | 1.667 | 4.519 | 41.852 | 93.572 |
| severity | 6.254 | 4.963 | 18.189 | 7.756 | 108 | 32 | 1.259 | 7.333 | 38.889 | 104.774 |
| rainready | 9.729 | 7.868 | 4.782 | 6.754 | 108 | 21 | 1.081 | 7.074 | 39.533 | 75.579 |

## Uncertainty

Original paired RainReady−severity mean 22.973 percentage points; min -82.670, median 5.256, max 202.223. Exploratory 2,000-replicate paired-row bootstrap (seed 12345) 95% percentile interval [14.237, 32.991]. This conditions on one synthetic generator and shared assumptions. It is not a field confidence interval. Stress rows share seed fixtures; no independent-sample interval is claimed for them. Budget/rain strata are preserved in summary.json.

## Fairness and limitations

All policies receive identical observed nodes, crews, hours, accessibility, task times and travel assumptions. None receives hidden true blockage/rainfall. However, the original generator copied true catchment and exposure into observations exactly, used one fixed graph, correlated high exposure with collector types, and evaluated downstream transport: assumptions naturally compatible with network prioritisation. Baselines intentionally ignore network/exposure; their poor scores do not prove the proposed heuristic beats stronger routing or marginal-benefit baselines. The allocator uses the same mechanics but RainReady includes benefit/time ranking, so this is not a pure ranking-only ablation. Fixed order is node-array order, not sorted asset ID. The local-only and unweighted alternatives test dependence on evaluation choices.

The original 29 failures reproduce after the two evaluator edge-case fixes; they are not caused by those bugs. Their per-asset traces show upstream-to-downstream overflow transfer. The model removes overflowing water from onward flow and has no storage, backwater, dynamic rainfall, pipe geometry or travel-time error. The planner sums static individual values and does not recompute downstream joint benefit after selecting tasks. This mismatch explains residual negative outcomes and cannot be marketed as validated hydraulic advantage. Synthetic stress tests expose fragility; they cannot establish commercial ROI.
