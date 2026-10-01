# Neutral Type-count research generation v0.3

Date: 2026-10-01  
Status: implementation contract  
Motivation: uniform reference population pilot result

## Problem

The legacy generator selects Type count through historical Easy / Medium / Hard source buckets.

That is acceptable for reproducing existing catalogs, but it is the wrong abstraction for structural population research:

- Type count is an explicit experimental variable;
- source bucket names are legacy provenance, not human difficulty truth;
- formal T=4..16 research must not require assigning a fake difficulty label.

The legacy path remains supported and reproducible.

## New research path

Add a separate research candidate catalog:

`research-candidates-v1`

A research run explicitly specifies:

- generator family: `uniform-v1`;
- Type count;
- capacity;
- target accepted count;
- batch seed;
- proof resource budget.

Example conceptual CLI:

```bash
npm run generate:research -- \
  --types=8 \
  --count=1000 \
  --seed=reference-t8-a \
  --output=data/audit/reference-t8-a.json \
  --yield-output=data/output/reference-t8-a-yield.json
```

No Easy / Medium / Hard value is required.

## Identity and provenance

Research candidate identity:

```text
puzzleId = f(rulesVersion, capacity, canonical puzzle identity)
```

Research provenance includes:

- generator family;
- Type count;
- research stratum ID;
- candidate index;
- candidate seed;
- batch seed;
- generator/RNG/canonical/encoding/solver-state versions;
- proof budget version;
- config fingerprint.

The research stratum ID for v1 is deterministic:

`types-<T>`

For example:

`types-8`

Changing Type count therefore changes provenance directly rather than indirectly through a legacy difficulty bucket.

## Candidate RNG

Legacy `deriveCandidateSeed()` remains unchanged.

The research path uses a separate derivation namespace:

```text
deriveResearchCandidateSeed(
  batchSeed,
  generatorFamily,
  stratumId,
  candidateIndex
)
```

Candidate independence remains mandatory:

Candidate N must not depend on RNG consumption by Candidate N-1.

## Proof budget

Initial neutral research proof budget:

- `maxVisitedStates = 200000`;
- `maxDepth = 200`;
- `maxEmptyTubes = 5`;
- capacity = 4 by default.

Version:

`research-proof-200k-d200-e5-v1`

This budget is grounded in the existing v0.2 solver-scaling benchmark:

- T6..16 has been cross-checked at 200k visited states / depth 200;
- 14 Types is comfortably inside the present solver envelope;
- 15..16 Types can produce budget-exceeded candidates;
- those UNKNOWN candidates must be rejected and counted, not rescued by silently increasing the budget.

This budget is a research execution policy, not a mathematical property of the puzzle.

Changing it creates a different reference population and requires a new proof-budget version.

## Technical acceptance

A research candidate is accepted only if:

1. balanced full-tube generation succeeds;
2. minimum-empty analysis is exact under the configured resource budget;
3. the resulting initial board is not already solved;
4. exact canonical identity is unique within the run;
5. one optimal solution is retained;
6. structural descriptors are computed.

No move-count window or human difficulty label participates in acceptance.

Solver outcomes remain:

- `solved`;
- `unsolvable`;
- `budget-exceeded` = UNKNOWN.

## Research catalog schema

Conceptual shape:

```json
{
  "version": "research-candidates-v1",
  "generatorFamily": "uniform-v1",
  "stratum": {
    "id": "types-8",
    "typeCount": 8
  },
  "generation": {
    "capacity": 4,
    "requestedAcceptedCount": 1000,
    "maxAttempts": 10000,
    "proofBudget": {
      "version": "research-proof-200k-d200-e5-v1",
      "maxVisitedStates": 200000,
      "maxDepth": 200,
      "maxEmptyTubes": 5
    }
  },
  "reproducibility": {
    "generatorVersion": "...",
    "rngVersion": "...",
    "canonicalVersion": "...",
    "encodingVersion": "...",
    "solverStateEncodingVersion": "...",
    "puzzleIdentityVersion": "...",
    "proofBudgetVersion": "research-proof-200k-d200-e5-v1",
    "batchSeed": "...",
    "configFingerprint": "..."
  },
  "puzzles": []
}
```

Each puzzle stores:

- `puzzleId`;
- candidate index / seed;
- capacity;
- empty tube count;
- exact minimum required empty tubes;
- Board;
- canonical key;
- optimal solution;
- solver metrics;
- solution-path metrics;
- structural descriptors;
- per-k empty-tube proof records.

It does not require:

- legacy provenance-derived runtime `id`;
- Easy / Medium / Hard;
- runtime exportability.


### Run configuration and fingerprint contract

The catalog must be self-describing enough to reproduce both the candidate stream and the stopping policy.

The `generation` block is mandatory and records:

- capacity;
- requested accepted count;
- maximum candidate attempts;
- proof-budget version;
- explicit proof-budget values.

The validator must recompute `configFingerprint` from the stored run configuration and reject a mismatch.

The fingerprint input for `research-candidates-v1` is exactly:

```text
catalog version
generator family
stratum id
Type count
capacity
requested accepted count
max attempts
proof-budget version
max visited states
max depth
max empty tubes
```

Fields such as output path, Yield Report path, wall-clock timestamps, and CLI formatting are not generation semantics and do not enter this fingerprint.

The catalog must also satisfy:

- `puzzles.length === requestedAcceptedCount`;
- every candidate index is lower than `maxAttempts`;
- every puzzle capacity equals `generation.capacity`;
- the explicit proof-budget values match the declared proof-budget version.

This prevents a fingerprint from becoming an opaque checksum that cannot be independently audited.

## Structural descriptors

The pilot result changes the proposed descriptor priorities.

Keep:

- `totalRuns`;
- `normalizedTotalRuns`;
- `allDistinctTubeCount`;
- `typeSpreadMean`;
- `typeSpreadMax` as secondary diagnostic.

Add:

- `topDistinctTypeCount`.

Retain `initialDistinctNextStates` only as a diagnostic compatibility field for now; it is not a primary coverage candidate because the pilot found it nearly constant at T=4..6.

No coverage weights or bins are defined here.

## Yield artifact linkage

A formal research run should emit a versioned Yield Report artifact that embeds enough provenance to bind it to the catalog:

- catalog config fingerprint;
- batch seed;
- stratum ID / Type count;
- proof-budget version;
- attempted / accepted / rejected counts;
- closed reason-code counts.

The Yield Report remains a derived observation artifact; the research catalog remains the source of accepted puzzle facts.


### Attempt-level pre-proof structure

Because the fixed proof budget can reject a candidate as UNKNOWN, accepted-puzzle structure alone may be a budget-conditioned sample.

For formal population runs, each attempt record should therefore retain a cheap standardized structure snapshot computed **before** the proof decision.

Standardization for classic-v1:

```text
full generated tubes
+ exactly one empty tube
-> analyzeStructure()
```

This snapshot is called `preProofStructure`.

The one-empty representation is used only to make the cheap descriptor calculation deterministic across attempts. It does not claim that one empty tube is sufficient.

For a proof-budget rejection, the attempt record should also retain:

- the last tested empty-tube count;
- the last solver metrics available at termination.

This allows later analysis to compare:

```text
accepted candidates
vs
budget-UNKNOWN candidates
```

on the same pre-proof structural variables.

This is especially important for T16, where the smoke already observed a non-zero 200k-budget rejection tail.

The accepted puzzle's authoritative `structure` field remains computed from the actual accepted initial Board. `preProofStructure` is an attempt-level research observation and must not replace it.

## Validation

A research catalog validator must verify:

- catalog/stratum/reproducibility fields;
- candidate seed derivation;
- exact requested Type count;
- balanced token conservation;
- classic initial occupancy;
- not already solved;
- canonical key;
- stable puzzle ID;
- exact duplicate absence;
- minimum-empty proof ordering;
- stored solution replay and solved end state;
- `optimalSolution.length === optimalMoves`;
- stored structural descriptors.

It must not require a difficulty label.

## Compatibility

This path is additive.

Do not:

- change legacy `generate` output semantics;
- change Runtime Level Pack v1;
- change existing playtest data;
- reinterpret historical difficulty/source-bucket fields.

Legacy catalogs continue to use the existing generator path.

## Next research sequence

After this path passes CI:

1. run a small smoke sample for T=4..16;
2. measure UNKNOWN/yield by Type count under the fixed 200k budget;
3. confirm the descriptor implementation including `topDistinctTypeCount`;
4. choose formal reference-population sample sizes from measured yield;
5. only then run the larger population used to evaluate `coverageSpaceVersion=1`.

No production Selection implementation is authorized by this contract.
