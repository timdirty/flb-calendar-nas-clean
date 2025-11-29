#!/bin/bash

echo "🚀 開始部署講師篩選與手機端優化..."

# 進入專案目錄
cd /volume1/docker/flb-calendar-nas

# 備份當前版本
cp public/perfect-calendar-optimized-complete2.html public/perfect-calendar-optimized-complete2.html.backup-$(date +%s)
echo "✅ 已備份當前版本"

# 同步最新文件
echo "📦 同步最新修復版本..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'logs' \
  "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/perfect-calendar-optimized-complete2.html" \
  /volume1/docker/flb-calendar-nas/public/

# 重啟服務
echo "🔄 重啟服務..."
cd /volume1/docker/flb-calendar-nas
docker-compose restart

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 修復內容："
echo "  1. ✅ 初次載入時自動篩選到個別講師"
echo "  2. ✅ 手機端隱藏月曆視圖"
echo "  3. ✅ 手機端隱藏今日課程區塊"
echo "  4. ✅ 手機端隱藏配色欄位"
echo ""
echo "🧪 測試步驟："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  2. 重新登入系統"
echo "  3. 檢查是否自動篩選到您的講師"
echo "  4. 在手機上檢查是否只顯示課程列表"
echo ""
echo "📱 手機端查看："
echo "  https://course-viewer.funlearnbar.synology.me/perfect-calendar-optimized-complete2.html"
echo ""

