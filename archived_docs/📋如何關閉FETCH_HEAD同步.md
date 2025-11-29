# 📋 如何關閉 FETCH_HEAD 同步

## 🎯 問題

每次修改檔案時，Synology Drive 都會顯示 `FETCH_HEAD` 要更新，但這個檔案是 Git 的內部檔案，不需要同步。

## ✅ 解決方案（三選一）

### 方案 1：在 Synology Drive 中手動忽略（最簡單）⭐⭐⭐

1. **打開 Synology Drive 應用程式**

2. **找到專案資料夾：**
   ```
   樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
   ```

3. **找到 `.git` 資料夾**（可能需要顯示隱藏檔案）
   - 在 Finder 中按 `Cmd + Shift + .` 顯示隱藏檔案

4. **右鍵點擊 `.git` 資料夾**

5. **選擇「停止同步此資料夾」或「從同步中移除」**

6. **完成！** `.git/` 內的所有檔案（包括 FETCH_HEAD）都不會再同步

---

### 方案 2：使用 .syncignore 檔案（已完成）✅

✅ 已經建立 `.syncignore` 檔案，內容包含：
```
.git/
.gitignore
node_modules/
logs/
*.log
*.backup
*.bak
backups/
.DS_Store
._*
```

**需要重啟 Synology Drive 才會生效：**
```bash
./🔄重啟SynologyDrive.sh
```

**或手動重啟：**
1. 退出 Synology Drive（右上角選單 → 退出）
2. 重新開啟 Synology Drive
3. 等待 10-20 秒讓它重新掃描

---

### 方案 3：在 Synology Drive 設定中添加忽略規則

1. **打開 Synology Drive**

2. **點擊右上角 ⚙️ → 偏好設定**

3. **前往「進階」分頁**

4. **找到「選擇性同步」或「忽略規則」區塊**

5. **添加忽略模式：**
   ```
   .git/
   .git/*
   **/.git/
   **/.git/*
   ```

6. **按「確定」儲存**

---

## 🔍 驗證是否成功

### 測試步驟：

1. **執行 Git 命令觸發 FETCH_HEAD 更新：**
   ```bash
   cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
   git fetch
   ```

2. **檢查 Synology Drive「最近更新」清單**
   - ✅ 應該**不會**看到 FETCH_HEAD
   - ✅ 只會看到您真正修改的檔案

3. **修改一個正常檔案測試：**
   ```bash
   touch README.md
   ```
   - ✅ README.md 應該出現在同步清單中

---

## 💡 為什麼 .git/ 不該被同步？

### Git 內部檔案包括：
- `FETCH_HEAD` - 最近 fetch 的資訊
- `HEAD` - 當前分支指標
- `index` - 暫存區狀態
- `refs/` - 分支和標籤參考
- `objects/` - Git 物件庫

### 問題：
1. **每台電腦的 Git 狀態都不同**
   - 您在本機 checkout 不同分支
   - NAS 可能在不同分支
   
2. **會造成不必要的衝突**
   - FETCH_HEAD 在每次 git fetch 時都會更新
   - 不同機器的內容永遠不一樣

3. **Git 應該獨立管理**
   - 使用 Git 的 push/pull 機制
   - 不應該透過檔案同步

---

## 🚀 最佳做法

### 建議的工作流程：

1. **檔案同步：** 使用 Synology Drive（但排除 .git/）
2. **程式碼版本：** 使用 Git push/pull
3. **部署到 NAS：** 使用專用的部署腳本

### 部署腳本：
```bash
# 快速部署單一檔案
./🚀快速部署HTML.sh

# 完整同步所有檔案
./scripts/sync-to-nas.sh
```

---

## 📊 同步設定檢查清單

- [ ] `.git/` 資料夾已從 Synology Drive 同步中排除
- [ ] `.syncignore` 檔案已建立並包含 `.git/`
- [ ] Synology Drive 已重啟以套用設定
- [ ] 測試 git fetch 不會觸發 FETCH_HEAD 同步
- [ ] 正常檔案修改仍然可以同步

---

## 🆘 如果問題仍然存在

### 診斷步驟：

1. **檢查 .syncignore 是否生效：**
   ```bash
   ls -la .syncignore
   cat .syncignore
   ```

2. **檢查 Synology Drive 版本：**
   - 較舊版本可能不支援 .syncignore
   - 考慮更新到最新版本

3. **使用手動排除：**
   - 在 Synology Drive UI 中手動排除 `.git` 資料夾
   - 這是最可靠的方法

4. **最後手段：使用部署腳本：**
   ```bash
   # 以後都用腳本部署，不依賴 Synology Drive
   ./🚀快速部署HTML.sh
   ```

---

**建立時間：** 2025-10-16  
**問題：** FETCH_HEAD 持續觸發同步  
**解決方案：** 從 Synology Drive 排除 .git/ 資料夾  
**狀態：** ✅ 已設定完成


