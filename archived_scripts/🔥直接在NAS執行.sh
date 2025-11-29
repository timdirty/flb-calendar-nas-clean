#!/bin/bash
# 🔥 直接在 NAS 上執行此腳本
# 
# 使用方法：
# 1. 將此檔案上傳到 NAS
# 2. SSH 登入 NAS: ssh ftpuser@192.168.50.242
# 3. 執行: bash /volume1/docker/flb-calendar-nas/🔥直接在NAS執行.sh

set -e

echo "🔥 開始修復時間問題..."
echo ""

# 確認在正確的目錄
cd /volume1/docker/flb-calendar-nas

echo "=== 步驟 1: 備份並清除數據（在 Docker 容器內） ==="
docker exec flb-calendar-nas /bin/sh << 'DOCKERCMD'
  echo "📦 備份現有數據..."
  cp ./data/reminders.json ./data/reminders.json.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "⚠️  無法備份（可能文件不存在）"
  
  echo "🗑️  清除所有提醒..."
  cat > ./data/reminders.json << 'EOF'
{
  "reminders": [],
  "studentReminders": []
}
EOF
  
  echo "✅ 已清除提醒數據"
  echo "檔案內容："
  cat ./data/reminders.json
DOCKERCMD

echo ""
echo "=== 步驟 2: 重啟容器 ==="
docker restart flb-calendar-nas

echo "⏳ 等待容器重啟（30秒）..."
sleep 30

echo ""
echo "=== 步驟 3: 驗證修復結果 ==="
docker exec flb-calendar-nas node << 'NODESCRIPT'
const fs = require("fs");

try {
  const data = JSON.parse(fs.readFileSync("./data/reminders.json", "utf8"));
  const reminders = data.reminders || [];
  
  console.log("");
  console.log("📊 提醒總數:", reminders.length);
  console.log("");
  
  if (reminders.length === 0) {
    console.log("⚠️  尚未生成提醒");
    console.log("   請訪問管理頁面並點擊「生成提醒」按鈕");
    console.log("   https://calendar.funlearnbar.synology.me/course-reminder-management.html");
  } else {
    console.log("檢查前 5 個提醒的時間：");
    console.log("");
    
    let mismatchCount = 0;
    let totalWithTime = 0;
    
    reminders.forEach((r, i) => {
      if (i < 5) {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        const nameTime = match ? match[0] : "無";
        
        if (match) {
          const timeMatch = r.courseTime === nameTime;
          const icon = timeMatch ? "✅" : "❌";
          
          console.log(`${icon} ${i + 1}. ${r.courseName}`);
          console.log(`   courseTime: ${r.courseTime} | 標題時間: ${nameTime}`);
          console.log("");
        } else {
          console.log(`⚪ ${i + 1}. ${r.courseName}`);
          console.log(`   courseTime: ${r.courseTime}`);
          console.log("");
        }
      }
      
      // 統計
      const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        totalWithTime++;
        if (r.courseTime !== match[0]) {
          mismatchCount++;
        }
      }
    });
    
    console.log("━".repeat(60));
    
    if (mismatchCount === 0 && totalWithTime > 0) {
      console.log("🎉 所有時間都正確匹配！修復成功！");
      console.log(`   總計：${totalWithTime} 個提醒，0 個錯誤`);
    } else if (mismatchCount > 0) {
      console.log(`❌ 仍有 ${mismatchCount}/${totalWithTime} 個時間不匹配`);
      console.log("   需要進一步調查代碼層級問題");
    }
    
    console.log("");
  }
  
} catch (error) {
  console.error("❌ 讀取失敗:", error.message);
  process.exit(1);
}
NODESCRIPT

echo ""
echo "=== 完成 ==="
echo ""
echo "🌐 請開啟瀏覽器檢查結果："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo ""

# 顯示最近的日誌
echo "📋 最近的容器日誌："
docker logs flb-calendar-nas --tail 20

echo ""
echo "✅ 修復腳本執行完成！"


