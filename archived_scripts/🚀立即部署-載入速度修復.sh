#!/bin/bash

echo "======================================"
echo "🔥 部署載入速度與快取修復"
echo "======================================"
echo ""

# 設定目錄
TARGET_DIR="/volume1/docker/flb-calendar-nas"

echo "📍 目標目錄: $TARGET_DIR"
echo ""

# 步驟 1: 停止服務
echo "🛑 步驟 1/4: 停止 Docker 容器..."
cd "$TARGET_DIR" || exit 1
docker-compose down
echo "✅ 容器已停止"
echo ""

# 步驟 2: 完全重建映像（不使用快取）
echo "🔨 步驟 2/4: 重建 Docker 映像（--no-cache）..."
docker-compose build --no-cache
echo "✅ 映像重建完成"
echo ""

# 步驟 3: 啟動服務
echo "🚀 步驟 3/4: 啟動 Docker 容器..."
docker-compose up -d
echo "✅ 容器已啟動"
echo ""

# 步驟 4: 等待並檢查狀態
echo "⏳ 步驟 4/4: 等待服務啟動（15秒）..."
sleep 15

echo ""
echo "📊 檢查容器狀態..."
docker ps | grep flb-calendar-nas

echo ""
echo "📝 最新日誌（後 30 行）:"
docker logs flb-calendar-nas --tail 30

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "🔍 關鍵修復內容："
echo "  1. ✅ 後端 API 加入「等待快取建立」機制"
echo "  2. ✅ 前端 async/await 完整對齊"
echo "  3. ✅ Docker 容器檔案權限修復"
echo ""
echo "📋 測試步驟："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  2. 重新開啟應用程式"
echo "  3. 應該在 5-10 秒內完成載入並自動綁定講師"
echo ""
echo "🔧 如需檢查即時日誌："
echo "  docker logs -f flb-calendar-nas"
echo ""

