#!/bin/bash
# 🔥 一鍵修復時間問題
# 直接複製此腳本內容到終端執行

echo "🔥 開始修復時間問題..."
echo ""

# 在本地執行，通過 SSH 遠程操作 NAS
ssh ftpuser@192.168.50.242 << 'ENDSSH'
set -e

echo "✅ 已連接到 NAS"
echo ""

cd /volume1/docker/flb-calendar-nas

echo "=== 步驟 1: 備份並清除數據 ==="
docker exec flb-calendar-nas /bin/sh -c '
  echo "📦 備份現有數據..."
  cp ./data/reminders.json ./data/reminders.json.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "⚠️  無法備份（可能文件不存在）"
  
  echo "🗑️  清除所有提醒..."
  cat > ./data/reminders.json << "INNEREOF"
{
  "reminders": [],
  "studentReminders": []
}
INNEREOF
  
  echo "✅ 已清除提醒數據"
  cat ./data/reminders.json
'

echo ""
echo "=== 步驟 2: 重啟容器 ==="
docker restart flb-calendar-nas

echo "⏳ 等待容器重啟（30秒）..."
sleep 30

echo ""
echo "=== 步驟 3: 驗證修復結果 ==="
docker exec flb-calendar-nas node -e '
const fs = require("fs");

try {
  const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
  const reminders = data.reminders || [];
  
  console.log("");
  console.log("📊 提醒總數:", reminders.length);
  console.log("");
  
  if (reminders.length === 0) {
    console.log("⚠️  尚未生成提醒，可能需要等待或手動觸發");
    console.log("   請訪問：https://calendar.funlearnbar.synology.me/course-reminder-management.html");
    console.log("   並點擊「生成提醒」按鈕");
  } else {
    console.log("檢查前 5 個提醒的時間：");
    console.log("");
    
    let mismatchCount = 0;
    let totalWithTime = 0;
    
    reminders.slice(0, 5).forEach((r, i) => {
      const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
      const nameTime = match ? match[0] : "無";
      
      if (match) {
        totalWithTime++;
        const timeMatch = r.courseTime === nameTime;
        const icon = timeMatch ? "✅" : "❌";
        
        if (!timeMatch) mismatchCount++;
        
        console.log(`${icon} ${i + 1}. ${r.courseName}`);
        console.log(`   courseTime: ${r.courseTime} | 標題時間: ${nameTime}`);
        console.log("");
      } else {
        console.log(`⚪ ${i + 1}. ${r.courseName}`);
        console.log(`   courseTime: ${r.courseTime} | 標題時間: 無`);
        console.log("");
      }
    });
    
    // 完整統計
    reminders.forEach(r => {
      const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
      if (match && r.courseTime !== match[0]) {
        mismatchCount++;
      }
      if (match) totalWithTime++;
    });
    
    console.log("━".repeat(60));
    
    if (mismatchCount === 0 && totalWithTime > 0) {
      console.log("🎉 所有時間都正確匹配！修復成功！");
      console.log(`   總計：${totalWithTime} 個提醒，0 個錯誤`);
    } else if (mismatchCount > 0) {
      console.log(`❌ 仍有 ${mismatchCount}/${totalWithTime} 個時間不匹配`);
      console.log("   需要進一步調查");
    }
    
    console.log("");
  }
  
} catch (error) {
  console.error("❌ 讀取失敗:", error.message);
}
'

echo ""
echo "=== 完成 ==="
echo ""
echo "🌐 請開啟瀏覽器檢查結果："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""
echo "如果提醒數量為 0，請在管理頁面點擊「生成提醒」按鈕"
echo ""

ENDSSH

echo ""
echo "✅ 修復腳本執行完成！"


