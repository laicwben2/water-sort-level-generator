# Uniform reference population pilot — 2026-10-01

Status: approved research run  
Branch: `feat/foundation-hardening-v0.3`

## Purpose

Measure the actual structural distribution of technically valid puzzles produced by the current balanced full-tube uniform generator after the real proof/acceptance pipeline.

This is not a difficulty-calibration experiment and does not define production Selection bins.

## Fixed experiment

Generation profile:

`baseline`

This yields the existing source buckets:

- `easy` source bucket: 4 Types;
- `medium` source bucket: 5 Types;
- `hard` source bucket: 6 Types.

The bucket names are generation provenance only for this experiment. They are not interpreted as human difficulty.

Acceptance mode:

`technical-validity`

Per independent seed:

- 1000 accepted 4-Type puzzles;
- 1000 accepted 5-Type puzzles;
- 1000 accepted 6-Type puzzles.

Three independent deterministic seeds:

- `structure-reference-2026-10-01-a`
- `structure-reference-2026-10-01-b`
- `structure-reference-2026-10-01-c`

Total target:

`9000 accepted puzzles`

Maximum attempts per source bucket:

`100000`

No proof/resource budget may be weakened merely to reach the requested accepted count. If a run cannot finish under the current contract, the partial/failure result is evidence and must be reported as such.

## Outputs per seed

Each run must retain:

1. full technical-validity audit candidate catalog;
2. generation Yield Report;
3. structure population summary/correlation report.

The pilot analysis must compare:

- acceptance yield;
- proof-budget / max-empty failure rate;
- already-solved rejection rate;
- exact canonical duplicate rate;
- minimum-empty distribution;
- optimal-move distribution;
- structural descriptor distributions;
- descriptor correlations;
- seed-to-seed stability.

## Structural descriptors in scope

The current v0.3 descriptors are:

- `totalRuns`;
- `normalizedTotalRuns`;
- `allDistinctTubeCount`;
- `typeSpreadMean`;
- `typeSpreadMax`;
- `initialDistinctNextStates`.

These remain descriptive variables only.

No descriptor is interpreted as Easy/Medium/Hard.

## Decision gate after the pilot

Do not implement production coverage bins, FPS distance weights, or targeted generation merely because this pilot completes.

After all three runs:

1. compare source-bucket descriptor distributions across seeds;
2. calculate seed-to-seed drift;
3. identify highly correlated / redundant descriptors;
4. identify stable sparse or concentrated regions;
5. decide whether the current descriptor set is sufficient for a larger formal reference population.

Only then decide whether to freeze a `coverageSpaceVersion=1`.

## Reproducibility

Each result is tied to:

- exact branch commit SHA;
- generator / RNG / canonical / solver-state versions;
- `technical-validity` acceptance mode;
- exact seed;
- profile;
- accepted count;
- current proof budgets.

Any code or contract change after this pilot creates a different reference population and must not be silently pooled with these results.
