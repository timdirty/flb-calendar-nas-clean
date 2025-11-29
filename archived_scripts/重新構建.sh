#!/bin/bash
# 重新構建 Docker 映像 - 正確的修復方式

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔧 重新構建 Docker 映像..."
echo ""

echo "=== 步驟 1: 驗證修改後的文件存在 ==="
if [ -f "./synology-calendar-client.js" ] && [ -f "./server.js" ]; then
  echo "✅ 文件存在"
  echo "synology-calendar-client.js: $(wc -l < ./synology-calendar-client.js) 行"
  echo "server.js: $(wc -l < ./server.js) 行"
else
  echo "❌ 文件不存在！"
  exit 1
fi
echo ""

echo "=== 步驟 2: 停止並移除現有容器 ==="
sudo docker-compose down
echo "✅ 容器已停止"
echo ""

echo "=== 步驟 3: 重新構建映像（使用修改後的文件） ==="
echo "這會將修改後的 synology-calendar-client.js 和 server.js 包含進映像..."
sudo docker-compose build --no-cache
echo "✅ 映像重新構建完成"
echo ""

echo "=== 步驟 4: 啟動容器 ==="
sudo docker-compose up -d
echo "⏳ 等待 45 秒讓容器完全啟動和初始化..."
sleep 45
echo ""

echo "=== 步驟 5: 檢查容器狀態 ==="
sudo docker ps | grep flb-calendar-nas
echo ""

echo "=== 步驟 6: 檢查 CalDAV 初始化日誌 ==="
echo "查找初始化相關日誌："
sudo docker logs flb-calendar-nas 2>&1 | grep -E "CalDAV|Synology|登入|初始化成功|permission" | tail -20
echo ""

echo "=== 步驟 7: 測試 CalDAV 連線 ==="
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
    
    console.log('🔐 正在登入...');
    const success = await client.login();
    
    if (success) {
      console.log('✅ 登入成功！\n');
      
      console.log('📅 獲取行事曆列表...');
      const calendars = await client.getCalendars();
      console.log(`✅ 找到 ${calendars.length} 個行事曆\n`);
      
      if (calendars.length > 0) {
        calendars.forEach((cal, i) => {
          console.log(`  ${i+1}. ${cal.cal_display_name}`);
        });
        
        console.log('\n📊 獲取事件（今天+明天）...');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 2);
        
        const events = await client.getEvents(calendars[0].cal_id, today, tomorrow);
        console.log(`✅ 找到 ${events.length} 個事件\n`);
        
        if (events.length > 0) {
          console.log('前 5 個事件時間檢查：\n');
          events.slice(0, 5).forEach((e, i) => {
            const timePart = e.start.split('T')[1]?.substring(0, 5);
            const match = e.title.match(/(\d{1,2}):(\d{2})/);
            const titleTime = match ? match[0] : '無';
            const icon = timePart === titleTime ? '✅' : (match ? '❌' : '⚪');
            
            console.log(`${icon} ${i+1}. ${e.title}`);
            console.log(`   start: ${e.start}`);
            console.log(`   時間: ${timePart} vs 標題: ${titleTime}`);
            console.log('');
          });
        }
      }
      
      await client.logout();
      console.log('🎉 CalDAV 測試成功！\n');
      process.exit(0);
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
  echo "=== 步驟 8: 啟動排程器 ==="
  sudo docker exec flb-calendar-nas curl -X POST http://localhost:3000/api/reminder-scheduler/start -H "Content-Type: application/json" 2>/dev/null
  echo ""
  sleep 2
  
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
    console.log("前 5 個提醒檢查：\n");
    
    let correct = 0, wrong = 0, noTime = 0;
    
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
        } else {
          console.log("⚪", (i+1) + ".", r.courseName);
          console.log("   courseTime:", r.courseTime);
          console.log("");
          noTime++;
        }
      } else {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          if (r.courseTime === match[0]) correct++; else wrong++;
        } else {
          noTime++;
        }
      }
    });
    
    console.log("━".repeat(50));
    
    if (wrong === 0 && correct > 0) {
      console.log("🎉🎉🎉 完美！所有時間都正確匹配！");
      console.log("✅ 正確：", correct, "個");
      if (noTime > 0) console.log("⚪ 無時間標記：", noTime, "個");
    } else if (correct > wrong) {
      console.log("⚠️  大部分正確但仍有錯誤");
      console.log("✅ 正確：", correct, "個");
      console.log("❌ 錯誤：", wrong, "個");
    } else {
      console.log("❌ 時間仍然不對");
      console.log("✅ 正確：", correct, "個");
      console.log("❌ 錯誤：", wrong, "個");
    }
    
    console.log("");
  } else {
    console.log("❌ 沒有生成提醒\n");
  }
  '
  
  echo ""
  echo "🎉 重新構建完成！"
  echo ""
  echo "🌐 請開啟網頁檢查："
  echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
else
  echo ""
  echo "❌ CalDAV 測試失敗"
  echo "請查看完整日誌："
  echo "  sudo docker logs flb-calendar-nas --tail 100"
fi

echo ""


