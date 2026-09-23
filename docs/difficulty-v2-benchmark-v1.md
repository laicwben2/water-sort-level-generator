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


## Local blind playtest

Run:

```bash
npm run playtest:benchmark
```

Then open:

```text
http://127.0.0.1:4174
```

The playtest page:

- hides the board until Start is pressed;
- uses classic-v1 pour rules;
- records elapsed time, move count, and restarts;
- supports solved / gave-up outcomes;
- asks for confirmation before giving up;
- requires at least one structured give-up reason for gave-up outcomes;
- preserves full legal-move/restart history and the final board state;
- requires a 1–5 perceived-difficulty rating;
- optionally records confidence and frustration;
- exports the current session as `difficulty-v2-playtest-results.json`;
- reads only the blind benchmark manifest and does not expose source difficulty or solver metadata.


### Validate exported results

```bash
npm run validate:playtest -- --file=difficulty-v2-playtest-results.json
```

Validation checks:

- results format version;
- complete ordered action history for legal moves and restarts;
- move/restart counts against the action history;
- the final board state at solve/give-up time;
- benchmark identity;
- valid export timestamp;
- benchmark IDs against the blind manifest;
- duplicate benchmark IDs;
- solved / gave-up outcome values;
- non-negative integer elapsed time, moves, and restarts;
- 1–5 perceived-difficulty ratings;
- optional 1–5 confidence and frustration ratings.

Partial sessions are valid; a tester does not need to finish all 12 puzzles before exporting.

The JSON contract is documented in:

```text
spec/difficulty-v2-playtest-results-v2.schema.json
```

### Summarize exported results

```bash
npm run summarize:playtest -- \
  --input=difficulty-v2-playtest-results.json \
  --output=data/output/difficulty-v2-playtest-summary.json
```

The summary validates the source first, then reports:

- benchmark coverage;
- solved / gave-up counts and completion rate;
- elapsed-time distribution;
- move-count distribution;
- restart distribution;
- perceived-difficulty distribution;
- optional confidence / frustration distributions;
- aggregate give-up reason counts;
- per-puzzle give-up reasons / optional free-text note;
- normalized per-puzzle records.

This summary is descriptive only. It does not derive or change production Easy / Medium / Hard thresholds.


### Correlate human ratings with solver metrics

After collecting a real playtest export:

```bash
npm run correlate:playtest -- \
  --input=difficulty-v2-playtest-results.json \
  --benchmark=data/benchmarks/difficulty-v2-benchmark-v1.json \
  --output=data/output/difficulty-v2-playtest-correlation.json
```

The correlation report joins blind playtest IDs back to the internal benchmark manifest only after ratings have been collected.

It currently computes Spearman rank correlation between perceived difficulty and:

- optimal move count;
- full-path decision states;
- alternatives per analyzed state;
- wrong-move density;
- dead-end density;
- maximum recovery penalty.

Spearman correlation is used because perceived difficulty is an ordinal 1–5 rating. Ties use average ranks. A correlation is reported as `null` when fewer than two samples are available or either variable has no rank variance.

These correlations are descriptive research signals. They do not produce a difficulty score, fit weights, define thresholds, or prove causality. The first version analyzes one exported playtest session at a time; multi-tester aggregation is a later step.

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
