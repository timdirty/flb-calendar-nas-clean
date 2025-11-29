#!/bin/bash
# 完整修復權限並重新部署

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔧 完整修復權限並重新部署..."
echo ""

echo "=== 步驟 1: 停止容器 ==="
sudo docker stop flb-calendar-nas
echo "✅ 容器已停止"
echo ""

echo "=== 步驟 2: 刪除容器內的文件（重新複製） ==="
sudo docker start flb-calendar-nas
sleep 5
sudo docker exec flb-calendar-nas rm -f /app/synology-calendar-client.js
sudo docker exec flb-calendar-nas rm -f /app/server.js
echo "✅ 舊文件已刪除"
echo ""

echo "=== 步驟 3: 以正確權限複製文件 ==="
# 複製並立即設置權限
sudo docker cp ./synology-calendar-client.js flb-calendar-nas:/app/synology-calendar-client.js && \
sudo docker exec flb-calendar-nas sh -c 'chmod 644 /app/synology-calendar-client.js && chown node:node /app/synology-calendar-client.js'
echo "✅ synology-calendar-client.js 已複製並設置權限"

sudo docker cp ./server.js flb-calendar-nas:/app/server.js && \
sudo docker exec flb-calendar-nas sh -c 'chmod 644 /app/server.js && chown node:node /app/server.js'
echo "✅ server.js 已複製並設置權限"
echo ""

echo "=== 步驟 4: 修復數據文件權限 ==="
sudo docker exec flb-calendar-nas sh -c 'chmod 666 /app/public/student_data.json && chown node:node /app/public/student_data.json' 2>/dev/null || echo "⚠️  student_data.json 可能不存在"
sudo docker exec flb-calendar-nas sh -c 'chmod 666 /app/data/reminders.json && chown node:node /app/data/reminders.json' 2>/dev/null || echo "⚠️  reminders.json 可能不存在"
echo "✅ 數據文件權限已設置"
echo ""

echo "=== 步驟 5: 驗證文件權限 ==="
echo "檢查關鍵文件："
sudo docker exec flb-calendar-nas ls -lh /app/synology-calendar-client.js
sudo docker exec flb-calendar-nas ls -lh /app/server.js
echo ""

echo "=== 步驟 6: 重啟容器 ==="
sudo docker restart flb-calendar-nas
echo "⏳ 等待 40 秒讓容器完全啟動..."
sleep 40
echo ""

echo "=== 步驟 7: 檢查 CalDAV 初始化日誌 ==="
echo "查找初始化和登入訊息："
sudo docker logs flb-calendar-nas 2>&1 | grep -E "Synology Calendar|CalDAV|登入|初始化" | tail -15
echo ""

echo "=== 步驟 8: 測試 CalDAV 連線 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const SynologyCalendarClient = require('./synology-calendar-client');

async function test() {
  try {
    console.log('\n🔍 測試 CalDAV 連線...\n');
    const client = new SynologyCalendarClient(
      'https://funlearnbar.synology.me:9102',
      'testacount',
      'testacount'
    );
    
    console.log('🔐 嘗試登入...');
    const success = await client.login();
    
    if (success) {
      console.log('✅ 登入成功！\n');
      
      console.log('📅 獲取行事曆列表...');
      const calendars = await client.getCalendars();
      console.log(`✅ 找到 ${calendars.length} 個行事曆\n`);
      
      if (calendars.length > 0) {
        console.log('行事曆列表：');
        calendars.forEach((cal, i) => {
          console.log(`  ${i + 1}. ${cal.cal_display_name} (ID: ${cal.cal_id})`);
        });
        
        console.log('\n📊 測試獲取第一個行事曆的事件...');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 2);
        
        const events = await client.getEvents(calendars[0].cal_id, today, tomorrow);
        console.log(`✅ 找到 ${events.length} 個事件\n`);
        
        if (events.length > 0) {
          console.log('前 3 個事件：');
          events.slice(0, 3).forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.title} - ${e.start}`);
            const timePart = e.start.split('T')[1]?.substring(0, 5);
            const titleMatch = e.title.match(/(\d{1,2}):(\d{2})/);
            if (titleMatch) {
              const match = timePart === titleMatch[0];
              console.log(`     時間檢查: ${timePart} vs ${titleMatch[0]} ${match ? '✅' : '❌'}`);
            }
          });
        }
      }
      
      await client.logout();
      console.log('\n🎉 CalDAV 測試成功！\n');
    } else {
      console.log('❌ 登入失敗\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "=== 步驟 9: 生成提醒 ==="
  sudo docker exec flb-calendar-nas curl -X POST http://localhost:3000/api/reminder-scheduler/run -H "Content-Type: application/json" 2>/dev/null
  echo ""
  echo "⏳ 等待 20 秒讓提醒生成..."
  sleep 20
  
  echo ""
  echo "=== 步驟 10: 檢查生成結果 ==="
  sudo docker exec flb-calendar-nas node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
  const reminders = data.reminders || [];
  
  console.log("\n📊 提醒總數:", reminders.length, "\n");
  
  if (reminders.length > 0) {
    console.log("前 5 個提醒：\n");
    
    let correct = 0, wrong = 0;
    
    reminders.forEach((r, i) => {
      if (i < 5) {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          const isCorrect = r.courseTime === match[0];
          const icon = isCorrect ? "✅" : "❌";
          console.log(icon, (i+1) + ".", r.courseName);
          console.log("   courseTime:", r.courseTime, "| 標題:", match[0]);
          console.log("");
          if (isCorrect) correct++; else wrong++;
        }
      } else {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          if (r.courseTime === match[0]) correct++; else wrong++;
        }
      }
    });
    
    console.log("━".repeat(50));
    
    if (wrong === 0 && correct > 0) {
      console.log("🎉🎉🎉 修復成功！所有時間都正確！");
      console.log("總計：", correct, "個提醒\n");
    } else if (wrong > 0) {
      console.log("❌ 仍有", wrong, "個時間錯誤\n");
    }
  } else {
    console.log("❌ 沒有生成提醒\n");
  }
  '
  
  echo ""
  echo "✅ 完整修復完成！"
  echo ""
  echo "🌐 請開啟網頁檢查："
  echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
else
  echo ""
  echo "❌ CalDAV 測試失敗，請檢查日誌"
fi

echo ""


