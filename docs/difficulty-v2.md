# Difficulty Model v2 research design

Date: 2026-09-22

## Goal

Difficulty Model v2 measures how much meaningful decision pressure a puzzle creates for a player.

The current shortest-path metrics remain useful but are insufficient on their own. Two puzzles can have the same optimal move count while differing greatly in how many plausible wrong choices exist, whether mistakes are recoverable, and how expensive recovery is.

v2 therefore adds mistake/recovery analysis while keeping all measurements solver-grounded.

## Non-goals

This phase does not immediately redefine Easy / Medium / Hard thresholds.

The first objective is to collect stable metrics from generated puzzles, then calibrate thresholds against human playtests and a fixed benchmark set.

## Analysis basis

The analyzer walks one proven optimal solution from the initial board.

At every state on that path:

1. enumerate legal moves using the same classic-v1 symmetry pruning as the solver;
2. identify the move used by the stored optimal solution;
3. treat every other distinct next state as an alternative;
4. solve the resulting alternative state with an explicit per-alternative budget;
5. classify the alternative result.

The alternative move itself counts as one move already spent.

Let:

- `R` = optimal moves remaining before the player chooses;
- `A` = shortest moves remaining after taking one alternative move.

If the alternative remains solvable, its recovery penalty is:

```text
recoveryPenalty = 1 + A - R
```

A value of 0 means the alternative is also optimal.
A positive value is the extra move cost relative to staying on the stored optimal path.

## Alternative outcomes

Each distinct alternative is classified as exactly one of:

### optimal-equivalent

The alternative is solvable and:

```text
1 + A == R
```

It belongs to another shortest solution and must not be counted as a player mistake.

### recoverable

The alternative is solvable but requires extra moves:

```text
1 + A > R
```

Store its exact recovery penalty.

### dead-end

The alternative state is proven unsolvable.

### unknown

The alternative solver hits its state/depth/resource budget.

Unknown is never treated as dead-end or recoverable.

## Metrics

Per puzzle:

- `analyzedStates`
- `decisionStates`
- `alternatives`
- `optimalEquivalentAlternatives`
- `recoverableAlternatives`
- `deadEndAlternatives`
- `unknownAlternatives`
- `analysisCoverage = knownAlternatives / alternatives`
- `alternativesPerAnalyzedState = alternatives / analyzedStates`
- `wrongMoveDensity = (recoverable + deadEnd) / knownAlternatives`
- `deadEndDensity = deadEnd / knownAlternatives`
- `deadEndRisk = deadEnd / knownWrongAlternatives`
- `averageRecoveryPenalty`
- `p50RecoveryPenalty`
- `p90RecoveryPenalty`
- `maxRecoveryPenalty`

Where a denominator is zero, the corresponding ratio is zero rather than NaN.

## Interpretation

These metrics are descriptive signals, not final difficulty labels.

Examples:

- high branching but many optimal-equivalent alternatives may feel easier than raw branching suggests;
- high `alternativesPerAnalyzedState` means the player sees more distinct legal deviations per analyzed state;
- high `wrongMoveDensity` means the player often faces legal choices that lose efficiency;
- high `deadEndDensity` means a larger fraction of all known alternatives immediately enter a proven unsolvable state;
- high `deadEndRisk` means that, among known wrong choices, a larger fraction are fatal rather than recoverable;
- high recovery penalties mean mistakes may stay hidden for a long time before their cost becomes apparent.

## Resource control

Mistake analysis can be much more expensive than solving the puzzle once because it runs additional solver searches.

Therefore it has a separate budget:

- `maxVisitedStatesPerAlternative`
- `maxDepthPerAlternative`
- optional maximum number of analyzed path states for research experiments

Analysis runs after a puzzle already has a proven optimal solution.

Budget-exceeded alternatives are recorded as unknown. The analyzer must never invent a difficulty result from incomplete proof.

## Storage

The verbose audit catalog may store the aggregate mistake/recovery metrics.

Per-alternative traces are research/debug artifacts and should not be shipped in the normal Runtime Level Pack.

The Runtime Level Pack continues to expose only gameplay data and selected consumer-facing metadata.

## Calibration plan

After the analyzer is stable:

1. run it over a broad deterministic research sample;
2. inspect distributions by type count and current profile;
3. select a fixed benchmark set;
4. human-playtest and label the benchmark set;
5. derive thresholds/weights from observed data;
6. only then update production difficulty classification.

## Required tests

Tests must cover:

- an alternative that is another optimal route;
- a recoverable alternative with a positive exact penalty;
- a proven dead-end alternative;
- budget-exceeded alternative recorded as unknown;
- ratios remain finite when there are zero alternatives or zero known wrong alternatives;
- stored optimal path is replayed legally during analysis.


## Initial research samples

Two deterministic exploratory batches were run before defining any Easy / Medium / Hard thresholds.

Shared configuration:

- profile: `expanded`;
- 5 accepted puzzles per difficulty;
- analyze the first 8 states on one stored optimal path;
- 10,000 visited-state budget per alternative;
- max alternative depth 120;
- deterministic but different batch seeds;
- 15 puzzles per batch, 30 total.

All analyzed alternatives in both batches completed exactly:

```text
analysisCoverage = 1.0
unknownAlternatives = 0
```

This indicates that a 10,000-state per-alternative budget is sufficient for the current 5/6/7-Type exploratory profile. It does not establish that the same budget is sufficient at larger Type counts.

Because every sampled puzzle still had at least one decision at each of the first eight analyzed states, `decisionStates` saturated at 8 and provided no discrimination in these runs. It should not be interpreted as evidence that the metric is generally useless; the fixed 8-state truncation caused a ceiling effect.

### Batch 1

Median / p90 observations:

| Metric | Easy | Medium | Hard |
|---|---:|---:|---:|
| alternatives/state p50 | 4.25 | 5.25 | 4.63 |
| alternatives/state p90 | 5.63 | 7.38 | 6.88 |
| wrong-move density p50 | 0.720 | 0.529 | 0.667 |
| wrong-move density p90 | 0.814 | 0.842 | 0.865 |
| dead-end density p50 | 0.000 | 0.017 | 0.055 |
| dead-end density p90 | 0.778 | 0.024 | 0.692 |
| max recovery penalty p90 | 1 | 2 | 2 |

Batch 1 showed substantial overlap and one important instability: Easy contained a high dead-end-density outlier. Therefore dead-end metrics cannot be treated as monotonic difficulty signals from this sample alone.

### Batch 2

Median / p90 observations:

| Metric | Easy | Medium | Hard |
|---|---:|---:|---:|
| alternatives/state p50 | 4.13 | 6.63 | 6.38 |
| alternatives/state p90 | 6.13 | 7.50 | 7.75 |
| wrong-move density p50 | 0.556 | 0.556 | 0.706 |
| wrong-move density p90 | 0.833 | 0.683 | 0.902 |
| dead-end density p50 | 0.000 | 0.000 | 0.039 |
| dead-end density p90 | 0.000 | 0.050 | 0.750 |
| max recovery penalty p90 | 1 | 1 | 2 |

Batch 2 showed a more intuitive shape:

- Easy had fewer alternatives per analyzed state than Medium / Hard;
- Hard had a higher median wrong-move density;
- Hard showed a larger dead-end-density tail;
- Hard showed recovery penalties above 1 while Easy did not.

However, the differences are not stable enough across both five-puzzle samples to justify classification thresholds.

## Current interpretation

The initial samples support treating the metrics as complementary signals rather than a single score.

Tentative hypotheses for future validation:

- `alternativesPerAnalyzedState` may help separate low-choice puzzles from higher-choice puzzles, especially Easy versus non-Easy;
- `wrongMoveDensity`, `deadEndDensity`, and recovery penalties may help distinguish harder puzzles when combined;
- `deadEndRisk` is more volatile than `deadEndDensity` because its denominator only includes known wrong alternatives;
- no single metric observed so far is reliably monotonic across Easy / Medium / Hard.

These are research hypotheses, not production rules.

No Easy / Medium / Hard thresholds should be set until a larger fixed benchmark set and human playtest labels are available.
