#!/bin/bash
# 檢查容器啟動日誌

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 檢查容器啟動日誌..."
echo ""

echo "=== 查找 CalDAV 初始化相關日誌 ==="
sudo docker logs flb-calendar-nas 2>&1 | grep -E "CalDAV|Synology|初始化|登入|login|init" | tail -30

echo ""
echo "=== 查找錯誤信息 ==="
sudo docker logs flb-calendar-nas 2>&1 | grep -E "Error|ERROR|錯誤|失敗|SyntaxError" | tail -20

echo ""
echo "=== 查看完整的最近日誌 ==="
sudo docker logs flb-calendar-nas 2>&1 | tail -100 | head -50


