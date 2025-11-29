#!/bin/bash

# 🚀 立即部署 - 學習歷程上傳頁面修復
# 修復 parseTitle 函數缺失和 Font Awesome 載入問題
# 日期: 2025-01-29

set -e

echo "=================================================="
echo "🚀 開始部署 - 學習歷程上傳頁面修復"
echo "=================================================="

# 設定顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 取得腳本所在目錄的父目錄（專案根目錄）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo -e "${BLUE}📂 專案根目錄: $PROJECT_ROOT${NC}"
echo ""

# 1. 驗證修改的檔案
echo -e "${YELLOW}🔍 步驟 1: 驗證修改的檔案${NC}"
echo "檢查 course-utils.js 是否包含 parseTitle 函數..."

if grep -q "parseTitle(title)" "$PROJECT_ROOT/public/js/modules/course-utils.js"; then
    echo -e "${GREEN}✅ course-utils.js 包含 parseTitle 函數${NC}"
else
    echo -e "${RED}❌ course-utils.js 缺少 parseTitle 函數！${NC}"
    exit 1
fi

echo "檢查 learning-record-upload.html 是否已更新版本號..."
if grep -q "v=20250129" "$PROJECT_ROOT/public/learning-record-upload.html"; then
    echo -e "${GREEN}✅ learning-record-upload.html 已更新版本號${NC}"
else
    echo -e "${RED}❌ learning-record-upload.html 缺少版本號！${NC}"
    exit 1
fi

echo ""

# 2. 檢查 Docker 狀態
echo -e "${YELLOW}🔍 步驟 2: 檢查 Docker 狀態${NC}"

if command -v docker &> /dev/null; then
    if docker ps | grep -q "flb-calendar"; then
        echo -e "${GREEN}✅ Docker 容器正在運行${NC}"
        CONTAINER_ID=$(docker ps --filter "name=flb-calendar" --format "{{.ID}}")
        echo "容器 ID: $CONTAINER_ID"
    else
        echo -e "${YELLOW}⚠️  Docker 容器未運行${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker 未安裝或不可用${NC}"
fi

echo ""

# 3. 重新啟動容器（如果在 Docker 中運行）
echo -e "${YELLOW}🔄 步驟 3: 重新啟動服務${NC}"

if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    echo "重新啟動 Docker 容器..."
    docker-compose restart
    echo -e "${GREEN}✅ Docker 容器已重新啟動${NC}"
    
    echo "等待容器啟動..."
    sleep 3
    
    # 檢查容器狀態
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}✅ 容器啟動成功${NC}"
    else
        echo -e "${RED}❌ 容器啟動失敗${NC}"
        docker-compose logs --tail=20
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose.yml 不存在，跳過容器重啟${NC}"
fi

echo ""

# 4. 清理瀏覽器快取指示
echo -e "${YELLOW}📋 步驟 4: 清理瀏覽器快取${NC}"
echo ""
echo -e "${BLUE}請在瀏覽器中執行以下操作：${NC}"
echo "  1. 開啟開發者工具 (F12)"
echo "  2. 右鍵點擊「重新整理」按鈕"
echo "  3. 選擇「清除快取並硬性重新整理」"
echo ""
echo -e "${BLUE}或使用快捷鍵：${NC}"
echo "  • Chrome/Edge: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)"
echo "  • Firefox: Ctrl+F5 (Windows) 或 Cmd+Shift+R (Mac)"
echo "  • Safari: Cmd+Option+R (Mac)"
echo ""

# 5. 測試 API 端點
echo -e "${YELLOW}🧪 步驟 5: 測試 API 端點${NC}"

# 等待服務完全啟動
sleep 2

if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 健康檢查端點正常${NC}"
else
    echo -e "${RED}❌ 健康檢查端點無回應${NC}"
    echo "請檢查伺服器日誌："
    echo "  docker-compose logs -f --tail=50"
fi

echo ""

# 6. 顯示修改摘要
echo -e "${YELLOW}📝 修改摘要${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ 已修復的問題：${NC}"
echo "  1. 新增 parseTitle 函數到 course-utils.js"
echo "  2. 修復 Font Awesome CSS 載入 (改用 CDN)"
echo "  3. 添加版本號強制重新載入腳本"
echo ""
echo -e "${BLUE}📁 修改的檔案：${NC}"
echo "  • public/js/modules/course-utils.js"
echo "  • public/learning-record-upload.html"
echo ""

# 7. 顯示測試 URL
echo -e "${YELLOW}🔗 測試 URL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "學習歷程上傳頁面："
echo "  http://localhost:8080/learning-record-upload.html"
echo ""
echo "帶參數測試："
echo "  http://localhost:8080/learning-record-upload.html?eventId=test-event&date=2025-01-29"
echo ""

# 8. 驗證修復
echo -e "${YELLOW}🔍 步驟 6: 驗證修復${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "請在瀏覽器開發者工具的 Console 中確認："
echo ""
echo -e "${GREEN}✅ 應該看到：${NC}"
echo "  • ✅ CourseStudentMatcher v2.0.0 已載入"
echo "  • ✅ Student Filter 已載入"
echo "  • 課程列表正常顯示"
echo ""
echo -e "${RED}❌ 不應該看到：${NC}"
echo "  • parseTitle is not a function"
echo "  • MIME type 'text/html' is not a supported stylesheet"
echo ""

echo "=================================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}💡 提示：${NC}"
echo "  如果問題仍然存在，請："
echo "  1. 完全關閉瀏覽器並重新開啟"
echo "  2. 使用無痕模式測試"
echo "  3. 檢查 Docker 日誌：docker-compose logs -f"
echo ""
echo -e "${YELLOW}📧 如需協助，請提供：${NC}"
echo "  • 瀏覽器 Console 的完整錯誤訊息"
echo "  • Docker 日誌 (docker-compose logs --tail=50)"
echo ""

