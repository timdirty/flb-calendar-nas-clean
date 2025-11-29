#!/bin/bash

# 🧪 學生匹配修復 - 測試腳本
# 用於驗證課程與學生的正確匹配

echo "============================================"
echo "🧪 測試學習歷程 - 學生匹配功能"
echo "============================================"
echo ""

# 測試 1: SPIKE PRO 日 10:00-12:00 第5週
echo "📝 測試 1: SPIKE PRO 日 10:00-12:00 第5週"
echo "預期學生: 陳杰睿、顏世餘"
echo "----------------------------------------"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?eventId=20251018T043723-ouqqshoc@cal.synology.com&date=2025-10-19&instructor=TIM" | \
  jq -r '.courses[] | select(.title | contains("SPIKE PRO 日 10:00-12:00")) | "✅ 課程: \(.title)\n   學生數: \(.students | length)\n   學生名單: \([.students[].name] | join(", "))"' 2>/dev/null
echo ""
echo ""

# 測試 2: SPIKE 日 15:15-17:15 第4週
echo "📝 測試 2: SPIKE 日 15:15-17:15 第4週"
echo "預期學生: 傅柏睿、呂恩琦、郭昕喬、蘇禹中"
echo "----------------------------------------"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?date=2025-10-19" | \
  jq -r '.courses[] | select(.title | contains("SPIKE 日 15:15-17:15")) | "✅ 課程: \(.title)\n   學生數: \(.students | length)\n   學生名單: \([.students[].name] | join(", "))"' 2>/dev/null | head -5
echo ""
echo ""

# 測試 3: 所有 SPIKE 課程概覽
echo "📝 測試 3: 所有 SPIKE 課程概覽"
echo "----------------------------------------"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?date=2025-10-19" | \
  jq -r '.courses[] | select(.title | contains("SPIKE")) | "📚 \(.title) → \(.students | length) 位學生: \([.students[].name] | join(", "))"' 2>/dev/null | sort | uniq
echo ""
echo ""

# 驗證結果
echo "============================================"
echo "✅ 驗證重點:"
echo "============================================"
echo "1. SPIKE PRO 日 10:00-12:00 應該只有 2 位學生（陳杰睿、顏世餘）"
echo "2. 張小明和李小華（19:30-21:00班）不應該出現在日 10:00-12:00 班"
echo "3. 不同時段的 SPIKE 課程應該有不同的學生"
echo "4. 沒有 period 的學生（劉柏辰、王予樂）不應該出現"
echo ""
echo "============================================"
echo "🌐 網頁測試 URL:"
echo "============================================"
echo "https://calendar.funlearnbar.synology.me/learning-record-upload.html?eventId=20251018T043723-ouqqshoc@cal.synology.com&date=2025-10-19&time=10:00&instructor=TIM"
echo ""

