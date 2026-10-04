# Generator design

Date: 2026-09-22

## Responsibilities

The generator owns all expensive or authoring-only work:

- balanced candidate generation;
- solving and proof of solvability;
- empty-tube experiments;
- difficulty metrics and profile selection;
- cross-puzzle canonical deduplication;
- audit validation;
- runtime-pack export.

It does not own rendering, persistence, input handling, animation, player records, or platform-specific behavior.

## Candidate model

For a given profile and independently derived deterministic candidate seed, each abstract type appears exactly `capacity` times. Layers are shuffled and divided into full tubes. Empty-tube counts are tested sequentially from 1 upward.

A minimum empty-tube count is recorded only when every smaller count is proven unsolvable and the selected count is solved. `budget-exceeded` means unknown and rejects the candidate from production-quality output.

## Solver semantics

The solver has three outcomes:

- `solved`: a shortest path was found under the admissible segment heuristic;
- `unsolvable`: the reachable search space was exhausted;
- `budget-exceeded`: the configured state/depth budget was reached and the result is unknown.

A budget cutoff is deterministic and never interpreted as unsolvable.

## Difficulty

The historical accepted-count generator filters by profile minimum/maximum optimal moves. These profile windows remain legacy metadata, not a calibrated measure of human difficulty.

The local range workflow does not use those windows or assign difficulty classes. It preserves independently indexed candidates and correctness proofs, then collects workload, trap-risk and recovery-cost raw metrics. Exact duplicate projection is separate from intrinsic candidate outcomes. Selection and human calibration can reinterpret saved audit data without regenerating or re-proving puzzles. See [local generation](local-generation.md) and [difficulty research](difficulty-v2.md).

## Data separation

The audit catalog is intentionally verbose and reproducible. It stores batch/candidate seed metadata, version fingerprints, the exact canonical key, `optimalMoves`, `optimalSolution`, search metrics, path metrics, and every tested empty-tube configuration.

The runtime pack is intentionally small. It stores only stable ID, difficulty, capacity, board, and consumer-facing metadata such as `optimalMoves`. Full answers are exported separately through the optional solution artifact.

The game client must not depend on audit fields.
