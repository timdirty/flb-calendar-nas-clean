#!/bin/bash
# 透過 SSH 重啟 NAS 上的 Docker 服務

echo "🔄 正在重啟 NAS 上的服務..."
echo ""

ssh -p 1022 ctctim14@funlearnbar.synology.me << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "📂 確認檔案已更新..."
ls -lh public/admin-dashboard.html | tail -1
echo ""

echo "🔄 重啟 Docker 容器..."
sudo docker-compose restart
echo ""

echo "⏳ 等待服務啟動 (5秒)..."
sleep 5
echo ""

echo "📋 查看最新日誌..."
sudo docker-compose logs --tail=30
echo ""

echo "✅ 服務重啟完成！"
EOF

echo ""
echo "📍 訪問網址:"
echo "   主頁: https://calendar.funlearnbar.synology.me/"
echo "   管理控制台: https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo "   行事曆: https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete.html"





