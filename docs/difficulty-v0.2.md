# Difficulty Model v2 — mistake and recovery analysis

Date: 2026-09-22

## Purpose

Difficulty Model v2 supplements shortest-path metrics with player-facing decision risk.

Two puzzles with the same optimal move count can feel very different:

- one may have mostly forced or harmless choices;
- another may contain many plausible alternatives that require substantial recovery or lead to dead ends.

The analyzer therefore evaluates legal alternatives along an optimal path.

## Important rule: stored path != only optimal path

The audit catalog stores one proven `optimalSolution`, but a state may have multiple legal moves that all preserve the same optimal distance.

A move must never be labeled a mistake merely because it differs from the stored move.

For each analyzed state:

1. let `remainingOptimalMoves` be the number of moves left in the stored optimal solution;
2. enumerate legal next states with the same symmetry pruning used by the solver;
3. for every distinct legal next state, solve it optimally under an analysis budget;
4. compare `1 + nextOptimalMoves` with `remainingOptimalMoves`.

Classification:

```text
1 + nextOptimalMoves == remainingOptimalMoves
    -> optimal-alternative

1 + nextOptimalMoves > remainingOptimalMoves
    -> recoverable mistake

next state proven unsolvable
    -> dead end

analysis budget exceeded
    -> unknown
```

The stored optimal move is known to have zero penalty and does not need to be re-solved unless needed for a consistency test.

## Recovery penalty

For a recoverable mistake:

```text
recoveryPenalty =
  1 + nextOptimalMoves - remainingOptimalMoves
```

Example:

```text
current state optimal remaining distance = 18
alternate move leads to state with optimal distance = 23

penalty = 1 + 23 - 18 = 6
```

The move costs six extra moves relative to staying on an optimal route.

## Per-state analysis

Each analyzed optimal-path state records:

- optimal path index;
- remaining optimal moves;
- number of distinct legal next states;
- number of optimal alternatives;
- number of recoverable mistakes;
- number of dead ends;
- number of unknown alternatives;
- recovery penalties for known recoverable mistakes;
- maximum recovery penalty at the state.

States with one or zero distinct legal next states are effectively forced and need no alternate solve calls.

## Puzzle-level metrics

Initial v2 metrics:

- `analyzedStates`
- `decisionStates`
- `forcedStates`
- `totalAlternativeMoves`
- `optimalAlternativeMoves`
- `recoverableMistakes`
- `deadEndMoves`
- `unknownMoves`
- `deadEndRatioKnown`
- `averageRecoveryPenalty`
- `maxRecoveryPenalty`
- `highPenaltyMistakes` (initial threshold: penalty >= 4)

Unknown alternatives are excluded from ratios that claim exact known behavior.

The analyzer must report its unknown count explicitly so a difficulty classifier can reject or downgrade incomplete analysis.

## Solver budget

Mistake analysis can multiply solver cost because every decision state may require several alternate solves.

Initial design:

- analyze only distinct legal next states;
- skip re-solving the stored optimal next state;
- use one worker / sequential execution;
- use a per-alternative `maxVisitedStates` budget;
- return `unknown` instead of guessing when the budget is exceeded;
- cache distance-only results by exact solver-state identity where safe.

The analysis budget is separate from the production solve budget.

## Exactness and caching

For mistake classification, only the optimal remaining distance/status of a next state is needed. The full alternate solution path does not need to be stored.

A cache entry may therefore contain:

```text
solver-state key ->
  solved(distance)
  unsolvable
  unknown
```

The key must preserve abstract Type identity and ignore tube order exactly as the solver state key does.

Unknown results should not be promoted to exact results.

## Scope

This phase does not yet assign Easy / Medium / Hard thresholds.

The intended workflow is:

```text
candidate
-> exact minimum empty tubes
-> optimal solution
-> mistake/recovery analysis
-> structural metrics
-> research report
-> human calibration
-> difficulty thresholds
```

## Required tests

Tests must cover:

1. a forced state with no alternate solve calls;
2. multiple optimal next moves are not labeled mistakes;
3. a recoverable alternate move gets the exact positive penalty;
4. a proven-unsolvable alternate move is labeled dead end;
5. budget-exceeded alternate analysis remains unknown;
6. aggregate puzzle metrics exclude unknown alternatives from exact known ratios;
7. stored optimal move is consistent with zero penalty.
