# Released puzzle registry v0.3

Date: 2026-10-01  
Status: implementation contract for foundation hardening v0.3

## Purpose

Batch-local canonical deduplication prevents duplicates inside one generation run. It does not prevent a later pack from rediscovering and republishing a puzzle that was released earlier.

The released-puzzle registry provides long-term identity reservation without turning rejected candidates into permanent global state.

## Scope

The first registry is a versioned static JSON artifact owned by the authoring repository.

It is deliberately not a database and does not change the runtime Level Pack format.

The registry records release identity events only:

- `release`;
- `withdrawal`;
- `reinstatement`.

Rejected candidates remain in run-local audit / yield data and never enter this registry.

## Identity

A released puzzle is identified by:

- `rulesVersion`;
- `capacity`;
- exact `canonicalKey`;
- stable `puzzleId`.

`puzzleId` is derived from the other identity inputs under `puzzle-id-v1`.

Generation provenance such as batch seed, source bucket, candidate index, or legacy level ID is not puzzle identity.

## Event log

Registry format:

```json
{
  "formatVersion": 1,
  "events": []
}
```

Every event has a contiguous zero-based `sequence`.

### release

A first release records enough immutable data to independently reconstruct and verify identity:

```json
{
  "sequence": 0,
  "type": "release",
  "puzzleId": "...",
  "rulesVersion": "classic-v1",
  "capacity": 4,
  "canonicalKey": "...",
  "board": [[0,1,2,3], []],
  "packId": "..."
}
```

The Board is retained intentionally. It allows:

- identity migration;
- canonical-key recomputation;
- independent equivalence checking without trusting the stored key.

A `puzzleId` may have only one first `release` event.

### withdrawal

Withdrawal removes a puzzle from active publication but does not release its identity for reuse.

```json
{
  "sequence": 1,
  "type": "withdrawal",
  "puzzleId": "...",
  "reason": "..."
}
```

### reinstatement

A withdrawn puzzle may be published again only with the same original Board and `puzzleId`.

```json
{
  "sequence": 2,
  "type": "reinstatement",
  "puzzleId": "...",
  "packId": "..."
}
```

## Derived state

Registry state is derived by replaying the append-only events.

For each released identity:

- first release -> active;
- withdrawal from active -> withdrawn;
- reinstatement from withdrawn -> active.

Invalid transitions are rejected.

History is never rewritten.

## Duplicate protection

A new release candidate is not considered novel merely because its PKey / `puzzleId` lookup misses.

Before minting or recording a new release identity, the authoring tool must use both:

1. stored identity lookup;
2. independent Board equivalence search against compatible registry entries.

The independent checker must not import the production canonicalizer.

A compatible registry entry has the same:

- rules version;
- capacity.

If an equivalent Board already exists:

- the candidate is the existing puzzle;
- its original `puzzleId` remains authoritative;
- a new identity must not be minted.

Withdrawal does not change duplicate protection.

## Validation

Registry validation must verify:

- supported format version;
- contiguous event sequence;
- each release has a non-empty pack ID;
- release Board / capacity are structurally valid enough for identity recomputation;
- stored canonical key matches the Board;
- stored puzzle ID matches rules version + capacity + canonical key;
- no second first-release for the same puzzle ID;
- no independently equivalent Board is first-released under another puzzle ID;
- withdrawal references an existing active identity;
- reinstatement references an existing withdrawn identity.

## Concurrency

The static-file implementation relies on repository-level optimistic concurrency:

1. read the latest registry file/version;
2. perform duplicate and transition validation;
3. append events;
4. write only if the expected prior file version still matches;
5. on conflict, reload and revalidate.

Generation-time registry snapshots are advisory only. Release-time validation must always use the latest registry state.

## Migration and compatibility

This v0.3 phase does not retroactively replace existing runtime IDs.

Existing released / seed-bank puzzles may later be imported through an explicit migration operation that:

- reconstructs canonical identity from the stored Board;
- derives `puzzleId`;
- checks independent equivalence;
- records the first release event.

No inferred historical release event should be created without an explicit migration decision.

## Non-goals

The first registry does not:

- store every generated candidate;
- store difficulty labels;
- store human playtest results;
- choose catalog order;
- implement structural near-duplicate selection;
- alter runtime Level Packs.
