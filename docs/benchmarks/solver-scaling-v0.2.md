# Solver scaling benchmark — Generator v0.2

Date: 2026-09-22

## Purpose

Measure the resource scaling of the packed authoring solver before choosing a production gameplay/type ceiling.

This benchmark is about engineering feasibility, not human difficulty.

## Solver configuration

First pass:

- type count: 6..16;
- capacity: 4;
- samples per type count: 5;
- maximum empty tubes tested: 5;
- max visited-state budget per solve: 100,000;
- max depth: 160;
- concurrency: 1;
- process isolation: one child process per candidate;
- deterministic batch seed: `water-sort-benchmark-v0.2`;
- runner: GitHub-hosted Ubuntu, Node 22.

Every candidate first proves lower empty-tube counts unsolvable, then solves the first feasible count. A budget cutoff remains `unknown`.

## First-pass results

| Types | Exact | Min empty | p50 time | max time | p50 explored | max explored | max RSS |
|---:|---:|---|---:|---:|---:|---:|---:|
| 6 | 5/5 | 1×1, 2×4 | 9 ms | 23 ms | 103 | 429 | 82 MB |
| 7 | 5/5 | 2×5 | 30 ms | 39 ms | 660 | 978 | 74 MB |
| 8 | 5/5 | 2×5 | 66 ms | 76 ms | 2,526 | 3,038 | 77 MB |
| 9 | 5/5 | 2×5 | 28 ms | 70 ms | 388 | 2,329 | 74 MB |
| 10 | 5/5 | 2×5 | 216 ms | 390 ms | 10,421 | 16,985 | 107 MB |
| 11 | 5/5 | 2×5 | 336 ms | 627 ms | 14,287 | 24,363 | 114 MB |
| 12 | 5/5 | 2×5 | 399 ms | 1,630 ms | 15,591 | 45,600 | 126 MB |
| 13 | 5/5 | 2×5 | 425 ms | 640 ms | 17,445 | 24,781 | 112 MB |
| 14 | 4/5 | 2×4, 1 unknown | 1,166 ms | 6,920 ms | 34,439 | 100,942 | 170 MB |
| 15 | 5/5 | 2×5 | 593 ms | 1,791 ms | 17,720 | 50,979 | 141 MB |
| 16 | 5/5 | 2×5 | 468 ms | 6,149 ms | 14,211 | 87,878 | 171 MB |

Percentiles from five samples are intentionally treated only as directional; they are not statistically strong p95/p99 estimates.

## Important observation: lower-empty proof is not the bottleneck

The 14-Type candidate that hit the 100,000-state budget behaved as follows:

```text
1 empty:
  unsolvable
  explored = 942

2 empty:
  budget-exceeded
  explored = 100,000
  visited  = 128,076
```

Representative 16-Type heavy cases show the same pattern:

```text
1 empty:
  proven unsolvable in tens/hundreds of states

2 empty:
  optimal A* search dominates the workload
```

Therefore the immediate resource bottleneck is not proving that one empty tube is insufficient. It is finding/proving the optimal solution in the first solvable two-empty-tube state.

This means introducing a separate feasibility solver would not materially remove the dominant cost for accepted production puzzles, because accepted puzzles still require an optimal solution for `optimalMoves`, `optimalSolution`, challenge modes, and difficulty analysis.

## Preliminary engineering conclusion

The packed state representation makes 16 types technically feasible under a single-worker offline workflow.

However:

- resource use is highly candidate-dependent rather than monotonic in type count;
- pathological candidates appear before the encoding ceiling;
- 16 types being solvable does not imply 16 types are suitable for UI or human play;
- production generation should keep a per-candidate state budget and reject unresolved pathological candidates;
- a larger 14..16 tail sample is required before setting a recommended production solver budget.

## Tail benchmark

A second pass uses:

- types: 14..16;
- 20 samples each;
- 200,000 visited-state budget;
- max depth 180;
- concurrency 1;
- one child process per candidate;
- deterministic seed `water-sort-benchmark-tail-v0.2`.

Its purpose is to estimate the long-tail unknown rate and memory/time envelope more reliably.


## Budget semantics correction

The initial benchmark exposed an implementation mismatch: `maxVisitedStates` was being enforced against popped/explored states while the visited map could grow substantially beyond that limit.

One 15-Type tail case reached:

```text
explored states = 200,000
visited states  = 682,774
max RSS         = ~592 MB
```

This violated the intended memory-guard semantics.

The solver has been corrected so `maxVisitedStates` now limits unique discovered states in `bestDepth`. A new state is not inserted once the configured visited-state budget is full, and the solver returns `budget-exceeded`.

Therefore the first-pass and first tail-pass timing/RSS data remain useful as observations of the previous implementation, but their budget-hit rates must not be used as the final v0.2 production limits. A corrected tail benchmark is required.


## Corrected 14..16 tail benchmark

After fixing `maxVisitedStates` to cap unique discovered states, the same deterministic tail seed was rerun with:

- 14..16 types;
- 20 samples per type count;
- 200,000 visited-state budget;
- max depth 180;
- concurrency 1;
- one child process per candidate.

| Types | Exact | Unknown | p50 time | p95 time | max time | p50 visited | p95 visited | max RSS |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 14 | 20/20 | 0 | 774 ms | 3.21 s | 4.60 s | 38,531 | 82,493 | 177 MB |
| 15 | 19/20 | 1 | 1.15 s | 6.51 s | 18.33 s | 39,790 | 166,733 | 236 MB |
| 16 | 15/20 | 5 | 1.81 s | 14.39 s | 14.86 s | 52,132 | 200,000 | 253 MB |

All unknown results were `budget-exceeded`.

The corrected guard successfully bounds the visited map at 200,000 states. Peak RSS stayed around 253 MB instead of the previous pathological ~592 MB.

## Tail behavior

Most 14..16 Type candidates still have a minimum of two empty tubes.

Two important pathological shapes appeared:

1. two empty tubes are solvable, but optimal A* reaches the memory budget before proving the shortest solution;
2. two empty tubes are proven unsolvable, then the three-empty-tube search has a much larger branching frontier and reaches the visited-state budget.

Example 15-Type pathological candidate:

```text
1 empty:
  unsolvable
  visited = 380

2 empty:
  unsolvable
  visited = 29,183

3 empty:
  budget-exceeded
  visited = 200,000
```

This confirms that minimum-empty proof is usually cheap at one empty tube, but can become expensive when a candidate requires three or more empty tubes.

## Engineering recommendation

For Generator v0.2:

- keep 16 types as the encoding/research ceiling;
- keep generation sequential by default;
- use a strict visited-state budget as the primary memory guard;
- reject `budget-exceeded` candidates instead of increasing memory without bound;
- treat 14 types as comfortably within the current solver envelope;
- treat 15 types as viable with occasional rejection;
- treat 16 types as supported for research/content generation, but expect a meaningful reject rate under a 200k visited-state budget.

The current result does not justify lowering the encoding ceiling below 16. Offline generation can tolerate rejecting pathological candidates.

Existing 4..7 Type profile budgets have been reduced substantially because the older 60k..1.5M limits were inherited from the pre-packed solver and are no longer justified by measured state counts.
