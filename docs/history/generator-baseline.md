# Generator v1 Baseline

量測日期：2026-09-20

樣本：Easy、Medium、Hard 各 1,000 個 Level Mode seeds，共 3,000 關

## 目的

這份 baseline 用來量化現行 `v1` generator 的可靠性、開場液面分布、多樣性與效能。後續 `v2` Classic generator 必須與這份資料比較，不能只因為畫面變整齊就視為改善。

## 重現方式

```bash
npm run analyze:generator -- --version=v1 --levels=1000
```

分析工具位於 `scripts/analyze-generator.mjs`，對每個 `difficulty + level number` 執行以下檢查：

- 相同 seed 生成兩次的完整 puzzle 必須一致。
- 開場不能是 solved state。
- 每根試管不能超過容量。
- 每種顏色必須恰好保留四層。
- 保存的每個 solution move 必須符合正式倒水規則。
- 重播完整 solution 後必須達成勝利條件。
- 統計空管、partial tubes、complexity、已知解長度及生成時間。
- 分別計算完全相同、忽略試管順序、忽略試管順序與顏色 ID 的重複盤面。

忽略試管順序與顏色 ID 的重複檢查會先建立結構 fingerprint，再以雙向顏色 mapping 及試管配對確認 board isomorphism。分析工具包含正例與反例的啟動自我檢查。

## 結論摘要

- 3,000 關全部通過 determinism、容量、顏色守恆與 solution replay，沒有 invariant failure。
- Classic occupancy 只出現在 6.1%–9.3% 的關卡，證實液面不齊是 `v1` 的常態，不是少數例外。
- 約 77%–81% 的關卡只有一根完全空管；約 12%–14% 甚至沒有完全空管。
- Easy 有明顯結構重複：忽略試管順序與顏色 ID 後，1,000 關中有 374 關與先前盤面同構。
- Medium 的同構重複降至 6 關，Hard 樣本中沒有發現同構重複。
- 已知解長度高度集中在最低門檻附近，表示現行難度主要來自顏色數增加，而不是經過 solver 校準的解題深度。
- 即使 Hard，平均單次生成仍約 4.1 ms，為後續 constrained search 留有相當效能空間。

## Occupancy

### Classic 命中率

Classic board 定義為：恰好有設定數量的完全空管，其他所有試管均裝滿。

| Difficulty | Classic boards | Classic rate | 有 partial tube |
|---|---:|---:|---:|
| Easy | 80 / 1,000 | 8.0% | 92.0% |
| Medium | 93 / 1,000 | 9.3% | 90.7% |
| Hard | 61 / 1,000 | 6.1% | 93.9% |

### 完全空管數量

| Difficulty | 0 empty | 1 empty | 2 empty |
|---|---:|---:|---:|
| Easy | 124 | 796 | 80 |
| Medium | 138 | 769 | 93 |
| Hard | 128 | 811 | 61 |

雖然三種難度的設定都是 `emptyTubes: 2`，但 `v1` 多數關卡只有一根完全空管。設定保留的是八格總空間，不是最終畫面上的兩根空管。

### Partial tube 數量

| Partial tubes | Easy | Medium | Hard |
|---:|---:|---:|---:|
| 0 | 80 | 93 | 61 |
| 2 | 331 | 121 | 66 |
| 3 | 374 | 436 | 400 |
| 4 | 163 | 222 | 346 |
| 5 | 45 | 55 | 31 |
| 6 | 7 | 61 | 60 |
| 7 | 0 | 12 | 33 |
| 8 | 0 | 0 | 3 |

最常見情況是三根 partial tubes；Hard 的空間分散程度更高。

## Complexity 與已知解長度

| Difficulty | Complexity min / mean / p95 / max | Solution min / mean / p95 / max |
|---|---|---|
| Easy | 20 / 25.849 / 31 / 35 | 8 / 8.929 / 11 / 13 |
| Medium | 30 / 38.125 / 43 / 51 | 12 / 12.682 / 14 / 16 |
| Hard | 40 / 50.260 / 55 / 61 | 16 / 16.515 / 18 / 21 |

目前最低 solution length 門檻是 `colors × 2`，而三個難度的平均值都只比門檻多不到一步。這條 solution 是建構過程保存的合法路徑，不保證是最短解，因此不能單獨作為真實難度指標。

## 多樣性

表中的數字代表第 2 次以後出現的重複樣本數，而不是 unique group 數量。

| Difficulty | Exact duplicates | Ignore tube order | Ignore tube order + color ID |
|---|---:|---:|---:|
| Easy | 16 | 71 | 374 |
| Medium | 0 | 1 | 6 |
| Hard | 0 | 0 | 0 |

Easy 的顏色與試管較少，在忽略純視覺重新編號後只有約 626 個結構上不同的盤面。`v2` 應加入 canonical recent-history rejection 或擴大有效搜尋空間，避免玩家在較低 Level 反覆看到本質相同的題目。

## 生成效能

數值為毫秒，量測單次第一次生成；determinism 驗證使用的第二次生成沒有納入時間統計。

| Difficulty | Min | Mean | p50 | p95 | Max |
|---|---:|---:|---:|---:|---:|
| Easy | 0.119 | 0.295 | 0.206 | 0.693 | 4.381 |
| Medium | 0.298 | 0.888 | 0.690 | 2.188 | 7.918 |
| Hard | 0.663 | 4.146 | 2.844 | 11.996 | 31.430 |

這是在目前 Node runtime 的相對基準，不代表 iPhone Safari 的絕對時間。後續 prototype 應在相同環境先比較，再補實機量測。

## 對 v2 的直接要求

根據 baseline，`v2` Classic prototype 至少要做到：

- Classic occupancy rate 由目前 6.1%–9.3% 提升至 100%。
- 保持 0 invariant failures 與 100% solution replay success。
- Easy 的 color-isomorphic duplicate rate 顯著低於目前 37.4%。
- 不讓 complexity 與已知解長度全部集中在最低接受門檻。
- 批次生成時 p95 latency 維持在手機可接受範圍。
- 使用 `water-sort:v2:` seed namespace，不改變既有 `v1` 關卡。

## 測試狀態

核心 Vitest suite 已增加每種難度 25 個 Level seeds 的 batch invariant test。目前另外登記兩個 Classic `v2` todo specifications：

- 開場必須恰好具有設定數量的完全空管。
- 開場所有非空試管必須裝滿。

這兩項在 `v2` 尚未實作前保持 todo，避免把現行 `v1` 的預期行為誤寫成 passing contract。
