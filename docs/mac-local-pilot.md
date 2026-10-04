# Mac local pilot — 2026-10-04

## Environment and provenance

- Repository: https://github.com/laicwben2/water-sort-level-generator.git
- Base: `feat/difficulty-v2`, `46ffd3eee9c7c9d958e4b2b648c8bd5646621ddc`.
- Review branch: `feat/local-deterministic-shards-v1`; implementation commit: `1c6418ebdf41f8d410fb1890821badceca94960e`.
- macOS 26.6 (25G72), native ARM64; Node 24.19.0, npm 11.17.0.
- Official Mac Node archive SHA-256: `8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d`.
- The initial pilot was run before committing: manifest correctly records base HEAD and dirty working tree. Git/timestamps/OS never enter the deterministic artifact.

## Quality gates

`npm ci` succeeded with the existing lockfile (no dependency upgrades). `npm test`: 68 tests in 9 files passed. `npm run build`: passed. Dedicated tests retain old audit-v2 metric compatibility and unchanged Runtime Pack v1 / Solution Artifact v1 exports. CLI scripts use `node --import tsx`, avoiding a restricted-workspace IPC listener.

## Pilot

- Seed: `mac-local-pilot-v1`.
- Inclusive range: 0–99; processed: 100 identities.
- Configuration: ordered colors 5,6,7; capacity 4; maximum empty tubes 5; proof depth 100 / state budget 100000; mistake analysis 25000 states / depth 100 / 20 steps / 6 alternatives per selected step / severe recovery penalty 5.
- Unique accepted: 100 (100%); quality rejected: 0; duplicates: 0; correctness UNKNOWN: 0.
- Research incomplete: 61/100; UNKNOWN alternatives: 0. Incompleteness comes from deterministic step/alternative sampling, not incorrect solvability.
- Initial elapsed (generation + raw analysis + validation, excluding file writes): 31.116 seconds.
- Same-range repeat: 33.927 seconds.
- Deterministic shard: 1413153 bytes (1.348 MiB); manifest: 9394 bytes.
- Process reported maxRSS: 173.62 MiB; RSS at resource snapshot: 173.69 MiB; heap used: 70.55 MiB. These snapshots are sampled before serialization/writing and do not prove a large-run memory bound.
- Process CPU: 9.110 seconds user + 0.603 seconds system; wall time differs substantially, so machine load affects extrapolation.

Published artifacts are available in [`data/pilots/mac-local-pilot-v1`](../data/pilots/mac-local-pilot-v1/README.md), including all generated puzzles, original manifests, verification artifacts and `environment.json`. The original local output paths below remain ignored by Git:

- `output/mac-local-pilot/shard-000000-000099.json`
- `output/mac-local-pilot/shard-000000-000099.run.json`
- `output/mac-local-pilot/repeat-000000-000099.json` and `.run.json`
- `output/mac-local-pilot/shard-000000-000049.json` and `.run.json`
- `output/mac-local-pilot/shard-000050-000099.json` and `.run.json`
- `output/mac-local-pilot/merged.json`
- `output/mac-local-pilot/pilot-summary.json`

## Raw metric distributions

All 100 unique accepted puzzles are included. Trap/recovery values refer only to analyzed alternatives. They are not final human calibration.

| Axis / raw metric | Min | Mean | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| workload / optimalMoves | 12 | 18.170 | 18 | 23 | 24 |
| workload / movesIntoEmptyTube | 1 | 2.170 | 2 | 3 | 4 |
| workload / totalAlternativeMoves | 7 | 57.150 | 59 | 103 | 122 |
| trap / wrongMoveCount | 3 | 30.530 | 30 | 57 | 74 |
| trap / deadEndCount | 0 | 1.390 | 0 | 5 | 26 |
| trap / knownAlternativeCount | 7 | 51.060 | 54 | 81 | 92 |
| trap / unknownCount | 0 | 0.000 | 0 | 0 | 0 |
| trap / knownCoverage | 0.7941176470588235 | 0.948 | 0.9714285714285714 | 1 | 1 |
| recovery / recoveryPenaltyTotal | 2 | 29.410 | 30 | 54 | 74 |
| recovery / recoverableMistakeCount | 2 | 29.140 | 30 | 53 | 74 |
| recovery / maximumRecoveryPenalty | 1 | 1.100 | 1 | 2 | 3 |
| recovery / severeRecoveryCount | 0 | 0.000 | 0 | 0 | 0 |

Alternative accounting: eligible 5504; analyzed/known 5106; skipped alternatives 398; known wrong moves 3053 = recoverable mistakes 2914 + proven dead ends 139. Recovery penalty total 2941 extra moves; severe-recovery events at >=5 extra moves: 0.

Pooled wrong-move density = 3053/5106 (59.79%); dead-end density = 139/5106 (2.72%); dead-end risk among known mistakes = 139/3053 (4.55%). These use different denominators and must not be conflated. Pooled known coverage = 5106/5504 (92.77%) within eligible alternatives at selected steps; skipped path steps are recorded separately. Mean per-puzzle known coverage is 94.79%.

## Performance estimates

Candidate timing (including local loop/callback overhead): min 0.915 ms, median 101.121 ms, p95 1544.133 ms, max 3127.390 ms. Candidate cost varies substantially.

| Candidates | Linear estimate from two 100-candidate runs |
| ---: | --- |
| 1000 | about 5.2–5.7 minutes |
| 10000 | about 52–57 minutes |
| 100000 | about 8.6–9.4 hours |

These are rough wall-time extrapolations for the same type mix/budgets. A 100-sample pilot cannot characterize rare expensive candidates, future machine contention, thermal effects, GC, duplicate rates or resident-memory growth. Generation retains all candidate records and merge reads complete shards; JSON size/serialization and memory do not have a demonstrated constant bound. Use small ranges and benchmark before any large run. No 1000-candidate or larger batch was executed.

## Determinism and merge verification

SHA-256 logical digest: `a5e20616055ca3ad026bbe2a71fee3cf359438c65aadb33be02c7d0d8a8ca974`. Same-range rerun matches all 100 candidate results and the full deterministic payload. Candidate 50 was also generated alone with the production pilot config and exactly matches the full-range record. A separate one-step/one-state reanalysis smoke check produced UNKNOWN alternatives with no falsely labeled dead ends, referenced the source digest, and left the generation shard intact. Unit tests additionally prove candidate 50 independence, split merge equivalence, byte repeat, compatible merge, exact duplicate handling, mismatch/overlap failures, incomplete-analysis semantics and resource/depth/empty-bound UNKNOWN behavior. Run manifests are deliberately different and excluded from merging.

Native pilot split 0–49 + 50–99 is merged in reversed input order, then compared against the full shard. Exact canonical identity is validated; merge does not rerun a solver. All three deterministic files (full, repeat, merged) are byte-identical. Split shards took 9.860 + 11.618 seconds before merge; this differs from full-run wall time and further illustrates timing variance. Operational manifests differ, as expected.

## Remaining risks and next step

Windows certification has not been performed. The fixed native certification command and comparator are ready; run both machines on the same clean implementation commit, exact runtime/lockfile/config, seed `cross-platform-cert-v1`, range 0–999, requiring 1000/1000 matching logical results. Native optional tooling binaries differ by platform, so actual comparison is still required.

The default research analysis is sampled for 61 puzzles. Increase research budgets in a separate reanalysis artifact if coverage is needed; never call skipped/unknown alternatives safe or dead ends. Use population distributions and more human data before selecting final thresholds. Existing consumer exports require explicit classification/selection into historical audit-v2 metadata; shards intentionally contain no final difficulty labels.

Verify this Documents workspace is outside iCloud synchronization or copy the clean checkout to a local SSD folder before long production runs. Keep Mac awake with `caffeinate`; benchmark larger ranges gradually rather than launching 100000 candidates.
