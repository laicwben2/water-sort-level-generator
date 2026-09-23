# Difficulty v2 fixed benchmark set v1

Date: 2026-09-23

## Purpose

This benchmark is a fixed, research-only set for human difficulty calibration.

It is not a production pack and does not define Easy / Medium / Hard thresholds.

The source pool is the 30-puzzle full-path research artifact generated from:

- profile: `expanded`;
- batch seed: `water-sort:difficulty-v2:research-3`;
- 10 accepted puzzles per current difficulty;
- full optimal-path mistake analysis;
- 10,000 visited states per alternative;
- max alternative depth 120;
- 100% analysis coverage;
- zero unknown alternatives.

## Selection goal

The benchmark intentionally avoids selecting only median puzzles or only the most extreme puzzles.

Four structurally different roles are selected inside each current source difficulty:

1. `branch-heavy`
   - maximize normalized `decisionStates + alternativesPerAnalyzedState`;
2. `trap-heavy`
   - maximize `deadEndDensity`, breaking ties with `wrongMoveDensity`;
3. `recovery-heavy`
   - maximize `maxRecoveryPenalty`, then `averageRecoveryPenalty`;
   - if the source difficulty has no recovery-penalty variation, use `low-pressure` instead by minimizing `decisionStates`, then `alternativesPerAnalyzedState`;
4. `representative`
   - from the remaining puzzles, minimize normalized distance from the source-difficulty medians across:
     - `decisionStates`;
     - `alternativesPerAnalyzedState`;
     - `wrongMoveDensity`;
     - `deadEndDensity`;
     - `maxRecoveryPenalty`.

Selections are distinct within each source difficulty.

This produces 12 puzzles total.

## Blinding

Human playtests should not show:

- source Easy / Medium / Hard;
- selection role;
- solver metrics;
- optimal move count.

Each puzzle instead receives a blind ID `B01` through `B12`.

Blind ordering is deterministic:

```text
sha256("difficulty-v2-benchmark-v1-order:" + levelId)
```

ascending.

The internal manifest keeps provenance and metrics for later analysis. A playtest surface should expose only the blind ID and board.

Committed artifacts:

- internal research manifest: `data/benchmarks/difficulty-v2-benchmark-v1.json`;
- blind playtest manifest: `data/benchmarks/difficulty-v2-benchmark-v1-blind.json`.

The blind manifest intentionally omits source difficulty, selection role, optimal moves, and all solver-derived metrics.

## Selected coverage

The set deliberately includes contrasting structures such as:

- high-decision / high-branching puzzles with low dead-end density;
- low-decision puzzles with high dead-end density;
- recovery-penalty outliers;
- central/representative puzzles.

This matters because the current research already shows that `wrongMoveDensity` and `deadEndDensity` are not monotonic across the current labels, while full-path `decisionStates` and branching pressure show a clearer aggregate gradient.

The benchmark is intended to test which of those solver-grounded signals align with actual player experience.

## Human calibration fields

For each blind puzzle, collect at minimum:

- perceived difficulty on a fixed ordinal scale;
- completion success/failure;
- elapsed solve time;
- player move count;
- number of resets/restarts;
- optional confidence / frustration rating.

Do not reveal the solver's current label or metrics before the rating is submitted.

## Interpretation rule

The human labels are evidence for calibration, not a mandate to preserve the current generator labels.

If human ratings disagree with current Easy / Medium / Hard buckets, the later classification model should be revised rather than forcing the ratings to fit the current thresholds.

No production threshold or weighting is introduced by benchmark v1.
