#!/bin/bash

###############################################################################
# 學生提醒重複生成 - 修復部署腳本
# 
# 功能:
# 1. 清理現有重複提醒
# 2. 重啟系統讓修復生效
# 3. 驗證修復結果
###############################################################################

echo "========================================"
echo "🔧 學生提醒重複生成修復 - 部署開始"
echo "========================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步驟 1: 清理重複提醒
echo -e "${YELLOW}📝 步驟 1: 清理現有重複提醒...${NC}"
node 🔧清理重複學生提醒-v2.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 清理完成${NC}"
else
    echo -e "${RED}❌ 清理失敗${NC}"
    exit 1
fi
echo ""

# 步驟 2: 檢查系統狀態
echo -e "${YELLOW}📝 步驟 2: 檢查系統狀態...${NC}"
if command -v pm2 &> /dev/null; then
    echo "使用 PM2 管理..."
    pm2 list | grep -q flb-calendar
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 找到 PM2 進程${NC}"
        USE_PM2=true
    else
        echo -e "${YELLOW}⚠️ 未找到 PM2 進程${NC}"
        USE_PM2=false
    fi
else
    echo -e "${YELLOW}⚠️ PM2 未安裝${NC}"
    USE_PM2=false
fi
echo ""

# 步驟 3: 重啟系統
echo -e "${YELLOW}📝 步驟 3: 重啟系統...${NC}"
if [ "$USE_PM2" = true ]; then
    echo "正在重啟 PM2 服務..."
    pm2 restart flb-calendar
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PM2 重啟成功${NC}"
        echo "等待 3 秒讓系統啟動..."
        sleep 3
    else
        echo -e "${RED}❌ PM2 重啟失敗${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ 請手動重啟系統:${NC}"
    echo "   - 方法 1: npm start"
    echo "   - 方法 2: node server.js"
    echo "   - 方法 3: pm2 restart flb-calendar"
    echo ""
    read -p "重啟完成後按 Enter 繼續..."
fi
echo ""

# 步驟 4: 驗證修復
echo -e "${YELLOW}📝 步驟 4: 驗證修復結果...${NC}"

# 檢查日誌文件
if [ -f "server.log" ]; then
    echo "檢查最近的日誌..."
    
    # 檢查是否有雙重檢查的日誌
    if grep -q "本次已創建" server.log; then
        echo -e "${GREEN}✅ 發現雙重檢查機制日誌${NC}"
    else
        echo -e "${YELLOW}⚠️ 尚未發現雙重檢查日誌（可能需要等待下次生成）${NC}"
    fi
    
    # 檢查是否有發送前驗證的日誌
    if grep -q "發送前重新驗證" server.log; then
        echo -e "${GREEN}✅ 發現發送前驗證機制日誌${NC}"
    else
        echo -e "${YELLOW}⚠️ 尚未發現發送前驗證日誌（可能需要等待發送時間）${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ 找不到 server.log 檔案${NC}"
fi
echo ""

# 步驟 5: 顯示監控命令
echo "========================================"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "========================================"
echo ""
echo "📊 監控命令:"
echo ""
echo "1. 即時監控學生提醒生成:"
echo "   tail -f server.log | grep '學生提醒'"
echo ""
echo "2. 查看重複檢測:"
echo "   tail -f server.log | grep '已存在'"
echo ""
echo "3. 查看請假取消:"
echo "   tail -f server.log | grep '請假'"
echo ""
echo "4. 檢查是否有新的重複提醒:"
echo "   node 🔧清理重複學生提醒-v2.js"
echo ""
echo "5. 前端驗證:"
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""
echo "========================================"
echo "📖 完整文件: ✅學生提醒重複生成-最終修復.md"
echo "========================================"

