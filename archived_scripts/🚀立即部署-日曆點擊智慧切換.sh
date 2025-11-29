#!/bin/bash

echo "==========================================="
echo "🚀 部署日曆點擊智慧切換修復"
echo "==========================================="
echo ""

# 設置顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 確認當前目錄
CURRENT_DIR=$(pwd)
echo "📂 當前目錄: $CURRENT_DIR"
echo ""

# 檢查檔案是否存在
if [ ! -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo -e "${RED}❌ 找不到檔案: public/perfect-calendar-optimized-complete2.html${NC}"
    exit 1
fi

echo -e "${BLUE}📋 準備部署以下修復：${NC}"
echo ""
echo "✅ 日曆點擊智慧切換功能"
echo "   - 點擊週日曆/月日曆上的課程方塊時"
echo "   - 如果該課程不在當前視圖（今日/本週）"
echo "   - 自動切換到「每月」視圖"
echo "   - 然後用金色高亮該課程卡片（呼吸動畫）"
echo "   - 並滾動到該課程位置"
echo ""
echo "✅ 改進內容："
echo "   1. 檢測課程是否在當前渲染的列表中"
echo "   2. 如果不在，檢查是否存在於 allEvents 中"
echo "   3. 如果存在，自動切換到「每月」視圖"
echo "   4. 等待切換完成後，重新查找並高亮課程"
echo "   5. 使用金色主題高亮（參考 learning-record-upload.html）"
echo "   6. 添加呼吸動畫和右上角標籤「⭐ 從日曆跳轉的課程」"
echo ""
echo -e "${YELLOW}📝 參考設計：${NC}"
echo "   - 參考 learning-record-upload.html 的高亮實現"
echo "   - 使用智慧視圖切換確保課程可見"
echo "   - 提供更好的用戶體驗"
echo ""
echo "按 Enter 繼續部署，或按 Ctrl+C 取消..."
read

echo ""
echo -e "${GREEN}開始部署...${NC}"
echo ""

# 1. 檢查 PM2 進程
echo "1️⃣  檢查 PM2 進程..."
if command -v pm2 &> /dev/null; then
    pm2 list
    echo ""
    
    # 2. 重啟服務
    echo "2️⃣  重啟行事曆服務..."
    pm2 restart calendar-server 2>/dev/null || echo "   ℹ️  calendar-server 未在運行或不存在"
    pm2 restart flb-calendar 2>/dev/null || echo "   ℹ️  flb-calendar 未在運行或不存在"
    echo ""
else
    echo "   ⚠️  PM2 未安裝，跳過重啟步驟"
    echo ""
fi

# 3. 清除瀏覽器快取提醒
echo "3️⃣  ${YELLOW}⚠️  重要提醒${NC}"
echo ""
echo "   請在瀏覽器中清除快取："
echo "   • Chrome/Edge: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)"
echo "   • Firefox: Ctrl+F5 (Windows) 或 Cmd+Shift+R (Mac)"
echo "   • Safari: Cmd+Option+R"
echo ""

# 4. 顯示測試步驟
echo "4️⃣  ${BLUE}測試步驟：${NC}"
echo ""
echo "   1. 登入 LINE 並選擇講師（例如：TIM）"
echo "   2. 系統會自動切換到「今日」或「本週」視圖"
echo "   3. 點擊「本週」按鈕，查看週日曆"
echo "   4. 點擊週日曆上的任何課程方塊"
echo "   5. 如果該課程不在本週列表中："
echo "      → 系統會自動切換到「每月」視圖"
echo "      → 找到並用金色高亮該課程卡片（呼吸動畫）"
echo "      → 右上角顯示「⭐ 從日曆跳轉的課程」標籤"
echo "      → 滾動到該課程位置"
echo "   6. 檢查控制台日誌："
echo "      → 🎯 高亮課程卡片（全域函數被調用）"
echo "      → 📍 該課程存在於資料中，但不在當前視圖"
echo "      → 🔄 自動切換到「每月」視圖以顯示該課程..."
echo "      → ✅ 成功在「每月」視圖中找到課程卡片"
echo ""

# 5. 測試月日曆
echo "   測試月日曆："
echo "   1. 點擊「每月」按鈕"
echo "   2. 點擊月日曆上的任何課程方塊"
echo "   3. 應該直接用金色高亮該課程（已在每月視圖中）"
echo "   4. 觀察金色呼吸動畫和右上角標籤"
echo ""

echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "📊 修復摘要："
echo "   • 修改了 highlightEventCardFromCalendar() 函數"
echo "   • 新增了 performHighlight() 輔助函數"
echo "   • 實現了智慧視圖切換邏輯"
echo "   • 提升了用戶體驗"
echo ""
echo "🔗 相關檔案："
echo "   • public/perfect-calendar-optimized-complete2.html (已修改)"
echo "   • ✅日曆點擊智慧切換完成.md (完成報告)"
echo ""
echo "⚡ 效能影響："
echo "   • 無明顯效能影響"
echo "   • 僅在需要時才切換視圖"
echo "   • 使用 setTimeout 確保非阻塞"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo "   如果遇到問題，請檢查瀏覽器控制台的日誌"
echo "   所有操作都有詳細的診斷資訊"
echo ""

