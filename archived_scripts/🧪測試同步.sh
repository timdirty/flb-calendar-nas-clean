#!/bin/bash

echo "🧪 測試 Synology Drive Client 同步設定"
echo "========================================"
echo ""

cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "測試 1️⃣：觸發 Git 更新（不應該同步）"
echo "----------------------------------------"
echo "執行 git fetch..."
git fetch 2>&1 | head -3
echo ""
echo "✅ 已更新 FETCH_HEAD"
echo "👉 請檢查 Synology Drive Client"
echo "   預期：不會看到 FETCH_HEAD 更新通知"
echo ""
read -p "按 Enter 繼續下一個測試..."
echo ""

echo "測試 2️⃣：觸發正常檔案更新（應該同步）"
echo "----------------------------------------"
echo "更新 README.md 時間戳..."
touch README.md
echo ""
echo "✅ 已更新 README.md"
echo "👉 請檢查 Synology Drive Client"
echo "   預期：會看到 README.md 更新通知"
echo ""
read -p "按 Enter 繼續下一個測試..."
echo ""

echo "測試 3️⃣：觸發 HTML 檔案更新（應該同步）"
echo "----------------------------------------"
echo "更新 perfect-calendar-optimized-complete.html 時間戳..."
touch public/perfect-calendar-optimized-complete.html
echo ""
echo "✅ 已更新 HTML 檔案"
echo "👉 請檢查 Synology Drive Client"
echo "   預期：會看到 HTML 檔案更新通知"
echo ""

echo "========================================"
echo "測試完成！"
echo ""
echo "📊 結果評估："
echo ""
echo "✅ 成功設定："
echo "   - 看不到 FETCH_HEAD 更新"
echo "   - 看得到 README.md 更新"
echo "   - 看得到 HTML 檔案更新"
echo ""
echo "❌ 設定失敗："
echo "   - 看得到 FETCH_HEAD 更新"
echo "   - 需要手動排除 .git 資料夾"
echo ""
echo "📖 詳細說明："
echo "   cat 🚫排除Git資料夾.md"
echo ""


