#!/bin/bash
# 快速重啟 Docker 容器（不重新構建）

echo "🔄 快速重啟 Docker 容器..."
echo ""

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "📦 確認新檔案..."
ls -lh synology-calendar-client.js | tail -1

echo ""
echo "🔄 重啟容器..."
sudo docker-compose restart

echo ""
echo "⏳ 等待 5 秒..."
sleep 5

echo ""
echo "📋 查看最新日誌..."
sudo docker-compose logs --tail=50


