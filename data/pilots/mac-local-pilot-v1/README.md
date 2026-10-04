# Mac pilot handoff: mac-local-pilot-v1

此目錄保存已實際在 Mac 產生的 100 題、環境、原始 run manifests 與 determinism 驗證資料，供其他工作直接讀取。所有 JSON 從已驗證的本機輸出逐位元組複製；本次發布未重新產題。

## 先讀取

1. [環境與 provenance](environment.json)：macOS 26.6 / ARM64、Node 24.19.0、npm 11.17.0、locked dependency versions、base/implementation commit、設定與檔案 SHA-256。
2. [Pilot 報告](../../../docs/mac-local-pilot.md)：test/build、效能、記憶體與 workload/trap/recovery 原始數據分布。
3. [本機 generation / merge / certification 規格](../../../docs/local-generation.md)。

Repository: https://github.com/laicwben2/water-sort-level-generator.git

Branch: `feat/local-deterministic-shards-v1`

Implementation commit: `1c6418ebdf41f8d410fb1890821badceca94960e`

Base: `feat/difficulty-v2` / `46ffd3eee9c7c9d958e4b2b648c8bd5646621ddc`

## 題目入口

[shard-000000-000099.json](shard-000000-000099.json) 是主要資料來源：

- `formatVersion = local-shard-v1`、`rulesVersion = classic-v1`。
- seed `mac-local-pilot-v1`，inclusive candidate range 0–99。
- `acceptedPuzzles` 含 100 題 unique accepted records。
- 每題含 `candidateIndex`、`candidateSeed`、`board`（試管內由底至頂）、exact `canonicalKey`、normalized representation、`optimalSolution`、`solver.optimalMoves`、嚴格 minimum-empty proof metadata 與 `research` raw metrics。
- `candidates` 含所有 100 個原始 candidate 結果；accepted puzzle 資料也保留在對應 candidate 內。讀題時使用 `acceptedPuzzles`，不要把這兩處相加當成 200 題。
- 沒有 Easy/Medium/Hard 新分類。61 題 research coverage 不完整；correctness UNKNOWN = 0、analysis UNKNOWN alternatives = 0。Skipped analysis 不等於 safe move 或 dead end。

Logical digest:

```text
a5e20616055ca3ad026bbe2a71fee3cf359438c65aadb33be02c7d0d8a8ca974
```

此 shard 是內部 audit/research artifact。既有 Runtime Level Pack v1 / Solution Artifact v1 contract 保持原樣。若後續要供遊戲 consumer 使用，先明確選題與分類，再經既有 audit-v2 exporter；不要直接把 shard 當 runtime pack。

## 操作紀錄與驗證資料

- [原始 run manifest](shard-000000-000099.run.json)：timestamps、Node/npm、Git state、per-candidate elapsed、CPU/RSS、counts。
- [統計摘要](pilot-summary.json)：workload、trap、recovery distributions 與粗略效能估算。
- `repeat-000000-000099.json`：同 seed/config/range 重跑，與主要 shard byte-identical。
- `shard-000000-000049.json`、`shard-000050-000099.json`：同一批 candidates 的兩個分段。
- `merged.json`：兩個分段以反向 input order 合併，與主要 shard byte-identical。
- `candidate-000050.json`：Candidate 50 單獨產生，與主要 shard 的 candidate 50 logical result 完全一致。
- `research-candidate-000050.json`：既有 puzzle 的獨立 reanalysis smoke artifact；使用一個 step / 一個 state budget，UNKNOWN 沒有誤判成 dead end。
- 各次 generation 的 `.run.json` 保留原始 operational metadata，完全不參與 deterministic merge/equality。

初次 pilot 在 implementation commit 前執行，原始 manifests 如實記錄 base HEAD 與 dirty=true；不得把它們改寫成 clean/final commit run。`environment.json` 另行標明實作 commit，避免誤解 provenance。

## 在另一個工作驗證／使用

取得本 branch（或交接連結中的 immutable commit），使用 exact Node/npm，執行：

```sh
npm ci
npm run validate -- --file=data/pilots/mac-local-pilot-v1/shard-000000-000099.json
npm run compare:shards -- data/pilots/mac-local-pilot-v1/shard-000000-000099.json data/pilots/mac-local-pilot-v1/merged.json
```

重新產生時請寫到新的 `output/` 檔案，工具預設拒絕覆寫既有 output。Merge 拒絕 ranges overlap、seed/config/version mismatch，使用 exact canonical identity 去重，並不重新執行 Solver。

Windows certification 尚未執行。工具已準備好，但必須由真實 Mac/Windows 在同一 clean commit 與 exact runtime/lockfile/config 上執行固定 seed `cross-platform-cert-v1`、range 0–999，並比較 1000/1000 logical results，才能宣稱認證通過。
