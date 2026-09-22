# Classic generator v2 prototype report

Date: 2026-09-20

## Outcome

The v2 prototype makes the opening layout match the familiar Water Sort format:

- exactly two empty tubes;
- every non-empty tube filled to its four-layer capacity;
- deterministic output for the same difficulty and level number;
- a stored legal forward solution for every accepted puzzle;
- v1 seeds still routed through the unchanged legacy generation path.

This removes the uneven opening liquid heights produced by v1. It is a generation policy improvement, not a change to pouring rules.

## Method

The generator still starts from a solved board and applies reversible transformations. For each v2 seed it performs deterministic reverse walks, rejects states that do not meet the Classic occupancy contract, collects distinct candidates, and chooses one using the same seeded RNG. A deterministic color and tube presentation permutation adds visible variety without changing solvability.

Deep searches are attempted first. Standard-depth searches provide a bounded fallback for seeds that do not reach a Classic state through the deeper walk. The generator never accepts a board unless its saved inverse move sequence can legally solve it.

This is a constrained retry-search prototype, not a solver and not the beam-search design originally considered in the roadmap.

## Reproduction

```bash
npm run analyze:generator -- --version=v2 --levels=1000
```

The command generates Easy, Medium, and Hard levels 1–1,000, regenerates each seed to confirm determinism, replays its saved solution, and measures occupancy, complexity, duplicates, and generation time.

## Results

| Metric | Easy | Medium | Hard |
| --- | ---: | ---: | ---: |
| Valid puzzles | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 |
| Classic occupancy | 100% | 100% | 100% |
| Invariant failures | 0 | 0 | 0 |
| Mean complexity | 23.118 | 33.504 | 44.358 |
| Mean known solution length | 9.197 | 12.711 | 16.486 |
| Mean generation time | 10.690 ms | 16.726 ms | 54.508 ms |
| p95 generation time | 20.673 ms | 39.474 ms | 162.920 ms |
| Maximum generation time | 39.162 ms | 91.548 ms | 412.949 ms |
| Exact duplicate boards | 6 | 0 | 0 |
| Duplicates ignoring tube order | 390 | 2 | 0 |
| Duplicates ignoring tube and color identity | 781 | 307 | 7 |

The timing measurements were collected in the development environment and are comparative, not mobile-device guarantees.

## Interpretation

The prototype meets the Classic opening-layout, determinism, validity, and solvability goals across the full 3,000-level sample. Exact on-screen duplicates are rare because presentation permutations change both tube order and color assignment.

Canonical analysis shows that the underlying Easy state space remains repetitive when tube order and color names are ignored. Medium improves substantially in visible ordering but also contains recurring structures. Hard has good structural variety in this sample, at the cost of a higher and more variable generation time.

Therefore v2 is suitable as the Classic layout prototype, but it does not close the roadmap's diversity or calibrated-difficulty work.

## Follow-up work

1. Add a canonical board representation shared by generation and analysis.
2. Use a bounded solver to reject shallow puzzles and measure explored states, solution depth, and branching factor.
3. Penalize or exclude canonical structures already used by nearby levels; for Easy, consider a small pre-generated catalog if runtime search cannot provide enough variety.
4. Benchmark Hard generation on a real iPhone Safari device and move generation to a Web Worker or catalog if main-thread delay is visible.
5. Decide whether Random Game should expose a separate Dynamic mode with partial tubes.
