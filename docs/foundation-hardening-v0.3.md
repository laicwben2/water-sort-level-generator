# Foundation hardening v0.3

Date: 2026-10-01  
Status: active implementation plan  
Branch: `feat/foundation-hardening-v0.3`  
Base: `feat/generator-v0.2-foundation`

## Purpose

The current generator foundation is functionally strong: it already has deterministic balanced full-tube candidates, exact cross-puzzle canonicalization, packed solver state, minimum-empty analysis, optimal solutions, audit validation, Difficulty v2 research, and developer playtest tooling.

A separate independent design review reached the same core generation direction but exposed several lifecycle and trust-boundary weaknesses that become important once generated puzzles are reused across research batches and human playtests.

This phase therefore hardens the existing implementation rather than replacing it.

The following are explicitly **not** goals of v0.3:

- replacing the balanced full-tube shuffle generator;
- deleting the current optimized A* solver;
- inventing new Easy / Medium / Hard thresholds;
- adding a targeted generator;
- changing the consumer repository;
- merging this work into `main`.

## Authoritative development baseline

Until an explicit later decision changes it, the authoritative implementation baseline for generator engineering is:

`feat/foundation-hardening-v0.3`

which is derived from:

`feat/generator-v0.2-foundation`

Historical and research branches remain valid evidence, but they are not independent sources of truth for shared foundation behavior.

In particular:

- `feat/difficulty-v2` contains useful Difficulty v2 research history;
- `feat/seed-puzzle-bank-v0` contains the frozen seed-bank work;
- `vercel-playtest` is a deployment/playtest line;
- `main` remains unchanged.

Any future research work that depends on generator semantics must record the exact generator commit SHA and relevant version metadata.

## Responsibility boundaries

The intended lifecycle is:

```text
Candidate generation
  -> correctness / proof
  -> technical validity
  -> research descriptors
  -> candidate pool
  -> diversity / coverage selection
  -> human calibration
  -> release
```

The responsibilities are separated as follows:

- **Generator**: produces deterministic candidate arrangements.
- **Solver / proof engine**: establishes solvability, minimum empty tubes, and shortest solutions.
- **Validator**: independently checks exported facts and replays witnesses.
- **Research**: describes puzzle structure and player-decision characteristics.
- **Selection**: chooses a structurally useful subset from a candidate pool.
- **Human calibration**: maps observed player behavior to difficulty interpretation.

Difficulty labels must not define whether a structurally valid puzzle exists.

## Priority 0: decouple generation acceptance from difficulty

The current implementation still uses `DifficultyProfile` both as a candidate-generation profile and as an acceptance window through `minMoves` / `maxMoves`.

This couples two different concepts:

1. where a research sample came from;
2. what human difficulty the puzzle actually has.

The existing human playtest work already shows that source buckets are not reliable difficulty truth.

### v0.3 direction

Introduce an explicit distinction between:

- **generation profile / source bucket**: deterministic generation configuration;
- **difficulty label**: a later interpretation derived from calibrated evidence.

During the migration period, existing runtime and audit schemas may retain the legacy `difficulty` field for compatibility, but internal code and documentation must stop treating it as a validated human label.

Generation should eventually produce a technically valid candidate pool before difficulty classification.

## Priority 0: stable puzzle identity separate from provenance

The current level ID is derived from generation provenance such as batch seed, profile, difficulty bucket, capacity, and candidate index.

This guarantees reproducibility, but it means the same structural puzzle generated in two different runs can receive two different IDs.

That is increasingly undesirable because playtest observations, future analytics, deduplication, and release history should attach to the puzzle itself rather than to the process that rediscovered it.

### v0.3 identity model

Maintain two concepts:

```text
Puzzle identity
  -> what puzzle is this?

Generation provenance
  -> how was this puzzle found?
```

A stable puzzle identifier will be derived from the exact canonical puzzle identity together with the rules namespace and tube capacity.

Generation provenance remains separately recorded:

- generator version;
- RNG version;
- batch seed;
- source profile;
- candidate index;
- candidate seed;
- config fingerprint.

The legacy provenance-derived level ID must not be silently repurposed. Migration must be explicit and backward-compatible.

## Priority 1: reference proof cross-check

The current optimized A* solver is retained.

v0.3 adds a deliberately simple reference BFS for small state spaces and differential tests that compare:

- solved / unsolvable status where exhaustive search completes;
- shortest move count;
- legality of the returned witness.

The reference BFS is an oracle for correctness testing, not the production bulk-search engine.

This preserves current performance work while reducing the risk that optimization, heuristic, packing, or search-order bugs become self-validating.

## Priority 1: validator independence

The validator should not merely ask production components to confirm their own claims.

Existing reusable pure data definitions and serialization may remain shared. However, correctness-sensitive checks should avoid common-mode implementation where practical.

Planned hardening:

- solution replay through ordinary rules semantics rather than solver transitions;
- independent structural checks for candidate validity;
- reference-BFS differential tests for solver correctness;
- exact canonical key recomputation remains allowed, but future cross-release duplicate protection should also have an independent equivalence path.

## Priority 1: structural diversity selection

Exact canonical deduplication answers:

`Are these the same puzzle?`

It does not answer:

`Do these puzzles play too similarly?`

Uniform balanced shuffling naturally concentrates at high Type counts around highly fragmented boards. Production catalogs therefore should not simply accept the first N exact-unique candidates.

The intended future pipeline is:

```text
large valid candidate pool
  -> cheap structure descriptors
  -> coverage analysis
  -> deterministic diversity selection
  -> playtest / calibration
```

Initial descriptors to research include:

- total runs / normalized total runs;
- Type spread across tubes;
- initial distinct next-state count;
- minimum required empty tubes;
- optimal moves.

These are descriptive features, not difficulty weights.

No targeted generator is authorized until a uniform reference population demonstrates a persistent structural supply problem.

## Priority 1: cross-release puzzle registry

Batch-local canonical deduplication is not sufficient for long-term catalog production.

Before production-scale release work, introduce a registry that records already released puzzle identities so later packs cannot silently republish the same puzzle under a new provenance path.

The first implementation may be a versioned static artifact rather than a database.

Release identity must remain distinct from rejected candidate history.

## Priority 2: run ledger and yield reports

Generation research needs to explain why candidates disappear from the pipeline.

The desired run ledger records closed reason codes for outcomes such as:

- structural rejection;
- exact duplicate;
- minimum-empty unsolved / unknown;
- solver resource budget;
- source-bucket compatibility filter during migration;
- accepted technical candidate.

Yield reports must be derived from the ledger rather than maintained as a second source of truth.

## Compatibility strategy

v0.3 is an authoring-foundation hardening phase.

Compatibility rules:

1. do not modify `main`;
2. do not modify the consumer repository;
3. preserve existing runtime Level Pack format unless a separate migration decision is approved;
4. preserve existing audit artifacts as historical evidence;
5. do not reinterpret historical source-bucket `difficulty` values as calibrated labels;
6. any new puzzle identity is additive during migration rather than silently replacing old IDs.

## Implementation order

### H0 — documentation and contracts

- freeze this hardening plan;
- document authoritative development baseline;
- define source bucket vs calibrated difficulty terminology;
- define new puzzle identity vs provenance;
- document compatibility constraints.

### H1 — identity migration foundation

- add a stable puzzle-identity derivation API;
- retain legacy provenance-derived ID;
- expose both in audit data without changing runtime consumer format yet;
- add identity invariance tests.

### H2 — difficulty / generation decoupling

- stop describing profile buckets as validated difficulty;
- separate generation profile matching from later difficulty interpretation;
- preserve backward-compatible fields where needed;
- ensure research can operate on candidate pools without hard Easy/Medium/Hard acceptance semantics.

### H3 — reference BFS and differential tests

- add small-state reference BFS;
- compare exact shortest lengths and statuses against production A*;
- keep A* as production solver.

### H4 — validator hardening

- reduce common-mode structural validation;
- add independent rule-level checks where valuable;
- keep export replay verification.

### H5 — candidate-pool structure descriptors

- compute cheap structure descriptors;
- generate a uniform reference population;
- measure correlations and concentration before defining selection bins.

### H6 — diversity selection prototype

- deterministic candidate-pool selection;
- exact-duplicate protection remains separate;
- no human difficulty labels in structural distance.

### H7 — cross-release registry and release checks

- versioned released-puzzle registry;
- current-registry duplicate check before release;
- migration rules for existing seed-bank levels.

## Current implementation status

As of 2026-10-01 on this branch:

- **H0 documentation/contracts**: complete for the current migration scope.
- **H1 identity migration foundation**: implemented additively. New audit catalogs emit `puzzleId` and `puzzleIdentityVersion`; legacy provenance-derived `id` remains unchanged for runtime compatibility. Stable puzzle identity includes rules version, capacity, and exact canonical puzzle key.
- **H2 difficulty / generation decoupling**: migration foundation implemented. New catalogs emit immutable `sourceBucket`; internal profile terminology uses `GenerationBucketProfile` (with a deprecated compatibility alias for the old name); `technical-validity` acceptance can bypass the legacy move window while explicit technical rejection still removes already-solved boards. Solver proof depth is now an explicit `proofMaxDepth` resource budget rather than being computed from the legacy move window. Legacy mode remains the default.
- **H3 reference BFS**: implemented as a deliberately simple ordered-board BFS independent of packed solver state and production transitions. Differential tests compare it with the production A* solver on small exact spaces.
- **H4 validator hardening**: existing rule-level solution replay and color-conservation checks remain; stable identity, source-bucket provenance, and stored structure descriptors are now validated. An independent tube-matching / global-Type-bijection equivalence checker now exists without importing the canonicalizer, providing a second identity path for differential tests and future H7 release checks.
- **H5 structural descriptors**: initial cheap descriptors are implemented and stored in new audit puzzles: total runs, normalized runs, all-distinct tube count, Type spread mean/max, and initial distinct next-state count. They are research facts only, not difficulty scores.
- **Yield observability**: generator attempts can optionally emit closed reason-coded records and a derived Yield Report. This is opt-in and does not enlarge AuditCatalog by default.
- **H7 registry foundation**: the append-only released-puzzle registry contract and pure validation/query primitives are implemented. The registry retains release Boards, validates stable identity, keeps withdrawn identities reserved, and uses the independent equivalence checker as a second duplicate path. It is not yet wired into a release command or populated with historical levels.

Example research generation:

```bash
npm run generate -- \
  --profile=baseline \
  --count=10 \
  --acceptance=technical-validity \
  --yield-output=data/output/baseline-yield.json \
  --output=data/audit/baseline-candidates.json
```

No production coverage bins, distance weights, or targeted generator have been introduced.

A manual `Structure Reference Population` GitHub Actions workflow is available for reproducible larger runs. It uses `technical-validity`, validates the resulting audit catalog, emits a Yield Report, summarizes structure distributions/correlations, and uploads all three artifacts. It is intentionally manual so large research runs do not execute on every push.

## Exit criteria for v0.3 foundation hardening

v0.3 is complete when:

1. one authoritative development baseline is documented;
2. puzzle identity is distinct from generation provenance;
3. legacy source buckets are no longer treated as calibrated difficulty truth internally;
4. optimized solver correctness is cross-checked by an independent reference BFS on supported test spaces;
5. validator trust boundaries are documented and covered by regression tests;
6. candidate structural descriptors and a reference-population report exist;
7. diversity selection can operate on a candidate pool without using human labels;
8. cross-release duplicate protection has a defined data contract;
9. no consumer repository change or `main` merge was required.

## Decision rule

This phase prefers incremental hardening over rewrite.

Existing components are retained unless there is concrete evidence that their semantics are wrong. New machinery must earn its complexity by protecting identity, proof correctness, reproducibility, or long-term catalog quality.
