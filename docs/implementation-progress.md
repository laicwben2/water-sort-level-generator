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
