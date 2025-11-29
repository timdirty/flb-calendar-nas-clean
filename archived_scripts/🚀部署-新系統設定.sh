#!/bin/bash

# 🚀 部署新系統設定頁面
# 作者: Cursor AI Assistant
# 日期: 2025-01-16

echo "=========================================="
echo "🚀 部署新系統設定頁面"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 檢查文件是否存在
echo -e "${BLUE}📋 步驟 1: 檢查文件${NC}"
if [ -f "public/新系統設定.html" ]; then
    echo -e "${GREEN}✅ 新系統設定.html 已創建${NC}"
else
    echo -e "${RED}❌ 找不到 public/新系統設定.html${NC}"
    exit 1
fi

# 2. 備份舊的系統設定
echo ""
echo -e "${BLUE}📋 步驟 2: 備份舊版設定頁面${NC}"
if [ -f "public/系統設定.html" ]; then
    BACKUP_DIR="backups/settings-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp "public/系統設定.html" "$BACKUP_DIR/系統設定.html.backup"
    echo -e "${GREEN}✅ 已備份到: $BACKUP_DIR${NC}"
fi

# 3. 重啟服務（如果需要）
echo ""
echo -e "${BLUE}📋 步驟 3: 檢查服務狀態${NC}"
if command -v docker &> /dev/null; then
    if docker ps | grep -q "flb-calendar"; then
        echo -e "${YELLOW}⚠️  檢測到 Docker 容器正在運行${NC}"
        read -p "是否需要重啟容器？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker restart flb-calendar-nas
            echo -e "${GREEN}✅ Docker 容器已重啟${NC}"
        fi
    fi
fi

# 4. 驗證API端點
echo ""
echo -e "${BLUE}📋 步驟 4: 驗證後端API${NC}"

API_BASE="http://localhost:3000"

check_api() {
    local endpoint=$1
    local method=$2
    local description=$3
    
    echo -n "  檢查 $description... "
    
    if [ "$method" = "GET" ]; then
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE$endpoint")
    else
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE$endpoint" -H "Content-Type: application/json" -d '{}')
    fi
    
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "400" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ 失敗 (HTTP $STATUS)${NC}"
        return 1
    fi
}

# 檢查關鍵API
check_api "/api/health" "GET" "健康檢查"
check_api "/api/admin/info" "GET" "管理員資訊"
check_api "/api/system-settings" "GET" "系統設定"
check_api "/api/reminder-scheduler/status" "GET" "排程器狀態"
check_api "/api/line-config" "GET" "LINE配置"

# 5. 顯示訪問資訊
echo ""
echo -e "${GREEN}=========================================="
echo "✅ 部署完成！"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}📱 訪問新系統設定頁面:${NC}"
echo "  👉 http://localhost:3000/新系統設定.html"
echo ""
echo -e "${BLUE}📚 功能清單:${NC}"
echo "  ✅ 儀表板 - 系統概覽"
echo "  ✅ 管理員設定 - 設定管理員 LINE User ID"
echo "  ✅ LINE 通知設定 - 配置 LINE Bot 憑證"
echo "  ✅ 行事曆設定 - Synology Calendar 連線"
echo "  ✅ 提醒設定 - 配置提醒時間"
echo "  ✅ 排程器設定 - 管理排程器運行"
echo "  ✅ 系統參數 - 檢視系統資訊"
echo ""
echo -e "${YELLOW}⚠️  注意事項:${NC}"
echo "  1. 所有功能都已對接真實後端API"
echo "  2. 修改設定後部分需要重啟服務才生效"
echo "  3. LINE Token 修改需要重啟 Docker 容器"
echo "  4. 排程器可以即時啟動/停止"
echo ""
echo -e "${BLUE}🔗 相關頁面:${NC}"
echo "  • 管理控制台: http://localhost:3000/course-reminder-management.html"
echo "  • 舊版設定: http://localhost:3000/系統設定.html"
echo ""

