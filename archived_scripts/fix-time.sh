#!/bin/bash
# 修復時間問題 - 在 NAS 上使用 sudo 執行
# 使用方法: sudo bash fix-time.sh

echo "🔥 開始修復時間問題..."
echo ""

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "=== 步驟 1: 清除提醒數據 ==="
docker exec flb-calendar-nas /bin/sh -c '
  echo "📦 備份..."
  cp ./data/reminders.json ./data/reminders.json.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
  
  echo "🗑️  清除..."
  cat > ./data/reminders.json << "EOF"
{
  "reminders": [],
  "studentReminders": []
}
EOF
  
  echo "✅ 完成"
'

echo ""
echo "=== 步驟 2: 重啟容器 ==="
docker restart flb-calendar-nas

echo ""
echo "⏳ 等待 30 秒..."
sleep 30

echo ""
echo "=== 步驟 3: 檢查結果 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
const reminders = data.reminders || [];

console.log("\n📊 提醒總數:", reminders.length, "\n");

if (reminders.length === 0) {
  console.log("⚠️  尚未生成提醒，請稍後或手動觸發\n");
} else {
  console.log("前 5 個提醒檢查：\n");
  
  let ok = 0, bad = 0;
  
  reminders.slice(0, 5).forEach((r, i) => {
    const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const isOk = r.courseTime === match[0];
      const icon = isOk ? "✅" : "❌";
      if (isOk) ok++; else bad++;
      console.log(icon, (i+1) + ".", r.courseName);
      console.log("   時間:", r.courseTime, "| 標題:", match[0]);
    } else {
      console.log("⚪", (i+1) + ".", r.courseName);
      console.log("   時間:", r.courseTime);
    }
    console.log("");
  });
  
  reminders.forEach(r => {
    const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      if (r.courseTime === match[0]) ok++; else bad++;
    }
  });
  
  console.log("━".repeat(50));
  if (bad === 0) {
    console.log("🎉 全部正確！修復成功！");
  } else {
    console.log("❌ 仍有", bad, "個時間不對");
  }
  console.log("");
}
'

echo ""
echo "✅ 完成！請檢查："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""

