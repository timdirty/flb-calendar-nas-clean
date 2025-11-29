#!/bin/bash

echo "=================================================="
echo "🚀 學習歷程上傳系統 - 快速部署腳本"
echo "=================================================="
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 步驟 1: 檢查 Node.js 環境
echo -e "${BLUE}步驟 1/5: 檢查 Node.js 環境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安裝！${NC}"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"
echo ""

# 步驟 2: 安裝依賴
echo -e "${BLUE}步驟 2/5: 安裝 npm 依賴...${NC}"
if npm install; then
    echo -e "${GREEN}✅ 依賴安裝成功！${NC}"
else
    echo -e "${RED}❌ 依賴安裝失敗！${NC}"
    exit 1
fi
echo ""

# 步驟 3: 檢查關鍵檔案
echo -e "${BLUE}步驟 3/5: 檢查關鍵檔案...${NC}"

FILES_TO_CHECK=(
    "server.js"
    "public/learning-record-upload.html"
    "public/perfect-calendar-optimized-complete2.html"
    "public/student_data.json"
    "teacher_data.json"
)

ALL_FILES_EXIST=true
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file 不存在！${NC}"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}有檔案缺失，請檢查！${NC}"
    exit 1
fi
echo ""

# 步驟 4: 檢查 NAS 目錄（如果在 NAS 上執行）
echo -e "${BLUE}步驟 4/5: 檢查 NAS 目錄...${NC}"
NAS_BASE_PATH="/volume1/Fun Learn Bar/學習歷程 automatic"

if [ -d "/volume1" ]; then
    echo "檢測到 Synology NAS 環境"
    if [ ! -d "$NAS_BASE_PATH" ]; then
        echo -e "${YELLOW}⚠️  目錄不存在，嘗試創建...${NC}"
        mkdir -p "$NAS_BASE_PATH"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 目錄創建成功: $NAS_BASE_PATH${NC}"
        else
            echo -e "${RED}❌ 目錄創建失敗！請手動創建。${NC}"
            echo "執行命令: mkdir -p \"$NAS_BASE_PATH\""
        fi
    else
        echo -e "${GREEN}✅ NAS 目錄已存在: $NAS_BASE_PATH${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  非 NAS 環境，跳過目錄檢查${NC}"
    echo "注意：在實際部署到 NAS 前，請確保目錄存在"
fi
echo ""

# 步驟 5: 顯示部署資訊
echo -e "${BLUE}步驟 5/5: 部署資訊${NC}"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ 學習歷程上傳系統部署完成！${NC}"
echo ""
echo "📋 系統資訊："
echo "  - 前端頁面: public/learning-record-upload.html"
echo "  - 入口位置: 主行事曆 → 學習歷程上傳按鈕"
echo "  - 儲存路徑: $NAS_BASE_PATH"
echo ""
echo "🌐 存取網址："
echo "  - 學習歷程: http://localhost:3002/learning-record-upload.html"
echo "  - 主行事曆: http://localhost:3002/perfect-calendar-optimized-complete2.html"
echo ""
echo "🔧 API 端點："
echo "  - GET  /api/learning-records/today-completed-courses"
echo "  - POST /api/learning-records/upload"
echo "  - GET  /api/learning-records/history"
echo "  - GET  /api/learning-records/check-completion"
echo "  - DELETE /api/learning-records/:recordId"
echo "  - PUT  /api/learning-records/:recordId"
echo ""
echo "📚 使用流程："
echo "  1. 從主行事曆點擊「學習歷程上傳」"
echo "  2. 選擇今天已結束的課程"
echo "  3. 為每個學生上傳：3張照片、1個影片、20字評語"
echo "  4. 上傳課程總覽（選填）"
echo "  5. 查看歷史記錄"
echo ""
echo "📁 檔案結構範例："
echo "  /volume1/Fun Learn Bar/學習歷程 automatic/"
echo "    └── 114-1/              (學期)"
echo "        └── SPIKE-六1600-1800/  (課程-時段)"
echo "            └── 2025-10-17/      (日期)"
echo "                ├── 學生姓名/    (學生資料夾)"
echo "                │   ├── 照片..."
echo "                │   ├── 影片..."
echo "                │   └── comment.txt"
echo "                └── 課程總覽/    (課程照片和摘要)"
echo ""
echo "=========================================="
echo ""

# 提示啟動服務
echo -e "${YELLOW}💡 接下來的步驟：${NC}"
echo ""
echo "本地開發環境："
echo "  npm start"
echo ""
echo "Docker 環境（NAS）："
echo "  docker-compose restart"
echo ""
echo "或使用 PM2："
echo "  pm2 restart server"
echo ""

# 詢問是否立即啟動
read -p "是否現在啟動伺服器？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}🚀 啟動伺服器...${NC}"
    npm start
else
    echo -e "${BLUE}請手動啟動伺服器以使用系統${NC}"
fi

echo ""
echo "=================================================="
echo "✅ 部署腳本執行完成"
echo "=================================================="


