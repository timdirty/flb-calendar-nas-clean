# 🚀 本地測試設置指南

**目的**: 完整設置本地開發環境並測試 Synology Drive 整合功能  
**前置條件**: Synology NAS 已啟動並可連線  
**預計時間**: 10 分鐘

---

## 📋 設置檢查清單

### ✅ 步驟 1：確認 Synology NAS 設置

#### 1.1 檢查 NAS 連線
- [ ] NAS 已開機並連線到網路
- [ ] 可以從瀏覽器訪問 NAS（例：`https://your-nas.synology.me:5001`）
- [ ] 知道管理員帳號和密碼

#### 1.2 啟用必要套件
登入 Synology DSM → 套件中心 → 確認已安裝：
- [ ] **File Station**（必要）- 檔案管理
- [ ] **Synology Drive**（建議）- 檔案同步
- [ ] **Web Station**（選用）- 若要部署到 NAS

#### 1.3 確認 API 權限
DSM → 控制台 → 終端機和 SNMP → 確認：
- [ ] 已啟用 SSH（選用，除錯用）
- [ ] FileStation API 可用（預設啟用）

---

### ✅ 步驟 2：填寫環境變數

#### 2.1 開啟 `.env.nas` 檔案
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
nano .env.nas
```

#### 2.2 填寫 Synology Drive 設定

將以下佔位符替換為真實資訊：

```bash
# ============================================
# Synology Drive 配置（必填）
# ============================================

# NAS 主機位址（可能的格式）
# 格式 1: QuickConnect ID
SYNOLOGY_HOST=your-quickconnect-id.synology.me
# 格式 2: 本地 IP
SYNOLOGY_HOST=192.168.x.x
# 格式 3: DDNS 域名
SYNOLOGY_HOST=your-domain.synology.me

# 連線端口（預設值）
SYNOLOGY_PORT=5001          # HTTPS 端口（建議）
# SYNOLOGY_PORT=5000        # HTTP 端口（不建議）

# 連線協議
SYNOLOGY_PROTOCOL=https     # 建議使用 HTTPS
# SYNOLOGY_PROTOCOL=http    # 僅本地測試

# NAS 管理員帳號
SYNOLOGY_USERNAME=admin     # 替換為你的管理員帳號

# NAS 管理員密碼
SYNOLOGY_PASSWORD=your-password    # 替換為你的密碼

# Drive 根目錄
SYNOLOGY_DRIVE_ROOT=/FLB-Learning-Portfolio
```

#### 2.3 儲存檔案
- 按 `Ctrl + O` → Enter（儲存）
- 按 `Ctrl + X`（離開）

---

### ✅ 步驟 3：創建 Drive 根目錄

#### 3.1 透過 File Station 創建
1. 登入 Synology DSM
2. 開啟 **File Station**
3. 在任何共享資料夾（如 `home` 或 `Drive`）中創建目錄：
   ```
   /FLB-Learning-Portfolio/
   ```
4. 確認有讀寫權限

#### 3.2 或透過 Synology Drive（若已安裝）
1. 開啟 **Synology Drive**
2. 在個人空間創建資料夾：`FLB-Learning-Portfolio`
3. 右鍵 → 屬性 → 記下完整路徑

---

### ✅ 步驟 4：執行連線測試

#### 4.1 測試 Drive 連線
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 執行連線測試
node tests/manual/test-drive-connection.js
```

#### 4.2 預期輸出
```bash
============================================================
🚀 Synology Drive 連線測試
============================================================

🔍 步驟 1: 檢查環境變數
────────────────────────────────────────────────────────────
✅ SYNOLOGY_HOST: your-actual-host.synology.me
✅ SYNOLOGY_PORT: 5001
✅ SYNOLOGY_PROTOCOL: https
✅ SYNOLOGY_USERNAME: admin
✅ SYNOLOGY_PASSWORD: ********
✅ SYNOLOGY_DRIVE_ROOT: /FLB-Learning-Portfolio

🔧 步驟 2: 初始化 Drive 客戶端
────────────────────────────────────────────────────────────
✅ 客戶端初始化成功

🔐 步驟 3: 測試登入
────────────────────────────────────────────────────────────
✅ 登入成功
SID: ****************************

📁 步驟 4: 創建測試目錄
────────────────────────────────────────────────────────────
✅ 目錄創建成功: /FLB-Learning-Portfolio/test-2025-11-08

📤 步驟 5: 上傳測試檔案
────────────────────────────────────────────────────────────
✅ 檔案上傳成功: /FLB-Learning-Portfolio/test-2025-11-08/test-file.txt

📝 步驟 6: 列出目錄內容
────────────────────────────────────────────────────────────
✅ 目錄列表成功，找到 1 個檔案

📥 步驟 7: 下載測試檔案
────────────────────────────────────────────────────────────
✅ 檔案下載成功，內容正確

🗑️  步驟 8: 刪除測試檔案
────────────────────────────────────────────────────────────
✅ 檔案刪除成功

🗑️  步驟 9: 清理測試目錄
────────────────────────────────────────────────────────────
✅ 目錄清理成功

============================================================
✅ 所有測試通過！Drive 連線正常
============================================================
```

---

### ✅ 步驟 5：測試上傳功能

#### 5.1 啟動伺服器（終端 1）
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 開發模式啟動（禁用自動排程）
npm run dev
```

#### 5.2 執行上傳測試（終端 2）
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 執行上傳測試
node tests/manual/test-drive-upload.js
```

#### 5.3 預期輸出
```bash
============================================================
🚀 Drive 上傳 API 測試
============================================================

🔍 測試 1: 上傳學生記錄（照片 + 評語）
────────────────────────────────────────────────────────────
✅ 測試通過 - 狀態碼: 200
📁 上傳路徑: /FLB-Learning-Portfolio/114-1/測試課程/2025-11-08/測試學生

🔍 測試 2: 上傳課程總覽（照片 + 總結）
────────────────────────────────────────────────────────────
✅ 測試通過 - 狀態碼: 200
📁 上傳路徑: /FLB-Learning-Portfolio/114-1/測試課程/2025-11-08/課程總覽

🔍 測試 3: 照片門檻驗證（少於 3 張）
────────────────────────────────────────────────────────────
✅ 測試通過 - 正確拒絕（門檻驗證生效）

🔍 測試 4: 評語門檻驗證（少於 10 字）
────────────────────────────────────────────────────────────
✅ 測試通過 - 正確拒絕（門檻驗證生效）

============================================================
✅ 所有測試通過！
============================================================
```

---

### ✅ 步驟 6：在 Drive 中驗證

#### 6.1 開啟 File Station
登入 DSM → File Station → 導航到：
```
/FLB-Learning-Portfolio/
  └── 114-1/              (學期資料夾)
      └── 測試課程/       (課程名稱)
          └── 2025-11-08/ (日期)
              ├── 測試學生/
              │   ├── photo_001.jpg
              │   ├── photo_002.jpg
              │   ├── photo_003.jpg
              │   └── metadata.json
              └── 課程總覽/
                  ├── photo_001.jpg
                  ├── photo_002.jpg
                  └── metadata.json
```

#### 6.2 檢查內容
- [ ] 資料夾結構正確
- [ ] 照片檔案完整
- [ ] metadata.json 存在且可讀
- [ ] 檔案命名規範（photo_001, photo_002...）

---

### ✅ 步驟 7：測試前端上傳

#### 7.1 開啟瀏覽器
```
http://localhost:3002/learning-record-upload.html
```

#### 7.2 測試流程
1. **選擇課程資訊**
   - [ ] 學期：114-1
   - [ ] 課程：任選
   - [ ] 日期：今天
   - [ ] 主題：測試主題

2. **上傳學生記錄**
   - [ ] 選擇學生
   - [ ] 上傳至少 3 張照片
   - [ ] 填寫評語（至少 10 字）
   - [ ] 點擊「上傳學習記錄」

3. **檢查結果**
   - [ ] 看到成功訊息
   - [ ] 到 Drive 中驗證檔案
   - [ ] 確認路徑正確

---

## 🔍 常見問題排除

### 問題 1：無法連線到 NAS
**錯誤訊息**:
```
❌ 登入失敗: getaddrinfo ENOTFOUND your-synology-host.synology.me
```

**可能原因**:
- SYNOLOGY_HOST 設定錯誤
- NAS 未開機或網路斷線
- QuickConnect ID 輸入錯誤

**解決方法**:
1. 確認可以從瀏覽器訪問 NAS
2. 試試使用本地 IP（192.168.x.x）
3. 檢查防火牆設定

### 問題 2：登入失敗（帳號密碼錯誤）
**錯誤訊息**:
```
❌ 登入失敗: 400 - 帳號或密碼錯誤
```

**可能原因**:
- 帳號或密碼輸入錯誤
- 帳號被鎖定
- NAS 管理員權限不足

**解決方法**:
1. 確認帳號密碼正確（可先用瀏覽器登入 DSM 測試）
2. 檢查帳號是否被鎖定
3. 確認帳號有管理員權限

### 問題 3：找不到目錄
**錯誤訊息**:
```
❌ 目錄不存在: /FLB-Learning-Portfolio
```

**可能原因**:
- 未創建根目錄
- 路徑設定錯誤
- 權限不足

**解決方法**:
1. 在 File Station 中手動創建目錄
2. 確認路徑名稱正確（區分大小寫）
3. 檢查目錄權限

### 問題 4：上傳失敗
**錯誤訊息**:
```
❌ 檔案上傳失敗: 權限不足
```

**可能原因**:
- 目錄無寫入權限
- 磁碟空間不足
- 檔案過大

**解決方法**:
1. 檢查目錄權限（File Station → 右鍵 → 屬性 → 權限）
2. 確認磁碟空間充足
3. 檢查單個檔案大小是否超過 200MB

### 問題 5：伺服器無法啟動
**錯誤訊息**:
```
Error: listen EADDRINUSE: address already in use :::3002
```

**可能原因**:
- 端口被佔用
- 伺服器已經在運行

**解決方法**:
```bash
# 1. 查找佔用端口的程序
lsof -i :3002

# 2. 終止程序
kill -9 [PID]

# 3. 或改用其他端口
PORT=3003 npm run dev
```

---

## 📊 測試完成檢查表

### 基礎設置
- [ ] .env.nas 已填寫完整
- [ ] NAS 可以連線
- [ ] FileStation 已啟用
- [ ] Drive 根目錄已創建

### Drive 連線測試
- [ ] test-drive-connection.js 全部通過（9/9）
- [ ] 可以成功登入
- [ ] 可以創建目錄
- [ ] 可以上傳檔案
- [ ] 可以列出檔案
- [ ] 可以下載檔案
- [ ] 可以刪除檔案

### 上傳功能測試
- [ ] test-drive-upload.js 全部通過（4/4）
- [ ] 學生記錄上傳成功
- [ ] 課程總覽上傳成功
- [ ] 照片門檻驗證正常
- [ ] 評語門檻驗證正常

### Drive 驗證
- [ ] 檔案確實上傳到 Drive
- [ ] 目錄結構正確
- [ ] 檔案命名規範
- [ ] metadata.json 完整

### 前端測試
- [ ] 伺服器可以啟動（npm run dev）
- [ ] 前端頁面載入正常
- [ ] 可以選擇學生
- [ ] 可以上傳照片
- [ ] 上傳後檔案出現在 Drive
- [ ] 錯誤訊息顯示正確

---

## 🎯 測試通過後的下一步

### 繼續開發
- [ ] 實作預覽 API（從 Drive 讀取檔案列表）
- [ ] 實作刪除 API（刪除 Drive 中的檔案）
- [ ] 更新前端 URL 使用代理路徑
- [ ] 撰寫單元測試
- [ ] 撰寫整合測試

### 部署準備
- [ ] 更新 Dockerfile（如有需要）
- [ ] 測試 Docker 構建
- [ ] 準備生產環境 .env
- [ ] 創建部署文檔
- [ ] 準備回滾計畫

---

## 📚 相關文檔

| 文檔 | 位置 | 說明 |
|------|------|------|
| PROJECT-STRUCTURE.md | 根目錄 | 專案結構 |
| PROJECT-REORGANIZATION-COMPLETE.md | 根目錄 | 整理報告 |
| DRIVE-INTEGRATION-SUMMARY.md | docs/synology-drive/ | Drive 整合總結 |
| DRIVE-UPLOAD-API-USAGE.md | docs/synology-drive/ | API 使用指南 |
| test-drive-connection.js | tests/manual/ | 連線測試腳本 |
| test-drive-upload.js | tests/manual/ | 上傳測試腳本 |

---

## 🆘 需要協助？

如果遇到無法解決的問題：

1. **查看日誌**
   ```bash
   # 伺服器日誌
   tail -f logs/server.log
   
   # 或即時日誌（開發模式）
   npm run dev
   ```

2. **檢查 NAS 日誌**
   DSM → 記錄中心 → 連線 → FileStation

3. **參考文檔**
   - Synology FileStation API: https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf
   - 專案整合文檔: `docs/synology-drive/`

4. **Debug 模式**
   ```bash
   DEBUG=* npm run dev
   ```

---

**建立時間**: 2025-11-08  
**適用版本**: v2.4+  
**狀態**: ✅ 可直接使用



**目的**: 完整設置本地開發環境並測試 Synology Drive 整合功能  
**前置條件**: Synology NAS 已啟動並可連線  
**預計時間**: 10 分鐘

---

## 📋 設置檢查清單

### ✅ 步驟 1：確認 Synology NAS 設置

#### 1.1 檢查 NAS 連線
- [ ] NAS 已開機並連線到網路
- [ ] 可以從瀏覽器訪問 NAS（例：`https://your-nas.synology.me:5001`）
- [ ] 知道管理員帳號和密碼

#### 1.2 啟用必要套件
登入 Synology DSM → 套件中心 → 確認已安裝：
- [ ] **File Station**（必要）- 檔案管理
- [ ] **Synology Drive**（建議）- 檔案同步
- [ ] **Web Station**（選用）- 若要部署到 NAS

#### 1.3 確認 API 權限
DSM → 控制台 → 終端機和 SNMP → 確認：
- [ ] 已啟用 SSH（選用，除錯用）
- [ ] FileStation API 可用（預設啟用）

---

### ✅ 步驟 2：填寫環境變數

#### 2.1 開啟 `.env.nas` 檔案
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
nano .env.nas
```

#### 2.2 填寫 Synology Drive 設定

將以下佔位符替換為真實資訊：

```bash
# ============================================
# Synology Drive 配置（必填）
# ============================================

# NAS 主機位址（可能的格式）
# 格式 1: QuickConnect ID
SYNOLOGY_HOST=your-quickconnect-id.synology.me
# 格式 2: 本地 IP
SYNOLOGY_HOST=192.168.x.x
# 格式 3: DDNS 域名
SYNOLOGY_HOST=your-domain.synology.me

# 連線端口（預設值）
SYNOLOGY_PORT=5001          # HTTPS 端口（建議）
# SYNOLOGY_PORT=5000        # HTTP 端口（不建議）

# 連線協議
SYNOLOGY_PROTOCOL=https     # 建議使用 HTTPS
# SYNOLOGY_PROTOCOL=http    # 僅本地測試

# NAS 管理員帳號
SYNOLOGY_USERNAME=admin     # 替換為你的管理員帳號

# NAS 管理員密碼
SYNOLOGY_PASSWORD=your-password    # 替換為你的密碼

# Drive 根目錄
SYNOLOGY_DRIVE_ROOT=/FLB-Learning-Portfolio
```

#### 2.3 儲存檔案
- 按 `Ctrl + O` → Enter（儲存）
- 按 `Ctrl + X`（離開）

---

### ✅ 步驟 3：創建 Drive 根目錄

#### 3.1 透過 File Station 創建
1. 登入 Synology DSM
2. 開啟 **File Station**
3. 在任何共享資料夾（如 `home` 或 `Drive`）中創建目錄：
   ```
   /FLB-Learning-Portfolio/
   ```
4. 確認有讀寫權限

#### 3.2 或透過 Synology Drive（若已安裝）
1. 開啟 **Synology Drive**
2. 在個人空間創建資料夾：`FLB-Learning-Portfolio`
3. 右鍵 → 屬性 → 記下完整路徑

---

### ✅ 步驟 4：執行連線測試

#### 4.1 測試 Drive 連線
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 執行連線測試
node tests/manual/test-drive-connection.js
```

#### 4.2 預期輸出
```bash
============================================================
🚀 Synology Drive 連線測試
============================================================

🔍 步驟 1: 檢查環境變數
────────────────────────────────────────────────────────────
✅ SYNOLOGY_HOST: your-actual-host.synology.me
✅ SYNOLOGY_PORT: 5001
✅ SYNOLOGY_PROTOCOL: https
✅ SYNOLOGY_USERNAME: admin
✅ SYNOLOGY_PASSWORD: ********
✅ SYNOLOGY_DRIVE_ROOT: /FLB-Learning-Portfolio

🔧 步驟 2: 初始化 Drive 客戶端
────────────────────────────────────────────────────────────
✅ 客戶端初始化成功

🔐 步驟 3: 測試登入
────────────────────────────────────────────────────────────
✅ 登入成功
SID: ****************************

📁 步驟 4: 創建測試目錄
────────────────────────────────────────────────────────────
✅ 目錄創建成功: /FLB-Learning-Portfolio/test-2025-11-08

📤 步驟 5: 上傳測試檔案
────────────────────────────────────────────────────────────
✅ 檔案上傳成功: /FLB-Learning-Portfolio/test-2025-11-08/test-file.txt

📝 步驟 6: 列出目錄內容
────────────────────────────────────────────────────────────
✅ 目錄列表成功，找到 1 個檔案

📥 步驟 7: 下載測試檔案
────────────────────────────────────────────────────────────
✅ 檔案下載成功，內容正確

🗑️  步驟 8: 刪除測試檔案
────────────────────────────────────────────────────────────
✅ 檔案刪除成功

🗑️  步驟 9: 清理測試目錄
────────────────────────────────────────────────────────────
✅ 目錄清理成功

============================================================
✅ 所有測試通過！Drive 連線正常
============================================================
```

---

### ✅ 步驟 5：測試上傳功能

#### 5.1 啟動伺服器（終端 1）
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 開發模式啟動（禁用自動排程）
npm run dev
```

#### 5.2 執行上傳測試（終端 2）
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 執行上傳測試
node tests/manual/test-drive-upload.js
```

#### 5.3 預期輸出
```bash
============================================================
🚀 Drive 上傳 API 測試
============================================================

🔍 測試 1: 上傳學生記錄（照片 + 評語）
────────────────────────────────────────────────────────────
✅ 測試通過 - 狀態碼: 200
📁 上傳路徑: /FLB-Learning-Portfolio/114-1/測試課程/2025-11-08/測試學生

🔍 測試 2: 上傳課程總覽（照片 + 總結）
────────────────────────────────────────────────────────────
✅ 測試通過 - 狀態碼: 200
📁 上傳路徑: /FLB-Learning-Portfolio/114-1/測試課程/2025-11-08/課程總覽

🔍 測試 3: 照片門檻驗證（少於 3 張）
────────────────────────────────────────────────────────────
✅ 測試通過 - 正確拒絕（門檻驗證生效）

🔍 測試 4: 評語門檻驗證（少於 10 字）
────────────────────────────────────────────────────────────
✅ 測試通過 - 正確拒絕（門檻驗證生效）

============================================================
✅ 所有測試通過！
============================================================
```

---

### ✅ 步驟 6：在 Drive 中驗證

#### 6.1 開啟 File Station
登入 DSM → File Station → 導航到：
```
/FLB-Learning-Portfolio/
  └── 114-1/              (學期資料夾)
      └── 測試課程/       (課程名稱)
          └── 2025-11-08/ (日期)
              ├── 測試學生/
              │   ├── photo_001.jpg
              │   ├── photo_002.jpg
              │   ├── photo_003.jpg
              │   └── metadata.json
              └── 課程總覽/
                  ├── photo_001.jpg
                  ├── photo_002.jpg
                  └── metadata.json
```

#### 6.2 檢查內容
- [ ] 資料夾結構正確
- [ ] 照片檔案完整
- [ ] metadata.json 存在且可讀
- [ ] 檔案命名規範（photo_001, photo_002...）

---

### ✅ 步驟 7：測試前端上傳

#### 7.1 開啟瀏覽器
```
http://localhost:3002/learning-record-upload.html
```

#### 7.2 測試流程
1. **選擇課程資訊**
   - [ ] 學期：114-1
   - [ ] 課程：任選
   - [ ] 日期：今天
   - [ ] 主題：測試主題

2. **上傳學生記錄**
   - [ ] 選擇學生
   - [ ] 上傳至少 3 張照片
   - [ ] 填寫評語（至少 10 字）
   - [ ] 點擊「上傳學習記錄」

3. **檢查結果**
   - [ ] 看到成功訊息
   - [ ] 到 Drive 中驗證檔案
   - [ ] 確認路徑正確

---

## 🔍 常見問題排除

### 問題 1：無法連線到 NAS
**錯誤訊息**:
```
❌ 登入失敗: getaddrinfo ENOTFOUND your-synology-host.synology.me
```

**可能原因**:
- SYNOLOGY_HOST 設定錯誤
- NAS 未開機或網路斷線
- QuickConnect ID 輸入錯誤

**解決方法**:
1. 確認可以從瀏覽器訪問 NAS
2. 試試使用本地 IP（192.168.x.x）
3. 檢查防火牆設定

### 問題 2：登入失敗（帳號密碼錯誤）
**錯誤訊息**:
```
❌ 登入失敗: 400 - 帳號或密碼錯誤
```

**可能原因**:
- 帳號或密碼輸入錯誤
- 帳號被鎖定
- NAS 管理員權限不足

**解決方法**:
1. 確認帳號密碼正確（可先用瀏覽器登入 DSM 測試）
2. 檢查帳號是否被鎖定
3. 確認帳號有管理員權限

### 問題 3：找不到目錄
**錯誤訊息**:
```
❌ 目錄不存在: /FLB-Learning-Portfolio
```

**可能原因**:
- 未創建根目錄
- 路徑設定錯誤
- 權限不足

**解決方法**:
1. 在 File Station 中手動創建目錄
2. 確認路徑名稱正確（區分大小寫）
3. 檢查目錄權限

### 問題 4：上傳失敗
**錯誤訊息**:
```
❌ 檔案上傳失敗: 權限不足
```

**可能原因**:
- 目錄無寫入權限
- 磁碟空間不足
- 檔案過大

**解決方法**:
1. 檢查目錄權限（File Station → 右鍵 → 屬性 → 權限）
2. 確認磁碟空間充足
3. 檢查單個檔案大小是否超過 200MB

### 問題 5：伺服器無法啟動
**錯誤訊息**:
```
Error: listen EADDRINUSE: address already in use :::3002
```

**可能原因**:
- 端口被佔用
- 伺服器已經在運行

**解決方法**:
```bash
# 1. 查找佔用端口的程序
lsof -i :3002

# 2. 終止程序
kill -9 [PID]

# 3. 或改用其他端口
PORT=3003 npm run dev
```

---

## 📊 測試完成檢查表

### 基礎設置
- [ ] .env.nas 已填寫完整
- [ ] NAS 可以連線
- [ ] FileStation 已啟用
- [ ] Drive 根目錄已創建

### Drive 連線測試
- [ ] test-drive-connection.js 全部通過（9/9）
- [ ] 可以成功登入
- [ ] 可以創建目錄
- [ ] 可以上傳檔案
- [ ] 可以列出檔案
- [ ] 可以下載檔案
- [ ] 可以刪除檔案

### 上傳功能測試
- [ ] test-drive-upload.js 全部通過（4/4）
- [ ] 學生記錄上傳成功
- [ ] 課程總覽上傳成功
- [ ] 照片門檻驗證正常
- [ ] 評語門檻驗證正常

### Drive 驗證
- [ ] 檔案確實上傳到 Drive
- [ ] 目錄結構正確
- [ ] 檔案命名規範
- [ ] metadata.json 完整

### 前端測試
- [ ] 伺服器可以啟動（npm run dev）
- [ ] 前端頁面載入正常
- [ ] 可以選擇學生
- [ ] 可以上傳照片
- [ ] 上傳後檔案出現在 Drive
- [ ] 錯誤訊息顯示正確

---

## 🎯 測試通過後的下一步

### 繼續開發
- [ ] 實作預覽 API（從 Drive 讀取檔案列表）
- [ ] 實作刪除 API（刪除 Drive 中的檔案）
- [ ] 更新前端 URL 使用代理路徑
- [ ] 撰寫單元測試
- [ ] 撰寫整合測試

### 部署準備
- [ ] 更新 Dockerfile（如有需要）
- [ ] 測試 Docker 構建
- [ ] 準備生產環境 .env
- [ ] 創建部署文檔
- [ ] 準備回滾計畫

---

## 📚 相關文檔

| 文檔 | 位置 | 說明 |
|------|------|------|
| PROJECT-STRUCTURE.md | 根目錄 | 專案結構 |
| PROJECT-REORGANIZATION-COMPLETE.md | 根目錄 | 整理報告 |
| DRIVE-INTEGRATION-SUMMARY.md | docs/synology-drive/ | Drive 整合總結 |
| DRIVE-UPLOAD-API-USAGE.md | docs/synology-drive/ | API 使用指南 |
| test-drive-connection.js | tests/manual/ | 連線測試腳本 |
| test-drive-upload.js | tests/manual/ | 上傳測試腳本 |

---

## 🆘 需要協助？

如果遇到無法解決的問題：

1. **查看日誌**
   ```bash
   # 伺服器日誌
   tail -f logs/server.log
   
   # 或即時日誌（開發模式）
   npm run dev
   ```

2. **檢查 NAS 日誌**
   DSM → 記錄中心 → 連線 → FileStation

3. **參考文檔**
   - Synology FileStation API: https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf
   - 專案整合文檔: `docs/synology-drive/`

4. **Debug 模式**
   ```bash
   DEBUG=* npm run dev
   ```

---

**建立時間**: 2025-11-08  
**適用版本**: v2.4+  
**狀態**: ✅ 可直接使用

