#!/bin/bash

# 講師綁定功能更新 - 快速測試腳本
# 版本：v2.0 - macOS 26 液態玻璃風格

echo "=================================="
echo "🚀 講師綁定功能更新 - 快速測試"
echo "=================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查當前目錄
if [ ! -f "server.js" ]; then
    echo "❌ 錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

echo "${BLUE}📋 更新內容：${NC}"
echo "  1. ✅ macOS 26 液態玻璃風格彈出選單"
echo "  2. ✅ 已綁定講師顯示綠色標記"
echo "  3. ✅ 未綁定講師自動排序到前面"
echo "  4. ✅ 增強綁定保存驗證機制"
echo ""

echo "${YELLOW}步驟 1: 檢查檔案狀態${NC}"
if [ -f "teacher_data.json" ]; then
    TEACHER_COUNT=$(cat teacher_data.json | grep -o "\"name\"" | wc -l | tr -d ' ')
    echo "  ✅ teacher_data.json 存在"
    echo "  📊 當前已綁定講師數：$TEACHER_COUNT"
    
    # 備份當前檔案
    BACKUP_FILE="teacher_data.json.backup-$(date +%Y%m%d-%H%M%S)"
    cp teacher_data.json "$BACKUP_FILE"
    echo "  📦 已備份到：$BACKUP_FILE"
else
    echo "  ⚠️  teacher_data.json 不存在，將自動創建"
fi
echo ""

echo "${YELLOW}步驟 2: 檢查伺服器狀態${NC}"
if pgrep -f "node.*server.js" > /dev/null; then
    echo "  ✅ 伺服器正在運行"
    echo "  🔄 正在重啟伺服器以載入更新..."
    
    # 找到伺服器進程並重啟
    pkill -f "node.*server.js"
    sleep 2
    
    # 在背景啟動伺服器
    nohup node server.js > server.log 2>&1 &
    SERVER_PID=$!
    
    sleep 3
    
    if ps -p $SERVER_PID > /dev/null; then
        echo "  ✅ 伺服器重啟成功 (PID: $SERVER_PID)"
    else
        echo "  ❌ 伺服器重啟失敗，請手動啟動"
        exit 1
    fi
else
    echo "  ⚠️  伺服器未運行"
    echo "  🚀 正在啟動伺服器..."
    nohup node server.js > server.log 2>&1 &
    SERVER_PID=$!
    sleep 3
    
    if ps -p $SERVER_PID > /dev/null; then
        echo "  ✅ 伺服器啟動成功 (PID: $SERVER_PID)"
    else
        echo "  ❌ 伺服器啟動失敗"
        cat server.log | tail -20
        exit 1
    fi
fi
echo ""

echo "${YELLOW}步驟 3: 驗證 API 端點${NC}"
sleep 2

# 測試 API
API_TEST=$(curl -s http://localhost:3000/api/teachers)
if [ $? -eq 0 ]; then
    echo "  ✅ API 端點正常運作"
    echo "  📊 API 回應："
    echo "$API_TEST" | head -5
else
    echo "  ❌ API 端點無法連接"
    exit 1
fi
echo ""

echo "${GREEN}=================================="
echo "✅ 所有檢查完成！"
echo "==================================${NC}"
echo ""

echo "${BLUE}📱 下一步測試步驟：${NC}"
echo ""
echo "1️⃣  在 LINE 中開啟應用"
echo "   網址：http://localhost:3000/public/perfect-calendar-optimized-complete2.html"
echo ""
echo "2️⃣  觀察液態玻璃風格"
echo "   • 背景應該有強烈的模糊效果"
echo "   • 彈出視窗有透明玻璃質感"
echo "   • 按鈕有流暢的懸停動畫"
echo ""
echo "3️⃣  測試綁定功能"
echo "   • 未綁定的講師應該排在上方"
echo "   • 已綁定的講師有 ✓ 標記和綠色文字"
echo "   • 綁定成功後應顯示總綁定數"
echo ""
echo "4️⃣  驗證持久性"
echo "   • 綁定後重新整理頁面"
echo "   • 不應該再次要求綁定"
echo "   • 檢查 teacher_data.json 是否有新記錄"
echo ""

echo "${YELLOW}🔍 診斷工具：${NC}"
echo "  • 查看伺服器日誌：tail -f server.log"
echo "  • 查看綁定記錄：cat teacher_data.json | jq"
echo "  • 查看備份檔案：ls -lt teacher_data.json*"
echo ""

echo "${YELLOW}⚠️  如果綁定後仍需重新綁定：${NC}"
echo "  請查看詳細診斷報告：診斷-綁定功能.md"
echo "  主要原因可能是 Synology Drive 同步衝突"
echo ""

echo "按 Ctrl+C 停止伺服器"
echo "伺服器日誌：server.log"
echo ""

