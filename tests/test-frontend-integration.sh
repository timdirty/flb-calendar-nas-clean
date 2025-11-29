#!/bin/bash

# 前端整合測試腳本
# 測試上傳統計功能在瀏覽器中的整合

set -e

BASE_URL="http://localhost:3000"
CALENDAR_URL="${BASE_URL}/perfect-calendar-modular.html"

echo "🧪 前端整合測試腳本"
echo "================================"
echo ""

# 檢查伺服器是否運行
echo "🔍 檢查伺服器狀態..."
if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "❌ 伺服器未運行！請先執行 'npm run dev'"
    exit 1
fi
echo "✅ 伺服器正常運行"
echo ""

# 測試 API 端點
echo "📡 測試 API 端點..."
API_RESPONSE=$(curl -s "${BASE_URL}/api/v2/courses/upload-stats?date=2025-01-19&courseName=SPIKE%20五%2016:10-17:40%20松山")

if echo "$API_RESPONSE" | grep -q '"success":true'; then
    echo "✅ API 響應成功"
    
    # 解析並顯示統計資料
    if command -v python3 &> /dev/null; then
        echo ""
        echo "📊 統計資料:"
        echo "$API_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success') and data.get('data'):
    stats = data['data']
    print(f\"  課程名稱: {stats.get('courseName', 'N/A')}\")
    print(f\"  日期: {stats.get('date', 'N/A')}\")
    print(f\"  學生總數: {stats.get('studentCount', 0)}\")
    print(f\"  已上傳學生: {stats.get('uploadedStudentCount', 0)}\")
    print(f\"  上傳檔案數: {stats.get('totalUploadedFiles', 0)}\")
    print(f\"  總覽已上傳: {'是' if stats.get('overviewUploaded') else '否'}\")
    print(f\"  上傳百分比: {stats.get('uploadPercentage', 0)}%\")
"
    fi
else
    echo "❌ API 響應失敗"
    echo "回應內容: $API_RESPONSE"
    exit 1
fi
echo ""

# 檢查前端檔案
echo "📄 檢查前端檔案..."
if [ -f "public/perfect-calendar-modular.html" ]; then
    echo "✅ 日曆 HTML 檔案存在"
else
    echo "❌ 日曆 HTML 檔案不存在"
    exit 1
fi

if [ -f "public/js/main.js" ]; then
    echo "✅ main.js 檔案存在"
    
    # 檢查是否包含統計函數
    if grep -q "fetchCourseUploadStats" public/js/main.js; then
        echo "✅ fetchCourseUploadStats 函數存在"
    else
        echo "❌ fetchCourseUploadStats 函數不存在"
        exit 1
    fi
else
    echo "❌ main.js 檔案不存在"
    exit 1
fi

if [ -f "public/css/styles.css" ]; then
    echo "✅ styles.css 檔案存在"
    
    # 檢查是否包含統計樣式
    if grep -q "upload-stats-compact" public/css/styles.css; then
        echo "✅ upload-stats-compact 樣式存在"
    else
        echo "❌ upload-stats-compact 樣式不存在"
        exit 1
    fi
else
    echo "❌ styles.css 檔案不存在"
    exit 1
fi
echo ""

# 檢查路由順序
echo "🔀 檢查路由順序..."
ROUTE_ORDER=$(grep -n "router.get('/courses" routes/v2-courses.js | head -4)
echo "$ROUTE_ORDER"

# 驗證具體路徑在動態路由之前
UPLOAD_STATS_LINE=$(echo "$ROUTE_ORDER" | grep "upload-stats" | cut -d: -f1)
ID_ROUTE_LINE=$(echo "$ROUTE_ORDER" | grep "/:id" | cut -d: -f1)

if [ -n "$UPLOAD_STATS_LINE" ] && [ -n "$ID_ROUTE_LINE" ]; then
    if [ "$UPLOAD_STATS_LINE" -lt "$ID_ROUTE_LINE" ]; then
        echo "✅ 路由順序正確（upload-stats 在 :id 之前）"
    else
        echo "❌ 路由順序錯誤（upload-stats 在 :id 之後）"
        exit 1
    fi
else
    echo "⚠️  無法驗證路由順序"
fi
echo ""

# 提供測試指引
echo "================================"
echo "✅ 自動測試完成！"
echo ""
echo "📋 手動測試步驟："
echo "1. 開啟瀏覽器訪問："
echo "   ${CALENDAR_URL}"
echo ""
echo "2. 開啟開發者工具（F12 或 Cmd+Option+I）"
echo ""
echo "3. 檢查 Console 輸出，應該看到："
echo "   ✅ [上傳統計] 查詢成功"
echo "   ⚠️ 無 404 錯誤"
echo ""
echo "4. 檢查 Network 標籤："
echo "   ✅ /api/v2/courses/upload-stats 返回 200"
echo ""
echo "5. 檢查日曆卡片下方是否顯示統計資訊："
echo "   👥2/5 · 📁8 · 📋✓"
echo ""
echo "詳細測試指南請參考："
echo "docs/UPLOAD-STATS-INTEGRATION-TEST.md"
echo ""
