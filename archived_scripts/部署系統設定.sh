#!/bin/bash

echo "🚀 開始部署系統設定功能..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查是否在正確的目錄
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ 錯誤：請在 flb-calendar-nas 目錄中執行此腳本${NC}"
    exit 1
fi

echo ""
echo "=== 步驟 1: 檢查文件是否存在 ==="
FILES_TO_CHECK=(
    "public/系統設定.html"
    "server.js"
)

ALL_FILES_EXIST=true
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file 存在"
    else
        echo -e "${RED}✗${NC} $file 不存在"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}❌ 部分文件缺失，請先確保所有文件都已創建${NC}"
    exit 1
fi

echo ""
echo "=== 步驟 2: 停止容器 ==="
sudo docker-compose stop
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 容器已停止${NC}"
else
    echo -e "${YELLOW}⚠️ 容器可能未運行${NC}"
fi

echo ""
echo "=== 步驟 3: 複製文件到容器 ==="

# 複製系統設定頁面
echo "複製系統設定頁面..."
sudo docker cp ./public/系統設定.html flb-calendar-nas:/app/public/系統設定.html
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 系統設定頁面已複製${NC}"
else
    echo -e "${RED}❌ 複製系統設定頁面失敗${NC}"
fi

# 複製更新的 server.js
echo "複製更新的 server.js..."
sudo docker cp ./server.js flb-calendar-nas:/app/server.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ server.js 已複製${NC}"
else
    echo -e "${RED}❌ 複製 server.js 失敗${NC}"
fi

# 複製更新的 course-reminder-management.html
echo "複製更新的管理頁面..."
sudo docker cp ./public/course-reminder-management.html flb-calendar-nas:/app/public/course-reminder-management.html
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 管理頁面已複製${NC}"
else
    echo -e "${RED}❌ 複製管理頁面失敗${NC}"
fi

echo ""
echo "=== 步驟 4: 修復文件權限 ==="
sudo docker exec flb-calendar-nas chown -R nextjs:nodejs /app/public/系統設定.html
sudo docker exec flb-calendar-nas chown -R nextjs:nodejs /app/server.js
sudo docker exec flb-calendar-nas chmod 644 /app/public/系統設定.html
sudo docker exec flb-calendar-nas chmod 644 /app/server.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 文件權限已修復${NC}"
else
    echo -e "${YELLOW}⚠️ 修復權限時遇到問題，但可能不影響運行${NC}"
fi

echo ""
echo "=== 步驟 5: 啟動容器 ==="
sudo docker-compose start
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 容器已啟動${NC}"
else
    echo -e "${RED}❌ 容器啟動失敗${NC}"
    exit 1
fi

echo ""
echo "⏳ 等待 10 秒讓服務完全啟動..."
sleep 10

echo ""
echo "=== 步驟 6: 檢查服務狀態 ==="

# 檢查容器是否運行
if sudo docker ps | grep -q flb-calendar-nas; then
    echo -e "${GREEN}✅ 容器運行中${NC}"
else
    echo -e "${RED}❌ 容器未運行${NC}"
    echo "檢查日誌："
    sudo docker logs flb-calendar-nas --tail 50
    exit 1
fi

# 檢查 API 是否響應
echo "測試 API 響應..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")

if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ API 響應正常 (HTTP $API_RESPONSE)${NC}"
elif [ "$API_RESPONSE" = "000" ]; then
    echo -e "${YELLOW}⚠️ 無法連接到 API（可能需要更多時間啟動）${NC}"
else
    echo -e "${YELLOW}⚠️ API 響應異常 (HTTP $API_RESPONSE)${NC}"
fi

echo ""
echo "=== 步驟 7: 驗證新端點 ==="

# 測試系統設定 API
echo "測試系統設定 API..."
SETTINGS_RESPONSE=$(curl -s http://localhost:3000/api/system-settings 2>/dev/null)
if echo "$SETTINGS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ /api/system-settings 端點正常${NC}"
else
    echo -e "${YELLOW}⚠️ /api/system-settings 端點可能有問題${NC}"
fi

# 測試管理員 API
echo "測試管理員 API..."
ADMIN_RESPONSE=$(curl -s http://localhost:3000/api/admin/info 2>/dev/null)
if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ /api/admin/info 端點正常${NC}"
else
    echo -e "${YELLOW}⚠️ /api/admin/info 端點可能有問題${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 訪問新的系統設定頁面："
echo -e "${BLUE}https://calendar.funlearnbar.synology.me/系統設定.html${NC}"
echo ""
echo "🔗 或從管理頁面進入："
echo -e "${BLUE}https://calendar.funlearnbar.synology.me/course-reminder-management.html${NC}"
echo ""
echo "📖 使用指南："
echo "   查看 系統設定使用指南.md"
echo ""
echo "⚠️ 如果遇到問題，請查看日誌："
echo "   sudo docker logs flb-calendar-nas"
echo ""


