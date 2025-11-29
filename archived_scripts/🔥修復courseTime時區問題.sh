#!/bin/bash
# 🔥 修復 courseTime 時區問題
#
# 問題：從 Synology Calendar 獲取的事件時間被錯誤轉換
# 症狀：courseTime 顯示為 "02:00" 而不是正確的 "10:00"（差了8小時）
#
# 原因：在解析事件時，可能將 UTC 時間當作本地時間處理
#
# 解決方案：
# 1. 清除所有錯誤的提醒數據
# 2. 重新從日曆抓取事件（確保時區轉換正確）
# 3. 重新生成提醒

echo "🔧 開始修復 courseTime 時區問題..."
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# NAS 連線資訊
NAS_HOST="ftpuser@192.168.50.242"
NAS_PATH="/volume1/docker/flb-calendar-nas"
CONTAINER_NAME="flb-calendar-nas"

echo "📋 修復計劃："
echo "  1. 備份現有提醒數據"
echo "  2. 清除所有提醒"
echo "  3. 重新啟動服務以重新生成提醒"
echo "  4. 驗證修復結果"
echo ""

read -p "⚠️  確定要繼續嗎？(yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ 已取消"
    exit 1
fi

echo ""
echo "=== 步驟 1: 連接到 NAS ==="
ssh $NAS_HOST << 'ENDSSH'
cd /volume1/docker/flb-calendar-nas

echo "✅ 已連接到 NAS"
echo ""

echo "=== 步驟 2: 進入 Docker 容器 ==="
docker exec -it flb-calendar-nas /bin/sh << 'ENDDOCKER'

echo "✅ 已進入容器"
echo ""

echo "=== 步驟 3: 備份現有數據 ==="
BACKUP_DIR="./data/backups/timezone-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp ./data/reminders.json "$BACKUP_DIR/" 2>/dev/null || echo "⚠️  沒有 reminders.json"
echo "✅ 備份已保存到 $BACKUP_DIR"
echo ""

echo "=== 步驟 4: 檢查當前錯誤數據 ==="
echo "📊 檢查 courseTime 和課程名稱的匹配情況："
node -e "
const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('./data/reminders.json', 'utf8'));
    const reminders = data.reminders || [];
    
    console.log('');
    console.log('檢查前 10 個提醒的時間：');
    console.log('');
    
    reminders.slice(0, 10).forEach(r => {
        // 從課程名稱提取時間（如果有）
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        const nameTime = match ? match[0] : '無';
        
        const timeMatch = nameTime !== '無' && r.courseTime !== nameTime;
        const icon = timeMatch ? '❌' : '✅';
        
        console.log(\`\${icon} \${r.courseName}\`);
        console.log(\`   courseTime: \${r.courseTime} | 名稱中的時間: \${nameTime}\`);
        console.log('');
    });
    
    // 統計不匹配的數量
    let mismatchCount = 0;
    reminders.forEach(r => {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        if (match && r.courseTime !== match[0]) {
            mismatchCount++;
        }
    });
    
    console.log(\`\n📊 總計 \${reminders.length} 個提醒，其中 \${mismatchCount} 個時間不匹配\n\`);
    
} catch (error) {
    console.log('⚠️  無法讀取提醒數據:', error.message);
}
"

echo ""
read -p "⚠️  發現時間不匹配的提醒。是否清除並重新生成？(yes/no): " confirm2
if [ "$confirm2" != "yes" ]; then
    echo "❌ 已取消"
    exit 1
fi

echo ""
echo "=== 步驟 5: 清除所有提醒 ==="
cat > ./data/reminders.json << 'ENDFILE'
{
  "reminders": [],
  "studentReminders": []
}
ENDFILE

echo "✅ 已清除所有提醒"
echo ""

echo "=== 步驟 6: 檢查 synology-calendar-client.js 時區轉換 ==="
grep -A 10 "startTaiwanStr" synology-calendar-client.js | head -15

echo ""
echo "✅ 時區轉換代碼檢查完成"
echo ""

echo "=== 步驟 7: 重新啟動服務 ==="
echo "🔄 退出容器並重啟服務..."

ENDDOCKER

echo ""
echo "=== 步驟 8: 重啟 Docker 容器 ==="
docker restart flb-calendar-nas

echo "⏳ 等待容器啟動（30秒）..."
sleep 30

echo ""
echo "=== 步驟 9: 觸發提醒生成 ==="
docker exec flb-calendar-nas node -e "
const axios = require('axios');
console.log('🔄 觸發提醒生成...');

axios.post('http://localhost:3000/api/reminder-scheduler/generate', {}, {
    headers: {
        'Content-Type': 'application/json'
    }
}).then(response => {
    console.log('✅ 提醒生成成功');
    console.log(response.data);
}).catch(error => {
    console.error('❌ 觸發失敗:', error.message);
});
"

echo ""
echo "⏳ 等待提醒生成完成（10秒）..."
sleep 10

echo ""
echo "=== 步驟 10: 驗證修復結果 ==="
docker exec flb-calendar-nas node -e "
const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('./data/reminders.json', 'utf8'));
    const reminders = data.reminders || [];
    
    console.log('');
    console.log('✅ 驗證結果：');
    console.log('');
    console.log(\`總提醒數：\${reminders.length}\`);
    console.log('');
    
    console.log('檢查前 5 個提醒的時間：');
    reminders.slice(0, 5).forEach(r => {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        const nameTime = match ? match[0] : '無';
        const timeMatch = nameTime !== '無' && r.courseTime === nameTime;
        const icon = timeMatch ? '✅' : (nameTime === '無' ? '⚪' : '❌');
        
        console.log(\`\${icon} \${r.courseName}\`);
        console.log(\`   courseTime: \${r.courseTime}\`);
    });
    
    // 統計匹配情況
    let totalWithTime = 0;
    let matchCount = 0;
    
    reminders.forEach(r => {
        const match = r.courseName.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            totalWithTime++;
            if (r.courseTime === match[0]) {
                matchCount++;
            }
        }
    });
    
    console.log('');
    console.log(\`📊 統計：\${matchCount}/\${totalWithTime} 個時間匹配\`);
    
    if (matchCount === totalWithTime && totalWithTime > 0) {
        console.log('');
        console.log('🎉 所有時間都正確匹配！修復成功！');
    } else if (matchCount > 0) {
        console.log('');
        console.log('⚠️  部分時間仍不匹配，可能需要進一步調查');
    } else {
        console.log('');
        console.log('❌ 時間仍然不匹配，修復失敗');
    }
    
} catch (error) {
    console.log('❌ 無法讀取提醒數據:', error.message);
}
"

echo ""
echo "=== 修復完成 ==="
echo ""
echo "📋 接下來的步驟："
echo "  1. 開啟網頁：https://calendar.funlearnbar.synology.me/course-reminder-management.html"
echo "  2. 檢查提醒的時間是否正確"
echo "  3. 如果仍有問題，請查看容器日誌："
echo "     docker logs flb-calendar-nas --tail 100"
echo ""

ENDSSH

echo ""
echo "✅ 遠程執行完成！"
echo ""
echo "🌐 請開啟瀏覽器檢查："
echo "   https://calendar.funlearnbar.synology.me/course-reminder-management.html"


