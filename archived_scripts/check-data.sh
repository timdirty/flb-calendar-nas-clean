#!/bin/bash
# 檢查 reminders.json 的原始數據，找出問題

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 檢查提醒數據中的時間..."
echo ""

docker exec flb-calendar-nas cat ./data/reminders.json | head -100 | grep -A 15 "ESM.*10:00\|BOOST.*12:30"


