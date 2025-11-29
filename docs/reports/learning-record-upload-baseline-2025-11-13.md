# Learning Record Upload Baseline — 2025-11-13

> Phase 0 目標：量化既有體驗，之後的重構／優化才能明確驗證成效。此文件提供指標定義、量測流程與資料表格，需連續填寫至少兩個工作天。

## 1. 指標清單
| 指標 | 定義 | 量測方式 | 來源/工具 | Phase 0 目標 |
|------|------|----------|-----------|-------------|
| **TTI (Time To Interactive)** | 從 LIFF 頁面開啟到瀏覽器可互動的時間 | Chrome DevTools Performance、WebPageTest；量測手機 (Pixel 6) + iPhone 13 | 手動抓 HAR + `performance.timing`，記錄三次平均 | 建立基準值，後續 Phase 1 需下降 ≥30% |
| **首屏請求數** | 首畫面載入期間觸發的 `<script>/<link>/<fetch>` 數量 | `node scripts/metrics/lru-dependency-map.js` + Chrome Network panel | 自動腳本輸出 + DevTools 篩選 `Initiator=learning-record-upload` | Phase 1 減少至 < 8 |
| **LIFF OOM 率** | LIFF 內嵌 WebView 報「記憶體不足」的比例 | 透過 LINE 開發者後台 → LIFF console & Sentry 錯誤 `OUT_OF_MEMORY`，每日截圖 | Sentry / LINE LIFF logs | Phase 3 降至 <0.5% |
| **平均上傳時長** | 「開始上傳」到 API `200 OK` 的時間，分照片/影片/純文字 | `UploadCenter` log（新增 `upload-events` channel）+ `/tmp/npm-dev.log` | DE/QA 手動測 3 組（Wi-Fi / 4G） | Phase 2 之後 ≤ 90 秒 (Lite) |
| **上傳失敗率** | 失敗任務數 / 總任務數（含自動重試後仍失敗） | 後端 `learning-upload-helper` 結構化 log + UploadCenter UI  | `logs/learning-upload/*.log` 匯入 Sheet | Phase 2 之後 ≤ 2% |

> 備註：所有指標需記錄「裝置、網路、LIFF 版本、commit hash」，避免資料失真。

## 2. 量測流程
1. **準備**
   - `PORT=3002 DISABLE_AUTO_REMINDERS=true npm run dev > /tmp/npm-dev.log 2>&1 & echo $!`（依 AGENTS.md 規範）。
   - `node scripts/metrics/lru-dependency-map.js --markdown > docs/reports/lru-deps-$(date +%Y%m%d).md` 產生腳本依賴報告。
2. **TTI / 請求數**（桌機 Chrome + 手機實測）：
   - DevTools → Performance → 勾選 Screenshots，重播 3 次，取平均。
   - Network panel 過濾 `Initiator`，記錄首屏請求數。
3. **UploadCenter 事件紀錄**：
   - 2025-11-13 起，`learning-record-upload.js` 會透過 `console.debug('UPLOAD_EVENT', …)` 輸出 `enqueue / progress / done / fail`，同時寫入 `window.__uploadEventBuffer`。
   - 抽取這些事件即可計算平均上傳時長、失敗率（必要時把 buffer dump 到 `/tmp/npm-dev.log`）。
4. **LIFF OOM 率**：
   - 每日從 LINE BI/Sentry 匯出錯誤計數寫入 Google Sheet《LRU-LIFF-Baseline》。
5. **平均上傳時長 / 失敗率**：
   - 以 3 名學生（照片-only / 照片+影片 / 純評語）各重複 2 次，從 `UPLOAD_EVENT` log 中取得 `enqueue` 到 `done` 的差值。

## 3. Data Sheet 範本
| 日期 | Commit | 裝置 / OS | 網路 | TTI (s) | 首屏請求數 | LIFF OOM 率 | 平均上傳時長 (Photo / Video / Text) | 上傳失敗率 | 備註 |
|------|--------|-----------|------|---------|-----------|------------|-------------------------------------|-------------|------|
| 2025-11-13 | `TODO` | Pixel 6 / Android 15 | 5G | - | - | - | - / - / - | - | 首次量測，建立基準 |
| 2025-11-14 |  |  |  |  |  |  |  |  |  |

> 將上述表格複製至 Google Sheet，並在 `docs/LEARNING-RECORD-UPLOAD-REFACTOR-PLAN.md` 更新連結。

## 4. 模組依賴圖說明
- `scripts/metrics/lru-dependency-map.js` 可輸出 JSON 或 Markdown：
  - JSON（預設）：`node scripts/metrics/lru-dependency-map.js > reports/lru-deps.json`
  - Markdown：`node scripts/metrics/lru-dependency-map.js --markdown > docs/reports/lru-deps-YYYYMMDD.md`
- Summary 欄位：
  - `total`: script 數
  - `inline`: 內嵌腳本數，若超過 3 需優先搬移至 bundle。
  - `categories`: core / learning-upload-module / UI / CDN 等。

## 5. 待辦 & 下一步
- [ ] 依上表補齊 11/13、11/14 實際數據。
- [ ] 建立 `upload-events` schema + logger（Phase 0 -> 1 過渡）。
- [ ] 於 `docs/DRIVE-UPLOAD-MIGRATION-PLAN.md` 連結此基準文件。
- [ ] Phase 1 開始前，在 `LEARNING-RECORD-UPLOAD-REFACTOR-PLAN.md` 標記「Stage 0 ✅」。

---
維護人：Codex。若指標定義有變動，需同步更新本檔與 Refactor Plan。
