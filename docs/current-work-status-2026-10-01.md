# Current work status — 2026-10-01

Branch: `feat/foundation-hardening-v0.3`  
Draft PR: #4 against `feat/generator-v0.2-foundation`  
Main branch: unchanged  
Consumer repository: unchanged

## Current checkpoint

The v0.3 foundation-hardening work has progressed from architecture hardening into measured reference-population research.

Completed engineering foundations:

- stable structural `puzzleId` separated from generation provenance;
- legacy runtime/provenance ID retained for compatibility;
- source bucket separated from human difficulty interpretation;
- technical-validity acceptance mode;
- explicit proof resource budgets rather than deriving proof depth from difficulty windows;
- independent reference BFS for differential solver tests;
- validator hardening and independent puzzle-equivalence checking;
- structural descriptor pipeline;
- generation Yield Reports / closed rejection reason codes;
- released-puzzle registry contract and pure validation/query foundation;
- neutral explicit-Type-count research path using `research-candidates-v1`;
- versioned research proof budget `research-proof-200k-d200-e5-v1`;
- self-describing research run configuration and independently recomputable config fingerprint;
- attempt-level `preProofStructure` and final UNKNOWN proof observations in research Yield artifacts.

The legacy generator/runtime path remains available and compatible.

## Research completed

### 1. Uniform baseline pilot — complete

The first 9,000-puzzle pilot used the legacy baseline source buckets only as generation provenance:

- T4 / T5 / T6;
- 1,000 accepted puzzles per Type count per seed;
- 3 independent seeds;
- 9,000 accepted puzzles total.

Key conclusions are documented in:

`docs/reference-population-pilot-results-2026-10-01.md`

The pilot established that:

- the T4..6 uniform technical-validity population is stable across the tested seeds;
- the uniform generator's high-Type fragmentation tendency survives the proof pipeline;
- `initialDistinctNextStates` is effectively degenerate for classic full-tube starts;
- `topDistinctTypeCount` is a more useful independent structural candidate;
- production coverage bins / FPS / targeted generation should not yet be implemented.

### 2. Explicit Type-count smoke — complete

The neutral `research-candidates-v1` path was exercised across T=4..16 with 20 accepted candidates per Type count.

Result:

- T4..15: no budget UNKNOWN observed;
- T16: 20 accepted from 23 attempts, with 3 `MINIMUM_EMPTY_BUDGET_EXCEEDED`;
- no max-empty exhaustion;
- no starts-solved rejection;
- no exact canonical duplicate in this small smoke;
- `topDistinctTypeCount` retained non-trivial variation through T16;
- `initialDistinctNextStates = T` for all 260 accepted smoke puzzles.

Detailed result:

`docs/type-count-smoke-results-2026-10-01.md`

This confirmed that the 200k research proof budget should remain fixed for the next population study and that T16 must be treated as a proof-budget-conditioned accepted population.

## Current work in progress

### Formal Reference Population Phase A

Execution contract:

`docs/reference-population-phase-a-2026-10-01.md`

Design:

- T=4..16;
- 3 independent seeds per Type count;
- 500 accepted candidates per (T, seed);
- 39 matrix cells;
- target 19,500 accepted puzzles;
- fixed `research-proof-200k-d200-e5-v1` budget;
- full accepted catalog + Yield artifact + structure summary per cell.

Execution status:

- workflow run: `36840180259`;
- execution commit: `8edfd26b8c953c66c4176bfce13712e14b628353`;
- 39 / 39 generation matrix cells completed successfully;
- 0 failed cells;
- aggregate artifact job completed successfully;
- 40 / 40 workflow jobs completed successfully in the Phase A run;
- 39 per-cell artifacts are present;
- aggregate artifact: `reference-population-phase-a-all` / artifact ID `11152379298`;
- aggregate artifact digest: `sha256:36802fd8d6ffdb3e9bcc61eeba81c6baed55c861347b68e607bad177ae589c05`.

Phase A **generation is complete**. The work is now at the analysis gate. Do not infer final Phase A conclusions from the execution status alone; the full artifacts still need to be aggregated and analyzed according to the declared plan.

## Next work

The immediate next work is analysis, not more generator redesign.

### N1 — freeze and inventory Phase A artifacts

Generation is complete. Next:

- download / inspect the aggregate artifact contents and confirm the expected catalog, Yield, and structure-summary files exist for all 39 cells;
- preserve workflow run `36840180259`, execution commit `8edfd26b8c953c66c4176bfce13712e14b628353`, and aggregate artifact digest as the authoritative Phase A provenance;
- preserve the completed artifacts as the authoritative Phase A dataset;
- do not regenerate successful cells with different seeds or budgets merely to improve results.

### N2 — build the Phase A analysis report

Analyze the full 19,500 accepted-puzzle target population plus attempt-level rejected observations.

Required analysis:

- yield / rejection reason by T and seed;
- proof-budget UNKNOWN rate by T and seed;
- minimum-empty distribution;
- optimal-move / solver-state distributions;
- descriptor distributions and quantiles;
- seed-to-seed stability;
- pairwise KS statistics;
- descriptor correlations / redundancy;
- accepted-vs-UNKNOWN `preProofStructure` comparison where enough UNKNOWN observations exist;
- explicit characterization of proof-budget conditioning at high T.

The analysis must preserve the distinction between:

- puzzle structure;
- solver workload;
- human difficulty.

### N3 — descriptor screening decision

After Phase A analysis, classify each candidate descriptor as:

- primary coverage candidate;
- secondary / diagnostic;
- redundant / drop;
- insufficient evidence.

Current pre-Phase-A expectations, not final decisions:

- `totalRuns`: retain;
- `normalizedTotalRuns`: do not independently weight together with `totalRuns`;
- `typeSpreadMean`: retain;
- `allDistinctTubeCount`: retain but check redundancy at high T;
- `typeSpreadMax`: secondary;
- `topDistinctTypeCount`: strong candidate;
- `initialDistinctNextStates`: diagnostic only.

### N4 — decide whether more reference data are needed

Do **not** automatically run another uniform 10,000+ sample.

Additional data should be allocated only where Phase A leaves uncertainty, for example:

- high-T proof-budget tail;
- rare minimum-empty cells;
- sparse structural regions;
- unstable seed-to-seed distributions.

### N5 — only then specify `coverageSpaceVersion=1`

A coverage-space contract may be drafted only after descriptor screening.

It must define:

- stratification variables;
- included descriptors;
- normalization;
- treatment of correlated descriptors;
- distance / coverage semantics;
- deterministic tie-breaking;
- versioning and reproducibility.

No human difficulty label may enter the structural coverage distance.

### N6 — diversity-selection prototype

Only after the coverage-space contract is reviewed:

- implement deterministic candidate-pool selection;
- compare selected vs source population coverage;
- retain exact duplicate protection as a separate identity rule;
- do not yet make Selection a human difficulty classifier.

### N7 — later human calibration

Human playtest calibration comes after structurally representative sampling.

It will answer a different question:

`Which measured puzzle properties predict player behavior and perceived difficulty?`

It must not be mixed into the machine reference-population conclusions.

## Explicitly not authorized yet

The following remain intentionally deferred:

- production Easy / Medium / Hard thresholds;
- a scalar machine difficulty score;
- production FPS / coverage weights before the Phase A descriptor gate;
- targeted / constructive generator families;
- increasing the research proof budget to rescue UNKNOWN candidates;
- inferring a production Type-count ceiling from solver research;
- automatic migration of the historical seed bank into the released-puzzle registry;
- merging this branch into `main`;
- changes to the consumer repository.

## Working rule

Continue to prefer measured evidence over additional mechanism.

The next decision point is the completed Phase A analysis. Until that analysis is reviewed, the generator family remains `uniform-v1`, the research proof budget remains fixed, and `coverageSpaceVersion=1` remains unfrozen.
