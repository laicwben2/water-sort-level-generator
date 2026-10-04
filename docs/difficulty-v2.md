# Difficulty Model v2 design

Date: 2026-09-22

## Goal

Difficulty Model v2 separates three concepts that were previously mixed together:

1. structural complexity of the starting board;
2. decision complexity along an optimal solution;
3. consequence of plausible non-optimal moves.

The model is for research and catalog classification. It must not claim human difficulty from solver cost alone.

## Non-goals

This phase does not:

- finalize Easy/Medium/Hard thresholds;
- assign permanent scalar scores by hand-tuned weights;
- treat solver explored-state count as human difficulty;
- require every high-Type puzzle to have exhaustive mistake analysis.

Human calibration comes after metrics are collected.

## Structural metrics

These metrics are cheap and deterministic.

### Type fragmentation

For each Type:

- `tubeSpread`: number of non-empty tubes containing the Type;
- `segmentCount`: number of contiguous runs of the Type across all tubes.

Aggregate:

- average Type tube spread;
- maximum Type tube spread;
- total segment count;
- fragmentation excess = total segments - Type count.

A solved board has one segment per Type.

### Segment blocking depth

Measure contiguous Type segments rather than individual cells.

For each segment in a non-completed tube, count how many cells are above the top of that segment. This is the number of cells that must be removed before that segment can become directly accessible.

Aggregate:

- average segment blocking depth;
- maximum segment blocking depth.

Cell-level depth is intentionally not used because fully occupied capacity-4 starting tubes would make the average almost constant regardless of puzzle structure.

### Mixed-tube structure

Record:

- mixed tube count;
- monochrome full tube count;
- initial empty tube count;
- initial segment count.

## Optimal-path metrics

Existing path metrics remain:

- optimal move count;
- decision steps;
- forced steps;
- average legal choices;
- maximum legal choices;
- total alternative legal moves.

Add:

- moves into an empty tube;
- moves joining an existing same-Type stack;
- staging ratio = empty-target moves / optimal moves.

These describe the shape of one optimal path. Multiple optimal paths may exist.

## Mistake / recovery analysis

At selected states along an optimal solution:

1. enumerate legal moves under classic-v1;
2. compute the exact successor state of the stored optimal move;
3. exclude moves whose successor state is equivalent to that same optimal successor;
4. for each remaining alternative successor, run the optimal solver under an explicit analysis budget;
5. classify the alternative.

For a state with optimal remaining distance `R` before any move:

- if alternative successor is solved in `d` moves:
  - alternative total distance = `1 + d`;
  - recovery penalty = `1 + d - R`;
  - penalty 0 means the move is another optimal move, not a mistake;
  - penalty > 0 means recoverable suboptimal move;
- if the alternative successor is proven unsolvable:
  - classify as dead end;
- if analysis hits budget/depth:
  - classify as unknown.

Unknown is never treated as dead end.

## Aggregate mistake metrics

Across analyzed alternatives:

- alternative count;
- optimal-alternative count;
- recoverable-mistake count;
- dead-end count;
- unknown count;
- known-analysis coverage;
- dead-end ratio among known non-optimal alternatives;
- average recovery penalty;
- maximum recovery penalty;
- severe-recovery count (configurable threshold, initially >= 5 extra moves).

Difficulty classification must not use dead-end/recovery ratios without also checking coverage.

## Analysis budget

Mistake analysis can multiply solver cost dramatically.

Defaults for v0.2 research:

- one puzzle at a time;
- `maxVisitedStatesPerAlternative = 25,000`;
- `maxAnalyzedSteps = 20`;
- `maxAlternativesPerStep = 6`;
- deterministic step selection when an optimal solution is longer than the step budget.

The analyzer records how many steps and alternatives were skipped.

A high-Type puzzle with low coverage is not assigned a confident mistake-based difficulty classification.

## Step sampling

If `optimalMoves <= maxAnalyzedSteps`, analyze every optimal state.

Otherwise choose deterministic approximately-even indices including:

- the start;
- early game;
- middle game;
- late game.

Sampling must not use random values.

## Caching

Alternative solves within one puzzle may revisit equivalent states.

Cache analysis results by solver-state identity for the duration of one puzzle analysis.

Cache scope is one puzzle because Type identity is stable within that puzzle and solver budgets are fixed for one analyzer invocation.

## Audit data

Audit Puzzle gains a `difficultyV2` section with:

- structural metrics;
- optimal-path metrics;
- mistake/recovery metrics;
- analyzer configuration;
- coverage.

Runtime Level Pack does not need these fields.

## Correctness requirements

Tests must verify:

- structural metrics are invariant under Type renaming and tube reordering;
- staging/join metrics replay the stored optimal solution correctly;
- an alternative optimal move gets penalty 0;
- a recoverable mistake gets positive penalty;
- a proven dead end is not confused with budget-exceeded;
- unknown alternatives reduce coverage;
- sampled step selection is deterministic.

## Research workflow

1. generate a deterministic research catalog;
2. compute Difficulty v2 metrics;
3. export aggregate distributions;
4. manually play a benchmark subset;
5. label human-perceived difficulty;
6. fit/choose thresholds from the observed relationship.

No final Easy/Medium/Hard weighting is hard-coded in this phase.

## Local research standard (2026-10-04)

Supplied blind human playtest observations: 59 results, 9 anonymous sessions, 97% solved. These are exploratory evidence, not final calibration; this repository does not alter the underlying human records.

| Aggregate relationship | Spearman rho |
| --- | ---: |
| Mean subjective difficulty / source Easy–Medium–Hard | -0.178 |
| Mean subjective difficulty / optimal moves | -0.183 |
| Mean subjective difficulty / wrong-move density | 0.754 |
| Mean subjective difficulty / dead-end density | 0.753 |
| Mean subjective difficulty / dead-end risk | 0.733 |
| Mean subjective difficulty / solver average branching | -0.709 |
| Completer median elapsed / optimal moves | 0.524 |
| Completer median moves / optimal moves | 0.563 |
| Mean retries/restarts / dead-end density | 0.844 |

Keep three research axes: **workload**, **trap risk**, and **recovery cost**. Optimal moves describe workload, not human difficulty. Preserve counts, penalty sums, ratio denominators, sampled/skipped steps and unknown alternatives. Wrong-move count is recoverable mistakes plus proven dead ends; known-alternative count excludes UNKNOWN. Report ratios with their denominators/coverage, never silently treating skipped or unknown alternatives as safe or as dead ends. Path-based alternatives are a bounded proxy for plausible player behavior, not a proven cognitive model.

New local shards omit difficulty labels and move-window selection. Keep generation/proof and research selection separate. Reinterpret raw metrics without solving; use a separate reanalysis artifact if changing alternative budgets. Population-based stratification and additional human data must precede final thresholds. No scalar weighting formula or final Easy/Medium/Hard thresholds are introduced.
