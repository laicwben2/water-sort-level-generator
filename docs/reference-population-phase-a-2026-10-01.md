# Formal reference population Phase A — 2026-10-01

Status: approved execution plan  
Catalog format: `research-candidates-v1`  
Generator family: `uniform-v1`  
Proof budget: `research-proof-200k-d200-e5-v1`

## Purpose

Build the first statistically useful, fully auditable explicit-Type-count reference population across the complete T=4..16 research range.

Phase A is intended to:

- measure stable structural distributions;
- measure seed-to-seed variation;
- measure exact-minimum-empty prevalence;
- measure proof-budget rejection rates;
- test whether proof-budget rejection changes the observed structural population;
- screen descriptor redundancy before defining any production coverage space.

Phase A does not define human difficulty and does not authorize targeted generation.

## Sampling design

Type-count strata:

`T = 4..16`

Independent deterministic seeds:

- `reference-phase-a-2026-10-01-a-t<T>`
- `reference-phase-a-2026-10-01-b-t<T>`
- `reference-phase-a-2026-10-01-c-t<T>`

Per (T, seed):

- requested accepted candidates: 500;
- max candidate attempts: 2,000;
- capacity: 4;
- fixed proof budget: 200k visited / depth 200 / maxEmpty 5.

Total requested accepted population:

`13 Type counts x 3 seeds x 500 = 19,500 puzzles`

The candidate stream is independent for every (T, seed).

## Why 500 x 3 before a larger run

The previous smoke showed:

- zero proof UNKNOWN for T4..15 in 20 accepted candidates per T;
- a non-zero T16 budget tail: 3 UNKNOWN among 23 attempts;
- no evidence that a larger uniform sample must be generated equally in every eventual (T, k*) cell.

Three independent samples of 500 accepted candidates per T provide:

- 1,500 accepted observations per Type count;
- enough T16 UNKNOWN attempts to compare accepted vs rejected pre-proof structure if the smoke rate persists;
- materially better estimates of descriptor distributions than the 20-puzzle smoke;
- a direct seed-stability check.

Phase A therefore precedes any decision to expand to 10,000+ observations in selected cells.

## Required artifacts per (T, seed)

Every matrix cell must retain:

1. `research-candidates-v1` accepted catalog;
2. `research-yield-v1` artifact with attempt-level observations;
3. research structure summary.

The Yield artifact must include:

- batch seed;
- config fingerprint;
- proof-budget version;
- aggregate reason-code counts;
- all attempt records;
- `preProofStructure` for each attempt;
- final proof empty-tube count / metrics for UNKNOWN attempts when available.

## Analysis plan

### Yield and proof

For each T and seed report:

- attempts;
- accepted;
- canonical duplicate rejects;
- starts-solved rejects;
- max-empty exhaustion;
- budget UNKNOWN;
- acceptance ratio.

For budget UNKNOWN:

- last tested empty-tube count;
- final visited / explored states.

### Minimum-empty distribution

Report exact accepted counts for:

- k=1;
- k=2;
- k>=3.

Never infer a minimum for rejected UNKNOWN candidates.

### Structural distributions

Analyze at least:

- totalRuns;
- normalizedTotalRuns;
- allDistinctTubeCount;
- typeSpreadMean;
- typeSpreadMax;
- topDistinctTypeCount.

`initialDistinctNextStates` remains recorded for diagnostics but is not a primary axis candidate.

### Seed stability

For each T:

- compare means and quantiles across three seeds;
- pairwise KS statistics for candidate descriptors;
- compare min-empty proportions;
- compare UNKNOWN proportions.

### Proof-budget selection bias

At T values with meaningful UNKNOWN counts, compare pre-proof descriptor distributions:

```text
accepted attempts
vs
MINIMUM_EMPTY_BUDGET_EXCEEDED attempts
```

The objective is to determine whether the fixed proof budget preferentially removes a structural region.

If rejection is structurally non-random, the accepted reference population must be described explicitly as a solver-budget-conditioned population.

## Descriptor gate

After Phase A, classify candidate descriptors as:

- retain as primary coverage candidate;
- retain as secondary/diagnostic;
- drop as redundant/degenerate;
- needs more evidence.

Do not assign weights yet.

## Expansion gate

After Phase A, decide whether more data are required by:

- Type count;
- minimum-empty cell;
- sparse structural region;
- proof-budget tail.

Additional samples should be targeted to unanswered statistical questions, not allocated uniformly by default.

## Prohibited interpretation

Phase A must not be used to:

- set Easy / Medium / Hard thresholds;
- claim a descriptor is human difficulty;
- set a production Type-count ceiling;
- authorize a targeted generator solely because a region is rare;
- rescue UNKNOWN candidates by raising the proof budget.

## Completion gate

Phase A passes when:

1. all 39 requested matrix cells either complete under the fixed contract or produce an explicitly documented failure;
2. catalogs validate;
3. Yield artifacts link to their catalog config fingerprints;
4. seed stability is quantified;
5. T16 proof-budget conditioning is quantified if enough UNKNOWN observations exist;
6. the descriptor screening decision is documented.

`coverageSpaceVersion=1` remains unfrozen until the Phase A results are reviewed.
