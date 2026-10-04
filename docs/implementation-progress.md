# 審查改善實作紀錄 — 2026-10-05

依 [審查待辦](review-backlog.md) 分段實作，每段驗證後提交推送。既有 3,000 題 artifact 與版本化 deterministic contract 保留；小型測試 fixtures 不作正式新增題目。

## 第一段：CLI 安全與參數（R05、R12）

新增共用 strict option parser，生成／重新分析／整合／認證／驗證在 I/O 前拒絕未知、空值、重複 flags；`--help` 先返回，不會運算或寫檔。legacy 正整數不再接受 `1x`；range／legacy 不容混用。重新分析使用共用 config validator，預算與 severe threshold 必須 ≥1。legacy output 預設 exclusive create，只有明確 `--overwrite=true` 可覆寫。

驗證：CLI regression 涵蓋 help、兩個 range 旗標拼錯、重複 seed、零值與錯字；既有 CLI／determinism tests 保留。其他舊 exporter／benchmark 的完整 option schema 尚待後續擴充，不能宣稱所有 CLI 均已覆蓋。

第一段驗證結果：74 tests／9 files 通過，`npm run build` 通過。

## 第二段：研究資料驗證（R11、R06 基礎）

共用 recovery arithmetic validator 檢查零事件、最大 penalty、總 penalty、severe count／threshold 界限，以 BigInt 防乘法溢位；audit／local shard 皆適用，舊 audit 的 optional raw totals 保持相容。新增 research v1／v2 validator，驗證 checksum、config、record 順序／count／coverage，`validate --source=SHARD` 可加驗來源 digest、candidate／canonical identity 與原有 structural／optimalPath。未提供 source 時明示 `sourceVerified=false`，不宣稱獨立 solver 證明。

R06 的選題／checkpoint 在下一段實作；現階段保持原有研究輸出格式。

第二段驗證結果：82 tests／10 files、build 通過；已發布 research smoke artifact 加來源驗證通過。

## 第三段：相容的效能改善（R02 短期、R04、R08 初步）

完整物件比較改用 deep strict equality，避免為比較額外建立 sorted JSON；digest 與輸出 serializer 保持原樣。路徑驗證／choice／staging 統計合併為一次走訪；mistake analysis 直接重用 packed transitions 的 board／key。每個 expansion 預計算 tube metadata，BigInt shift constant 只建立一次；transition／heap 排序與 exact identity 保持。

實測 3,000 題 validation 約 1.32–1.55 秒（舊審查觀測 2.55 秒；不同輪負載不可當穩定倍率）；前一量測程序 maxRSS 354.8 MiB。交錯 A/B 的 warm 20 題 reanalysis：舊 477.97／453.80 ms、新 486.03／445.17 ms，尚未證明 solver 有穩定加速，因此不承諾該項倍數。TypedArray 排序方案已撤回。R02 長期 immutable manifest、R08 operational queue 指標與進一步 profiling 尚在後續。

相容驗證新增：既有 candidate 50 完整結果與 100 題 pilot 的所有 research records 相等；原題庫 3,000 題新版 validator 通過、digest 不變。

第三段驗證結果：84 tests／10 files 與 build 通過。

## 第四段：成組發布與恢復（R03）

generation 先將兩個檔案寫入唯一 staging directory，flush 後發布 checksum journal，再 exclusive link 正式題目／manifest，最後寫 `.complete.json` 標記。中斷時保留 `.pending.json` 與 staged 原檔，`npm run recover:artifact -- --file=SHARD.json` 核對 checksum 後完成發布，不重新求解、不捏造 timing、不覆寫矛盾既有檔案。寫檔失敗時 temporary files 在 finally 清理；失敗前已發布 journal 的資料保留供恢復。

單檔既有 reader 保持相容；新的批次工具以 complete marker 為成功條件。歷史 3,000 題無標記，不回寫假標記；透過既有 checksum／validator 驗證。測試涵蓋正常發布、拒絕覆寫、發布間中斷與既有檔案衝突。作業系統整機斷電的 directory fsync 行為尚未實機驗證，不宣稱跨平台 power-loss certification。

第四段驗證結果：86 tests／11 files 與 build 通過。

## 第五段：選題與可續跑研究（R06）

`analyze:shard` 新增 inclusive `--start-index=N --end-index=N`、`--only-incomplete=true`、`--resume=true`。輸出升為 `local-research-v2`，明示選中 indices；v1 仍可讀／驗。每題完成即 exclusive 寫 checksum-bound checkpoint，來源 digest／分析版本／完整設定／選題不一致時拒絕續跑；已有完整 output 可驗證後返回。逐題顯示進度與 checkpoint 重用狀態，保留 checkpoints 供稽核，不改原 shards。

範例：`npm run analyze:shard -- --input=data/batches/mac-local-pilot-v1/catalog.json --output=output/research-selected.json --start-index=0 --end-index=99 --only-incomplete=true`。中斷後加 `--resume=true`，保持其他參數一致。對同一 output 同時開多個程序不支援；exclusive files 會使競爭者失敗，而不覆寫已完成結果。

第五段驗證結果：87 tests／12 files 與 build 通過。

## 第六段：完整 worker telemetry（R01、R08 operational 指標）

local generate／certify／merge／reanalyze 改為父程序監督 worker；每 10 秒顯示 heartbeat，完成／失敗都在 `OUTPUT.process-runs/UUID.json` 保存 operational report。父程序記錄含 worker 啟動／退出的 wall time，worker 成功自然退出前回報含 artifact／manifest／marker 寫入後的 maxRSS／CPU；強制終止時缺失資源資料明示 null，不捏造數據。Report 自身寫入與父程序 RAM 不包含在 worker 資源數字。

階段包含 load、proof、analysis、generate、validation、assemble、serialize、write；inclusive nested phases 不可直接全部相加。原 `.run.json` 保留相容的 partial timing，完整效能以 process report 為準。新增 solver operational allocatedNodes／peakQueue／reopens；不進入 deterministic artifact，也不影響 integer correctness budgets。

第六段驗證結果：87 tests／12 files 與 build 通過；新增 CLI report 斷言已驗證含 write、solver calls 及 terminal RSS。

## 第七段：coverage 與穩定 namespace（R07、R10）

新增 `report:coverage -- --input=SHARD --output=REPORT [--comparison=RESEARCH]`，不呼叫 solver，以顏色數／最佳解長分組顯示 selected steps、skipped、eligible、known、UNKNOWN；比較研究檔時使用同一 candidate subset 的 baseline，避免不同母群相混。明示 deterministic 採樣不是隨機樣本、raw counts 尚無人類難度校準；不改 sampling／analysisVersion。高 coverage sensitivity 與人類資料校準仍需獨立研究。

新增 `candidateIdentity(shard,index)`：完整 config＋reproducibility namespace＋index 作穩定結構身份，範圍／catalog digest 不進入身份。既有 `puzzle.id` 僅為 namespace 內 alias，未改寫 3,000 題。其他工作匯入時保存完整 identity，hash 僅供查找提示；`(sourceShardDigest,index)` 另外作特定 artifact locator。

第七段驗證結果：coverage／identity 兩項測試及 build 通過；3,000 題 coverage report 已產生於 ignored output，未改原 artifacts。

## 第八段：immutable shards／catalog index（R02 長期方案）

新增 `local-catalog-index-v1` 小型 manifest：綁定所有 immutable shard 檔案 checksum／logical digest／namespace，保存 exact canonical winner 與 ranges／counts。首次載入外部 index 會逐一驗證參照檔案並重建投影，不能只信任 index 自己的 checksum；同一已驗證 session 追加時只驗新 shard。metadata 更新仍隨題數成長，但不再每批重寫完整重複 board／solution payload。

`npm run index:catalog -- shard-a.json shard-b.json --output=INDEX.json` 建立；`--input=INDEX.json` 驗證；加 `--materialize=CATALOG.json` 才建立既有 v1 完整 catalog，與原 merge contract 相容。輸出預設不覆寫，所有歷史 blobs 保留。原 3,000 題 catalog 不回寫或刪除。

第八段驗證結果：index 順序／投影／overlap／checksum 測試及 build 通過。

## 第九段：正式本機批次工具（R09）

新增 `batch:local`，以 tracked immutable plan／shards／index snapshots 與 ignored operational state 分離。支援 dry-run、status、resume、publish-retry；quota 明確是 candidate range。每批依序生成、complete marker 核對、validation、更新小型 exact index／交接 README，再 optional commit／push。保留 git／generation 各階段時間；恢復前核對 baseline checksum、來源 src tree／lockfile、branch／namespace。Push retry 不重產題，不 force-push 或自動合併遠端分歧。預設不 publish，需建立 plan 時明確 `--publish=true`；同 directory 不支援並行 runner。

僅做 dry-run，不新增正式題目的例子：`npm run batch:local -- --baseline=data/batches/mac-local-pilot-v1/catalog.json --directory=data/batches/next-local-series --start-index=3000 --end-index=3099 --dry-run=true`。啟動時顯示 pinned runtime、磁碟、候選範圍與下一個 index。恢復：`--directory=DIR --resume=true`；只看狀況：`--status=true`；發布失敗後只重送：`--publish-retry=true`。

第九段驗證結果：92 tests／15 files 與 build 通過。暫存 Git repository／本機 bare remote 整合測試涵蓋 dry-run 零產題、push 拒絕、publish retry、resume 不重產。已對正式 3,000 題基線做下一批的 dry-run，未新增題目。
