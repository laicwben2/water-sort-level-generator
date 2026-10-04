# 目前狀況與階段交接 — 2026-10-05

本階段已完成，依使用者指示停在累積 **3,000 題**。本機批次工作已結束；本次文件更新不啟動新的生成。後續增加題目或重新分析，待使用者另行指示。

後續審查記錄 12 項發現；已依使用者指示分 10 段改善，每段更新文件、提交及推送。詳見 [改善實作紀錄](implementation-progress.md) 及 [審查待辦目前狀態](review-backlog.md#2026-10-05-實作狀態)。新增完整 worker telemetry、資料驗證、成組發布恢復、選題續跑分析、coverage 報表、穩定 namespace、immutable catalog index 與本機批次工具；修正 CLI 安全及重複計算。完整驗證 93 tests／15 files 與 build 通過。原有 58 份 shard／manifest 加 catalog 共 59 份 checksum 全數吻合；30 份 shards 經新 index 物化仍與原 catalog 完全 byte-identical。未新增正式題目。

R07 的高 coverage 敏感度研究與人類校準仍待進行；R08 尚無穩定 solver 加速倍率；Windows 原生與整機斷電恢復認證尚未完成。

## 已完成與發布

- Repository：<https://github.com/laicwben2/water-sort-level-generator.git>。
- 分支：`feat/local-deterministic-shards-v1`；資料與最終驗證已推送，尚未合併回 base branch。
- 初始實作 commit：`1c6418ebdf41f8d410fb1890821badceca94960e`。
- 本次文件整理前的完整交接 commit：`fe8beaaa8af5312272b68cfcf2fa49686f154f32`；此版本已包含 3,000 題與最終驗證。
- 原 pilot 100 題，加上第一輪 20 批 × 100 題、第二輪 9 批 × 100 題，共處理 3,000 candidates，範圍 **0–2999 inclusive**。
- 所有追加批次均在本機依序生成、驗證、累積整合去重、提交並推送。原始 shards 與 run manifests 保留，累積 catalog 更新。

| 指標 | 累積結果 |
| --- | ---: |
| 可用 unique puzzles | 3,000 |
| 重複 | 0 |
| 品質拒絕 | 0 |
| 正確性 UNKNOWN | 0 |
| Research analysisIncomplete | 1,898 |

`analysisIncomplete` 表示原始難度研究分析覆蓋未完整，與正確性驗證分開；不得將 skipped 或 UNKNOWN alternatives 當作安全步驟或死路。所有題目保留原始 workload／trap／recovery 指標，尚無新的 Easy／Medium／Hard 分類。

## 讀取與驗證入口

- [分批資料交接](../data/batches/mac-local-pilot-v1/README.md)：欄位說明與使用方式。
- [累積 catalog](../data/batches/mac-local-pilot-v1/catalog.json)：另一個工作讀題的主要入口，使用 `acceptedPuzzles`。`candidates` 保留相同題目的 audit records，不能相加計數。試管內容順序為由底至頂。
- [批次 summary](../data/batches/mac-local-pilot-v1/summary.json)：29 批的範圍、count、耗時、記憶體、生成 commit、SHA-256 與設定。
- [環境](../data/batches/mac-local-pilot-v1/environment.json)及各批 `.run.json`：實際執行 provenance。
- [最終 verification](../data/batches/mac-local-pilot-v1/verification.json)：29 組 shard／manifest 與 catalog SHA-256 核對通過；全部 shards 反向重新合併，與逐批累積 catalog 完全 byte-identical。
- [原 pilot 報告](mac-local-pilot.md)：100 題重跑／分段一致性證據、初始品質檢查與研究指標。

供其他工作固定讀取的 [3,000 題 JSON](https://raw.githubusercontent.com/laicwben2/water-sort-level-generator/fe8beaaa8af5312272b68cfcf2fa49686f154f32/data/batches/mac-local-pilot-v1/catalog.json) 與 [交接說明](https://github.com/laicwben2/water-sort-level-generator/blob/fe8beaaa8af5312272b68cfcf2fa49686f154f32/data/batches/mac-local-pilot-v1/README.md) 使用上述 immutable commit。

Catalog logical digest：`4a5e5ac53a6036ac1a0eb8d99a4fd7d9f7bcfbf04e077b6ec4dd73ecccbfceec`。

Catalog 檔案 SHA-256：`ee06d644a659beaa6c628285f052a33776643c2ee77cfe37b7d090ca2b13fe62`。

## 環境與驗證範圍

原生 macOS 26.6／ARM64，Node **24.19.0**、npm **11.17.0**，既有 lockfile 保持不變；使用本機 CPU／RAM，以 `caffeinate` 保持運算期間喚醒。GitHub 僅保存原始碼、題目與紀錄，未使用雲端生成運算。

Seed 維持 `mac-local-pilot-v1`。設定為 colors 5／6／7、capacity 4、max empty tubes 5、proof depth 100／100000 states；mistake analysis 25000 states／depth 100／20 steps／6 alternatives／severe penalty 5。各批 manifest 記錄 clean Git source state；批次間的 publication commits 不改變產題程式或設定。

追加 29 批 manifest 的生成／分析／驗證 elapsed 合計約 **266.821 秒**，不含原 pilot，也不含檔案寫入、額外 merge／validation、commit／push 時間。最大單批記錄 maxRSS 約 **281.8 MiB**，為寫檔前的 resource snapshot；不是累積 merge 的記憶體上限。機器負載與題目成本會影響速度，不將此數字當作後續保證。

實作階段 `npm ci`、68 tests／9 files 與 build 通過。此後產題使用相同實作與 lockfile；原始 shards 與累積 catalog 已逐批驗證。2026-10-05 改善實作後的完整測試為 93 tests／15 files 與 build 通過，沒有重新生成或修改正式題目。

## 待辦與恢復方式

- Windows 原生跨平台 certification 尚未執行；不能宣稱已完成 Mac／Windows 認證。
- 新難度分類、人類資料校準、選題及 Runtime Pack 匯出尚未進行；目前 catalog 為 audit／research artifact。
- 更完整的研究 coverage 可使用已保存 board／optimalSolution 另做 reanalysis，輸出獨立 artifact，保留原始 shards。
- 若之後獲授權繼續產題，下一個未使用 candidate index 為 **3000**，下一批為 **3000–3099**。沿用同 seed／config／runtime，輸出到新的路徑，先驗證再與目前 catalog 合併。不要重新生成 0–2999，也不要把 catalog 與其已包含的 shards 再合併。

恢復後可參照 [本機生成與整合規格](local-generation.md)。範例僅供後續明確授權時執行：

```sh
npm run generate -- --seed=mac-local-pilot-v1 --start-index=3000 --end-index=3099 --output=output/shard-003000-003099.json
npm run validate -- --file=output/shard-003000-003099.json
npm run merge -- data/batches/mac-local-pilot-v1/catalog.json output/shard-003000-003099.json --output=output/catalog-through-003099.json
npm run validate -- --file=output/catalog-through-003099.json
```

檢查接受數、重複與 UNKNOWN，再更新交接 summary、環境／驗證紀錄、catalog 並提交推送。既有工具拒絕覆寫已存在的 output；使用新路徑。若從此 workspace 的終端恢復，先依本機規格設定 `.local` Node 的 PATH；其他機器安裝相同 exact runtime 並執行 `npm ci`。
