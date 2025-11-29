#!/bin/bash
# 觸發提醒生成 - 使用正確的 API 端點

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔄 觸發提醒生成..."
echo ""

echo "=== 步驟 1: 執行排程任務 ==="
docker exec flb-calendar-nas curl -X POST http://localhost:3000/api/reminder-scheduler/run \
  -H "Content-Type: application/json" 2>/dev/null
echo ""
echo "⏳ 等待 15 秒讓任務完成..."
sleep 15

echo ""
echo "=== 步驟 2: 檢查提醒數量 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
console.log("📊 提醒總數:", data.reminders.length);
'

echo ""
echo "=== 步驟 3: 檢查排程器狀態 ==="
docker exec flb-calendar-nas curl -X GET http://localhost:3000/api/reminder-scheduler/status 2>/dev/null | grep -o '"totalReminders":[0-9]*' || echo "無法獲取狀態"

echo ""
echo ""
echo "=== 步驟 4: 詳細檢查生成的提醒 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
const reminders = data.reminders || [];

console.log("📊 提醒總數:", reminders.length);
console.log("");

if (reminders.length === 0) {
  console.log("⚠️  沒有生成提醒！");
  console.log("");
  console.log("可能原因：");
  console.log("1. 沒有今天或明天的課程");
  console.log("2. CalDAV 連線失敗");
  console.log("3. 行事曆沒有事件");
  console.log("");
  console.log("請檢查日誌：");
  console.log("  sudo docker logs flb-calendar-nas 2>&1 | grep -A 5 \"CalDAV\\|事件\\|錯誤\"");
} else {
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
      } else {
        console.log("⚪", (i+1) + ".", r.courseName);
        console.log("   courseTime:", r.courseTime);
        console.log("");
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
    console.log("🎉🎉🎉 修復成功！所有時間都正確！");
    console.log("總計：", correctCount, "個提醒");
  } else if (wrongCount > 0) {
    console.log("❌ 仍有", wrongCount, "個時間錯誤");
    console.log("✅ 正確：", correctCount, "個");
  }
  
  console.log("");
}
'

echo ""
echo "✅ 完成！"
echo ""
echo "🌐 請開啟網頁檢查："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""


