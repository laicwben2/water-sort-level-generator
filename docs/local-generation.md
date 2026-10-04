# Local Deterministic Generation

## Purpose

Prepare the existing generator for native local CPU/RAM authoring and future macOS ARM64 + Windows x64 partitioning. Source: https://github.com/laicwben2/water-sort-level-generator.git; base branch `feat/difficulty-v2`; base SHA `46ffd3eee9c7c9d958e4b2b648c8bd5646621ddc`. Work branch: `feat/local-deterministic-shards-v1`.

## Local-only Compute Policy

GitHub is source control only. All generation, proof, analysis, merge and certification execute locally. No Actions, Vercel, Neon, remote solver or cloud compute. No consumer, playtest, human records or B01–B12 benchmark modifications.

## Candidate Index Semantics

`--start-index` and `--end-index` are nonnegative safe integers; end is inclusive. 0–99 processes exactly 100 identities, independently of acceptance. Rejections never renumber later candidates. Both flags are required for range mode. Legacy `--count` mode remains available but is not a production shard.

## Candidate Independence

Global candidate index selects a type count from the configuration's ordered `colors` list by index modulo list length. Existing seed derivation and PRNG are retained, using fixed namespace `local-v1` and `types-N`; no human difficulty label enters the seed. Range boundaries and accepted counts are not configuration. Each candidate gets fresh RNG, solver and analysis state. A candidate's intrinsic accepted/quality-rejected/unknown outcome is independent of other candidates.

Exact deduplication is a separate catalog projection: the lowest index for an exact canonical key survives within the supplied range(s). Candidate results retain every intrinsic result including duplicate puzzles. Therefore split ranges and a full run have identical candidate results and identical unique-puzzle projection after merge. A puzzle retained in a shard can become a duplicate in the global projection; its intrinsic result is unchanged.

## Cross-platform Determinism

Fix source commit, exact Node/npm, lockfile, generator/rules/RNG/canonical/encoding/analysis versions, seed and complete config. Preserve serial ordering, integer state/depth budgets, deterministic solver transition ordering and heap ties (priority, depth, node ID). There are no time, RSS, timezone, locale, path, worker completion or native-random correctness cutoffs. Resource exhaustion outside deterministic budgets fails the run; it never fabricates a completed shard or an unsolvable result.

Exact canonical strings encode the full bigint sequence, not a probabilistic hash. SHA-256 digests are integrity/convenience checks only. Config equality uses full canonical serialized config in addition to its SHA-256 fingerprint. Reporting ratios have integer numerators/denominators and do not gate generation or classification. No floating-point difficulty ranking is used.

## macOS Environment

Use native Git and Node on a local SSD directory outside iCloud synchronization. Keep one sequential process initially. For long authorized runs use `caffeinate -i npm run generate -- ...`; begin with the 100-candidate pilot. This workspace may be under Documents: verify its iCloud settings before long production runs.

## Windows Environment

Use native Git, the same exact Node/npm, same source commit, config and seed, then `npm ci`. PowerShell supports the single-line examples below. No Docker, WSL, Python or cloud service is required. Keep the computer awake through Windows power settings.

## Node Runtime

Pin Node `24.19.0` in `.nvmrc` and package engines and npm `11.17.0` (bundled with the official release). Node 24.19.0 is an LTS release: https://nodejs.org/en/blog/release/v24.19.0. It matches the available local runtime and supports the existing dependency tree. Do not upgrade dependencies. Use `npm ci` and the existing lockfile. Range generation, merge and certification reject a different Node/npm runtime.

## Shard Generation

```sh
npm ci
npm run generate -- --seed=mac-local-pilot-v1 --start-index=0 --end-index=99 --output=output/shard-000000-000099.json
npm run validate -- --file=output/shard-000000-000099.json
```

Defaults: ordered colors 5,6,7; capacity 4; max empty tubes 5; proof max depth 100 and max states 100000. Mistake analysis defaults retain the existing 25000 states, depth 100, 20 steps, 6 alternatives, severe recovery penalty 5. Override with `--colors=5,6,7`, `--capacity`, `--max-empty`, `--max-depth`, `--max-states`, `--analysis-max-states`, `--analysis-max-depth`, `--analysis-max-steps`, `--analysis-max-alternatives`, `--severe-penalty`. Severe penalty describes raw recovery events, not a difficulty threshold.

## Shard Artifact

Versioned `local-shard-v1` stores rules and reproducibility versions, full config/fingerprint, seed, inclusive ranges, candidates processed, every indexed candidate's raw board/seed/status/proof, accepted puzzle solutions and raw research metrics, unique accepted records, duplicate references and summary. Arrays are ordered by candidate index. Serialization recursively sorts object keys by UTF-16 code unit order, writes UTF-8 with LF and one final newline. No operational values are included. Digest excludes only its own field. Atomic writes prevent partial JSON; existing outputs are not silently overwritten.

## Run Manifest

A separate `.run.json` records platform/architecture/OS, exact Node/npm, Git commit/branch/dirty state, start/finish timestamps, elapsed time, per-candidate timings, RSS/heap end, process maxRSS and CPU usage, counts and shard digest. It is never an input to deterministic merging. The Git commit identifies code at execution; dirty state is explicit for a precommit pilot.

## Merge Semantics

```sh
npm run merge -- output/shard-000000-000049.json output/shard-000050-000099.json --output=output/merged.json
```

Validate supported format, exact versions, full config and fingerprint, seed, structure, complete ranges, unique indices, raw candidate reproduction, canonical sequence, solution replay, proof metadata and raw analysis accounting. Reject overlap, missing indices inside declared ranges, incompatible versions, malformed records or summaries, and integrity failures. Gaps between distinct ranges are retained explicitly; they do not claim processing. Merge sorts candidates globally and rebuilds exact deduplication with lowest-index winner, reporting duplicate references. No solver is rerun. No overlap override or last-write-wins is provided. Validation checks proof certificates structurally; expensive independent re-solving is a separate research activity.

## Cross-platform Certification

After the pilot, on each machine at the final clean commit:

```sh
npm run certify -- --output=output/cert-mac.json
```

This command fixes seed `cross-platform-cert-v1`, range 0–999 and default config. On Windows use output `output/cert-windows.json`. Transfer the deterministic JSON files and compare:

```sh
npm run compare:shards -- output/cert-mac.json output/cert-windows.json
```

Require exactly 1000/1000 indexed logical results and complete deterministic payload equality, as well as matching digests. Run manifests and speed/memory are excluded. Windows certification is pending until a real Windows run is compared; local tests cannot certify Windows.

## Pilot Procedure

Run `npm ci`, `npm test`, `npm run build`; generate only seed `mac-local-pilot-v1` range 0–99, validate, repeat for byte equality, and compare split 0–49 + 50–99 after merge. Inspect workload/trap/recovery distributions with coverage and UNKNOWN counts. Record environment, time, output size and reliable memory measurements. Do not automatically enlarge to 1000 or beyond; linear estimates from 100 samples do not establish tail performance or safe long-run memory.

## UNKNOWN Semantics

Existing solver `budget-exceeded` remains UNKNOWN. A lower empty-count cutoff stops strict minimum proof. Exhausting the configured maximum empties yields UNKNOWN for the unconstrained minimum, even when all tested counts are unsolvable. No accepted puzzle lacks exact minimum proof or an optimal replayable solution. Starts already solved are quality rejected. Incomplete mistake analysis leaves correctness acceptance intact but marks research coverage incomplete; unknown alternatives are never counted as dead ends. No wall-clock cutoff decides logical outcomes.

## Difficulty Research Separation

Candidate → correctness proof → audit puzzle → bounded raw analysis → research catalog → population analysis → selection/classification → unchanged Runtime Pack v1 / Solution Artifact v1. Shard puzzles have no Easy/Medium/Hard classification. Legacy audit-v2/export commands remain compatible and retain their historical labels. Reanalysis can use stored boards and optimal solutions; it never requires regenerating or re-proving puzzles. Keep an analyzed research artifact separate from the immutable generation shard; raw metrics can be reinterpreted for selection without solver calls.

Research axes: workload (optimal moves, staging, structural/path properties), trap risk (known wrong moves, dead ends, denominators and coverage), recovery cost (penalty total/count/max, severe recoveries and restarts/dead ends). No final scalar formula or human difficulty thresholds. See difficulty-v2.md for the supplied exploratory playtest evidence.

## Baseline Inspection

The baseline already has independent per-profile/per-difficulty candidate seeds, balanced shuffling, exact bigint canonical trie equality, deterministic packed A*, explicit status separation, strict ascending minimum-empty proof, cheap structural/path metrics, optional bounded mistake analysis, audit-v2 validators and unchanged v1 exporters. CLI stops by accepted count, uses per-difficulty indices, filters legacy move windows and deduplicates during generation. Fingerprint is order-sensitive 32-bit metadata; RNG never depends on it. No range/shard/merge or runtime pin exists. Logical artifacts contain no timestamps/paths; benchmark reports intentionally contain operational values. Correctness ordering has explicit ties; Map/Set iteration follows deterministic insertion, integer comparisons and fixed loops. Existing code is preserved; new local format/version identifies the distinct global partition semantics.

## Reanalysis of stored audit puzzles

```sh
npm run analyze:shard -- --input=output/shard-000000-000099.json --output=output/research-reanalysis.json --analysis-max-states=50000
```

This reads existing unique puzzles and stored optimal paths, runs only bounded alternative-path analysis, and writes `local-research-v1` referencing the source digest. It does not regenerate candidates or repeat minimum-empty/optimal-solution proof. Reclassification from unchanged raw metrics requires no solver. Runtime export still requires an explicit selection with legacy difficulty metadata in audit-v2; new research shards intentionally do not invent consumer difficulty labels.

## Project-local Mac runtime in this workspace

This Mac pilot uses the official Node archive extracted under ignored `.local/node-v24.19.0-darwin-arm64`, verified against official SHA-256 checksums. In a fresh terminal here:

```sh
export PATH="$PWD/.local/node-v24.19.0-darwin-arm64/bin:$PATH"
node --version
npm --version
```

Other machines install the exact official runtime normally (or via nvm on macOS); `.local` is not committed or needed by Windows.

CLI scripts use `node --import tsx` to execute TypeScript without the tsx CLI's additional IPC listener. This works with native Node on both platforms and permits generation inside a restricted local workspace without relaxing network/socket permissions.


## 2026-10-05 改善後的操作入口

保持相同 exact Node 24.19.0／npm 11.17.0 與 lockfile。共用 CLI 提供 `--help`／`--version`，未知、空值、重複 flags 會拒絕；數字必須為合法 safe integer，分析預算須為正。Legacy generate 預設不覆寫，只有明確 `--overwrite=true` 可覆寫。

新生成的 shard 與 `.run.json` 先 staging，再發布 `.pending.json` checksum journal，最後 `.complete.json`。中斷後以 `npm run recover:artifact -- --file=output/shard.json` 恢復，不重新求解。歷史題庫不補造 marker。完整 worker 流程紀錄位於 `OUTPUT.process-runs/UUID.json`；原 manifest 為較早的 partial snapshot。Inclusive nested phases 不可全部相加；強制終止缺失資源數字為 null，report 自身寫入與父程序 RAM 不包含在 worker 資源數字。

研究分析可選範圍、只選不完整題並續跑；保持來源、選題、設定及輸出路徑一致：

```sh
npm run analyze:shard -- --input=data/batches/mac-local-pilot-v1/catalog.json --output=output/research-selected.json --start-index=0 --end-index=99 --only-incomplete=true
# 中斷後，在同一命令加 --resume=true
npm run validate -- --file=output/research-selected.json --source=data/batches/mac-local-pilot-v1/catalog.json
npm run report:coverage -- --input=data/batches/mac-local-pilot-v1/catalog.json --output=output/coverage.json --comparison=output/research-selected.json
```

未提供 source 的研究驗證會明示 `sourceVerified=false`。Coverage 比較使用相同 candidate subset；工具不自動產生新難度分類。另一個工作匯入題目時，保存 `candidateIdentity(shard,index)` 所提供的完整 namespace／config／index；既有 puzzle id 是 namespace 內 alias。

大批量發布使用 immutable shards 與小型 index；需要既有 v1 catalog 時才物化。外來 index 會完整驗證所有參照 checksum 與投影；輸出不覆寫：

```sh
npm run index:catalog -- output/shard-a.json output/shard-b.json --output=output/index.json
npm run index:catalog -- --input=output/index.json
npm run index:catalog -- --input=output/index.json --materialize=output/catalog.json
```

批次工具 quota 是 candidate range；不保證 accepted 數量。下例只預覽下一批，不新增題目：

```sh
npm run batch:local -- --baseline=data/batches/mac-local-pilot-v1/catalog.json --directory=data/batches/next-local-series --start-index=3000 --end-index=3099 --batch-size=100 --dry-run=true
# 已建立 plan 才能使用以下狀態／恢復入口
npm run batch:local -- --directory=data/batches/next-local-series --status=true
npm run batch:local -- --directory=data/batches/next-local-series --resume=true
npm run batch:local -- --directory=data/batches/next-local-series --publish-retry=true
```

獲授權啟動時移除 dry-run；預設不發布。建立 plan 時加 `--publish=true` 才會每批 commit／push 到 origin 的目前 branch。Tracked plan 綁定來源 src tree／lockfile、baseline checksum、namespace 與分支；ignored state 保存工作進度。發布失敗可重送已完成資料，不重產題、不 force-push、不自動合併遠端分歧。同目錄僅支援單一 runner，需乾淨的工作樹，且發布目錄不可被 Git 忽略。現在正式題庫仍停在 index 2999。

詳細相容性證據與限制見 [改善實作紀錄](implementation-progress.md)；Windows 原生 certification、人類難度校準與整機斷電恢復仍待獨立驗證。
