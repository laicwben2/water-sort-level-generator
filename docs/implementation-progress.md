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
