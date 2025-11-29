# 🚫 排除 .git 資料夾 - 徹底解決 FETCH_HEAD 同步問題

## 🎯 問題現象

**每次修改檔案時：**
- ❌ Synology Drive Client 只顯示 `FETCH_HEAD` 更新
- ❌ 真正修改的檔案（如 `perfect-calendar-optimized-complete.html`）不會同步
- ❌ 一直看到 Git 內部檔案的同步通知

## ✅ 最有效的解決方案（手動排除）

### 方法 1：在 Synology Drive Client 設定中排除 ⭐⭐⭐

1. **打開 Synology Drive Client**（點擊選單列圖示）

2. **點擊「設定」或齒輪圖示 ⚙️**

3. **選擇「選擇性同步」或「Selective Sync」**

4. **找到專案資料夾：**
   ```
   樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
   ```

5. **取消勾選 `.git` 資料夾**
   - 如果看不到 `.git`，需要先顯示隱藏檔案（見下方說明）

6. **點擊「套用」或「確定」**

7. **完成！**

---

### 方法 2：在 Finder 中操作 ⭐⭐⭐⭐⭐

#### Step 1: 顯示隱藏檔案

在 Finder 中按快捷鍵：
```
Cmd + Shift + .
```

#### Step 2: 找到 .git 資料夾

前往：
```
/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/.git
```

#### Step 3: 停止同步

1. **右鍵點擊 `.git` 資料夾**

2. 選擇以下任一選項（依版本不同）：
   - 「**停止同步此資料夾**」
   - 「**從同步中移除**」
   - 「**Make Available Online Only**」
   - 「**Free Up Space**」（讓它變成線上檔案）

3. **確認操作**

#### Step 4: 驗證成功

執行 Git 命令測試：
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
git fetch
```

檢查 Synology Drive Client：
- ✅ 應該**不會**看到 FETCH_HEAD 或其他 Git 檔案
- ✅ 只會看到您真正修改的檔案

---

### 方法 3：使用腳本自動設定（實驗性）

如果以上方法不可行，使用這個腳本：

```bash
# 重啟 Synology Drive Client（套用 .syncignore）
./🔄重啟SynologyDrive.sh
```

**注意：** 此方法依賴 `.syncignore` 檔案支援，不是所有版本都有效。

---

## 🔍 如何確認 .git 已被排除？

### 測試 1：觸發 Git 更新
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 更新 Git 內部檔案
git fetch

# 檢查 FETCH_HEAD 時間戳
ls -l .git/FETCH_HEAD
```

**預期結果：**
- ✅ Synology Drive Client **不會**顯示 FETCH_HEAD 更新通知

### 測試 2：修改正常檔案
```bash
# 觸發一個正常檔案的更新
touch README.md
```

**預期結果：**
- ✅ Synology Drive Client **會**顯示 README.md 更新通知
- ✅ 檔案正常同步

---

## 🚀 針對 perfect-calendar-optimized-complete.html 的特殊處理

### 問題：檔案顯示「線上存取」

如果 `perfect-calendar-optimized-complete.html` 顯示藍色圖示（線上存取），需要：

#### 解決方法 A：固定到本機
```bash
# 在 Finder 中右鍵點擊檔案
# 選擇「保留在此裝置上」或「Make Available Offline」
```

#### 解決方法 B：清除屬性並重新同步
```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 清除 macOS 屬性
xattr -c public/perfect-calendar-optimized-complete.html

# 確保可寫入
chmod 644 public/perfect-calendar-optimized-complete.html

# 觸發更新
touch public/perfect-calendar-optimized-complete.html
```

#### 解決方法 C：直接部署到 NAS（最快）
```bash
./🚀快速部署HTML.sh
```

這會繞過 Synology Drive，直接上傳到 NAS。

---

## 📊 完整檢查清單

檢查以下項目確保設定正確：

### Git 資料夾排除
- [ ] `.git/` 已從 Synology Drive 同步中排除
- [ ] 執行 `git fetch` 不會觸發 FETCH_HEAD 同步通知
- [ ] `.gitignore` 檔案仍然正常同步（這個要同步）

### HTML 檔案同步
- [ ] `perfect-calendar-optimized-complete.html` 不是「線上存取」狀態
- [ ] 修改檔案後會顯示在「最近更新」中
- [ ] 檔案權限正確（644）
- [ ] 沒有 macOS 擴展屬性阻擋同步

### Synology Drive 設定
- [ ] 應用程式正常運行（選單列有圖示）
- [ ] 網路連線正常
- [ ] 沒有同步錯誤或警告
- [ ] 「選擇性同步」設定正確

---

## 💡 為什麼這樣設定？

### Git 資料夾的特性：
```
本機 Git 倉庫 (.git/)
    ├── FETCH_HEAD      ← 每次 fetch 都會變
    ├── HEAD            ← checkout 分支時會變
    ├── index           ← 每次 stage 都會變
    ├── objects/        ← 經常變動
    └── refs/           ← 經常變動
```

### 問題流程：
```
1. 您執行：git fetch
   ↓
2. Git 更新：.git/FETCH_HEAD
   ↓
3. Synology Drive 偵測到變更
   ↓
4. 嘗試同步 FETCH_HEAD
   ↓
5. 優先處理 Git 檔案（因為更頻繁）
   ↓
6. 結果：真正的檔案被忽略 ❌
```

### 解決後：
```
1. 您修改：perfect-calendar-optimized-complete.html
   ↓
2. Synology Drive 偵測到變更
   ↓
3. 同步此檔案（沒有 Git 檔案干擾）
   ↓
4. 結果：檔案正常同步 ✅
```

---

## 🔧 故障排除

### 問題：排除後仍看到 Git 檔案同步

**可能原因：**
1. Synology Drive Client 尚未重新掃描
2. 排除設定未正確套用
3. 使用了不支援排除功能的舊版本

**解決方案：**
```bash
# 完全重啟 Synology Drive Client
osascript -e 'quit app "Synology Drive Client"'
sleep 5
open -a "Synology Drive Client"
```

### 問題：找不到 .git 資料夾

**解決方案：**
```bash
# 在 Terminal 確認資料夾存在
ls -la /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/.git

# 在 Finder 顯示隱藏檔案
# 按 Cmd + Shift + .
```

### 問題：HTML 檔案還是不同步

**使用部署腳本：**
```bash
# 快速部署單一檔案
./🚀快速部署HTML.sh

# 或完整同步
./scripts/sync-to-nas.sh
```

---

## 🎯 推薦的工作流程

### 日常開發：
1. ✅ 修改檔案（HTML、JS、CSS等）
2. ✅ Synology Drive 自動同步（.git/ 已排除）
3. ✅ 不會看到 Git 相關的同步通知

### 版本控制：
1. ✅ 使用 Git 命令（commit、push、pull）
2. ✅ Git 操作不影響檔案同步
3. ✅ .git/ 資料夾保持獨立

### 部署上線：
1. ✅ 使用部署腳本：`./🚀快速部署HTML.sh`
2. ✅ 直接上傳到 NAS
3. ✅ 不依賴 Synology Drive

---

**建立時間：** 2025-10-16  
**問題：** Synology Drive Client 持續同步 FETCH_HEAD，阻擋真正的檔案更新  
**解決方案：** 從同步中排除 .git/ 資料夾  
**狀態：** ⏳ 待用戶執行


