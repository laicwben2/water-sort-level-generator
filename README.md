# Water Sort Level Generator

Offline, reusable content-generation toolchain for Water Sort games.

This project generates candidate boards, proves solvability with a bounded A* solver, measures difficulty signals, removes canonical duplicates, validates the resulting audit catalog, and exports a compact **Level Pack v1** for game clients.

It intentionally has no dependency on React, Vite, localStorage, or a specific game UI. The exported pack can be consumed by the existing web game and future iOS, Android, Unity, or other clients that implement the same `rulesVersion`.

## Architecture (legacy accepted-count workflow)

```text
candidate generation
        |
        v
empty-tube trials
        |
        v
bounded A* solver
        |
        v
difficulty selection
        |
        v
canonical deduplication
        |
        v
audit catalog
        |
        +--> validator
        |
        v
runtime exporter
        |
        v
Level Pack v1 JSON
```

The audit catalog keeps solver solutions and search metrics. The runtime pack strips those authoring details and contains only data needed by consumers.

## Install

Use exact Node 24.19.0 and npm 11.17.0 (see `.nvmrc` and [local setup](docs/local-generation.md)).

```bash
npm ci
```

## Generate

Generate 20 accepted levels per difficulty with the expanded 5/6/7-color profile:

```bash
npm run generate -- --profile=expanded --count=20 --max-attempts=5000
```

Default output:

```text
data/audit/catalog-expanded.json
```

The baseline 4/5/6-color profile is also available:

```bash
npm run generate -- --profile=baseline --count=20
```

## Validate

```bash
npm run validate -- --file=data/audit/catalog-expanded.json
```

Validation checks:

- unique level IDs;
- canonical uniqueness independent of tube order and color names;
- classic starting occupancy;
- color-volume conservation;
- non-solved starts;
- saved solution replay;
- solver minimum-move metadata;
- solution-path metrics.

`budget-exceeded` is never treated as proof that a board is unsolvable.

## Export for games

```bash
npm run export:runtime -- \
  --input=data/audit/catalog-expanded.json \
  --output=data/output/levels-v1.json \
  --pack-id=production-2026-10
```

The output contract is defined by `spec/level-pack-v1.schema.json`.

## Export optimal solutions

The normal Runtime Level Pack exposes the proven optimal move count but deliberately omits the full answer. Applications that need hints, replay, challenge verification, or research data can export the separate solution artifact:

```bash
npm run export:solutions -- \
  --input=data/audit/catalog-expanded.json \
  --output=data/output/solutions-v1.json
```

Each solution entry is keyed by level ID and contains both `optimalMoves` and `optimalSolution`.

## Contract

Current contract values:

- `formatVersion: 1`
- `rulesVersion: "classic-v1"`

Changing JSON structure requires a new `formatVersion`. Changing legal-pour or solved-state semantics requires a new `rulesVersion`.

Level IDs are derived from deterministic candidate indices rather than accepted-list position. This keeps a candidate's identity stable when acceptance thresholds change.

## Tests

```bash
npm test
npm run build
```

## Relationship to water-sort

`water-sort-level-generator` is the producer. `water-sort` is a consumer.

Official game releases should never run this solver on the player's device. Generation, solving, validation, and difficulty analysis happen before release; clients load the exported static pack.

## Consumer repository

The current web consumer is [laicwben2/water-sort](https://github.com/laicwben2/water-sort). Both projects share the versioned Level Pack contract in `spec/level-pack-v1.schema.json`.


## Generator v0.2 foundation

The v0.2 foundation is documented in [docs/v0.2-foundation.md](docs/v0.2-foundation.md).

Key invariants:

- puzzle identity uses abstract types, not presentation colors;
- type renaming and tube order do not change puzzle identity;
- canonicalization uses a shared global type mapping and exact tube-order search;
- generation uses an explicit versioned PRNG and independently derived candidate seeds;
- the CLI accepts an explicit batch seed with `--seed=...`;
- empty tubes are searched from 1 upward and are only declared minimal when every smaller count is proven unsolvable;
- `budget-exceeded` means unknown and causes that candidate to be rejected;
- generation is sequential by default so solver memory does not multiply by worker count.

Example reproducible generation:

```bash
npm run generate -- \
  --profile=expanded \
  --count=20 \
  --max-attempts=5000 \
  --seed=water-sort-research-2026-09
```

The audit catalog records generator, RNG, canonicalization, encoding, batch-seed, candidate-seed, and config-fingerprint metadata needed to reproduce accepted candidates.


## Benchmark solver scaling

Benchmark type-count scaling with one candidate process at a time:

```bash
npm run benchmark -- \
  --min-types=6 \
  --max-types=16 \
  --samples=10 \
  --max-states=100000 \
  --max-empty=5 \
  --seed=water-sort-benchmark-v0.2 \
  --output=data/output/solver-benchmark.json
```

Each candidate runs in its own child process. The report records exact/unknown rates, minimum-empty distribution, elapsed time, explored/visited states, generated moves, and process `maxRSS`. This keeps concurrency at 1 and makes peak-memory measurements comparable across candidates.


## Analyze Difficulty v2

Cheap structural and optimal-path metrics are stored during generation. Mistake/recovery analysis is intentionally a separate bounded pass because it may require many additional optimal-solver calls.

```bash
npm run analyze:difficulty -- \
  --input=data/audit/catalog-expanded.json \
  --output=data/audit/catalog-expanded-difficulty-v2.json \
  --max-states=25000 \
  --max-depth=100 \
  --max-steps=20 \
  --max-alternatives=6 \
  --severe-penalty=5
```

The analyzer records coverage explicitly. Budget-exceeded alternatives remain `unknown`; they are never counted as dead ends. Difficulty thresholds are not hard-coded yet. See [docs/difficulty-v2.md](docs/difficulty-v2.md).

## Local deterministic shards

Use exact Node **24.19.0**, npm **11.17.0**, and `npm ci`. Native Mac and Windows generation uses local CPU/RAM only.

```sh
npm run generate -- --seed=mac-local-pilot-v1 --start-index=0 --end-index=99 --output=output/shard-000000-000099.json
npm run validate -- --file=output/shard-000000-000099.json
npm run merge -- output/shard-000000-000049.json output/shard-000050-000099.json --output=output/merged.json
```

The local flow is candidate generation → correctness proof → audit puzzle → raw analysis → research catalog → population analysis → selection/classification → runtime export.

Range mode processes inclusive candidate identities, not an accepted quota. It writes deterministic JSON plus a separate operational `.run.json`. Research stores workload, trap and recovery metrics without final difficulty labels. The older `--count` workflow and v1 game exports remain available.

Begin with 100 candidates. Use a local SSD outside iCloud sync; for authorized long Mac runs use `caffeinate -i npm run generate -- ...`. Windows uses native Node with the identical commit, runtime, lockfile, seed and config. See [local generation, merge and certification](docs/local-generation.md).

The [Mac 100-candidate pilot report](docs/mac-local-pilot.md) records environment, quality gates, raw research distributions, resource observations and rough performance estimates. Windows certification is prepared but remains pending.

## Published pilot data / handoff

The [Mac pilot handoff](data/pilots/mac-local-pilot-v1/README.md) includes all 100 generated puzzles, original run manifests, recorded environment, raw metric summary, and byte-identical repeat/merge evidence for reuse by another task.
