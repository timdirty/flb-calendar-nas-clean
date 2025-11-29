# 學習歷程影片媒體服務重構說明（2025-11-03）

## 目標
- 提供穩定的影片上傳、續傳與轉碼流程。
- 將媒體檔案存放至獨立的目錄結構，利於備援與快取。
- 以 REST API 方式開放影片清單、縮圖與下載功能，方便前端管理 UI 串接。

## 儲存結構
- 根目錄：`data/learning-media`
- 階層：`YYYY/MM/DD/<課程slug>/<overview|students>/<學生slug>/`
- 目錄內容：
  - `origin/`：原始上傳檔案
  - `transcoded/`：轉碼後的 H.264 MP4
  - `thumbs/`：FFmpeg 擷取的縮圖
  - `meta.json`：桶狀資料（課程、學生、檔案列表）
  - `_sessions/`：分片上傳暫存區（自動清理）

## 主要模組
- `services/media/media-storage.js`：處理目錄建立與 slug 正規化。
- `services/media/media-session-registry.js`：管理分片會話生命週期。
- `services/media/media-index.js`：集中索引（`data/learning-media/index.json`）。
- `services/media/media-transcoder.js`：FFmpeg 轉碼 + 縮圖任務列隊。
- `services/media/media-manager.js`：整合服務（上傳、合併、索引更新、背景任務）。

## 後端 API
| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/media/videos/init` | 建立分片上傳會話 |
| `POST` | `/api/media/videos/chunk` | 上傳單一分片（FormData） |
| `POST` | `/api/media/videos/complete` | 合併分片並排入轉碼佇列 |
| `GET` | `/api/media/videos` | 依條件篩選影片清單 |
| `GET` | `/api/media/videos/:id` | 查詢單筆影片詳情 |
| `GET` | `/api/media/videos/:id/download` | 下載（優先回傳轉碼檔） |
| `GET` | `/api/media/videos/:id/thumbnail` | 取得縮圖 |

## 前端重構
- 新增 `public/css/learning-record-upload-v2.css` 與全新 UI layout。
- `public/js/modules/chunked-uploader.js` 改版，對接新版 API，支援 metadata 與任務佇列。
- `public/js/pages/learning-record-upload.js` 以 Vanilla JS 重寫：
  - 上傳表單（課程/學生/講師）
  - 分片隊列進度條
  - 任務列表與狀態提示
  - 影片資料表格、縮圖、下載操作

## 後續建議
1. 部署 Redis/BullMQ 取代記憶體佇列，提高轉碼任務容錯。
2. 規劃媒體監控 API（佇列深度、FFmpeg 失敗率）。
3. 加入簽名 URL 與權限驗證，提供外部分享控制。
4. 補上整合測試（分片重試、轉碼失敗回復、批次下載）。
