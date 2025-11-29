#!/bin/bash

# ====================================
# 綁定功能更新 - 立即部署到 NAS Docker
# ====================================

echo "=================================="
echo "🚀 部署綁定功能更新到 NAS"
echo "=================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# NAS 配置
NAS_USER="ctctim14"
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 本地路徑
LOCAL_PATH="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 檢查檔案
cd "$LOCAL_PATH" || exit 1

echo "${BLUE}📋 更新內容：${NC}"
echo "  1. ✅ macOS 26 液態玻璃風格"
echo "  2. ✅ 已綁定講師綠色標記"
echo "  3. ✅ 未綁定講師自動排序"
echo "  4. ✅ 增強保存驗證機制"
echo ""

echo "${YELLOW}步驟 1: 驗證本地檔案${NC}"
if [ ! -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "${RED}  ❌ 前端檔案不存在！${NC}"
    exit 1
fi

if [ ! -f "server.js" ]; then
    echo "${RED}  ❌ 後端檔案不存在！${NC}"
    exit 1
fi

# 檢查關鍵更新
if grep -q "macOS 26 液態玻璃風格" "public/perfect-calendar-optimized-complete2.html"; then
    echo "${GREEN}  ✅ 前端已包含液態玻璃風格更新${NC}"
else
    echo "${RED}  ⚠️  前端可能未包含完整更新${NC}"
fi

if grep -q "講師綁定成功並已驗證" "server.js"; then
    echo "${GREEN}  ✅ 後端已包含驗證機制${NC}"
else
    echo "${RED}  ⚠️  後端可能未包含完整更新${NC}"
fi

echo ""
echo "${YELLOW}步驟 2: 同步前端檔案到 NAS${NC}"
echo "  📂 同步 public/perfect-calendar-optimized-complete2.html..."

rsync -avz --progress -e "ssh -p $NAS_PORT" \
    "$LOCAL_PATH/public/perfect-calendar-optimized-complete2.html" \
    "$NAS_USER@$NAS_HOST:$NAS_PATH/public/"

if [ $? -eq 0 ]; then
    echo "${GREEN}  ✅ 前端檔案同步成功${NC}"
else
    echo "${RED}  ❌ 前端檔案同步失敗${NC}"
    exit 1
fi

echo ""
echo "${YELLOW}步驟 3: 同步後端檔案到 NAS${NC}"
echo "  📂 同步 server.js..."

rsync -avz --progress -e "ssh -p $NAS_PORT" \
    "$LOCAL_PATH/server.js" \
    "$NAS_USER@$NAS_HOST:$NAS_PATH/"

if [ $? -eq 0 ]; then
    echo "${GREEN}  ✅ 後端檔案同步成功${NC}"
else
    echo "${RED}  ❌ 後端檔案同步失敗${NC}"
    exit 1
fi

echo ""
echo "${YELLOW}步驟 4: 重建並重啟 Docker 容器${NC}"
echo "  🔄 執行遠端命令..."

ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'ENDSSH'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo ""
echo "📊 當前容器狀態："
sudo docker-compose ps

echo ""
echo "🛑 停止容器..."
sudo docker-compose down

echo ""
echo "🔨 重建 Docker 鏡像..."
sudo docker-compose build --no-cache

echo ""
echo "🚀 啟動新容器..."
sudo docker-compose up -d

echo ""
echo "⏳ 等待服務啟動 (15 秒)..."
sleep 15

echo ""
echo "📊 新容器狀態："
sudo docker-compose ps

echo ""
echo "📋 查看最新日誌（最後 50 行）："
sudo docker-compose logs --tail=50

echo ""
echo "🔍 驗證更新是否生效..."

# 檢查前端檔案
if sudo docker exec flb-calendar-nas grep -q "macOS 26 液態玻璃風格" /app/public/perfect-calendar-optimized-complete2.html 2>/dev/null; then
    echo "  ✅ 前端更新已生效（液態玻璃風格）"
else
    echo "  ⚠️  前端更新可能未生效"
fi

# 檢查後端檔案
if sudo docker exec flb-calendar-nas grep -q "講師綁定成功並已驗證" /app/server.js 2>/dev/null; then
    echo "  ✅ 後端更新已生效（驗證機制）"
else
    echo "  ⚠️  後端更新可能未生效"
fi

echo ""
echo "🧪 測試 API 端點..."
sleep 5

# 測試 health check
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo "  ✅ Health check 正常"
else
    echo "  ⚠️  Health check 異常"
fi

# 測試 teachers API
if curl -s http://localhost:3000/api/teachers | grep -q "teachers"; then
    echo "  ✅ Teachers API 正常"
else
    echo "  ⚠️  Teachers API 異常"
fi

ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "${GREEN}=================================="
    echo "✅ 部署完成！"
    echo "==================================${NC}"
else
    echo ""
    echo "${RED}=================================="
    echo "❌ 部署過程中出現錯誤"
    echo "==================================${NC}"
    exit 1
fi

echo ""
echo "${BLUE}📱 測試網址：${NC}"
echo ""
echo "🔗 主要頁面（更新後的版本）："
echo "   https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete2.html"
echo ""
echo "🔗 其他頁面："
echo "   https://calendar.funlearnbar.synology.me/"
echo "   https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo ""

echo "${YELLOW}🧪 如何驗證更新：${NC}"
echo ""
echo "1️⃣  在 LINE 中開啟應用（使用 perfect-calendar-optimized-complete2.html）"
echo ""
echo "2️⃣  觀察液態玻璃風格："
echo "   • 背景應該有超強模糊效果"
echo "   • 對話框透明且有玻璃質感"
echo "   • 按鈕懸停有 3D 動畫"
echo ""
echo "3️⃣  測試綁定功能："
echo "   • 下拉選單中未綁定講師在上方"
echo "   • 已綁定講師有 ✓ 標記和綠色文字"
echo "   • 綁定成功後顯示總綁定數"
echo ""
echo "4️⃣  檢查 Docker 日誌："
echo "   ssh -p 1022 ctctim14@funlearnbar.synology.me"
echo "   cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
echo "   sudo docker-compose logs -f"
echo ""

echo "${GREEN}🎉 所有更新已成功部署到線上環境！${NC}"
echo ""

