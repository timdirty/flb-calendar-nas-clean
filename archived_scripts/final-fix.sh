#!/bin/bash
# 最終修復 - 部署所有修改並測試

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🚀 最終修復部署..."
echo ""

echo "=== 步驟 1: 複製修改後的檔案到容器 ==="
echo "📦 複製 synology-calendar-client.js..."
sudo docker cp ./synology-calendar-client.js flb-calendar-nas:/app/synology-calendar-client.js
echo "✅ 完成"

echo "📦 複製 server.js..."
sudo docker cp ./server.js flb-calendar-nas:/app/server.js
echo "✅ 完成"
echo ""

echo "=== 步驟 2: 重啟容器 ==="
sudo docker restart flb-calendar-nas
echo "⏳ 等待 35 秒讓容器完全啟動並初始化 CalDAV..."
sleep 35
echo ""

echo "=== 步驟 3: 檢查 CalDAV 初始化狀態 ==="
sudo docker logs flb-calendar-nas 2>&1 | grep -A 3 "CalDAV\|Synology Calendar\|登入" | tail -10
echo ""

echo "=== 步驟 4: 觸發提醒生成 ==="
sudo docker exec flb-calendar-nas curl -X POST http://localhost:3000/api/reminder-scheduler/run -H "Content-Type: application/json" 2>/dev/null
echo ""
echo "⏳ 等待 15 秒讓提醒生成..."
sleep 15
echo ""

echo "=== 步驟 5: 檢查生成結果 ==="
sudo docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
const reminders = data.reminders || [];

console.log("📊 提醒總數:", reminders.length);
console.log("");

if (reminders.length === 0) {
  console.log("❌ 仍然沒有生成提醒");
  console.log("");
  console.log("請檢查日誌：");
  console.log("  sudo docker logs flb-calendar-nas 2>&1 | grep -A 10 \"獲取事件\\|CalDAV\"");
} else {
  console.log("✅ 成功生成提醒！");
  console.log("");
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
  } else {
    console.log("⚪ 無法判斷（可能課程名稱沒有時間）");
  }
  
  console.log("");
}
'

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 請開啟網頁檢查："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""


