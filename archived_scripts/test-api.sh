#!/bin/bash

echo "🧪 測試 API 是否返回 coursePeriod..."
echo ""

echo "📍 測試 1: 不帶 instructor 參數"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?range=day&date=2025-10-19" | jq '.courses[0] | {title, courseName, coursePeriod}' || echo "❌ 測試失敗"

echo ""
echo "📍 測試 2: 帶 instructor=TIM 參數"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?range=day&date=2025-10-19&instructor=TIM" | jq '.courses[] | select(.courseName == "SPIKE PRO") | {title, courseName, coursePeriod}' || echo "❌ 測試失敗"

echo ""
echo "📍 測試 3: 完整 URL（與瀏覽器相同）"
curl -s "http://localhost:3000/api/learning-records/today-completed-courses?range=day&date=2025-10-19&eventId=20251018T043723-ouqqshoc@cal.synology.com&instructor=TIM" | jq '.courses[] | select(.id == "20251018T043723-ouqqshoc@cal.synology.com") | {title, courseName, coursePeriod}' || echo "❌ 測試失敗"

echo ""
echo "✅ 測試完成"

