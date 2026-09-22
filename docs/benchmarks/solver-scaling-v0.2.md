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
