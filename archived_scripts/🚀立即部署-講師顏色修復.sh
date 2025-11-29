#!/bin/bash

echo "🎨 =========================================="
echo "🎨  講師顏色設定修復 - 部署腳本"
echo "🎨 =========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 獲取腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}📍 當前工作目錄: $(pwd)${NC}"
echo ""

# 1. 備份關鍵檔案
echo -e "${YELLOW}📦 步驟 1/5: 備份關鍵檔案...${NC}"
BACKUP_DIR="backups/teacher-color-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "teacher_data.json" ]; then
    cp teacher_data.json "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份 teacher_data.json${NC}"
fi

if [ -f "server.js" ]; then
    cp server.js "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份 server.js${NC}"
fi

if [ -f "public/admin-dashboard.html" ]; then
    cp public/admin-dashboard.html "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份 admin-dashboard.html${NC}"
fi

if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    cp public/perfect-calendar-optimized-complete2.html "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份 perfect-calendar-optimized-complete2.html${NC}"
fi

echo ""

# 2. 檢查檔案是否存在
echo -e "${YELLOW}🔍 步驟 2/5: 檢查修復檔案...${NC}"
FILES_OK=true

if [ ! -f "teacher_data.json" ]; then
    echo -e "${RED}❌ teacher_data.json 不存在${NC}"
    FILES_OK=false
fi

if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ server.js 不存在${NC}"
    FILES_OK=false
fi

if [ ! -f "public/admin-dashboard.html" ]; then
    echo -e "${RED}❌ admin-dashboard.html 不存在${NC}"
    FILES_OK=false
fi

if [ ! -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo -e "${RED}❌ perfect-calendar-optimized-complete2.html 不存在${NC}"
    FILES_OK=false
fi

if [ "$FILES_OK" = false ]; then
    echo -e "${RED}❌ 檔案檢查失敗，請確認檔案完整性${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 所有檔案檢查通過${NC}"
echo ""

# 3. 檢查 teacher_data.json 是否包含顏色欄位
echo -e "${YELLOW}🎨 步驟 3/5: 驗證講師顏色配置...${NC}"
if grep -q '"color":' teacher_data.json; then
    echo -e "${GREEN}✅ teacher_data.json 包含顏色配置${NC}"
    TEACHER_COUNT=$(grep -o '"name":' teacher_data.json | wc -l | tr -d ' ')
    echo -e "${BLUE}📊 發現 ${TEACHER_COUNT} 位講師${NC}"
else
    echo -e "${RED}❌ teacher_data.json 缺少顏色配置${NC}"
    echo -e "${YELLOW}⚠️  請確認檔案已正確更新${NC}"
    exit 1
fi
echo ""

# 4. 檢查 server.js 是否包含 PUT API
echo -e "${YELLOW}🔧 步驟 4/5: 驗證後端 API...${NC}"
if grep -q "app.put('/api/teachers'" server.js; then
    echo -e "${GREEN}✅ 後端已包含 PUT /api/teachers API${NC}"
else
    echo -e "${RED}❌ 後端缺少 PUT /api/teachers API${NC}"
    exit 1
fi
echo ""

# 5. 重啟服務
echo -e "${YELLOW}🔄 步驟 5/5: 重啟服務...${NC}"

# 檢查是否在 Docker 環境中
if [ -f "docker-compose.yml" ]; then
    echo -e "${BLUE}🐳 檢測到 Docker 環境，使用 docker-compose 重啟...${NC}"
    docker-compose restart
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Docker 服務重啟成功${NC}"
    else
        echo -e "${RED}❌ Docker 服務重啟失敗${NC}"
        exit 1
    fi
else
    # 非 Docker 環境，使用 pm2 或 node
    if command -v pm2 &> /dev/null; then
        echo -e "${BLUE}🔧 使用 pm2 重啟服務...${NC}"
        pm2 restart all
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ PM2 服務重啟成功${NC}"
        else
            echo -e "${RED}❌ PM2 服務重啟失敗${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  未檢測到 pm2，請手動重啟 Node.js 服務${NC}"
        echo -e "${BLUE}💡 提示: 使用以下命令重啟:${NC}"
        echo -e "   pkill -f 'node server.js' && nohup node server.js > server.log 2>&1 &"
    fi
fi

echo ""
echo -e "${GREEN}🎉 =========================================="
echo -e "🎉  講師顏色設定修復部署完成！"
echo -e "🎉 ==========================================${NC}"
echo ""
echo -e "${BLUE}📋 接下來的測試步驟：${NC}"
echo -e "1. 📱 開啟管理控制台: http://your-domain/admin-dashboard.html"
echo -e "2. 🎨 進入「講師管理」→「講師顏色配置」"
echo -e "3. ✏️  調整講師顏色並點擊「儲存顏色配置」"
echo -e "4. 🔄 重新整理前端行事曆頁面"
echo -e "5. ✅ 確認講師顏色已正確套用且不再隨機變動"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo -e "   • 顏色現在保存在伺服器端，所有裝置同步"
echo -e "   • 清除瀏覽器快取不會影響顏色設定"
echo -e "   • 可隨時在管理控制台修改顏色"
echo ""
echo -e "${BLUE}📦 備份位置: $BACKUP_DIR${NC}"
echo ""

