#!/bin/bash
# 驗證並修復容器內的文件

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 檢查容器內的 synology-calendar-client.js..."
echo ""

echo "=== 步驟 1: 檢查容器內的文件 ==="
docker exec flb-calendar-nas grep -A 5 "修復：Synology API" ./synology-calendar-client.js || echo "❌ 容器內的文件未更新！"
echo ""

echo "=== 步驟 2: 複製修改後的文件到容器內 ==="
docker cp ./synology-calendar-client.js flb-calendar-nas:/app/synology-calendar-client.js
echo "✅ 已複製到容器內"
echo ""

echo "=== 步驟 3: 驗證複製成功 ==="
docker exec flb-calendar-nas grep -A 5 "修復：Synology API" ./synology-calendar-client.js
echo ""

echo "=== 步驟 4: 清除提醒 ==="
docker exec flb-calendar-nas /bin/sh -c 'cat > ./data/reminders.json << "EOF"
{
  "reminders": [],
  "studentReminders": []
}
EOF'
echo "✅ 已清除"
echo ""

echo "=== 步驟 5: 重啟容器 ==="
docker restart flb-calendar-nas
echo "⏳ 等待 30 秒..."
sleep 30
echo ""

echo "=== 步驟 6: 檢查日誌中的事件時間 ==="
echo "查看最新的事件獲取日誌："
docker logs flb-calendar-nas 2>&1 | grep -A 10 "正在從 CalDAV 獲取事件\|調試 - 格式化後的事件" | tail -20
echo ""

echo "=== 步驟 7: 檢查生成的提醒 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
const reminders = data.reminders || [];

console.log("📊 提醒總數:", reminders.length, "\n");

if (reminders.length > 0) {
  console.log("前 5 個提醒檢查：\n");
  
  let correctCount = 0;
  let wrongCount = 0;
  
  reminders.forEach((r, i) => {
    if (i < 5) {
      const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        const isCorrect = r.courseTime === match[0];
        const icon = isCorrect ? "✅" : "❌";
        console.log(icon, (i+1) + ".", r.courseName);
        console.log("   courseTime:", r.courseTime, "| 標題:", match[0]);
        console.log("");
        if (isCorrect) correctCount++; else wrongCount++;
      }
    } else {
      const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        if (r.courseTime === match[0]) correctCount++; else wrongCount++;
      }
    }
  });
  
  console.log("━".repeat(50));
  
  if (wrongCount === 0 && correctCount > 0) {
    console.log("🎉🎉🎉 修復成功！全部正確！");
  } else {
    console.log("❌ 仍有問題，錯誤數:", wrongCount);
  }
}
'

echo ""
echo "✅ 驗證完成！"


