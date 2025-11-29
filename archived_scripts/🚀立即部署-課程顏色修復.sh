#!/bin/bash

echo "🚀 開始部署課程顏色修復..."

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
echo "  1. ✅ 課程方塊顏色根據課程類型（ESM/SPM/SPIKE/BOOST/PYTHON）"
echo "  2. ✅ 講師顏色只用於講師標籤，不影響整個課程方塊"
echo "  3. ✅ 講師顏色在載入時從 teacher_data.json 讀取"
echo ""
echo "🎨 預期效果："
echo "  • SPIKE 課程 → 黃色方塊"
echo "  • BOOST 課程 → 藍色方塊"
echo "  • ESM 課程 → 粉色方塊"
echo "  • SPM 課程 → 橘色方塊"
echo "  • PYTHON 課程 → 紫色方塊"
echo "  • 講師標籤（TIM/JAMES/TED 等）→ 各自的顏色"
echo ""
echo "🧪 測試步驟："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  2. 檢查週視圖中的課程方塊顏色"
echo "  3. 確認 SPIKE 課程是黃色、BOOST 課程是藍色等"
echo "  4. 檢查課程卡片中的講師標籤顏色是否正確"
echo "  5. 檢查今日課程區塊的顏色是否正確"
echo ""
echo "📱 系統網址："
echo "  https://course-viewer.funlearnbar.synology.me/perfect-calendar-optimized-complete2.html"
echo ""

