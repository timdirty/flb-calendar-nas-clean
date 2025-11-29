#!/bin/bash
# ============================================
# FLB 行事曆系統 - 伺服器重啟腳本
# ============================================
# 用途：停止舊伺服器、安裝依賴、重新啟動
# 使用：./restart-server.sh [dev|prod]
# ============================================

set -e  # 遇到錯誤立即退出

MODE="${1:-dev}"  # 預設開發模式

echo "🚀 FLB 行事曆系統 - 伺服器重啟"
echo "模式: $MODE"
echo "=========================================="

# ==================== 步驟 1: 停止舊伺服器 ====================
echo "🛑 步驟 1: 停止舊伺服器..."

if [ "$MODE" = "prod" ]; then
    echo "📦 停止 Docker 容器..."
    docker-compose down
else
    echo "🔍 尋找 Node.js 進程..."
    if pgrep -f "node server.js" > /dev/null; then
        echo "⚠️  發現運行中的 server.js 進程，正在停止..."
        pkill -f "node server.js" || true
        sleep 2
        echo "✅ 舊伺服器已停止"
    else
        echo "ℹ️  沒有發現運行中的 server.js 進程"
    fi
fi

# ==================== 步驟 2: 安裝依賴 ====================
echo ""
echo "📦 步驟 2: 安裝/更新依賴..."
npm install

# 驗證關鍵依賴
echo "🔍 驗證關鍵依賴..."
MISSING_DEPS=0

if [ ! -d "node_modules/sharp" ]; then
    echo "❌ 缺少依賴: sharp"
    MISSING_DEPS=1
fi

if [ ! -d "node_modules/p-queue" ]; then
    echo "❌ 缺少依賴: p-queue"
    MISSING_DEPS=1
fi

if [ ! -d "node_modules/uuid" ]; then
    echo "❌ 缺少依賴: uuid"
    MISSING_DEPS=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo "⚠️  部分依賴缺失，請檢查 package.json"
    exit 1
fi

echo "✅ 所有關鍵依賴已安裝"

# ==================== 步驟 3: 啟動伺服器 ====================
echo ""
echo "🚀 步驟 3: 啟動伺服器..."

if [ "$MODE" = "prod" ]; then
    echo "📦 使用 Docker Compose 啟動..."
    docker-compose build --no-cache
    docker-compose up -d
    sleep 3
    echo ""
    echo "📊 容器狀態:"
    docker-compose ps
    echo ""
    echo "📝 查看日誌: docker-compose logs -f --tail=50"
else
    echo "🔧 開發模式啟動..."
    echo "請在另一個終端運行: npm run dev"
    echo "或完整功能測試: npm run dev:full"
fi

# ==================== 步驟 4: 驗證 API ====================
echo ""
echo "🧪 步驟 4: 驗證 API 可用性..."
echo "等待伺服器啟動... (5 秒)"
sleep 5

if [ "$MODE" = "prod" ]; then
    API_URL="http://localhost:8080"
else
    API_URL="http://localhost:3002"
fi

echo "🔍 測試健康檢查端點..."
if curl -s -f "$API_URL/health" > /dev/null; then
    echo "✅ 伺服器健康檢查通過"
else
    echo "⚠️  伺服器健康檢查失敗，請檢查日誌"
fi

echo ""
echo "🔍 測試分片上傳初始化端點..."
INIT_RESPONSE=$(curl -s -X POST "$API_URL/api/learning-records/upload/init" \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","fileSize":10485760,"chunkSize":5242880}' || echo '{"success":false}')

if echo "$INIT_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 分片上傳 API 正常運作"
    echo "📊 回應: $INIT_RESPONSE"
else
    echo "⚠️  分片上傳 API 測試失敗"
    echo "📊 回應: $INIT_RESPONSE"
fi

# ==================== 完成 ====================
echo ""
echo "=========================================="
echo "🎉 伺服器重啟完成！"
echo "=========================================="
echo ""
echo "📋 下一步測試："
echo "  1. 打開瀏覽器: $API_URL/perfect-calendar-modular.html"
echo "  2. 進入學習記錄上傳頁面"
echo "  3. 上傳一個 >= 10MB 的檔案"
echo "  4. 檢查瀏覽器控制台應顯示: '📦 使用分片上傳'"
echo "  5. 檢查 Network 標籤應看到 upload/init、upload/chunk、upload/complete"
echo ""
echo "📝 查看日誌："
if [ "$MODE" = "prod" ]; then
    echo "  docker-compose logs -f --tail=50"
else
    echo "  終端中的 npm run dev 輸出"
fi
echo ""



