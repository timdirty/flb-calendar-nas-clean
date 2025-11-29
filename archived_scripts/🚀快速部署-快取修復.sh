#!/bin/bash

# 🚀 快取問題修復 - 快速部署腳本
# 修復 Docker 重啟後快取延遲和講師識別失敗的問題

echo "════════════════════════════════════════════════════════"
echo "🚀 快取問題修復 - 快速部署"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📋 修復內容："
echo "  1. 後端：CalDAV 初始化完成後立即建立快取（從30秒改為立即）"
echo "  2. 前端：修復初始化流程中的結果判斷邏輯"
echo "  3. 前端：確保講師比對前檢查資料是否已載入"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "server.js" ]; then
    echo "❌ 錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

# 1. 備份現有檔案
echo "📦 備份現有檔案..."
timestamp=$(date +%Y%m%d-%H%M%S)
cp server.js "server.js.backup-cache-fix-${timestamp}" 2>/dev/null || echo "⚠️ 無法備份 server.js"
cp public/perfect-calendar-optimized-complete2.html "public/perfect-calendar-optimized-complete2.html.backup-cache-fix-${timestamp}" 2>/dev/null || echo "⚠️ 無法備份前端檔案"
echo "✅ 備份完成"
echo ""

# 2. 檢查 Docker 是否運行
echo "🔍 檢查 Docker 服務狀態..."
if docker ps > /dev/null 2>&1; then
    echo "✅ Docker 服務正常運行"
else
    echo "❌ Docker 服務未運行，請先啟動 Docker"
    exit 1
fi
echo ""

# 3. 停止現有容器
echo "🛑 停止現有容器..."
docker-compose down
echo "✅ 容器已停止"
echo ""

# 4. 重新構建並啟動
echo "🔨 重新構建並啟動服務..."
docker-compose up -d --build
echo "✅ 服務已啟動"
echo ""

# 5. 等待服務啟動
echo "⏳ 等待服務啟動（10秒）..."
sleep 10
echo ""

# 6. 檢查服務狀態
echo "🔍 檢查服務狀態..."
if curl -s http://localhost:3002/api/health > /dev/null; then
    echo "✅ 服務運行正常"
else
    echo "⚠️ 服務可能尚未完全啟動，請稍候再試"
fi
echo ""

# 7. 檢查快取狀態
echo "📊 檢查快取狀態..."
sleep 3  # 等待快取建立
cache_status=$(curl -s http://localhost:3002/api/events/cache-status)
echo "$cache_status" | jq '.' 2>/dev/null || echo "$cache_status"
echo ""

# 8. 顯示日誌（最後20行）
echo "📋 最近的服務日誌："
echo "────────────────────────────────────────────────────────"
docker-compose logs --tail=20
echo "────────────────────────────────────────────────────────"
echo ""

# 9. 完成
echo "════════════════════════════════════════════════════════"
echo "🎉 部署完成！"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📍 測試步驟："
echo "  1. 開啟瀏覽器訪問：http://localhost:3002"
echo "  2. 開啟瀏覽器開發者工具（F12）查看 Console"
echo "  3. 觀察載入過程中的日誌"
echo "  4. 檢查是否自動識別講師"
echo ""
echo "🔍 關鍵日誌訊息："
echo "  • '🚀 CalDAV 初始化完成，立即執行首次快取更新...'"
echo "  • '✅ 事件快取更新成功'"
echo "  • '✅ 行事曆資料已載入，allInstructors 數量: X'"
echo "  • '✅ 行事曆資料載入完成，講師列表已準備好: X 位講師'"
echo "  • '✅ 講師身份比對完成'"
echo ""
echo "🔧 如果遇到問題："
echo "  1. 查看完整日誌：docker-compose logs -f"
echo "  2. 檢查快取狀態：curl http://localhost:3002/api/events/cache-status | jq"
echo "  3. 手動刷新快取：curl -X POST http://localhost:3002/api/events/refresh-cache"
echo ""
echo "════════════════════════════════════════════════════════"

