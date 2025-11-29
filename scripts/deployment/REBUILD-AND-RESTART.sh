#!/bin/bash
# =============================================================================
# 重新構建映像並重啟容器 - 修復 502 錯誤
# =============================================================================
set -e

echo "========================================"
echo "🔧 重新構建 Docker 映像並重啟"
echo "========================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 停止並移除容器
echo -e "${BLUE}[1/5]${NC} 停止舊容器..."
docker-compose down
echo -e "${GREEN}✅ 容器已停止${NC}"
echo ""

# 2. 刪除舊映像（強制重新構建）
echo -e "${BLUE}[2/5]${NC} 刪除舊映像..."
OLD_IMAGE=$(docker images -q flb-calendar-nas-flb-calendar 2>/dev/null)
if [ ! -z "$OLD_IMAGE" ]; then
    docker rmi -f flb-calendar-nas-flb-calendar || echo "映像正在使用中，將在構建時覆蓋"
    echo -e "${GREEN}✅ 舊映像已標記刪除${NC}"
else
    echo -e "${YELLOW}⚠️ 沒有找到舊映像${NC}"
fi
echo ""

# 3. 重新構建映像（不使用快取）
echo -e "${BLUE}[3/5]${NC} 重新構建映像（這需要 3-5 分鐘）..."
echo -e "${YELLOW}⏳ 開始構建...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ 映像構建完成${NC}"
echo ""

# 4. 啟動新容器
echo -e "${BLUE}[4/5]${NC} 啟動新容器..."
docker-compose up -d
echo -e "${GREEN}✅ 容器已啟動${NC}"
echo ""

# 5. 等待容器完全啟動
echo -e "${BLUE}[5/5]${NC} 等待容器完全啟動..."
echo -e "${YELLOW}⏳ 等待 15 秒...${NC}"
sleep 15

# 檢查容器狀態
CONTAINER_STATUS=$(docker-compose ps -q flb-calendar-nas | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not found")
if [ "$CONTAINER_STATUS" = "running" ]; then
    echo -e "${GREEN}✅ 容器運行正常${NC}"
else
    echo -e "${RED}❌ 容器狀態異常: $CONTAINER_STATUS${NC}"
    echo "查看日誌："
    docker-compose logs --tail=50
    exit 1
fi

echo ""
echo "========================================"
echo -e "${GREEN}🧪 測試新 API 端點${NC}"
echo "========================================"
echo ""

# 測試健康檢查
echo "🩺 測試健康檢查..."
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 健康檢查成功 (HTTP 200)${NC}"
else
    echo -e "${RED}❌ 健康檢查失敗 (HTTP $HEALTH_CODE)${NC}"
fi

# 測試分片上傳 API
echo ""
echo "🧪 測試分片上傳初始化 API..."
INIT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/learning-records/upload/init \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}' 2>/dev/null)

INIT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/learning-records/upload/init \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}' 2>/dev/null || echo "000")

echo "   HTTP 狀態碼: $INIT_CODE"

if [ "$INIT_CODE" = "200" ] && echo "$INIT_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 分片上傳 API 正常工作！${NC}"
    echo "   回應: $(echo $INIT_RESPONSE | head -c 150)..."
elif [ "$INIT_CODE" = "502" ]; then
    echo -e "${RED}❌ 仍然是 502 錯誤！請檢查容器日誌${NC}"
    echo ""
    echo "查看詳細日誌："
    docker-compose logs --tail=100
    exit 1
elif [ "$INIT_CODE" = "404" ]; then
    echo -e "${RED}❌ 404 錯誤 - API 端點不存在！${NC}"
    echo "   這表示容器內的 server.js 沒有新 API"
    echo ""
    echo "檢查容器內檔案："
    docker exec flb-calendar-nas grep -n "api/learning-records/upload/init" /app/server.js || echo "找不到 API"
    exit 1
else
    echo -e "${YELLOW}⚠️ 意外的回應 (HTTP $INIT_CODE)${NC}"
    echo "   回應: $INIT_RESPONSE"
fi

echo ""
echo "========================================"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "========================================"
echo ""
echo "📊 容器狀態："
docker-compose ps
echo ""
echo "📋 最新日誌（最後 20 行）："
docker-compose logs --tail=20
echo ""
echo "========================================"
echo -e "${BLUE}✅ 下一步：在瀏覽器中測試${NC}"
echo "========================================"
echo ""
echo "1. 訪問 https://calendar.funlearnbar.synology.me/"
echo "2. 打開開發者工具（F12）→ Console"
echo "3. 上傳一個大檔案（>= 10MB）"
echo "4. 應該看到："
echo "   📦 使用分片上傳: xxx.mp4 15.5 MB"
echo "   🚀 開始分片上傳 (分片數: X)"
echo "   ✅ 上傳完成"
echo ""
echo "5. 【不應該再看到 502 錯誤】✅"
echo ""
echo "========================================"
echo "📚 如果仍有問題，查看完整日誌："
echo "   docker-compose logs -f"
echo "========================================"


