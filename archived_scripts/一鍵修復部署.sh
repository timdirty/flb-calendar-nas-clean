#!/bin/bash
# ========================================
# 一鍵修復部署腳本
# ========================================

echo "🚀 開始修復和部署流程..."
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# NAS 配置
NAS_USER="ctctim14"
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

echo -e "${BLUE}📋 修復內容：${NC}"
echo "  1. 添加完整 API 端點"
echo "  2. 修復講師管理顯示"
echo "  3. 添加訊息模板管理"
echo "  4. 配置 LINE Token"
echo ""

# ========================================
# 步驟 1: 備份當前文件
# ========================================
echo -e "${YELLOW}📦 步驟 1: 備份當前文件...${NC}"
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
cp .env.nas .env.nas.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 備份完成"
EOF

echo ""

# ========================================
# 步驟 2: 上傳修復文件
# ========================================
echo -e "${YELLOW}📤 步驟 2: 上傳修復文件...${NC}"
scp -P $NAS_PORT \
    "server-api-fixes.js" \
    "$NAS_USER@$NAS_HOST:$NAS_PATH/"

echo "✅ 修復文件已上傳"
echo ""

# ========================================
# 步驟 3: 合併 API 修復到 server.js
# ========================================
echo -e "${YELLOW}🔧 步驟 3: 合併 API 修復...${NC}"
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 在 server.js 的最後一個 app.listen 之前插入新的 API
# 這裡需要手動合併，因為直接追加可能會有問題
echo "⚠️  請手動將 server-api-fixes.js 的內容合併到 server.js"
echo "   位置：在最後一個 app.listen() 之前"
EOF

echo ""

# ========================================
# 步驟 4: 配置 LINE Token
# ========================================
echo -e "${YELLOW}📱 步驟 4: 配置 LINE Channel Access Token...${NC}"
echo ""
echo -e "${RED}⚠️  重要：請提供您的 LINE Channel Access Token${NC}"
echo "   1. 登入 https://developers.line.biz/console/"
echo "   2. 選擇您的 Messaging API Channel"
echo "   3. 在 'Messaging API' 分頁找到 'Channel access token'"
echo "   4. 複製 Token"
echo ""
read -p "請輸入 LINE_CHANNEL_ACCESS_TOKEN (或按 Enter 跳過): " LINE_TOKEN

if [ ! -z "$LINE_TOKEN" ]; then
    ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << EOF
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
echo "" >> .env.nas
echo "# LINE Messaging API" >> .env.nas
echo "LINE_CHANNEL_ACCESS_TOKEN=$LINE_TOKEN" >> .env.nas
echo "✅ LINE Token 已設定"
EOF
else
    echo -e "${YELLOW}⚠️  已跳過 LINE Token 設定，LINE 通知將無法使用${NC}"
fi

echo ""

# ========================================
# 步驟 5: 創建默認模板文件
# ========================================
echo -e "${YELLOW}📝 步驟 5: 創建默認模板文件...${NC}"
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 創建 templates.json
cat > data/templates.json << 'TEMPLATE'
{
  "studentAttendance": {
    "present": "✅ 出席：{present}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}",
    "absent": "❌ 缺席：{absent}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}",
    "unmarked": "⏳ 未標記：{unmarked}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}"
  },
  "courseReminder": {
    "template": "🔔 課程提醒\n\n👨‍🏫 講師：{teacher}\n📚 課程：{course}\n📅 日期：{date}\n⏰ 時間：{time}\n🏫 地點：{location}"
  },
  "dailyReminder": {
    "template": "📅 今日課程提醒\n\n您今天有 {count} 堂課：\n{courseList}\n\n請準時出席！"
  },
  "nextDayReminder": {
    "template": "📅 明日課程提醒\n\n您明天有 {count} 堂課：\n{courseList}\n\n請提前準備！"
  },
  "beforeClassReminder": {
    "template": "⏰ 課前提醒\n\n您的課程即將開始：\n📚 {course}\n⏰ {time}\n🏫 {location}\n\n請準備上課！"
  },
  "studentReminder": {
    "template": "👨‍🎓 學生提醒\n\n{studentName} 同學：\n📚 課程：{course}\n📅 {date} ({weekday})\n⏰ {time}\n🏫 {location}\n\n📝 剩餘堂數：{remainingClasses}"
  },
  "courseCancellation": {
    "template": "❌ 課程取消通知\n\n📚 課程：{course}\n📅 原定時間：{date} {time}\n🏫 地點：{location}\n\n📝 取消原因：{reason}"
  },
  "systemNotification": {
    "template": "📢 系統通知\n\n{message}"
  }
}
TEMPLATE

echo "✅ 模板文件已創建"
EOF

echo ""

# ========================================
# 步驟 6: 重啟服務
# ========================================
echo -e "${YELLOW}🔄 步驟 6: 重啟 Docker 服務...${NC}"
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
sudo docker-compose down
sudo docker-compose up -d
sleep 10
EOF

echo "✅ 服務已重啟"
echo ""

# ========================================
# 步驟 7: 驗證修復
# ========================================
echo -e "${YELLOW}✅ 步驟 7: 驗證修復...${NC}"
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "📋 容器狀態："
sudo docker-compose ps

echo ""
echo "📊 最新日誌："
sudo docker-compose logs --tail=20

echo ""
echo "🔍 檢查 LINE Token 配置："
grep "LINE_CHANNEL_ACCESS_TOKEN" .env.nas | cut -d'=' -f1
EOF

echo ""

# ========================================
# 完成
# ========================================
echo -e "${GREEN}🎉 修復部署完成！${NC}"
echo ""
echo -e "${BLUE}📍 下一步：${NC}"
echo "  1. 訪問管理控制台："
echo "     https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo ""
echo "  2. 測試 LINE 通知："
echo "     curl -X POST http://localhost:3001/api/test-line-notification \\"
echo "       -H \"Content-Type: application/json\" \\"
echo "       -d '{\"message\": \"測試訊息\"}'"
echo ""
echo "  3. 檢查講師列表："
echo "     應該正確顯示講師名稱和 LINE User ID"
echo ""
echo "  4. 檢查訊息模板："
echo "     所有模板類型應該都可以編輯"
echo ""
echo -e "${YELLOW}⚠️  注意：${NC}"
echo "  - 如果跳過了 LINE Token 設定，請手動編輯 NAS 上的 .env.nas"
echo "  - API 修復需要手動合併到 server.js（已提供 server-api-fixes.js）"
echo ""


