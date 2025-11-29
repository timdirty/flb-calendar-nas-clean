#!/bin/bash
# 系統功能完整檢查

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 開始系統功能完整檢查..."
echo ""
echo "=" | head -c 70 | tr '\n' '='
echo ""

# 1. 容器狀態檢查
echo ""
echo "=== 1. 容器狀態檢查 ==="
CONTAINER_STATUS=$(sudo docker inspect -f '{{.State.Status}}' flb-calendar-nas 2>/dev/null)
if [ "$CONTAINER_STATUS" = "running" ]; then
    echo "✅ 容器運行中"
    sudo docker ps | grep flb-calendar-nas
else
    echo "❌ 容器未運行"
fi

# 2. 健康檢查
echo ""
echo "=== 2. 容器健康狀態 ==="
HEALTH_STATUS=$(sudo docker inspect -f '{{.State.Health.Status}}' flb-calendar-nas 2>/dev/null)
echo "健康狀態: $HEALTH_STATUS"

# 3. CalDAV 連線檢查
echo ""
echo "=== 3. CalDAV 連線檢查 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const SynologyCalendarClient = require('./synology-calendar-client');

async function testCalDAV() {
  try {
    const client = new SynologyCalendarClient(
      'https://funlearnbar.synology.me:9102',
      'testacount',
      'testacount'
    );
    
    const success = await client.login();
    if (success) {
      const calendars = await client.getCalendars();
      console.log(`✅ CalDAV 連線正常，找到 ${calendars.length} 個行事曆`);
      
      const events = await client.getEvents(calendars[0].cal_id, new Date(), new Date(Date.now() + 172800000));
      console.log(`✅ 可以獲取事件，找到 ${events.length} 個事件（今天+明天）`);
      
      await client.logout();
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ CalDAV 連線失敗:', error.message);
    return false;
  }
}

testCalDAV();
EOF

# 4. 排程器狀態檢查
echo ""
echo "=== 4. 排程器狀態檢查 ==="
SCHEDULER_STATUS=$(sudo docker exec flb-calendar-nas curl -s http://localhost:3000/api/reminder-scheduler/status 2>/dev/null)
if echo "$SCHEDULER_STATUS" | grep -q '"isRunning":true'; then
    echo "✅ 排程器運行中"
    echo "$SCHEDULER_STATUS" | grep -o '"isRunning":[^,]*' || true
    echo "$SCHEDULER_STATUS" | grep -o '"totalReminders":[^,]*' || true
    echo "$SCHEDULER_STATUS" | grep -o '"lastRunTime":"[^"]*"' || true
else
    echo "❌ 排程器未運行或無響應"
fi

# 5. 提醒數據檢查
echo ""
echo "=== 5. 提醒數據檢查 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('./data/reminders.json', 'utf8'));
  const reminders = data.reminders || [];
  const studentReminders = data.studentReminders || [];
  
  console.log(`📊 一般提醒: ${reminders.length} 個`);
  console.log(`👨‍🎓 學生提醒: ${studentReminders.length} 個`);
  
  // 檢查提醒狀態分佈
  const statusCount = {};
  reminders.forEach(r => {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
  });
  
  console.log('\n提醒狀態分佈：');
  Object.entries(statusCount).forEach(([status, count]) => {
    const icon = status === 'pending' ? '⏳' : status === 'sent' ? '✅' : status === 'failed' ? '❌' : '⚪';
    console.log(`  ${icon} ${status}: ${count} 個`);
  });
  
  // 檢查時間正確性
  let correct = 0, wrong = 0;
  reminders.forEach(r => {
    const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      if (r.courseTime === match[0]) correct++;
      else wrong++;
    }
  });
  
  console.log('\n時間正確性：');
  if (wrong === 0 && correct > 0) {
    console.log(`  ✅ 所有 ${correct} 個提醒時間正確`);
  } else if (wrong > 0) {
    console.log(`  ⚠️  ${correct} 個正確，${wrong} 個錯誤`);
  }
  
} catch (error) {
  console.log('❌ 無法讀取提醒數據:', error.message);
}
EOF

# 6. API 端點檢查
echo ""
echo "=== 6. 關鍵 API 端點檢查 ==="
API_TESTS=(
  "GET /api/health:健康檢查"
  "GET /api/events:獲取事件"
  "GET /api/reminders:獲取提醒"
  "GET /api/teachers:獲取講師"
  "GET /api/students:獲取學生"
  "GET /api/reminder-scheduler/status:排程器狀態"
)

for test in "${API_TESTS[@]}"; do
  IFS=':' read -r endpoint desc <<< "$test"
  METHOD=$(echo $endpoint | cut -d' ' -f1)
  PATH=$(echo $endpoint | cut -d' ' -f2)
  
  if [ "$METHOD" = "GET" ]; then
    RESPONSE=$(sudo docker exec flb-calendar-nas curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$PATH 2>/dev/null)
    if [ "$RESPONSE" = "200" ]; then
      echo "  ✅ $desc ($PATH)"
    else
      echo "  ❌ $desc ($PATH) - HTTP $RESPONSE"
    fi
  fi
done

# 7. 數據文件檢查
echo ""
echo "=== 7. 數據文件檢查 ==="
DATA_FILES=(
  "/app/data/reminders.json:提醒數據"
  "/app/public/student_data.json:學生數據"
  "/app/public/teacher_list_data.csv:講師列表"
  "/app/notification-config.json:LINE通知配置"
  "/app/system-settings.json:系統設定"
)

for file in "${DATA_FILES[@]}"; do
  IFS=':' read -r path desc <<< "$file"
  if sudo docker exec flb-calendar-nas test -f "$path" 2>/dev/null; then
    SIZE=$(sudo docker exec flb-calendar-nas stat -f%z "$path" 2>/dev/null || sudo docker exec flb-calendar-nas stat -c%s "$path" 2>/dev/null)
    if [ "$SIZE" -gt 0 ]; then
      echo "  ✅ $desc ($(numfmt --to=iec-i --suffix=B $SIZE 2>/dev/null || echo ${SIZE}B))"
    else
      echo "  ⚠️  $desc (檔案為空)"
    fi
  else
    echo "  ❌ $desc (檔案不存在)"
  fi
done

# 8. 日誌檢查
echo ""
echo "=== 8. 最近錯誤日誌 ==="
ERROR_COUNT=$(sudo docker logs flb-calendar-nas 2>&1 | grep -i "error\|錯誤\|failed\|失敗" | tail -20 | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠️  發現 $ERROR_COUNT 條最近的錯誤日誌"
    echo "最近 5 條錯誤："
    sudo docker logs flb-calendar-nas 2>&1 | grep -i "error\|錯誤" | tail -5
else
    echo "✅ 沒有最近的錯誤日誌"
fi

# 9. LINE 通知配置檢查
echo ""
echo "=== 9. LINE 通知配置檢查 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const fs = require('fs');
try {
  const config = JSON.parse(fs.readFileSync('./notification-config.json', 'utf8'));
  if (config.channelAccessToken && config.channelSecret) {
    console.log('✅ LINE 通知已配置');
    console.log(`   測試模式: ${config.testMode ? '開啟' : '關閉'}`);
    console.log(`   測試用戶: ${config.testUserId ? '已設定' : '未設定'}`);
  } else {
    console.log('⚠️  LINE 通知未完整配置');
  }
} catch (error) {
  console.log('⚠️  無法讀取 LINE 通知配置');
}
EOF

# 10. 系統設定檢查
echo ""
echo "=== 10. 系統設定檢查 ==="
sudo docker exec flb-calendar-nas node << 'EOF'
const fs = require('fs');
try {
  const settings = JSON.parse(fs.readFileSync('./system-settings.json', 'utf8'));
  console.log('✅ 系統設定已載入');
  console.log(`   Synology Calendar URL: ${settings.synologyCalendar?.baseUrl || '未設定'}`);
  console.log(`   行事曆 ID: ${settings.synologyCalendar?.calendarId || '未設定'}`);
  console.log(`   當日提醒時間: ${settings.reminders?.todayReminderHour || 8}:${settings.reminders?.todayReminderMinute || 0}`);
  console.log(`   隔日提醒時間: ${settings.reminders?.tomorrowReminderHour || 19}:${settings.reminders?.tomorrowReminderMinute || 30}`);
  console.log(`   課前提醒: ${settings.reminders?.beforeClassMinutes || 30} 分鐘前`);
} catch (error) {
  console.log('❌ 無法讀取系統設定');
}
EOF

# 總結
echo ""
echo "=" | head -c 70 | tr '\n' '='
echo ""
echo "=== 檢查總結 ==="
echo ""
echo "✅ 系統功能檢查完成！"
echo ""
echo "🌐 管理頁面："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""
echo "📅 行事曆檢視："
echo "   https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete.html"
echo ""
echo "💡 如需查看詳細日誌："
echo "   sudo docker logs flb-calendar-nas --tail 100"
echo ""


