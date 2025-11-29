#!/bin/bash

echo "======================================"
echo "🔥 部署 CalDAV 錯誤碼 119 修復"
echo "======================================"
echo ""

echo "📋 修復內容："
echo "  1. ✅ CalDAV 日曆列表獲取修復（錯誤碼 119）"
echo "  2. ✅ 檔案權限問題修復"
echo "  3. ✅ 後端等待快取機制"
echo ""

# 步驟 1: 停止容器
echo "🛑 步驟 1/4: 停止容器..."
sudo docker-compose down
echo "✅ 容器已停止"
echo ""

# 步驟 2: 完全重建映像
echo "🔨 步驟 2/4: 重建 Docker 映像..."
sudo docker-compose build --no-cache
echo "✅ 映像重建完成"
echo ""

# 步驟 3: 啟動容器
echo "🚀 步驟 3/4: 啟動容器..."
sudo docker-compose up -d
echo "✅ 容器已啟動"
echo ""

# 步驟 4: 等待並檢查
echo "⏳ 步驟 4/4: 等待服務啟動（20秒）..."
sleep 20

echo ""
echo "📊 檢查容器狀態："
sudo docker-compose ps

echo ""
echo "📋 查看啟動日誌（前 80 行）："
echo "======================================"
sudo docker logs flb-calendar-nas | head -80

echo ""
echo "======================================"
echo "🔍 檢查關鍵訊息："
echo "======================================"

echo ""
echo "1️⃣ CalDAV 登入狀態："
sudo docker logs flb-calendar-nas 2>&1 | grep -i "caldav\|登入\|login" | tail -5

echo ""
echo "2️⃣ 日曆列表獲取："
sudo docker logs flb-calendar-nas 2>&1 | grep -i "日曆列表\|calendar" | tail -5

echo ""
echo "3️⃣ 事件快取狀態："
sudo docker logs flb-calendar-nas 2>&1 | grep -i "快取.*事件\|獲取.*事件" | tail -5

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "🎯 預期看到："
echo "  ✅ Synology Calendar API 客戶端初始化成功"
echo "  ✅ CalDAV 客戶端登入成功"
echo "  ✅ 找到 X 個日曆"
echo "  ✅ 事件快取更新成功，獲取 XX 個事件"
echo ""
echo "❌ 不應該看到："
echo "  ❌ 獲取日曆列表失敗"
echo "  ❌ 錯誤碼: 119"
echo "  ❌ EACCES: permission denied"
echo ""
echo "📊 檢查快取狀態："
echo "======================================"
sleep 5
curl -s "https://calendar.funlearnbar.synology.me/api/events/cache-status" | python3 -m json.tool

echo ""
echo "======================================"
echo "🎉 如果 eventCount > 0，修復成功！"
echo "======================================"

