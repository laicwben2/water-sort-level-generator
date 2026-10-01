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
