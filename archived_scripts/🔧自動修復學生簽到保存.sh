#!/bin/bash

echo "🔧 自動修復學生簽到保存問題"
echo "================================"
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WEB_FILE="/volume1/web/flb-calendar/public/student_data.json"
DOCKER_FILE="/volume1/docker/flb-calendar-nas/public/student_data.json"
BACKUP_DIR="/volume1/docker/flb-calendar-nas/backups"

echo -e "${YELLOW}⚠️  警告：此腳本將修改檔案系統${NC}"
echo "   - 將備份現有檔案"
echo "   - 統一兩個 student_data.json 檔案"
echo "   - 修復檔案權限"
echo ""
read -p "是否繼續? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo -e "${BLUE}開始修復...${NC}"
echo ""

# 1. 創建備份目錄
echo -e "${BLUE}📁 1. 創建備份目錄${NC}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 2. 備份現有檔案
echo -e "${BLUE}💾 2. 備份現有檔案${NC}"

if [ -f "$WEB_FILE" ]; then
    WEB_BACKUP="$BACKUP_DIR/student_data_web_${TIMESTAMP}.json"
    cp "$WEB_FILE" "$WEB_BACKUP"
    echo -e "${GREEN}✅ Web 檔案已備份:${NC} $WEB_BACKUP"
fi

if [ -f "$DOCKER_FILE" ]; then
    DOCKER_BACKUP="$BACKUP_DIR/student_data_docker_${TIMESTAMP}.json"
    cp "$DOCKER_FILE" "$DOCKER_BACKUP"
    echo -e "${GREEN}✅ Docker 檔案已備份:${NC} $DOCKER_BACKUP"
fi

echo ""

# 3. 決定使用哪個檔案作為主檔案
echo -e "${BLUE}🔍 3. 決定主檔案${NC}"

MAIN_FILE=""

if [ -f "$WEB_FILE" ] && [ -f "$DOCKER_FILE" ]; then
    # 兩個檔案都存在，使用較新的
    WEB_MTIME=$(stat -c %Y "$WEB_FILE" 2>/dev/null || stat -f "%m" "$WEB_FILE")
    DOCKER_MTIME=$(stat -c %Y "$DOCKER_FILE" 2>/dev/null || stat -f "%m" "$DOCKER_FILE")
    
    if [ "$WEB_MTIME" -gt "$DOCKER_MTIME" ]; then
        MAIN_FILE="$WEB_FILE"
        echo -e "${GREEN}✅ 使用 Web 檔案（較新）${NC}"
    else
        MAIN_FILE="$DOCKER_FILE"
        echo -e "${GREEN}✅ 使用 Docker 檔案（較新）${NC}"
    fi
elif [ -f "$WEB_FILE" ]; then
    MAIN_FILE="$WEB_FILE"
    echo -e "${GREEN}✅ 使用 Web 檔案${NC}"
elif [ -f "$DOCKER_FILE" ]; then
    MAIN_FILE="$DOCKER_FILE"
    echo -e "${GREEN}✅ 使用 Docker 檔案${NC}"
else
    echo -e "${RED}❌ 錯誤：找不到任何 student_data.json 檔案！${NC}"
    exit 1
fi

echo ""

# 4. 統一檔案 - 使用軟連結
echo -e "${BLUE}🔗 4. 統一檔案（建立軟連結）${NC}"

# 確保目錄存在
mkdir -p "$(dirname $WEB_FILE)"
mkdir -p "$(dirname $DOCKER_FILE)"

# 決定連結方向
if [ "$MAIN_FILE" == "$WEB_FILE" ]; then
    # Web 檔案為主，Docker 連結到 Web
    if [ -f "$DOCKER_FILE" ] || [ -L "$DOCKER_FILE" ]; then
        rm -f "$DOCKER_FILE"
    fi
    ln -sf "$WEB_FILE" "$DOCKER_FILE"
    echo -e "${GREEN}✅ Docker 檔案已連結到 Web 檔案${NC}"
    echo "   $DOCKER_FILE -> $WEB_FILE"
else
    # Docker 檔案為主，Web 連結到 Docker
    if [ -f "$WEB_FILE" ] || [ -L "$WEB_FILE" ]; then
        rm -f "$WEB_FILE"
    fi
    ln -sf "$DOCKER_FILE" "$WEB_FILE"
    echo -e "${GREEN}✅ Web 檔案已連結到 Docker 檔案${NC}"
    echo "   $WEB_FILE -> $DOCKER_FILE"
fi

echo ""

# 5. 修復檔案權限
echo -e "${BLUE}🔒 5. 修復檔案權限${NC}"

# 修復主檔案權限
if [ -f "$MAIN_FILE" ]; then
    chmod 666 "$MAIN_FILE"
    chown http:http "$MAIN_FILE"
    echo -e "${GREEN}✅ 主檔案權限已修復${NC}"
    ls -l "$MAIN_FILE"
fi

# 修復目錄權限
chmod 755 "$(dirname $WEB_FILE)"
chmod 755 "$(dirname $DOCKER_FILE)"
echo -e "${GREEN}✅ 目錄權限已修復${NC}"

echo ""

# 6. 驗證修復結果
echo -e "${BLUE}✅ 6. 驗證修復結果${NC}"

echo "Web 檔案:"
ls -lh "$WEB_FILE"

echo ""
echo "Docker 檔案:"
ls -lh "$DOCKER_FILE"

echo ""

if [ -L "$WEB_FILE" ]; then
    echo -e "${GREEN}✅ Web 檔案是軟連結${NC}"
    echo "   指向: $(readlink $WEB_FILE)"
elif [ -L "$DOCKER_FILE" ]; then
    echo -e "${GREEN}✅ Docker 檔案是軟連結${NC}"
    echo "   指向: $(readlink $DOCKER_FILE)"
fi

echo ""

# 7. 檢查 server.js 是否需要重啟
echo -e "${BLUE}⚙️  7. 檢查服務狀態${NC}"

SERVER_PIDS=$(ps aux | grep "[n]ode.*server.js" | awk '{print $2}')
if [ -n "$SERVER_PIDS" ]; then
    echo -e "${YELLOW}⚠️  server.js 正在運行（PID: $SERVER_PIDS）${NC}"
    echo ""
    read -p "是否重啟 server.js? (y/N): " RESTART
    
    if [ "$RESTART" == "y" ] || [ "$RESTART" == "Y" ]; then
        echo "正在重啟 server.js..."
        kill $SERVER_PIDS
        sleep 2
        cd /volume1/docker/flb-calendar-nas
        nohup node server.js > server.log 2>&1 &
        echo -e "${GREEN}✅ server.js 已重啟${NC}"
    else
        echo -e "${YELLOW}⚠️  建議重啟 server.js 以套用變更${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  server.js 未運行${NC}"
    read -p "是否啟動 server.js? (y/N): " START
    
    if [ "$START" == "y" ] || [ "$START" == "Y" ]; then
        echo "正在啟動 server.js..."
        cd /volume1/docker/flb-calendar-nas
        nohup node server.js > server.log 2>&1 &
        echo -e "${GREEN}✅ server.js 已啟動${NC}"
    fi
fi

echo ""
echo ""

# 8. 總結
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ 修復完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "已完成的修復："
echo "  ✅ 備份了現有檔案到 $BACKUP_DIR"
echo "  ✅ 統一了兩個 student_data.json 檔案"
echo "  ✅ 修復了檔案和目錄權限"
echo ""
echo "接下來請："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+Delete）"
echo "  2. 重新載入頁面"
echo "  3. 長按課程卡片進行簽到測試"
echo "  4. 關閉並重新打開簽到頁面，驗證資料是否保存"
echo ""
echo "如果問題仍然存在，請："
echo "  1. 查看瀏覽器 Console (F12) 的錯誤訊息"
echo "  2. 檢查 server.log 檔案："
echo "     tail -50 /volume1/docker/flb-calendar-nas/server.log"
echo ""
echo -e "${BLUE}備份位置:${NC} $BACKUP_DIR"

