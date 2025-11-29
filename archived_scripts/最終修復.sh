#!/bin/bash
# 最終修復 - 先在宿主機修改權限再複製

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔧 最終修復 - 先修復宿主機權限..."
echo ""

echo "=== 步驟 1: 在宿主機上修復文件權限 ==="
sudo chmod 644 ./synology-calendar-client.js
sudo chmod 644 ./server.js
echo "✅ 宿主機權限已設置"
ls -lh ./synology-calendar-client.js ./server.js
echo ""

echo "=== 步驟 2: 停止並移除容器 ==="
sudo docker-compose down
echo "✅ 容器已停止並移除"
echo ""

echo "=== 步驟 3: 重新啟動容器（會重新掛載所有文件） ==="
sudo docker-compose up -d
echo "⏳ 等待 40 秒讓容器完全啟動..."
sleep 40
echo ""

echo "=== 步驟 4: 檢查容器內的文件權限 ==="
echo "容器內文件權限："
sudo docker exec flb-calendar-nas ls -lh /app/synology-calendar-client.js /app/server.js
echo ""

echo "=== 步驟 5: 檢查 CalDAV 初始化 ==="
sudo docker logs flb-calendar-nas 2>&1 | grep -E "CalDAV|Synology|登入|初始化|permission denied" | tail -15
echo ""

echo "=== 步驟 6: 手動測試 CalDAV ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const SynologyCalendarClient = require('./synology-calendar-client');

async function test() {
  try {
    console.log('📡 測試 CalDAV...\n');
    const client = new SynologyCalendarClient(
      'https://funlearnbar.synology.me:9102',
      'testacount',
      'testacount'
    );
    
    const success = await client.login();
    if (success) {
      console.log('✅ 登入成功！');
      const calendars = await client.getCalendars();
      console.log(`✅ 找到 ${calendars.length} 個行事曆\n`);
      
      if (calendars.length > 0) {
        const events = await client.getEvents(calendars[0].cal_id, new Date(), new Date(Date.now() + 172800000));
        console.log(`✅ 找到 ${events.length} 個事件\n`);
        
        if (events.length > 0) {
          console.log('前 3 個事件：');
          events.slice(0, 3).forEach((e, i) => {
            const time = e.start.split('T')[1]?.substring(0, 5);
            const match = e.title.match(/(\d{1,2}):(\d{2})/);
            const titleTime = match ? match[0] : '無';
            const ok = time === titleTime ? '✅' : '❌';
            console.log(`  ${i+1}. ${e.title}`);
            console.log(`     時間: ${time} | 標題: ${titleTime} ${ok}`);
          });
        }
      }
      
      await client.logout();
      console.log('\n🎉 CalDAV 測試成功！\n');
      process.exit(0);
    } else {
      console.log('❌ 登入失敗\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  }
}

test();
EOF

CALDAV_TEST_RESULT=$?

if [ $CALDAV_TEST_RESULT -eq 0 ]; then
  echo ""
  echo "=== 步驟 7: 生成提醒 ==="
  sudo docker exec flb-calendar-nas curl -X POST http://localhost:3000/api/reminder-scheduler/run -H "Content-Type: application/json" 2>/dev/null
  echo ""
  echo "⏳ 等待 20 秒..."
  sleep 20
  
  echo ""
  echo "=== 步驟 8: 檢查結果 ==="
  sudo docker exec flb-calendar-nas node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
  const reminders = data.reminders || [];
  
  console.log("\n📊 提醒總數:", reminders.length, "\n");
  
  if (reminders.length > 0) {
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
        if (match && r.courseTime === match[0]) correct++;
        else if (match) wrong++;
      }
    });
    
    console.log("━".repeat(50));
    
    if (wrong === 0 && correct > 0) {
      console.log("🎉🎉🎉 修復成功！");
      console.log("總計：", correct, "個提醒時間正確\n");
    } else {
      console.log("❌ 仍有", wrong, "個錯誤\n");
    }
  }
  '
  
  echo ""
  echo "✅ 最終修復完成！"
else
  echo ""
  echo "❌ CalDAV 仍然無法工作"
  echo "請檢查完整日誌："
  echo "  sudo docker logs flb-calendar-nas"
fi

echo ""
echo "🌐 請開啟網頁："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""


