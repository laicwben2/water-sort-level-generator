# Water Sort Level Generator

Offline, reusable content-generation toolchain for Water Sort games.

This project generates candidate boards, proves solvability with a bounded A* solver, measures difficulty signals, removes canonical duplicates, validates the resulting audit catalog, and exports a compact **Level Pack v1** for game clients.

It intentionally has no dependency on React, Vite, localStorage, or a specific game UI. The exported pack can be consumed by the existing web game and future iOS, Android, Unity, or other clients that implement the same `rulesVersion`.

## Architecture

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

```bash
npm install
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
