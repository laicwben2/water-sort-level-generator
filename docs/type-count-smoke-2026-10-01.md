# Explicit Type-count research smoke — 2026-10-01

Status: approved execution plan  
Prerequisite: neutral Type-count research path passes CI

## Purpose

Measure the first end-to-end yield and proof-budget envelope of the new `research-candidates-v1` path across the supported research Type-count range.

This is not the formal reference population.

## Fixed configuration

For each Type count:

`T = 4..16`

Generate:

`20 accepted candidates`

Maximum candidate attempts:

`200`

Capacity:

`4`

Generator family:

`uniform-v1`

Proof budget:

- maxVisitedStates = 200,000;
- maxDepth = 200;
- maxEmptyTubes = 5;
- proof budget version = `research-proof-200k-d200-e5-v1`.

Seed per stratum:

`type-count-smoke-2026-10-01-t<T>`

Example:

`type-count-smoke-2026-10-01-t16`

## Required outputs

For every Type count retain:

1. research candidate catalog;
2. research Yield Report;
3. structure summary.

## Questions

The smoke must answer:

- does every T=4..16 stratum produce 20 accepted candidates without changing the proof budget?
- how many attempts are needed?
- how many candidates are rejected due to proof UNKNOWN?
- how many exact canonical duplicates occur?
- which minimum-empty values are observed?
- how does optimal-solver state cost scale in this sample?
- does `topDistinctTypeCount` provide variation across the entire range?

## Decision use

This smoke is used only to size the next formal reference-population run.

It must not:

- define difficulty;
- freeze coverage bins;
- establish production Type-count limits;
- justify a targeted generator.

A T=15/16 UNKNOWN tail is expected to be possible under the fixed 200k research budget and is not itself a correctness defect.
