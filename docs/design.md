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

For a given profile and deterministic source seed, each color appears exactly `capacity` times. Layers are shuffled and divided into full colored tubes. The same colored arrangement is tested with 1..N empty tubes.

Only solver-confirmed configurations that satisfy the selected difficulty profile can enter the catalog.

## Solver semantics

The solver has three outcomes:

- `solved`: a shortest path was found under the admissible segment heuristic;
- `unsolvable`: the reachable search space was exhausted;
- `budget-exceeded`: the configured state/depth budget was reached and the result is unknown.

A budget cutoff is deterministic and never interpreted as unsolvable.

## Difficulty

Current profile scoring uses:

- shortest solution length;
- decision ratio along the shortest path;
- empty-tube preference;
- solver explored-state count as a tie-breaker.

These are a starting point, not a complete model of human difficulty. Future work should add dead-end density, recovery cost after plausible mistakes, buried-color depth, and human playtest calibration.

## Data separation

The audit catalog is intentionally verbose and reproducible. It stores source seed, solution, canonical key, search metrics, path metrics, and every tested empty-tube configuration.

The runtime pack is intentionally small. It stores only stable ID, difficulty, capacity, board, and optional consumer-facing metadata.

The game client must not depend on audit fields.
