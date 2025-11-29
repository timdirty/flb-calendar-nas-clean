#!/bin/bash

# ==================== 部署：學生請假複選與智能通知 ====================
# 
# 功能：
# 1. 複選學生請假
# 2. 智能通知合併（相同家長 → Carousel，不同家長 → 分別發送）
# 
# ==================== 部署腳本 ====================

echo "🚀 開始部署學生請假複選與智能通知功能..."
echo ""

# 設定變數
NAS_USER="FLB"
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_PATH="/volume1/docker/flb-calendar-nas"
LOCAL_PATH="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📂 同步前端檔案..."
rsync -avz -e "ssh -p ${NAS_PORT}" \
    "${LOCAL_PATH}/public/admin-dashboard.html" \
    "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/public/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端檔案同步成功${NC}"
else
    echo -e "${RED}❌ 前端檔案同步失敗${NC}"
    exit 1
fi

echo ""
echo "📂 同步後端檔案..."
rsync -avz -e "ssh -p ${NAS_PORT}" \
    "${LOCAL_PATH}/server.js" \
    "${LOCAL_PATH}/fast-attendance.js" \
    "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 後端檔案同步成功${NC}"
else
    echo -e "${RED}❌ 後端檔案同步失敗${NC}"
    exit 1
fi

echo ""
echo "🔄 重啟 Docker 服務..."
ssh -p ${NAS_PORT} ${NAS_USER}@${NAS_HOST} "cd ${NAS_PATH} && docker-compose restart"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 服務重啟成功${NC}"
else
    echo -e "${RED}❌ Docker 服務重啟失敗${NC}"
    exit 1
fi

echo ""
echo "⏳ 等待服務啟動 (10 秒)..."
sleep 10

echo ""
echo "🧪 測試 API 健康狀態..."
HEALTH_CHECK=$(curl -s https://calendar.funlearnbar.synology.me/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API 健康檢查通過${NC}"
    echo "$HEALTH_CHECK"
else
    echo -e "${YELLOW}⚠️ API 健康檢查失敗（但服務可能仍在啟動中）${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 測試步驟："
echo "1. 前往：https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo "2. 進入「學生請假安排」"
echo "3. 選擇課程類別（例如：SPM）"
echo "4. 點擊多位學生加入選取列表"
echo "5. 設定請假日期與原因"
echo "6. 勾選「立即發送通知」"
echo "7. 提交後觀察："
echo "   - 正職群組收到 Carousel（多個學生）或單一卡片（一個學生）"
echo "   - 相同家長的多個孩子請假會收到一個 Carousel"
echo "   - 不同家長分別收到各自孩子的通知"
echo ""
echo "🔍 查看日誌："
echo "ssh -p ${NAS_PORT} ${NAS_USER}@${NAS_HOST} 'cd ${NAS_PATH} && docker-compose logs -f --tail=50'"
echo ""



