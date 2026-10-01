# Uniform reference population pilot results — 2026-10-01

Status: completed  
Experiment spec: [reference-population-pilot-2026-10-01.md](reference-population-pilot-2026-10-01.md)  
Generator commit: `5b0cbd8183eafe99dcab3ddf64e54a2ca0d22c6e`  
Workflow run: `Reference Population Pilot 2026-10-01 / run 1`

## Executive result

The 9,000-puzzle pilot completed successfully:

- 3 independent seeds;
- baseline 4 / 5 / 6 Type source buckets;
- 1,000 technically valid accepted puzzles per Type count per seed;
- 9,000 accepted puzzles total;
- zero minimum-empty proof budget failures;
- zero max-empty exhaustion failures;
- zero already-solved accepted candidates;
- 23 exact canonical duplicates, all in the 4-Type stratum.

The current uniform generator therefore has no observed supply or proof-completion problem at T=4..6 under the current v0.3 technical-validity contract.

The pilot also demonstrates that not every proposed structural descriptor is useful. In particular, `initialDistinctNextStates` is effectively degenerate for classic full-tube starts with empty tubes and should not be promoted to a primary coverage axis.

## Run yield

| Seed | Attempts | Accepted | Rejected | Canonical duplicates | Proof UNKNOWN |
| --- | ---: | ---: | ---: | ---: | ---: |
| a | 3,011 | 3,000 | 11 | 11 | 0 |
| b | 3,003 | 3,000 | 3 | 3 | 0 |
| c | 3,009 | 3,000 | 9 | 9 | 0 |
| **Total** | **9,023** | **9,000** | **23** | **23** | **0** |

All 23 duplicate rejections occurred in the 4-Type source bucket.

Aggregate acceptance yield:

`9000 / 9023 = 99.745%`

4-Type exact duplicate rate over attempted candidates:

`23 / 3023 = 0.761%`

No duplicate rejection was observed in the 5-Type or 6-Type pilot samples.

## Minimum-empty distribution

| Types | N | minimum=1 | minimum=2 | observed minimum >2 |
| ---: | ---: | ---: | ---: | ---: |
| 4 | 3,000 | 48.37% | 51.63% | 0 |
| 5 | 3,000 | 26.87% | 73.13% | 0 |
| 6 | 3,000 | 13.40% | 86.60% | 0 |

Seed-level proportions were stable:

- T4 minimum=1: 47.5% .. 49.6%;
- T5 minimum=1: 26.2% .. 28.0%;
- T6 minimum=1: 12.4% .. 14.6%.

This does **not** prove that minimum >2 is impossible for T<=6. It means none was observed in 9,000 technically valid accepted samples.

## Optimal moves and fragmentation

| Types | optimalMoves mean | optimalMoves p50 | optimalMoves p90 | normalized runs mean | all-distinct tubes mean | Type spread mean |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 11.27 | 11 | 13 | 0.846 | 0.546 | 2.899 |
| 5 | 14.69 | 15 | 17 | 0.883 | 1.346 | 3.128 |
| 6 | 17.92 | 18 | 20 | 0.902 | 2.164 | 3.266 |

The expected combinatorial concentration is visible after the real proof pipeline:

- mean normalized run count increases with Type count;
- all-distinct Tube count increases with Type count;
- mean Type spread across Tubes increases with Type count.

The proof/technical-validity pipeline does not remove the uniform generator's high-Type fragmentation tendency.

## Minimum-empty vs solver cost

Mean production-solver explored states:

| Types | minimum=1 | minimum=2 |
| ---: | ---: | ---: |
| 4 | 18.8 | 41.0 |
| 5 | 30.9 | 135.5 |
| 6 | 47.8 | 371.6 |

The minimum=2 population is measurably more expensive for the current search engine, but the current pilot remained far below the configured resource budgets.

## Seed-to-seed stability

Across the three independent 1,000-puzzle samples per Type count, the largest difference in seed means was small:

| Metric | T4 max mean range | T5 | T6 |
| --- | ---: | ---: | ---: |
| minimum empty | 0.021 | 0.018 | 0.022 |
| optimal moves | 0.109 | 0.018 | 0.046 |
| total runs | 0.098 | 0.041 | 0.052 |
| all-distinct Tube count | 0.029 | 0.048 | 0.022 |
| Type spread mean | 0.014 | 0.002 | 0.003 |

Maximum pairwise two-sample KS statistic across current descriptor distributions remained <= 0.055 in this pilot.

Interpretation:

The observed T=4..6 uniform technical-validity population is stable enough across these seeds to support descriptor screening. This pilot does not by itself freeze production coverage bins.

## Descriptor review

### totalRuns / normalizedTotalRuns

Keep as research descriptors.

Within a fixed Type count, `normalizedTotalRuns` is a linear rescaling of `totalRuns`; they must not both receive independent weight in one coverage distance.

`totalRuns` is strongly correlated with `optimalMoves` in this uniform population:

- T4: r = 0.945;
- T5: r = 0.946;
- T6: r = 0.933.

This is useful information but is **not** evidence that total runs is human difficulty.

If both `totalRuns` and `optimalMoves` are later used in Selection distance, the duplication must be intentional rather than accidental.

### allDistinctTubeCount

Keep as a descriptive metric.

It has real variance, but it increasingly overlaps with Type spread as T grows.

Correlation with `typeSpreadMean`:

- T4: r = 0.740;
- T5: r = 0.855;
- T6: r = 0.893.

It should therefore not automatically be treated as an independent coverage dimension alongside Type spread at larger T.

### typeSpreadMean

Keep.

It has useful variation and describes a different structural property than raw run fragmentation, although the correlation with total runs is moderate (~0.64..0.66).

### typeSpreadMax

Keep only as a secondary diagnostic for now.

It becomes strongly concentrated:

- T5: 77.9% of puzzles have max spread = 4;
- T6: 92.5% have max spread = 4.

It is not a good primary axis in the observed T6 population.

### initialDistinctNextStates

Do **not** use as a v1 primary coverage axis.

Observed values:

- T4: 98.90% equal 4;
- T5: 98.90% equal 5;
- T6: 99.53% equal 6.

Classic initial boards are full except for empty tubes, so the initial state has very little meaningful local branching variation under the current state-equivalence definition.

Keep the metric only if it remains useful for diagnostics or future non-classic rules; otherwise deprecate it.

## Post-hoc descriptor experiment: top-Type diversity

The archived Boards were additionally analyzed with a simple descriptor that was **not** part of the original pilot artifact schema:

`topDistinctTypeCount = number of distinct Type IDs visible at the tops of non-empty Tubes`

Observed distribution:

| Types | mean | distribution |
| ---: | ---: | --- |
| 4 | 2.911 | 1: 0.13%, 2: 22.13%, 3: 64.20%, 4: 13.53% |
| 5 | 3.586 | 2: 3.70%, 3: 40.33%, 4: 49.67%, 5: 6.30% |
| 6 | 4.284 | 2: 0.20%, 3: 12.47%, 4: 48.87%, 5: 35.67%, 6: 2.80% |

This descriptor is notably more orthogonal to the existing fragmentation descriptors:

Correlation with total runs:

- T4: -0.036;
- T5: -0.045;
- T6: -0.005.

Correlation with Type spread mean:

- T4: -0.119;
- T5: -0.130;
- T6: -0.096.

Correlation with optimal moves:

- T4: -0.090;
- T5: -0.092;
- T6: -0.064.

It is therefore a better candidate for the next descriptor set than `initialDistinctNextStates`.

This is still a structural coverage candidate, not a difficulty signal.

## Design decisions from the pilot

1. **Do not implement production FPS / coverage bins yet.**
2. Remove `initialDistinctNextStates` from the proposed primary coverage-axis list.
3. Keep `totalRuns`, `typeSpreadMean`, and `allDistinctTubeCount` as research descriptors, while treating their correlations explicitly.
4. Add `topDistinctTypeCount` as a research descriptor candidate.
5. Keep `typeSpreadMax` secondary rather than primary.
6. Continue stratifying any future Selection analysis by Type count and minimum required empty tubes.
7. Do not add a targeted generator: no structural supply failure has yet been demonstrated.
8. Before the formal large reference population, remove the remaining dependence on legacy Easy/Medium/Hard source-bucket names for choosing Type count. Research generation should be able to request Type count directly.

## Next implementation requirement

The current baseline profile is sufficient for this pilot but not for formal T=4..16 population research because Type count is still indirectly selected through legacy source buckets.

Before the formal reference population:

- add an explicit Type-count research generation path;
- give it a neutral generation-stratum identity;
- keep legacy profile/source-bucket mode for historical reproducibility;
- do not require a fake human difficulty label merely to generate a research candidate;
- preserve the same proof / identity / validation contracts.

After that migration, run the next reference population across explicitly selected Type counts.

## Gate result

**Pilot: PASS**

The data are sufficient to revise the descriptor set and to justify a neutral explicit-Type-count research generation path.

**coverageSpaceVersion=1: NOT FROZEN**

**targeted generator: NOT AUTHORIZED**

**human difficulty thresholds: NOT AUTHORIZED**
