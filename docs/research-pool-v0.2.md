# Unlabeled research pool — Generator v0.2

Date: 2026-09-22

## Why this exists

The first Difficulty v2 sample showed that the existing Easy / Medium / Hard labels are still dominated by puzzle scale:

- more Types;
- longer optimal solutions;
- more total legal choices.

Normalized decision-risk metrics overlapped heavily across the three labels:

- risky decision ratio was roughly similar;
- average probability of choosing a known non-optimal move at a decision state was roughly similar;
- recovery penalty was almost always 1;
- dead-end density was not monotonic with the current difficulty label.

Therefore the next calibration step must hold puzzle scale constant.

## Research-pool principle

Generate many puzzles at one fixed Type count without assigning difficulty.

Example:

```text
7 Types
capacity 4
minimum empty tubes derived exactly
100 accepted unique puzzles
no Easy / Medium / Hard label
```

For each accepted puzzle preserve:

- candidate index / deterministic seed;
- board;
- minimum required empty tubes;
- optimal move count;
- full optimal solution;
- solver metrics;
- solution-path metrics;
- Difficulty v2 mistake/recovery analysis;
- canonical identity.

Only correctness and resource guards may reject a research candidate.

No difficulty threshold or target move count is applied.

## CLI

Planned form:

```bash
npm run research:pool -- \
  --types=7 \
  --count=100 \
  --max-attempts=5000 \
  --max-states=100000 \
  --mistake-max-states=50000 \
  --max-empty=5 \
  --seed=water-sort-research-types7-v0.2 \
  --output=data/research/types7-v0.2.json
```

## Reproducibility

A pool is deterministic under:

- generator version;
- RNG version;
- canonicalization version;
- solver-state encoding version;
- config;
- batch seed;
- candidate index.

Accepted-list position is not candidate identity.

## How the pool will be used

The pool is not a production Level Pack.

It is used to:

1. inspect distributions within one fixed scale;
2. select low/middle/high examples for each metric;
3. manually playtest diverse puzzles;
4. record human difficulty judgments;
5. determine which metrics actually correlate with perceived difficulty;
6. only then define production difficulty thresholds.

## Metrics to compare at fixed scale

Initial comparison set:

- optimal moves;
- decision ratio;
- average choices;
- risky decision ratio;
- average / maximum decision-choice risk;
- optimal-alternative rate;
- dead-end ratio;
- recovery penalty;
- local cue-conditioned risk;
- solver search metrics.

The system must not combine these into one authoritative score before human calibration.


## First fixed-scale result: 7 Types / 50 puzzles

A deterministic pool of 50 unique 7-Type puzzles was generated with seed:

```text
water-sort-research-types7-v0.2
```

Generation accepted 50/50 scanned candidates. Minimum empty tubes:

- 1 empty: 2 puzzles;
- 2 empty: 48 puzzles.

All Difficulty v2 alternate analyses completed with zero unknown alternatives.

Selected within-scale distributions:

| Metric | Min | p25 | p50 | p75 | Max |
|---|---:|---:|---:|---:|---:|
| optimalMoves | 19 | 21 | 22 | 23 | 24 |
| averageChoices | 1.75 | 3.67 | 4.43 | 5.57 | 6.55 |
| riskyDecisionRatio | 0.556 | 0.737 | 0.833 | 0.905 | 1.000 |
| averageDecisionChoiceRisk | 0.278 | 0.352 | 0.412 | 0.467 | 0.701 |
| optimalAlternativeRate | 0.132 | 0.305 | 0.390 | 0.482 | 0.672 |
| deadEndRatioKnown | 0.000 | 0.000 | 0.000 | 0.098 | 0.773 |
| averageRecoveryPenalty | 1.000 | 1.000 | 1.000 | 1.000 | 1.143 |
| maxRecoveryPenalty | 1 | 1 | 1 | 1 | 2 |

Important findings:

1. **Fixed-scale decision risk has meaningful spread.**  
   At the same 7-Type scale, average decision-choice risk ranges from about 0.28 to 0.70 and risky-decision ratio ranges from about 0.56 to 1.0.

2. **Optimal path length is relatively narrow.**  
   The pool spans only 19-24 optimal moves, so the decision-risk spread is not simply a proxy for solution length.

3. **Recovery penalty remains weak.**  
   Most recoverable mistakes cost only one extra move; maximum penalty is only 2 in this pool.

4. **Dead-end density is sparse but highly variable.**  
   Median dead-end ratio is 0, while a few puzzles reach 0.58-0.77.

5. **Solver search effort is not a player-difficulty metric.**  
   Explored states range from 42 to 4,289 and correlate strongly with visited states, but only weakly with several player-facing risk metrics.

6. **The pool is suitable for human calibration.**  
   There is enough within-scale spread to select contrasting puzzles without changing Type count.

## Playtest selection strategy

Do not rank the pool with one composite difficulty score.

Instead select contrasting examples along independent axes:

- low / high average decision-choice risk;
- low / high risky-decision ratio;
- low / high optimal-alternative rate;
- low / high dead-end ratio;
- low / high average choices;
- short / long optimal solution.

Selection should:

1. keep Type count fixed;
2. avoid duplicate puzzle IDs where possible;
3. record exactly why each puzzle was selected;
4. preserve the full source puzzle and optimal solution in the playtest artifact;
5. randomize presentation colors and presentation order separately from level identity during actual playtests;
6. collect human ratings before defining Easy / Medium / Hard thresholds.

The selector is a sampling tool, not a classifier.


## Blind playtest artifact

The researcher-facing selection file contains:

- selection reason;
- metric value;
- rank within the selected metric;
- full research puzzle;
- optimal solution.

That file must **not** be used directly as the player-facing test input because it can reveal why a puzzle was selected and expose the answer.

A separate blind artifact is exported for actual play:

```json
{
  "formatVersion": 1,
  "rulesVersion": "classic-v1",
  "kind": "blind-playtest",
  "playtestId": "types7-v0.2",
  "types": 7,
  "levels": [
    {
      "order": 1,
      "id": "ws-research-t07-c000045",
      "capacity": 4,
      "board": [[0, 1, 2, 3], ...]
    }
  ]
}
```

The blind artifact intentionally omits:

- difficulty label;
- selection reason;
- research metrics;
- optimal move count;
- optimal solution.

This prevents the test artifact itself from priming the player.

The researcher retains the separate selection/report artifacts and joins them with player ratings after the playtest.
