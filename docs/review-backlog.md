# 審查與改善待辦 — 2026-10-04

審查基準：`93cb2e264c6263e072f4d7fbaf2dbcb1435ae2df`，分支 `feat/local-deterministic-shards-v1`，累積 3,000 題。依使用者要求逐項記錄，本輪僅更新文件，不修改產品程式碼、不新增正式題目。狀態：審查進行中；以下皆為待辦，尚未實作。

優先級：P1＝影響結果可信度或失敗後恢復；P2＝明確效能／操作改善；P3＝需量測再決策。程式位置以審查基準版本為準。實測與推論分開標示，效能提案須維持 deterministic seed／排序、exact canonical identity 與 UNKNOWN 語意。

## R01 · P2 · 執行紀錄缺少完整流程耗時與真正的程序尖峰記憶體

- 狀態：待辦；已確認程式行為。
- 位置：`src/cli/local.ts:75–90`、`src/cli/merge.ts:14–17`。
- 問題：generation 的 `finishTime`、`elapsedMs`、CPU 與 maxRSS 在輸出 shard／manifest 前取樣，因此省略 JSON 序列化及寫檔。merge 另讀入所有 JSON、驗證、組裝、序列化，卻沒有相同 run manifest。現有 29 批摘要只加總 generation 的部分時間，無法據此評估每批生成→合併→驗證→提交→推送的實際耗時或 merge 尖峰記憶體。現行文件已提醒此限制，但工具仍不能直接回答瓶頸所在。
- 改善方式：新增 operational manifest schema，分別記錄 load／generate／analysis／validate／assemble／serialize／write 各階段及 command total；merge 也產生紀錄。由父程序在子程序結束後收集整體 maxRSS／CPU，避免最後一次寫檔發生在取樣之後。Git／push 耗時由批次 runner 分開記錄，勿混入 deterministic shard 或 correctness budgets。
- 驗證：在相同既有 shards 上量測，確認 phase totals 與 command wall time 可對帳（列出額外 overhead）、覆蓋成功與失敗狀態，且加入 operational telemetry 前後 deterministic JSON／digest 完全一致。不要使用 wall-time cutoff 改變 accepted／UNKNOWN 分類。

## R02 · P2 · 每批重新處理完整 catalog，累積成本隨批數呈平方成長

- 狀態：待辦；資料流已確認，接續實測成本。
- 位置：`src/cli/merge.ts:14–16`、`src/shard.ts:63–81,155–187,215–217,312–324`；既有每 100 題合併一次的操作流程。
- 問題：merge 每次完整讀取／解析舊 catalog、逐題驗證、重建投影與 digest，再序列化整份新 catalog。`validateLocalShard` 本身也重建 shard 並對兩份完整物件排序序列化比較。固定批量 B、共 K 批時，反覆掃描的資料量是 B×(1+…+K)，即 O(BK²)，尚未計入每批額外 validate 與 Git 全檔變更。`acceptedPuzzles` 和 `candidates[].puzzle` 在記憶體生成時可共用參照，寫成 JSON／讀回後則成為重複 payload。
- 具體改善：先量測 load／validate／assemble／serialize 成本與尖峰 RSS。短期以 schema-aware 深比較取代通用 stringify 比較，使用維持相同 sorted-key／LF／縮排輸出的串流 writer，對 byte stream 增量計算 digest。長期以 immutable shards + 小型 manifest／exact canonical winner index 作每批發布入口，需要完整 v1 catalog 時再物化；保留每 100 題 push 的節奏，但不必每批重寫完整 catalog。若採新儲存格式，使用新 formatVersion 並提供 v1 adapter，不能默默改既有 digest 或消費介面。
- 完整性要求：增量驗證只信任本機已驗證且綁定完整內容 digest 的 immutable inputs；外來資料第一次仍完整驗證。需處理最低 candidate index winner 替換、重疊／缺口、版本／config 不相容，不能用機率 hash 取代 exact canonical equality。
- 驗證：100／1,000／3,000 既有資料的時間、尖峰 RSS、bytes；正向／反向／隨機分批合併結果一致，v1 adapter byte-identical；損壞 shard／index／digest 必須拒絕。沒有量測前不宣稱具體加速倍數。

本機實測補記（Node 24.19.0，每組新程序、單次觀測、無新產題）：讀取既有 JSON → `validateLocalShard` → `serialize`，全部重輸出 byte-identical。時間未涵蓋磁碟寫入、Git 或 push；RSS 為該測試程序截至序列化後的高水位，不能當機器總 RAM。

| 候選數 | JSON bytes | load ms | validate ms | serialize ms | 小計 ms | maxRSS MiB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 1,413,153 | 3.21 | 83.59 | 10.75 | 97.55 | 93.67 |
| 1,000 | 14,081,688 | 37.41 | 632.51 | 92.57 | 762.50 | 276.41 |
| 3,000 | 42,293,397 | 102.15 | 2,550.96 | 259.17 | 2,912.27 | 466.41 |

結論限於此次觀測：3,000 題驗證約占此流程 87.6%，應先追查驗證重工；既有 generation manifest 的 281.8 MiB 峰值無法代表 catalog 處理需求。1,000 題輸入是已存在的 `output/mac-local-pilot-v1-expansion/catalog-through-000999.json`，可由已發布 index 0–999 的 shards 重建；另兩組直接讀已發布 pilot／catalog。

Git／資料體積補記：目前 catalog 42,293,397 bytes，加上 29 份原始 shard 40,923,062 bytes，兩者合計 83,216,459 bytes（未含 pilot／manifest）。catalog 內 `acceptedPuzzles` 單独 pretty JSON 約 16,848,737 bytes，而同題 payload 亦保留於 candidates。29 個不同歷史 catalog blobs 的**未壓縮邏輯內容**合計 653,807,889 bytes；這不是 clone 網路量或壓縮後 repository 大小。實測 `git count-objects -vH` 為 loose objects 79.61 MiB、pack 505.90 KiB（本機當下狀態，打包會改變）。採 immutable shards＋小型 manifest 後可避免每批生成新的完整 catalog blob；既有歷史保留，不建議為此重寫已發布 history。

原批次 execution log 另可估算 command-start 到下一個 command-start 的區間：29 次 generate 共 298.153 秒、58 次 validate 共 163.311 秒、29 次 merge 共 111.480 秒、29 次 git commit 共 158.231 秒。這些區間包含程序啟動及中間 runner 工作，不能當精準函式時間；已排除跨輪停頓及無下一筆 timestamp 的最後 push。與 R01 的 manifest generation 合計 266.821 秒相比，足以證實端到端耗時不只有 solver。先補精準 phase telemetry 再決定發布／儲存設計。

## R03 · P1 · 題目與執行紀錄的發布不是同一個可恢復交易

- 狀態：待辦；已由寫入順序確認可發生的不完整狀態，尚未做故障注入。
- 位置：`src/cli/local.ts:37–49,58–60,88–89`。
- 問題：先發布 `.json`，再發布 `.run.json`；第二次寫入失敗或程序在兩次之間中斷，會留下正式 shard 但缺 manifest。重跑又因 shard 已存在而立即拒絕。單檔 hard-link 防覆寫保護有效，但不能保證一組 artifact 完成。若 `writeFile` 失敗，temporary file 的清理也不在目前 `finally` 範圍內。
- 具體改善：引入「準備→寫完兩檔→完成標記」protocol：以唯一 run directory 保存 temporary shard／manifest，flush／close 後發布檔案，最後原子發布小型 commit marker（含檔名、兩檔 checksum、schema）。reader／runner 僅將 marker 完整者視為可發布批次；啟動時辨識 partial state，驗證已完成 shard 後提供明確 recovery 路徑，缺失 timing 不可捏造，應標示 interrupted／unavailable。保留 exclusive publication，勿採先刪除既有輸出的修復方式。
- 驗證：故障注入磁碟滿、第二檔寫入失敗、各階段中斷、重複執行、兩程序競爭同 output；已存在題目永不截斷、partial state 可辨識，且恢復不改邏輯 digest。

## R04 · P2 · 驗證重複走訪最佳解路徑，研究分析丟棄已算好的 successor 後再重算

- 狀態：待辦；重複呼叫已由程式確認，尚未量測個別函式占比。
- 位置：`src/validator.ts:85–118`、`src/difficulty.ts:97–112,178–196`、`src/solver.ts:74–91`、`src/solver-state.ts:207–248`。
- 問題：validator 先 replay solution，再 `analyzeSolutionPath`；之後 `analyzeOptimalPathDifficulty` 內又呼叫一次 `analyzeSolutionPath` 並再 replay。每一步的 `listLegalMoves` 會建立所有 packed successor boards 與 exact keys，但只回傳 move；mistake analysis 隨後再對這些 moves `applyMove`、pack、計算 key，最後只取前六個來求解。
- 改善方式：以單次路徑走訪共用 immutable per-step snapshot，統一取得 legality、path metrics、staging 與選中 step 的 transitions；mistake analysis 直接消費既有 `{move, board, key}`，必要時只對選中 successor 解包。validation 共享重算結果，不直接信任輸入中的 cached metrics。先優化確定的重工，再依 CPU profile 決定是否改善 BigInt key／transition allocation。
- 驗證：相同 puzzles 的完整 research／solutionPath metrics 與 serialized digest 不變；包含 symmetry 排除、move 排序 tie、不同 capacity、採樣限制與 UNKNOWN cases。以 profiling 比較 transition 次數、配置量、CPU；不得因「少算」改變 sampling 順序或 eligible denominator。

## R05 · P1 · 重新分析的錯誤參數被靜默忽略，且允許不符合生成規格的零值

- 狀態：待辦；已在 temporary directory 實際重現，原題庫不變。
- 位置：`src/cli/analyze-shard.ts:8–15`、`src/cli/args.ts:1–4`、`src/cli/local.ts:13–34`；對照 `src/cli/generate.ts:10–16` 及 `src/shard.ts:93–108`。
- 重現：對既有 `candidate-000050.json` 重新分析，使用 `--analysis-max-steps=1 --analysis-max-alternatives=1 --analysis-max-state=1`（state 少 s），指令成功且結果實際使用 `maxVisitedStatesPerAlternative=25000`。再用 `--analysis-max-states=0 --severe-penalty=0`，同樣成功輸出，未走 generation 的 config ≥1 驗證。重複旗標也是 `find()` 第一個值勝出。這會使使用者要求的計算預算／分析語意與實際執行不符。
- 改善方式：建立各 CLI 共用的 option schema：明確 allowed／required／repeat policy、strict integer／min bounds，先驗證全部參數再讀入或開始昂貴工作。analysis config 共用單一 runtime validator；只接受 analysis 所需欄位。若零值是刻意支援的模式，需定義顯式 flag／schema，而非偶然繞過限制。merge／certify／validate 與 legacy args 也一併盤點，舊 CLI 相容性需明確規劃。
- 驗證：拼錯、重複、空值、負數、0、`1x`、過大整數、無關 flags 均得到具體錯誤且不產生 output；有效旗標完全反映在輸出 config，並提供 `--help`／建議拼字。既有預設結果保持一致。

## R06 · P2 · 研究輸出缺少對應 validator、篩選與恢復能力

- 狀態：待辦；格式驗證缺口已實測，其餘由 CLI 確認。
- 位置：`src/cli/analyze-shard.ts:12–18`、`src/cli/validate.ts:12–16`。
- 問題：`analyze:shard` 輸出 `local-research-v1`，但 `validate` 只辨識 local-shard／audit-v2；對有效研究檔會報 `Unsupported audit version: undefined`。重新分析也只能一次 `map` 所有 accepted puzzles，沒有 candidate selection、逐題進度、run manifest 或恢復點。對 3,000 題只想提高少數題的 coverage，必須外部處理或全部重算。
- 具體改善：增加 research 格式 dispatcher／validator，檢查 source shard digest、版本、config、record identity／重複、完整性 digest、count／ratio accounting；提供明確 source lookup，避免把 checksum 當 solver 證明。支援 candidate range／ID selection／only-incomplete、分批 checkpoint 與 resumable manifest；重跑 key 應包含 source digest＋candidate identity＋analysis config＋analysisVersion。對 selected subset 明示 selection 與 coverage，不偽裝完整分析。
- 驗證：既有 research smoke artifact 可驗；亂改來源、缺／重複 records、錯誤比例或 config 必須拒絕。分批與完整同設定 reanalysis 對選中題結果一致；中斷後只重算未完成 records。

## R07 · P2 · 研究 coverage 隨顏色數明顯不同，容易混淆未分析與較容易

- 狀態：待辦；已彙整全部 3,000 題原始 records，未重跑 solver。
- 位置：`src/difficulty.ts:123–143,195–197,245–267`；已發布 catalog／summary。
- 證據：目前 summary 只有總 `analysisIncomplete=1898`，而分組結果如下。這不是正確性失敗；UNKNOWN alternatives 總數仍為 0。

| 顏色數 | 題數 | 不完整題數 | skipped steps | skipped alternatives |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 1,000 | 242（24.2%） | 0 | 502 |
| 6 | 1,000 | 699（69.9%） | 40 | 3,041 |
| 7 | 1,000 | 957（95.7%） | 1,408 | 7,430 |

- 問題：固定 20 steps／6 alternatives 對不同題組覆蓋不同；alternatives 取排序後前六個，受 joinsColor／amount／from／to 影響，不是隨機代表性樣本。當前 raw mistake count／penalty totals 不適合直接跨 coverage 排難度。這是分析用途限制，不能將 95.7% 不完整解讀成無解或錯題。
- 改善方式：報表分顏色數／解長顯示 eligible、known、skipped、UNKNOWN 與採樣策略；分類前先做固定題組的高 coverage sensitivity study，再選擇重分析預算或 deterministic 分層採樣。任何改變 sampling 的方法需新 analysisVersion，並保留原始 artifact；不能只改顯示比例就宣稱校準完成。
- 驗證：同一組既有題比較預算提升前後的 known coverage、trap／recovery 指標穩定性及人類資料關聯；明確區分 selected-step coverage 與全解路徑 coverage。

## R08 · P2 · Solver 實測熱點在 exact state key 與 transition 建立，應優先做保持語意的優化

- 狀態：待辦；已對既有 pilot 100 題做一次 CPU sampling profile 的 reanalysis，100/100 research 結果與已發布 records 完全一致。未產生新題或修改來源。
- 位置：`src/solver-state.ts:94–98,207–248`、`src/solver.ts:153–194`。
- 實測：reanalysis elapsed 約 3,528.56 ms；整個受測程序 2,883 self samples 中，`packedStateKey` 41.6%、`listPackedTransitions` 23.8%、`solveBoard` 13.9%，GC 約 2.0%。這是單次 profile（含程序啟動，tsx frame 行號不作定位依據），不是普遍加速比；但足以優先於猜測式平行化或降低 proof budgets。
- 具體改善：先套用 R04，避免反覆建立同一批 transitions；再為每個 expansion 共用 tube length／top／run-length 資料，減少 pair loop 重掃。key 建立可比較 reusable numeric sort scratch buffer、預先固定 BigInt shift constant 與精確增量排序方案；最終 key 仍須包含 tube 數及完整排序後 20-bit 序列。量測後才決定方案，不能以有碰撞的 hash 代替 exact identity。
- 記憶體注意：`bestDepth.size` 只限制 unique states；較短路徑更新時 nodes／heap 可保留舊節點（`src/solver.ts:175–194`）。因此 100000 states 不等於固定配置上限。先新增 operational allocatedNodes／peakQueue／reopens 指標；沒有量測前不把這點宣稱為已發生 OOM。
- 驗證：現有 deterministic outputs、heap tie／transition order、visited／generated metrics 與 budget 邊界一致；多顏色／不同 capacity／UNKNOWN 的既有 fixtures 比較 CPU 與 RSS。若改變搜尋順序或預算意義，必須新 solver／generator version 與重新認證，不能沿用原版本冒充相容。

## R09 · P2 · 每百題發布流程依賴未追蹤的本機腳本，缺少正式 resume／status 操作

- 狀態：待辦；已檢查 tracked CLI／package scripts 與 `.gitignore`。
- 位置：`package.json:scripts`、`.gitignore`、本機 `.local/run-2000-batches.cjs`／`.local/run-to-3000.cjs`（被忽略、未發布）。
- 問題：已完成的批次資料可重現，但「每 100 題生成→validate→merge→更新文件→commit→push」沒有可供其他 checkout 使用的正式 runner。現有本機腳本硬編碼 20／29 批及 resume 起點；push 失敗後，檔案已存在或 summary 已前進，不能直接重新跑整個迴圈。使用者需靠手動操作或 agent 才能續跑與判斷階段。
- 具體改善：新增版本控制內的本機 runner，支援 dry-run／status／resume／publish-retry，以 `(seed, full config, versions, range)` + 檔案 digest 確認批次 identity；持久化 generated／validated／merged／committed／pushed 階段。push retry 僅重送既有 commit，不能重產題；遠端前進時停下顯示差異，不 force-push。預設沿用 serial batches，若要並行需另量測記憶體與 machine responsiveness，仍按 index deterministic merge。
- UX：開跑前顯示目標是 candidates 還是 accepted unique quota、既有／新增／累積數、下一個 range、runtime、輸出位置、可用磁碟；提供進度與目前階段、可中止／續跑提示。增加 accepted quota 時設明確 candidate 上限，避免大量拒絕造成無止盡運算。heartbeat 應由 runner／worker 實作，單一同步 solver 內的 timer 不能保證即時輸出。
- 驗證：每階段中斷、push 失敗、已有 output、同 range 重跑、磁碟不足、partial manifest、遠端分歧與重複題；status 可明確指出已提交／尚未推送，不跳過未驗證資料。新 checkout 不依賴 `.local` 腳本即可操作。

## R10 · P2 · Puzzle ID 僅含 index，跨 seed／config 的外部引用可能碰撞

- 狀態：待辦；由 identity 建構與驗證規則確認。現有單 seed 題庫沒有 ID 衝突。
- 位置：`src/shard.ts:132–148,265–267`。
- 問題：`ws-local-v1-c000050` 僅由 index 產生，但不同 batchSeed／colors／capacity 可讓 index 50 對應不同 board。merge 已拒絕不相容 seed／config，因此同一 shard 的安全性仍成立；風險在其他工作將 puzzle.id 單獨當作全域 key、重分析關聯或之後跨 catalog 選題／匯入時。
- 改善方式：先在 schema／交接 contract 明確 `id` 僅在 generation namespace 內唯一；新 consumer 使用結構化 namespace（seed＋完整 config／versions）和 candidateIndex，或引用 `(sourceShardDigest, candidateIndex)` 作特定 artifact locator。後者隨 catalog 增加會變，不能當永久題目 ID。若新增跨 catalog 穩定 ID，需版本化且提供舊 ID alias；fingerprint 只能作索引提示，仍保存完整 identity，不能改既有 3,000 題 ID。
- 驗證：同 index／不同 seed 與 config 可並存而不覆蓋；同設定的 split／merged catalogs 能定位相同 candidate；artifact locator 與 canonical puzzle equality 不混為一談。

## R11 · P2 · 研究數值的 validator 仍接受互相矛盾的 recovery 統計

- 狀態：待辦；已對記憶體中的副本重現，已發布 JSON 未修改。
- 位置：`src/shard.ts:284–299`、`src/validator.ts:119–130`。
- 重現：既有 candidate 50 的 `recoverableMistakeCount=37`、`recoveryPenaltyTotal=42`、`maximumRecoveryPenalty=3`。將 candidate 與 accepted projection 的 maximum 同步改為 0，重新計算 shard digest，`validateLocalShard` 仍接受。這不表示已生成題庫有此錯誤，而是 validator 對重新封裝或外部匯入資料的語意檢查不足；checksum 一致並不足以保證數值合理。
- 改善方式：增加不需 solver 的整數不變式：recoverable=0 時 total／max／severe 必須為 0；recoverable>0 時 max≥1、total≥recoverable、max≤total≤recoverable×max。再驗 severe 與 threshold／max／total 的必要界限，例如 max<threshold 時 severe=0、max≥threshold 時 severe≥1（recoverable>0）。乘積應防安全整數溢位；使用 BigInt 做驗證或等價安全比較。
- 驗證：對已有合法 fixtures 的逐欄 mutation／property tests，特別涵蓋零事件、有正 penalty 卻 max=0、總量小於事件數、severe 和 threshold 矛盾。不要加入需要重跑 solver 才能證明的 invariant；完整最短路徑證明仍屬獨立求解驗證範圍。

## 審查紀錄

- R01–R11 已逐項記錄。已完成容量量測、CLI 重現、coverage 分組、100 題 research CPU profile、批次操作及 recovery consistency 重現；接續整理 Git 成本與優先順序。尚未完成的檢查不代表通過。
