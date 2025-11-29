#!/bin/bash

echo "🚀 快速更新系統設定頁面..."

# 檢查檔案
if [ ! -f "public/系統設定.html" ]; then
    echo "❌ 找不到 public/系統設定.html"
    exit 1
fi

echo "=== 步驟 1: 複製更新的檔案到容器 ==="
sudo docker cp ./public/系統設定.html flb-calendar-nas:/app/public/系統設定.html

if [ $? -eq 0 ]; then
    echo "✅ 系統設定頁面已更新"
else
    echo "❌ 更新失敗"
    exit 1
fi

echo ""
echo "=== 步驟 2: 修復權限 ==="
sudo docker exec flb-calendar-nas chown nextjs:nodejs /app/public/系統設定.html
sudo docker exec flb-calendar-nas chmod 644 /app/public/系統設定.html

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 更新完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 請刷新瀏覽器測試："
echo "https://calendar.funlearnbar.synology.me/系統設定.html"
echo ""
echo "💡 如果還是跑版，請按 Ctrl+Shift+R 強制刷新"
echo ""


