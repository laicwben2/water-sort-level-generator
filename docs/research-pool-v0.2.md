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
