# Explicit Type-count research smoke results — 2026-10-01

Status: completed  
Experiment spec: [type-count-smoke-2026-10-01.md](type-count-smoke-2026-10-01.md)  
Workflow run: `Explicit Type-count Research Smoke 2026-10-01 / run 1`  
Research catalog version: `research-candidates-v1`  
Proof budget: `research-proof-200k-d200-e5-v1`

## Executive result

The neutral explicit-Type-count research path successfully generated, validated, and summarized all strata from T=4 through T=16 without changing the fixed proof budget.

Each stratum targeted 20 accepted candidates.

- T4..15: 20 attempts -> 20 accepted, zero rejected.
- T16: 23 attempts -> 20 accepted, 3 `MINIMUM_EMPTY_BUDGET_EXCEEDED`.
- No `MINIMUM_EMPTY_EXHAUSTED`.
- No `STARTS_SOLVED`.
- No exact canonical duplicates in this 260-accepted-puzzle smoke sample.

The T16 rejection tail is consistent with the earlier solver-scaling benchmark and is expected behavior under the fixed 200k research budget. It is not interpreted as UNSOLVABLE.

## Yield

| Types | Attempts | Accepted | Budget UNKNOWN | Other rejects | Attempt acceptance |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 20 | 20 | 0 | 0 | 100% |
| 5 | 20 | 20 | 0 | 0 | 100% |
| 6 | 20 | 20 | 0 | 0 | 100% |
| 7 | 20 | 20 | 0 | 0 | 100% |
| 8 | 20 | 20 | 0 | 0 | 100% |
| 9 | 20 | 20 | 0 | 0 | 100% |
| 10 | 20 | 20 | 0 | 0 | 100% |
| 11 | 20 | 20 | 0 | 0 | 100% |
| 12 | 20 | 20 | 0 | 0 | 100% |
| 13 | 20 | 20 | 0 | 0 | 100% |
| 14 | 20 | 20 | 0 | 0 | 100% |
| 15 | 20 | 20 | 0 | 0 | 100% |
| 16 | 23 | 20 | 3 | 0 | 87.0% |

For T16, the observed attempt-level budget-UNKNOWN rate was:

`3 / 23 = 13.0%`

This is a small deterministic sample. It is sufficient to confirm a non-zero tail, not to estimate the long-run T16 rejection probability precisely.

## Minimum-empty observations

| Types | min=1 | min=2 | observed min>2 |
| ---: | ---: | ---: | ---: |
| 4 | 9 | 11 | 0 |
| 5 | 4 | 16 | 0 |
| 6 | 1 | 19 | 0 |
| 7 | 0 | 20 | 0 |
| 8 | 1 | 19 | 0 |
| 9 | 0 | 20 | 0 |
| 10 | 1 | 19 | 0 |
| 11 | 0 | 20 | 0 |
| 12 | 0 | 20 | 0 |
| 13 | 0 | 20 | 0 |
| 14 | 0 | 20 | 0 |
| 15 | 0 | 20 | 0 |
| 16 | 0 | 20 | 0 |

No accepted puzzle in this smoke required more than two empty tubes.

This is an observation, not a proof that k>2 cannot occur.

The isolated T8 and T10 minimum=1 cases also show why a formal reference population must measure rather than assume the minimum-empty distribution at larger T.

## Optimal-move scaling

| Types | mean optimal moves | p50 | p90 | max |
| ---: | ---: | ---: | ---: | ---: |
| 4 | 10.80 | 11 | 12 | 13 |
| 5 | 14.75 | 14 | 17 | 17 |
| 6 | 18.35 | 18 | 20 | 21 |
| 7 | 21.25 | 21 | 23 | 23 |
| 8 | 24.95 | 25 | 27 | 27 |
| 9 | 27.65 | 27 | 30 | 31 |
| 10 | 31.15 | 31 | 33 | 33 |
| 11 | 35.00 | 35 | 37 | 38 |
| 12 | 38.30 | 38 | 40 | 41 |
| 13 | 41.20 | 41 | 43 | 45 |
| 14 | 45.50 | 45 | 48 | 49 |
| 15 | 48.05 | 48 | 50 | 51 |
| 16 | 52.25 | 52 | 54 | 55 |

This is a machine workload fact for the accepted sample and is not a human difficulty scale.

## Solver visited-state envelope

| Types | p50 visited | p95 visited | max visited |
| ---: | ---: | ---: | ---: |
| 4 | 42 | 130 | 159 |
| 5 | 137 | 800 | 2,065 |
| 6 | 260 | 1,997 | 2,958 |
| 7 | 741 | 2,542 | 3,583 |
| 8 | 2,727 | 6,918 | 6,941 |
| 9 | 4,063 | 5,986 | 7,020 |
| 10 | 7,215 | 21,543 | 31,093 |
| 11 | 20,120 | 36,263 | 37,786 |
| 12 | 16,995 | 56,031 | 56,206 |
| 13 | 17,115 | 55,868 | 110,253 |
| 14 | 42,114 | 109,766 | 131,373 |
| 15 | 37,729 | 81,691 | 103,085 |
| 16 | 47,340 | 130,756 | 133,055 |

The accepted-sample state cost is not monotonic candidate-by-candidate or even strictly monotonic by T. The main pattern is a widening high-Type tail.

The accepted T16 puzzles stayed below the 200k limit; three additional T16 attempts hit the limit and were rejected as UNKNOWN.

This demonstrates an important sampling property:

> The accepted T16 reference population is conditioned on successful proof under the declared 200k budget.

Future analysis must preserve that provenance and report the reject rate alongside accepted-puzzle structural distributions.

## Structural concentration

Mean descriptor values:

| Types | normalized runs | all-distinct Tube count | Type spread mean | top-distinct Types |
| ---: | ---: | ---: | ---: | ---: |
| 4 | 0.816 | 0.65 | 2.888 | 3.00 |
| 5 | 0.885 | 1.25 | 3.090 | 3.65 |
| 6 | 0.919 | 2.60 | 3.342 | 4.25 |
| 7 | 0.925 | 3.10 | 3.357 | 4.90 |
| 8 | 0.942 | 4.15 | 3.500 | 5.65 |
| 9 | 0.942 | 4.60 | 3.483 | 6.30 |
| 10 | 0.938 | 5.75 | 3.540 | 7.25 |
| 11 | 0.951 | 6.60 | 3.586 | 7.65 |
| 12 | 0.956 | 7.60 | 3.625 | 8.50 |
| 13 | 0.958 | 8.95 | 3.673 | 8.55 |
| 14 | 0.964 | 9.90 | 3.696 | 9.50 |
| 15 | 0.960 | 10.00 | 3.657 | 10.60 |
| 16 | 0.965 | 11.95 | 3.741 | 11.05 |

The high-Type combinatorial concentration seen in the earlier pilot remains visible under the neutral research path.

## topDistinctTypeCount validation

`topDistinctTypeCount` retains non-trivial variation across the entire T=4..16 smoke range.

Observed min/max by stratum:

| Types | mean | min | max |
| ---: | ---: | ---: | ---: |
| 4 | 3.00 | 2 | 4 |
| 5 | 3.65 | 3 | 5 |
| 6 | 4.25 | 3 | 5 |
| 7 | 4.90 | 3 | 7 |
| 8 | 5.65 | 4 | 7 |
| 9 | 6.30 | 5 | 8 |
| 10 | 7.25 | 5 | 9 |
| 11 | 7.65 | 6 | 10 |
| 12 | 8.50 | 7 | 10 |
| 13 | 8.55 | 7 | 11 |
| 14 | 9.50 | 7 | 11 |
| 15 | 10.60 | 8 | 13 |
| 16 | 11.05 | 10 | 13 |

This supports keeping it in the next formal descriptor set as a structural coverage candidate.

It still has no difficulty interpretation.

## initialDistinctNextStates confirmation

For every one of the 260 accepted smoke puzzles:

`initialDistinctNextStates = T`

There was zero within-stratum variance.

Therefore:

- keep it only for compatibility/diagnostics if useful;
- do not use it as a primary `coverageSpaceVersion=1` axis under classic full-tube starts.

## Decisions from this smoke

1. The neutral explicit-Type-count path is operational across T=4..16.
2. Keep the fixed 200k research proof budget; do not increase it to rescue T16 tail cases.
3. Future T16 accepted-population reports must always include the accompanying UNKNOWN rate.
4. Do not infer a production Type ceiling from this smoke.
5. Keep `topDistinctTypeCount` in the descriptor candidate set.
6. Remove `initialDistinctNextStates` from the primary coverage-axis candidate set.
7. Do not implement FPS / coverage bins yet.
8. Do not authorize targeted generation.
9. The next formal reference population should use explicit Type-count strata rather than legacy source buckets.

## Data-contract issue discovered before the formal run

The smoke also exposed a reproducibility contract that should be hardened before a larger formal population.

The current `research-candidates-v1` catalog records:

- Type-count stratum;
- batch seed;
- proof-budget version;
- config fingerprint;
- candidate provenance.

However, the catalog does not yet expose the full run configuration needed to independently recompute the config fingerprint and reproduce the stopping policy, notably:

- capacity;
- requested accepted count;
- max attempts;
- explicit proof-budget values.

These values are used by generation but some are only implicit or only represented by the fingerprint/version.

Before a formal reference population, add a versioned run-configuration block and make the validator recompute its fingerprint.

This is a reproducibility hardening issue, not a failure of the smoke data.

## Gate result

**Neutral research path smoke: PASS**

**T4..15 supply under this sample: no observed UNKNOWN**

**T16: non-zero proof-budget tail confirmed**

**coverageSpaceVersion=1: NOT FROZEN**

**formal reference population: WAITING FOR RUN-CONFIG CONTRACT HARDENING**

**targeted generator: NOT AUTHORIZED**
