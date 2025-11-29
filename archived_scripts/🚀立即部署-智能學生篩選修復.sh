#!/bin/bash

echo "🚀 開始部署智能學生篩選修復..."
echo "========================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 項目目錄
PROJECT_DIR="/volume1/web/flb-calendar-nas"

echo "📦 修復內容："
echo "  ✓ 移除課程日期 fallback 邏輯"
echo "  ✓ 動態從 attendance 陣列計算最後出席日期"
echo "  ✓ 只有7天內有出席記錄的學生才豁免"
echo "  ✓ 無出席記錄的學生嚴格篩選（不豁免）"
echo ""

# 步驟 1: 備份現有檔案
echo -e "${YELLOW}📋 步驟 1/4: 備份現有檔案...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp "$PROJECT_DIR/public/js/student-filter.js" "$PROJECT_DIR/public/js/student-filter.js.backup-$TIMESTAMP"
cp "$PROJECT_DIR/server.js" "$PROJECT_DIR/server.js.backup-$TIMESTAMP"
cp "$PROJECT_DIR/public/admin-dashboard.html" "$PROJECT_DIR/public/admin-dashboard.html.backup-$TIMESTAMP"
echo -e "${GREEN}✅ 備份完成${NC}"
echo ""

# 步驟 2: 複製新檔案
echo -e "${YELLOW}📋 步驟 2/4: 複製更新的檔案...${NC}"

# 複製 student-filter.js
if [ -f "public/js/student-filter.js" ]; then
    cp "public/js/student-filter.js" "$PROJECT_DIR/public/js/"
    echo -e "${GREEN}✅ student-filter.js 已更新${NC}"
else
    echo -e "${RED}❌ 找不到 public/js/student-filter.js${NC}"
    exit 1
fi

# 複製 server.js
if [ -f "server.js" ]; then
    cp "server.js" "$PROJECT_DIR/"
    echo -e "${GREEN}✅ server.js 已更新${NC}"
else
    echo -e "${RED}❌ 找不到 server.js${NC}"
    exit 1
fi

# 複製 admin-dashboard.html
if [ -f "public/admin-dashboard.html" ]; then
    cp "public/admin-dashboard.html" "$PROJECT_DIR/public/"
    echo -e "${GREEN}✅ admin-dashboard.html 已更新${NC}"
else
    echo -e "${RED}❌ 找不到 public/admin-dashboard.html${NC}"
    exit 1
fi

echo ""

# 步驟 3: 重啟服務
echo -e "${YELLOW}📋 步驟 3/4: 重啟 Node.js 服務...${NC}"
cd "$PROJECT_DIR"

# 停止現有服務
if [ -f server.pid ]; then
    PID=$(cat server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "停止現有服務 (PID: $PID)..."
        kill $PID
        sleep 2
    fi
fi

# 啟動新服務
echo "啟動服務..."
nohup node server.js > server.log 2>&1 &
NEW_PID=$!
echo $NEW_PID > server.pid
echo -e "${GREEN}✅ 服務已啟動 (PID: $NEW_PID)${NC}"
echo ""

# 步驟 4: 驗證服務
echo -e "${YELLOW}📋 步驟 4/4: 驗證服務狀態...${NC}"
sleep 3

if ps -p $NEW_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 服務運行正常${NC}"
    
    # 測試 API
    echo ""
    echo "測試 API 連線..."
    if curl -s http://localhost:3005/api/student-data > /dev/null; then
        echo -e "${GREEN}✅ API 連線正常${NC}"
    else
        echo -e "${YELLOW}⚠️  API 連線測試失敗，請檢查 server.log${NC}"
    fi
else
    echo -e "${RED}❌ 服務啟動失敗，請檢查 server.log${NC}"
    tail -20 server.log
    exit 1
fi

echo ""
echo "========================================"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo "📝 更新說明："
echo "  版本：v2.3.0"
echo "  日期：$(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo "🔍 新邏輯："
echo "  1. 檢查學生的 attendance 陣列"
echo "  2. 找出所有 present=true 的記錄"
echo "  3. 取最新的出席日期"
echo "  4. 如果在 7 天內 → 豁免剩餘堂數檢查"
echo "  5. 如果超過 7 天或無記錄 → 嚴格篩選"
echo ""
echo "🧪 測試建議："
echo "  1. 開啟管理控制台的調試模式"
echo "  2. 查看 Console 中的篩選日誌"
echo "  3. 確認 -1 堂的學生已隱藏"
echo ""
echo "📂 備份位置："
echo "  $PROJECT_DIR/public/js/student-filter.js.backup-$TIMESTAMP"
echo "  $PROJECT_DIR/server.js.backup-$TIMESTAMP"
echo "  $PROJECT_DIR/public/admin-dashboard.html.backup-$TIMESTAMP"
echo ""

