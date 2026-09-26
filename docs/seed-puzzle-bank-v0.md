# Seed puzzle bank v0

Date: 2026-09-26 (Asia/Taipei)

## Scope

`data/levels/research3-v2-seed-bank-v0.json` is a frozen, playable 12-level
candidate pack in the existing `level-pack-v1` format. It copies the boards
from the corrected `difficulty-v2-benchmark-v2` snapshot in
`laicwben2/water-sort-developer-playtest/public/benchmark.json` and uses the
solver's optimal moves from the server-only benchmark metric manifest.

The `difficulty` field is the **original generator bucket**, required by the
runtime pack schema. It is not a calibrated human difficulty label. This pack
is a candidate library, not an ordered production progression. Do not expose
optimal moves or the research notes in the blind playtest interface.

Source: research-3 seed `water-sort:difficulty-v2:research-3`, generator 0.2.1,
config `aaa8ea23`, full-path artifact `10730213935`. The corrected v2 B03 has
two empty tubes; the legacy v1 one-empty B03 is unsolvable and is absent here.

## Current human evidence

The v2 report snapshot at 2026-09-26 15:01 Taipei time contained 14 results
from three anonymous sessions: one solved result for each of the 12 puzzles,
plus two shallow give-ups. B03's give-up was about 21 seconds, zero legal
moves and one restart; B12's was about 37 seconds, two legal moves and no
restarts. Neither give-up rating is used below as intrinsic puzzle difficulty.

| ID | Source bucket | Solved rating 1–5 | Solved time | Solved moves | Restarts | Exploratory score | Follow-up |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| B01 | hard | 2 | 2:09.8 | 48 | 4 | 39 | Recheck |
| B02 | easy | 4 | 2:38.6 | 31 | 6 | 80 | Priority retest |
| B03 | easy | 1 | 18.5 s | 16 | 0 | 20 | Separate shallow give-up |
| B04 | medium | 1 | 25.8 s | 21 | 0 | 10 | Recheck |
| B05 | hard | 4 | 3:21.1 | 56 | 9 | 85 | Retest |
| B06 | easy | 5 | 6:25.5 | 63 | 13 | 94 | Priority retest |
| B07 | medium | 2 | 20.1 s | 17 | 0 | 24 | Recheck |
| B08 | medium | 2 | 28.5 s | 17 | 0 | 37 | Recheck |
| B09 | hard | 2 | 23.6 s | 20 | 0 | 16 | Priority retest |
| B10 | hard | 1 | 26.8 s | 20 | 0 | 11 | Priority retest |
| B11 | medium | 4 | 1:39.6 | 29 | 2 | 64 | Retest |
| B12 | easy | 1 | 16.6 s | 18 | 0 | 15 | Separate shallow give-up |

The exploratory score reproduces the first provisional calculation:

```text
100 × [0.60 × (solved rating − 1) / 4
     + 0.25 × percentile rank of wrong-move density among these 12
     + 0.15 × percentile rank of dead-end density among these 12]
```

Tied ranks use their average rank; percentile is `(rank − 1) / 11`, then the
result is rounded to the nearest integer. The weights and any Easy/Medium/Hard
cutoffs are unvalidated judgment calls. The score is intentionally kept out of
the playable JSON. It exists only to prioritize independent retests, especially
B06 and B02 (source easy, harder for the first solver) and B09 and B10 (source
hard, easier for the first solver).

## Promotion criteria

Keep the frozen boards and stable IDs. Collect multiple independent, meaningful
attempts per puzzle with a stable UI. Examine solve rate, time, moves, restarts,
confidence and give-up depth before assigning human-calibrated labels or
sequencing levels. Preserve the raw results and the source bucket separately.
Do not merge the v1 B03 result into the v2 puzzle evidence.
