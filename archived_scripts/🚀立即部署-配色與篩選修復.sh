#!/bin/bash

echo "🚀 開始部署配色與篩選修復..."

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
echo "  1. ✅ 講師顏色正確套用 teacher_data.json"
echo "  2. ✅ 今日課程根據篩選條件變化"
echo "  3. ✅ 配色面板根據篩選條件變動"
echo ""
echo "🔍 檢查重點："
echo "  • 講師顏色是否正確顯示（從 teacher_data.json 載入）"
echo "  • 今日課程區塊是否根據講師/時段篩選"
echo "  • 配色面板是否只顯示當前篩選的講師和課程類型"
echo ""
echo "🧪 測試步驟："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  2. 選擇特定講師"
echo "  3. 檢查配色面板是否只顯示該講師"
echo "  4. 檢查今日課程是否只顯示該講師的課程"
echo "  5. 檢查課程卡片的講師名稱底色是否正確"
echo ""
echo "📱 系統網址："
echo "  https://course-viewer.funlearnbar.synology.me/perfect-calendar-optimized-complete2.html"
echo ""

