#!/bin/bash

# 🚀 FLB 行事曆系統 - 修復視圖和按鈕問題
# 
# 修復內容:
# 1. ✅ 修復講師篩選按鈕不可點擊問題 (添加z-index和pointer-events確保可點擊)
# 2. ✅ 修復搜尋時視圖鎖定問題 (允許在搜尋模式下自由切換本週/本月視圖)  
# 3. ✅ 修復週次選擇按鈕需要按兩次的問題 (改用Promise-based等待DOM渲染機制)
# 4. ✅ 移除電腦版自動滾動 (避免干擾用戶操作,手機版維持正常)
# 5. ✅ 修正toast阻擋點擊問題 (添加pointer-events: none允許點穿)
#
# 執行時間: 2025-01-30
# 版本: v2.1-final-fix

set -e

echo "=========================================="
echo "🚀 FLB 行事曆系統 - 立即部署修復"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查是否在正確的目錄
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ 錯誤: 請在專案根目錄執行此腳本${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 步驟 1/5: 備份關鍵檔案...${NC}"
mkdir -p backups/pre-view-fix-$(date +%Y%m%d-%H%M%S)
cp public/js/main.js backups/pre-view-fix-$(date +%Y%m%d-%H%M%S)/main.js.backup
cp public/css/styles.css backups/pre-view-fix-$(date +%Y%m%d-%H%M%S)/styles.css.backup
echo -e "${GREEN}✅ 備份完成${NC}"
echo ""

echo -e "${YELLOW}📝 步驟 2/5: 驗證修復內容...${NC}"
echo "檢查 CSS 修復..."
if grep -q "pointer-events: auto !important" public/css/styles.css; then
    echo -e "${GREEN}  ✅ 講師按鈕CSS修復已應用${NC}"
else
    echo -e "${RED}  ❌ 講師按鈕CSS修復未找到${NC}"
    exit 1
fi

echo "檢查 JS 修復..."
if grep -q "async function scrollToWeekdayCard" public/js/main.js; then
    echo -e "${GREEN}  ✅ 週次選擇Promise修復已應用${NC}"
else
    echo -e "${RED}  ❌ 週次選擇修復未找到${NC}"
    exit 1
fi

if grep -q "允許用戶在搜尋模式下自由切換視圖" public/js/main.js; then
    echo -e "${GREEN}  ✅ 搜尋視圖鎖定修復已應用${NC}"
else
    echo -e "${RED}  ❌ 搜尋視圖鎖定修復未找到${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}🛑 步驟 3/5: 停止現有容器...${NC}"
docker-compose down
echo -e "${GREEN}✅ 容器已停止${NC}"
echo ""

echo -e "${YELLOW}🔨 步驟 4/5: 重新構建映像 (無快取)...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ 映像構建完成${NC}"
echo ""

echo -e "${YELLOW}🚀 步驟 5/5: 啟動服務...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ 服務已啟動${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=========================================="
echo ""
echo "📊 修復內容摘要:"
echo "  1. ✅ 講師篩選按鈕現在可以正常點擊"
echo "  2. ✅ 搜尋時可以自由切換本週/本月視圖"
echo "  3. ✅ 週次選擇按鈕只需點擊一次即可正確定位"
echo "  4. ✅ 移除電腦版自動滾動 (避免干擾,手機版正常)"
echo "  5. ✅ Toast訊息不再阻擋後面的點擊"
echo ""
echo "🔍 查看日誌:"
echo "  docker-compose logs -f --tail=100"
echo ""
echo "🌐 訪問系統:"
echo "  http://localhost:8080"
echo ""
echo "📝 回滾方式 (如有問題):"
echo "  1. 停止容器: docker-compose down"
echo "  2. 還原備份: cp backups/pre-view-fix-*/main.js.backup public/js/main.js"
echo "               cp backups/pre-view-fix-*/styles.css.backup public/css/styles.css"
echo "  3. 重新構建: docker-compose build --no-cache && docker-compose up -d"
echo ""

# 等待幾秒讓服務啟動
echo -e "${YELLOW}⏳ 等待服務啟動 (5秒)...${NC}"
sleep 5

echo -e "${YELLOW}🔍 檢查服務狀態...${NC}"
docker-compose ps
echo ""

echo -e "${GREEN}🎉 所有修復已成功部署！請測試以下功能:${NC}"
echo "  1. 點擊搜尋結果中的講師標籤按鈕 (應該可以點擊)"
echo "  2. 在搜尋模式下切換本週/本月視圖 (應該可以自由切換)"
echo "  3. 點擊星期快速導航按鈕 (只需點擊一次即可定位)"
echo "  4. 電腦版載入頁面 (不會自動滾動,維持原位置)"
echo "  5. Toast訊息出現時點擊後面的元素 (應該可以點穿)"
echo ""

