#!/bin/bash

echo "======================================"
echo "🔥 完整修復部署"
echo "======================================"
echo ""

echo "📋 修復內容總覽："
echo "  1. ✅ CalDAV API 錯誤碼 119 修復"
echo "  2. ✅ 檔案權限問題修復"
echo "  3. ✅ 前端空快取智能驗證"
echo "  4. ✅ 背景自動刷新機制"
echo "  5. ✅ 前端等待後端快取就緒"
echo "  6. ✅ 後端快取就緒標誌"
echo ""

cd "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

echo "🛑 步驟 1/5: 停止 Docker 容器..."
ssh ctctim14@funlearnbar.synology.me "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas && sudo docker-compose down"
echo "✅ 容器已停止"
echo ""

echo "🔨 步驟 2/5: 重建 Docker 映像..."
ssh ctctim14@funlearnbar.synology.me "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas && sudo docker-compose build --no-cache"
echo "✅ 映像重建完成"
echo ""

echo "🚀 步驟 3/5: 啟動新容器..."
ssh ctctim14@funlearnbar.synology.me "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas && sudo docker-compose up -d"
echo "✅ 容器已啟動"
echo ""

echo "⏳ 步驟 4/5: 等待服務啟動（30 秒）..."
sleep 30

echo ""
echo "📊 步驟 5/5: 檢查服務狀態..."
ssh ctctim14@funlearnbar.synology.me "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas && sudo docker-compose ps"

echo ""
echo "📋 查看啟動日誌（前 100 行）："
echo "======================================"
ssh ctctim14@funlearnbar.synology.me "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas && sudo docker logs flb-calendar-nas | head -100"

echo ""
echo "======================================"
echo "🔍 檢查快取狀態："
echo "======================================"
sleep 5
curl -s "https://calendar.funlearnbar.synology.me/api/events/cache-status" | python3 -m json.tool

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "🎯 預期結果："
echo "  ✅ eventCount: 216（或更多）"
echo "  ✅ isReady: true"
echo "  ✅ 找到 18 個日曆"
echo "  ✅ 沒有錯誤碼 119"
echo ""
echo "📱 測試步驟："
echo "  1. 在 LINE 中開啟行事曆"
echo "  2. 清除瀏覽器快取（Ctrl+Shift+R）"
echo "  3. 應該在 5-15 秒內完成載入"
echo "  4. 自動顯示完整課程（不再是 0 堂）"
echo "  5. 自動比對並綁定講師"
echo ""

