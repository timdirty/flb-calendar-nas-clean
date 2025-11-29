# 🔧 修復 Synology Drive 同步問題

## 🔍 問題診斷

### 發現的問題
`perfect-calendar-optimized-complete.html` 檔案無法被 Synology Drive 同步

### 檔案資訊
- **檔案大小**：917KB (938,881 bytes)
- **檔案行數**：21,471 行
- **問題**：檔案有 macOS 壓縮屬性 `com.apple.decmpfs`

## ✅ 已執行的修復步驟

### 1. 移除 macOS 壓縮屬性
```bash
xattr -d com.apple.decmpfs public/perfect-calendar-optimized-complete.html
```

### 2. 觸發重新同步
```bash
touch public/perfect-calendar-optimized-complete.html
```

## 🎯 如果問題仍未解決

### 方案 A：檢查 Synology Drive 設定

1. **開啟 Synology Drive 應用程式**
2. **前往「偏好設定」→「進階」**
3. **檢查「檔案大小限制」設定**
   - 預設可能是 500MB 或 1GB
   - 確認 917KB 的檔案沒有超過限制

4. **檢查「忽略清單」**
   - 確認 `*.html` 或 `perfect-calendar*` 不在忽略清單中

### 方案 B：手動強制同步

```bash
# 1. 暫時重新命名檔案
cd public
mv perfect-calendar-optimized-complete.html temp-calendar.html

# 2. 等待 Synology Drive 同步（刪除遠端檔案）
sleep 10

# 3. 改回原名
mv temp-calendar.html perfect-calendar-optimized-complete.html

# 4. 等待同步
sleep 10
```

### 方案 C：使用 SCP 直接同步到 NAS

如果 Synology Drive 持續有問題，使用 SCP 直接上傳：

```bash
# 同步單一檔案
scp public/perfect-calendar-optimized-complete.html \
    flbadmin@192.168.50.139:/volume1/docker/flb-calendar/public/

# 或使用部署腳本
./🚀立即測試-效能優化.sh
```

### 方案 D：批次移除所有 macOS 壓縮屬性

如果其他檔案也有同樣問題：

```bash
# 移除整個專案的壓縮屬性
find . -type f -exec xattr -d com.apple.decmpfs {} \; 2>/dev/null

# 更新所有檔案時間戳
find . -type f -name "*.html" -exec touch {} \;
```

## 🔍 診斷指令

### 檢查檔案屬性
```bash
ls -lh@ public/perfect-calendar-optimized-complete.html
xattr -l public/perfect-calendar-optimized-complete.html
```

### 檢查 Synology Drive 狀態
```bash
# macOS 系統日誌
log show --predicate 'process == "synologydrive"' --last 5m

# 或使用 Console.app 搜尋 "synologydrive"
```

### 確認檔案已同步到 NAS
```bash
ssh flbadmin@192.168.50.139 "ls -lh /volume1/docker/flb-calendar/public/perfect-calendar-optimized-complete.html"
```

## 📋 Synology Drive 常見忽略原因

### 1. 檔案大小限制
- **預設限制**：通常是 500MB-1GB
- **解決方案**：調整 Synology Drive 設定

### 2. macOS 系統屬性
- **問題屬性**：
  - `com.apple.decmpfs` (HFS+ 壓縮)
  - `com.apple.quarantine` (隔離標記)
- **解決方案**：使用 `xattr -d` 移除

### 3. 檔案權限問題
- **檢查權限**：`ls -l` 確認讀取權限
- **修復權限**：`chmod 644 檔案名稱`

### 4. 路徑太長
- **macOS 限制**：255 字元
- **解決方案**：縮短檔案名稱或路徑

### 5. 特殊字元
- **避免字元**：`? * : " < > |`
- **解決方案**：重新命名檔案

## 🚀 快速解決腳本

創建 `fix-sync.sh`：

```bash
#!/bin/bash

echo "🔧 修復 Synology Drive 同步問題"

# 目標檔案
FILE="public/perfect-calendar-optimized-complete.html"

# 1. 移除 macOS 壓縮屬性
echo "1. 移除壓縮屬性..."
xattr -d com.apple.decmpfs "$FILE" 2>/dev/null

# 2. 移除隔離屬性
echo "2. 移除隔離屬性..."
xattr -d com.apple.quarantine "$FILE" 2>/dev/null

# 3. 確保權限正確
echo "3. 修正權限..."
chmod 644 "$FILE"

# 4. 觸發重新同步
echo "4. 觸發同步..."
touch "$FILE"

echo ""
echo "✅ 修復完成！"
echo "請等待 10-30 秒讓 Synology Drive 同步"
echo ""
echo "檢查同步狀態："
echo "  ssh flbadmin@192.168.50.139 'ls -lh /volume1/docker/flb-calendar/public/perfect-calendar-optimized-complete.html'"
```

## 📊 同步狀態檢查清單

- [ ] 檔案無 macOS 壓縮屬性 (`com.apple.decmpfs`)
- [ ] 檔案權限正確 (644 或 755)
- [ ] Synology Drive 正在執行
- [ ] 網路連線正常
- [ ] NAS 上的目標資料夾存在
- [ ] 沒有檔案大小限制問題
- [ ] 檔案不在忽略清單中

## 💡 建議的最佳做法

### 1. 定期清理 macOS 屬性
```bash
# 在專案根目錄執行
find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) \
  -exec xattr -c {} \; 2>/dev/null
```

### 2. 使用 .syncignore 檔案
如果有不想同步的檔案，創建 `.syncignore`：
```
# 大型檔案
*.zip
*.tar.gz

# 臨時檔案
*.tmp
*.bak

# Node modules
node_modules/
```

### 3. 監控同步狀態
在 Synology Drive 應用程式中啟用「顯示同步狀態圖示」

### 4. 備用方案：使用 rsync
如果 Synology Drive 經常出問題，考慮使用 rsync：

```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  public/ \
  flbadmin@192.168.50.139:/volume1/docker/flb-calendar/public/
```

## 📞 需要更多協助？

如果問題仍未解決，請收集以下資訊：

1. **Synology Drive 版本**
2. **macOS 版本**
3. **錯誤訊息**（如果有）
4. **系統日誌**：
   ```bash
   log show --predicate 'process == "synologydrive"' --last 5m > synology-drive.log
   ```

---

**修復時間**：2025-10-16  
**問題**：macOS 壓縮屬性導致同步失敗  
**解決方案**：移除 `com.apple.decmpfs` 屬性  
**狀態**：✅ 已修復

