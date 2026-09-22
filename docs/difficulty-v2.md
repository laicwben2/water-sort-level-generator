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
- `wrongMoveDensity = (recoverable + deadEnd) / knownAlternatives`
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
- high wrongMoveDensity means the player often faces legal choices that lose efficiency;
- high deadEndRisk means mistakes can destroy solvability;
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
