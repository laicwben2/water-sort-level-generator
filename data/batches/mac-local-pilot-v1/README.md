# Mac 本機追加產題交接

沿用 seed `mac-local-pilot-v1` 與原有設定；每批 100 candidates，驗證、累積合併去重、提交並推送。目標累積 3,000 題（原有 pilot 100 加上 2,900 candidates）；已完成 23/29 批。

## 讀取入口

- [catalog.json](catalog.json)：主要累積資料，包含原有 100 candidates 與本次追加；目前處理 2400 candidates，可用 unique puzzles 2400 題，較原有新增 2300 題。
- [summary.json](summary.json)：每批範圍、counts、時間、記憶體、檔案 SHA-256、生成 commit 與累積 digest。
- [verification.json](verification.json)：目前 catalog 的驗證狀態；[原 2,100 題驗證](verification-2100.json) 保留前次完整核對紀錄。
- [environment.json](environment.json)：runtime、OS、lockfile、實作版本與 provenance；各批原始 `.run.json` 提供詳細執行紀錄。
- [本機生成規格](../../../docs/local-generation.md)；[原有 pilot](../../pilots/mac-local-pilot-v1/README.md)。

讀題使用 `acceptedPuzzles`；`candidates` 保留相同題目的 audit records，不能相加計數。每個 board 的試管內容由底至頂。沒有新難度標籤；analysisIncomplete 不代表 correctness 不通過，UNKNOWN 不等於無解。

目前累積 accepted=2400、duplicate=0、qualityRejected=0、unknown=0、analysisIncomplete=1517。範圍 0–2399（inclusive）。

各 `shard-*.json` 為不可覆寫的原始分批資料。`catalog.json` 在每次 commit 更新；欲固定版本請使用該 commit 的連結。本目錄 shard 範圍 100 起，原有 0–99 取自 pilot，不要將 catalog 與各 shards 再合併，否則會產生範圍重疊。

`npm run validate -- --file=data/batches/mac-local-pilot-v1/catalog.json` 可驗證 catalog；已逐批驗證原始 shard 與合併 catalog，merge 不重新跑 solver。Runtime export 仍需明確選題與既有分類流程。
