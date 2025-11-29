#!/bin/bash

echo "🔄 強制 Synology Drive 同步 HTML 檔案"
echo ""

# 目標檔案
FILE="public/perfect-calendar-optimized-complete.html"

# 1. 檢查檔案狀態
echo "1️⃣ 檢查檔案狀態..."
ls -lh "$FILE"
echo ""

# 2. 清除所有擴展屬性
echo "2️⃣ 清除 macOS 擴展屬性..."
xattr -c "$FILE" 2>/dev/null
echo "   ✅ 已清除"
echo ""

# 3. 修改檔案權限（確保可寫入）
echo "3️⃣ 確保檔案權限..."
chmod 644 "$FILE"
echo "   ✅ 權限設定為 644"
echo ""

# 4. 觸發同步
echo "4️⃣ 觸發同步..."
touch "$FILE"
echo "   ✅ 已更新時間戳"
echo ""

# 5. 在檔案末尾添加一個空白註解（強制內容變更）
echo "5️⃣ 強制內容變更..."
echo "<!-- Sync trigger: $(date) -->" >> "$FILE"
echo "   ✅ 已添加同步觸發標記"
echo ""

echo "✅ 完成！"
echo ""
echo "📋 後續步驟："
echo "1. 在 Synology Drive 中右鍵點擊 perfect-calendar-optimized-complete.html"
echo "2. 選擇「保留在此裝置上」或「釘選」"
echo "3. 等待 10-30 秒檢查同步狀態"
echo ""
echo "如果還是「線上存取」，請執行："
echo "  osascript -e 'quit app \"Synology Drive\"'"
echo "  sleep 3"
echo "  open -a 'Synology Drive'"


