#!/bin/bash
# 部署時區修復並測試

echo "🚀 部署時區修復..."
echo ""

# 在 NAS 上執行
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "=== 步驟 1: 備份原文件 ==="
cp synology-calendar-client.js synology-calendar-client.js.backup-$(date +%Y%m%d-%H%M%S)
echo "✅ 已備份"
echo ""

echo "=== 步驟 2: 檢查修改後的文件 ==="
grep -A 10 "修復：Synology API" synology-calendar-client.js | head -15
echo ""

echo "=== 步驟 3: 清除舊提醒 ==="
docker exec flb-calendar-nas /bin/sh -c '
  cat > ./data/reminders.json << "EOF"
{
  "reminders": [],
  "studentReminders": []
}
EOF
  echo "✅ 已清除"
'
echo ""

echo "=== 步驟 4: 重啟容器 ==="
docker restart flb-calendar-nas
echo "⏳ 等待容器重啟（30秒）..."
sleep 30
echo ""

echo "=== 步驟 5: 檢查結果 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
const reminders = data.reminders || [];

console.log("📊 提醒總數:", reminders.length, "\n");

if (reminders.length === 0) {
  console.log("⚠️  尚未生成提醒");
  console.log("請訪問管理頁面手動觸發生成\n");
} else {
  console.log("檢查前 5 個提醒：\n");
  
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
    console.log("🎉🎉🎉 全部正確！時區修復成功！");
    console.log("總計：", correctCount, "個提醒全部匹配");
  } else if (correctCount > 0 && wrongCount > 0) {
    console.log("⚠️  部分正確：", correctCount, "個正確，", wrongCount, "個錯誤");
  } else {
    console.log("❌ 仍然有問題，需要進一步調查");
  }
  
  console.log("");
}
'

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 請開啟網頁驗證："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""


