# Generator design

Date: 2026-10-01

> Active hardening plan: [Foundation hardening v0.3](foundation-hardening-v0.3.md).
> This document is the compact responsibility overview; the v0.3 document owns the migration sequence and compatibility constraints.

## Responsibilities

The authoring system owns all expensive or authoring-only work, but responsibility is intentionally split by stage:

- **Generator**: deterministic balanced candidate generation.
- **Solver / proof engine**: solvability, minimum-empty proof, and shortest-solution facts.
- **Validator**: independent replay and consistency checks.
- **Research**: structural, solver-grounded, and human-calibration descriptors.
- **Selection**: catalog coverage and diversity policy.
- **Export / release**: runtime artifacts and release-time identity checks.

The generator itself does **not** own human difficulty classification.

The authoring system does not own rendering, persistence, input handling, animation, player records, or platform-specific behavior.

## Candidate model

For a given generation profile and independently derived deterministic candidate seed, each abstract type appears exactly `capacity` times. Layers are shuffled and divided into full tubes. Empty-tube counts are tested sequentially.

A minimum empty-tube count is recorded only when every smaller tested count is proven unsolvable and the selected count is solved. `budget-exceeded` means unknown and never means unsolvable.

Generation profile / source bucket and calibrated human difficulty are separate concepts. Existing legacy `difficulty` fields may remain during compatibility migration, but they must not be treated as validated human labels.

## Solver semantics

The production solver has three outcomes:

- `solved`: a shortest path was found under the current exact-search contract;
- `unsolvable`: the reachable search space was exhausted;
- `budget-exceeded`: the configured state/depth budget was reached and the result is unknown.

A budget cutoff is deterministic and never interpreted as unsolvable.

The current optimized A* engine remains the production bulk solver. v0.3 adds an intentionally simple reference BFS for small-state differential verification rather than replacing A*.

## Identity

Puzzle identity and generation provenance are separate:

- **Puzzle identity** answers "what puzzle is this?" and is based on exact structural canonicalization plus the rules namespace and tube capacity.
- **Generation provenance** answers "how was this puzzle found?" and records generator/RNG versions, batch seed, source profile, candidate index/seed, and configuration fingerprint.

The existing provenance-derived level ID remains historical/compatibility data during migration. v0.3 introduces an additive stable puzzle identity rather than silently changing the meaning of existing IDs.

## Difficulty and research

Difficulty metrics are descriptive research signals until calibrated against human playtests.

Current research includes:

- shortest solution length;
- decision / choice metrics along an optimal path;
- mistake alternatives;
- recovery cost;
- dead-end exposure;
- solver search measurements.

These signals must not by themselves define technical candidate validity.

Future catalog construction should operate on a technically valid candidate pool and use separate structural-diversity selection before human difficulty labeling.

## Data separation

The audit catalog is intentionally verbose and reproducible. It stores generation provenance, version fingerprints, exact canonical identity, `optimalMoves`, `optimalSolution`, search metrics, path metrics, and tested empty-tube configurations.

The runtime pack is intentionally small. It stores only consumer-facing gameplay data and metadata. Full answers remain separate through the optional solution artifact.

The game client must not depend on authoring audit fields.

## Current development baseline

Foundation engineering continues on:

`feat/foundation-hardening-v0.3`

derived from:

`feat/generator-v0.2-foundation`

Research/history branches remain evidence sources, but shared foundation semantics should not evolve independently on multiple branches.

No v0.3 work implies a merge into `main` or a change to the consumer repository.
