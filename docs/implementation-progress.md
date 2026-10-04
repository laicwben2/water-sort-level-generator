# 審查改善實作紀錄 — 2026-10-05

依 [審查待辦](review-backlog.md) 分段實作，每段驗證後提交推送。既有 3,000 題 artifact 與版本化 deterministic contract 保留；小型測試 fixtures 不作正式新增題目。

## 第一段：CLI 安全與參數（R05、R12）

新增共用 strict option parser，生成／重新分析／整合／認證／驗證在 I/O 前拒絕未知、空值、重複 flags；`--help` 先返回，不會運算或寫檔。legacy 正整數不再接受 `1x`；range／legacy 不容混用。重新分析使用共用 config validator，預算與 severe threshold 必須 ≥1。legacy output 預設 exclusive create，只有明確 `--overwrite=true` 可覆寫。

驗證：CLI regression 涵蓋 help、兩個 range 旗標拼錯、重複 seed、零值與錯字；既有 CLI／determinism tests 保留。其他舊 exporter／benchmark 的完整 option schema 尚待後續擴充，不能宣稱所有 CLI 均已覆蓋。

第一段驗證結果：74 tests／9 files 通過，`npm run build` 通過。
