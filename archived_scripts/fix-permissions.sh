#!/bin/bash
# 修復容器內文件權限問題

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔧 修復容器內文件權限..."
echo ""

echo "=== 步驟 1: 修復 synology-calendar-client.js 權限 ==="
sudo docker exec flb-calendar-nas chmod 644 /app/synology-calendar-client.js
sudo docker exec flb-calendar-nas chown node:node /app/synology-calendar-client.js
echo "✅ 完成"

echo ""
echo "=== 步驟 2: 修復 server.js 權限 ==="
sudo docker exec flb-calendar-nas chmod 644 /app/server.js
sudo docker exec flb-calendar-nas chown node:node /app/server.js
echo "✅ 完成"

echo ""
echo "=== 步驟 3: 修復 public/student_data.json 權限 ==="
sudo docker exec flb-calendar-nas chmod 666 /app/public/student_data.json
sudo docker exec flb-calendar-nas chown node:node /app/public/student_data.json
echo "✅ 完成"

echo ""
echo "=== 步驟 4: 修復 data/reminders.json 權限 ==="
sudo docker exec flb-calendar-nas chmod 666 /app/data/reminders.json
sudo docker exec flb-calendar-nas chown node:node /app/data/reminders.json
echo "✅ 完成"

echo ""
echo "=== 步驟 5: 檢查權限 ==="
echo "檢查關鍵文件權限："
sudo docker exec flb-calendar-nas ls -l /app/synology-calendar-client.js
sudo docker exec flb-calendar-nas ls -l /app/server.js
sudo docker exec flb-calendar-nas ls -l /app/public/student_data.json
sudo docker exec flb-calendar-nas ls -l /app/data/reminders.json

echo ""
echo "=== 步驟 6: 重啟容器讓變更生效 ==="
sudo docker restart flb-calendar-nas
echo "⏳ 等待 35 秒..."
sleep 35

echo ""
echo "=== 步驟 7: 檢查 CalDAV 初始化 ==="
sudo docker logs flb-calendar-nas 2>&1 | grep -E "CalDAV|Synology|登入" | tail -10

echo ""
echo "=== 步驟 8: 測試 CalDAV 連線 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const SynologyCalendarClient = require('./synology-calendar-client');

async function test() {
  try {
    console.log('📡 測試 CalDAV 連線...');
    const client = new SynologyCalendarClient(
      'https://funlearnbar.synology.me:9102',
      'testacount',
      'testacount'
    );
    
    console.log('🔐 嘗試登入...');
    const success = await client.login();
    
    if (success) {
      console.log('✅ 登入成功！');
      
      console.log('📅 獲取行事曆...');
      const calendars = await client.getCalendars();
      console.log(`✅ 找到 ${calendars.length} 個行事曆`);
      
      if (calendars.length > 0) {
        console.log('📊 測試獲取事件...');
        const events = await client.getEvents(calendars[0].cal_id, new Date(), new Date(Date.now() + 86400000));
        console.log(`✅ 找到 ${events.length} 個事件`);
      }
      
      await client.logout();
      console.log('✅ CalDAV 測試成功！');
    } else {
      console.log('❌ 登入失敗');
    }
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

test();
EOF

echo ""
echo "✅ 權限修復完成！"


