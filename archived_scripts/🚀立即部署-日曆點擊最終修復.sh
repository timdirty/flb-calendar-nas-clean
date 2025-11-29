#!/bin/bash

echo "=========================================="
echo "🚀 部署日曆點擊最終修復 - onclick 事件綁定版"
echo "=========================================="
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
echo "✅ 日曆點擊事件處理改進（參考 special-events-manager.html）"
echo "   - ⭐ 改用直接 onclick 事件綁定（不再依賴事件委派）"
echo "   - 週日曆：calendar-day 和 event-chip 都有 onclick"
echo "   - 月日曆：calendar-day 和 event-chip 都有 onclick"
echo "   - event-chip 使用 event.stopPropagation() 防止冒泡"
echo ""
echo "✅ 點擊功能"
echo "   - 點擊事件方塊 (event-chip) → 跳轉並高亮對應課程卡片"
echo "   - 點擊日曆方塊 (calendar-day) → 滾動到該日期的所有課程"
echo "   - 使用內聯函數檢查確保函數存在"
echo ""
echo "✅ 診斷功能"
echo "   - 點擊時會在控制台輸出診斷訊息"
echo "   - 週日曆顯示：🗓️ 週日曆-點擊日期 / 🎯 週日曆-點擊課程"
echo "   - 月日曆顯示：🗓️ 月日曆-點擊日期 / 🎯 月日曆-點擊課程"
echo ""

read -p "確定要部署嗎？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ 取消部署${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 開始部署...${NC}"
echo ""

# 備份檔案
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="public/perfect-calendar-optimized-complete2.html.backup-onclick-$TIMESTAMP"
cp public/perfect-calendar-optimized-complete2.html "$BACKUP_FILE"
echo -e "${GREEN}✅ 已備份原始檔案到: $BACKUP_FILE${NC}"
echo ""

# 檢查 Docker 容器狀態
echo "🔍 檢查 Docker 容器狀態..."
if docker ps | grep -q "flb-calendar"; then
    echo "✅ Docker 容器正在運行"
    
    # 重啟容器以應用變更
    echo ""
    echo "🔄 重啟 Docker 容器..."
    docker-compose restart
    
    # 等待服務啟動
    echo "⏳ 等待服務啟動..."
    sleep 3
    
    # 檢查服務狀態
    echo ""
    echo "🔍 檢查服務狀態..."
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ 服務已成功啟動"
    else
        echo "⚠️  服務可能尚未完全啟動，請稍候再試"
    fi
else
    echo "⚠️  Docker 容器未運行"
    echo "📝 請執行以下命令啟動："
    echo "   docker-compose up -d"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ 部署完成！"
echo "==========================================${NC}"
echo ""
echo "📋 接下來請執行以下步驟："
echo ""
echo "1️⃣  **清除瀏覽器快取並重新整理**"
echo "   - 按 Ctrl+Shift+R (Windows/Linux)"
echo "   - 按 Cmd+Shift+R (Mac)"
echo "   - ⚠️ 重要：必須清除快取，否則會載入舊版本"
echo ""
echo "2️⃣  測試週日曆點擊："
echo "   - 切換到「本週」視圖"
echo "   - 點擊空白日期 → 應該滾動到該日期的課程區塊"
echo "   - 點擊課程方塊 → 應該跳轉並高亮對應的課程卡片"
echo "   - 控制台應顯示：🗓️ 週日曆-點擊日期 或 🎯 週日曆-點擊課程"
echo ""
echo "3️⃣  測試月日曆點擊："
echo "   - 切換到「每月」視圖"
echo "   - 重複上述測試"
echo "   - 控制台應顯示：🗓️ 月日曆-點擊日期 或 🎯 月日曆-點擊課程"
echo ""
echo "4️⃣  檢查控制台："
echo "   - 開啟開發者工具 (F12)"
echo "   - 查看 Console 分頁"
echo "   - 確認沒有 JavaScript 錯誤"
echo ""
echo "💡 技術說明："
echo "   - 已改用 onclick 直接綁定（與 special-events-manager.html 相同）"
echo "   - 不再依賴事件委派機制"
echo "   - event-chip 使用 event.stopPropagation() 防止觸發父元素的點擊"
echo "   - 使用 escapeHtmlAttr() 確保 HTML 屬性安全"
echo ""
echo "⚠️  如果還是無法點擊："
echo "   1. 確認瀏覽器已清除快取"
echo "   2. 檢查控制台是否有 JavaScript 錯誤"
echo "   3. 確認日曆是否有正確渲染（應該看到日期和課程）"
echo "   4. 嘗試使用無痕模式開啟"
echo "   5. 在控制台執行："
echo "      document.querySelectorAll('.calendar-day').length"
echo "      （應該返回 > 0）"
echo ""
echo "🔙 如需還原："
echo "   cp $BACKUP_FILE public/perfect-calendar-optimized-complete2.html"
echo "   docker-compose restart"
echo ""
echo -e "${GREEN}=========================================${NC}"
