#!/bin/bash

echo "🔍 學生簽到保存問題診斷"
echo "================================"
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 檢查檔案是否存在
echo -e "${BLUE}📁 1. 檢查檔案是否存在${NC}"
echo "-----------------------------------"

WEB_FILE="/volume1/web/flb-calendar/public/student_data.json"
DOCKER_FILE="/volume1/docker/flb-calendar-nas/public/student_data.json"

if [ -f "$WEB_FILE" ]; then
    echo -e "${GREEN}✅ Web 檔案存在:${NC} $WEB_FILE"
    WEB_MTIME=$(stat -c %y "$WEB_FILE" 2>/dev/null || stat -f "%Sm" "$WEB_FILE")
    WEB_SIZE=$(stat -c %s "$WEB_FILE" 2>/dev/null || stat -f "%z" "$WEB_FILE")
    echo "   最後修改: $WEB_MTIME"
    echo "   檔案大小: $WEB_SIZE bytes"
else
    echo -e "${RED}❌ Web 檔案不存在:${NC} $WEB_FILE"
fi

echo ""

if [ -f "$DOCKER_FILE" ]; then
    echo -e "${GREEN}✅ Docker 檔案存在:${NC} $DOCKER_FILE"
    DOCKER_MTIME=$(stat -c %y "$DOCKER_FILE" 2>/dev/null || stat -f "%Sm" "$DOCKER_FILE")
    DOCKER_SIZE=$(stat -c %s "$DOCKER_FILE" 2>/dev/null || stat -f "%z" "$DOCKER_FILE")
    echo "   最後修改: $DOCKER_MTIME"
    echo "   檔案大小: $DOCKER_SIZE bytes"
else
    echo -e "${RED}❌ Docker 檔案不存在:${NC} $DOCKER_FILE"
fi

echo ""

# 2. 檢查檔案權限
echo -e "${BLUE}🔒 2. 檢查檔案權限${NC}"
echo "-----------------------------------"

if [ -f "$WEB_FILE" ]; then
    WEB_PERMS=$(ls -l "$WEB_FILE" | awk '{print $1, $3, $4}')
    echo "Web 檔案權限: $WEB_PERMS"
    
    if [ -w "$WEB_FILE" ]; then
        echo -e "${GREEN}✅ Web 檔案可寫入${NC}"
    else
        echo -e "${RED}❌ Web 檔案不可寫入！${NC}"
        echo -e "${YELLOW}   修復方式: chmod 666 $WEB_FILE${NC}"
    fi
fi

echo ""

if [ -f "$DOCKER_FILE" ]; then
    DOCKER_PERMS=$(ls -l "$DOCKER_FILE" | awk '{print $1, $3, $4}')
    echo "Docker 檔案權限: $DOCKER_PERMS"
    
    if [ -w "$DOCKER_FILE" ]; then
        echo -e "${GREEN}✅ Docker 檔案可寫入${NC}"
    else
        echo -e "${RED}❌ Docker 檔案不可寫入！${NC}"
        echo -e "${YELLOW}   修復方式: chmod 666 $DOCKER_FILE${NC}"
    fi
fi

echo ""

# 3. 檢查兩個檔案是否相同
echo -e "${BLUE}🔗 3. 檢查檔案是否同步${NC}"
echo "-----------------------------------"

if [ -f "$WEB_FILE" ] && [ -f "$DOCKER_FILE" ]; then
    if cmp -s "$WEB_FILE" "$DOCKER_FILE"; then
        echo -e "${GREEN}✅ 兩個檔案內容相同（已同步）${NC}"
    else
        echo -e "${RED}❌ 兩個檔案內容不同！${NC}"
        echo -e "${YELLOW}   這可能是問題所在！${NC}"
        echo ""
        echo "   檔案差異："
        diff -u "$WEB_FILE" "$DOCKER_FILE" | head -20
        echo ""
        echo -e "${YELLOW}   建議：建立軟連結統一兩個檔案${NC}"
        echo "   指令: ln -sf $WEB_FILE $DOCKER_FILE"
    fi
fi

echo ""

# 4. 檢查 server.js 進程
echo -e "${BLUE}⚙️  4. 檢查 server.js 運行狀態${NC}"
echo "-----------------------------------"

SERVER_PIDS=$(ps aux | grep "[n]ode.*server.js" | awk '{print $2}')
if [ -n "$SERVER_PIDS" ]; then
    echo -e "${GREEN}✅ server.js 正在運行${NC}"
    echo "   進程 ID: $SERVER_PIDS"
    
    # 檢查進程使用的檔案
    for PID in $SERVER_PIDS; do
        echo ""
        echo "   進程 $PID 打開的 student_data.json:"
        lsof -p $PID 2>/dev/null | grep "student_data.json" || echo "   （無法檢查或未找到）"
    done
else
    echo -e "${RED}❌ server.js 未運行！${NC}"
    echo -e "${YELLOW}   請先啟動 server: node server.js${NC}"
fi

echo ""

# 5. 檢查最近的 API 調用日誌
echo -e "${BLUE}📋 5. 檢查最近的 API 調用日誌${NC}"
echo "-----------------------------------"

SERVER_LOG="/volume1/docker/flb-calendar-nas/server.log"
if [ -f "$SERVER_LOG" ]; then
    echo "最近的 update-student-attendance 調用:"
    echo ""
    tail -100 "$SERVER_LOG" | grep -A 5 -B 2 "update-student-attendance" | tail -30
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  沒有找到 update-student-attendance 的日誌${NC}"
        echo "   這表示 API 可能從未被調用過"
    fi
else
    echo -e "${YELLOW}⚠️  找不到 server.log${NC}"
fi

echo ""

# 6. 檢查最近的簽到記錄
echo -e "${BLUE}📊 6. 檢查最近的簽到記錄${NC}"
echo "-----------------------------------"

if [ -f "$WEB_FILE" ]; then
    echo "student_data.json 中最近的簽到記錄:"
    echo ""
    
    # 獲取今天的日期
    TODAY=$(date +"%Y-%m-%d")
    
    # 查找今天的簽到記錄
    grep -B 2 -A 2 "\"date\": \"$TODAY\"" "$WEB_FILE" | head -20
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  沒有找到今天（$TODAY）的簽到記錄${NC}"
        echo ""
        echo "   最近的簽到記錄:"
        grep -B 2 -A 2 "\"date\":" "$WEB_FILE" | tail -20
    fi
fi

echo ""
echo ""

# 7. 總結和建議
echo -e "${BLUE}📝 診斷總結和建議${NC}"
echo "================================"
echo ""

# 判斷主要問題
ISSUES=0

if [ ! -f "$WEB_FILE" ] && [ ! -f "$DOCKER_FILE" ]; then
    echo -e "${RED}❌ 嚴重問題：student_data.json 檔案完全不存在！${NC}"
    ISSUES=$((ISSUES + 1))
elif [ -f "$WEB_FILE" ] && [ -f "$DOCKER_FILE" ]; then
    if ! cmp -s "$WEB_FILE" "$DOCKER_FILE"; then
        echo -e "${YELLOW}⚠️  主要問題：兩個 student_data.json 檔案不同步${NC}"
        echo ""
        echo "   📌 建議修復方式："
        echo "   1. 備份兩個檔案"
        echo "   2. 比較並合併最新資料"
        echo "   3. 建立軟連結: ln -sf $WEB_FILE $DOCKER_FILE"
        ISSUES=$((ISSUES + 1))
    fi
fi

if [ -f "$WEB_FILE" ] && [ ! -w "$WEB_FILE" ]; then
    echo -e "${YELLOW}⚠️  問題：Web 檔案無寫入權限${NC}"
    echo "   修復: chmod 666 $WEB_FILE"
    ISSUES=$((ISSUES + 1))
fi

if [ -f "$DOCKER_FILE" ] && [ ! -w "$DOCKER_FILE" ]; then
    echo -e "${YELLOW}⚠️  問題：Docker 檔案無寫入權限${NC}"
    echo "   修復: chmod 666 $DOCKER_FILE"
    ISSUES=$((ISSUES + 1))
fi

if [ -z "$SERVER_PIDS" ]; then
    echo -e "${RED}❌ server.js 未運行${NC}"
    echo "   請先啟動後端服務"
    ISSUES=$((ISSUES + 1))
fi

echo ""

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ 沒有發現明顯問題${NC}"
    echo ""
    echo "如果簽到仍然無法保存，請："
    echo "1. 打開瀏覽器開發者工具（F12）"
    echo "2. 查看 Console 中的錯誤訊息"
    echo "3. 查看 Network 標籤中的 API 請求狀態"
else
    echo -e "${RED}發現 $ISSUES 個問題，請參考上述建議修復${NC}"
fi

echo ""
echo "================================"

