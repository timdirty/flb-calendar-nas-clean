#!/bin/bash

# 🔍 完整系統檢查腳本
# 檢查所有 API 端點和配置文件

echo "======================================"
echo "🔍 開始完整系統檢查"
echo "======================================"
echo ""

# 檢查伺服器是否運行
echo "1️⃣  檢查伺服器狀態..."
if curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ 伺服器運行中"
else
    echo "❌ 伺服器未運行或無法連接"
    echo "   請執行: npm start"
    exit 1
fi
echo ""

# 檢查講師資料 API
echo "2️⃣  檢查講師資料 API..."
TEACHERS_RESPONSE=$(curl -s http://localhost:3002/api/teachers)
if echo "$TEACHERS_RESPONSE" | grep -q "success.*true"; then
    TEACHER_COUNT=$(echo "$TEACHERS_RESPONSE" | grep -o '"name"' | wc -l)
    echo "✅ 講師資料 API 正常"
    echo "   講師數量: $TEACHER_COUNT"
    
    # 檢查顏色欄位
    if echo "$TEACHERS_RESPONSE" | grep -q '"color"'; then
        echo "✅ 講師顏色欄位存在"
    else
        echo "⚠️  講師顏色欄位缺失"
    fi
else
    echo "❌ 講師資料 API 異常"
    echo "   回應: $TEACHERS_RESPONSE"
fi
echo ""

# 檢查特殊事件配置 API
echo "3️⃣  檢查特殊事件配置 API..."
SPECIAL_EVENTS_RESPONSE=$(curl -s http://localhost:3002/api/special-events-config)
if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "success.*true"; then
    echo "✅ 特殊事件配置 API 正常"
    
    # 檢查各類型配置
    if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "停課"; then
        echo "   ✅ 停課配置存在"
    fi
    if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "體驗"; then
        echo "   ✅ 體驗配置存在"
    fi
    if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "代課"; then
        echo "   ✅ 代課配置存在"
    fi
    if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "補課"; then
        echo "   ✅ 補課配置存在"
    fi
    if echo "$SPECIAL_EVENTS_RESPONSE" | grep -q "改時間"; then
        echo "   ✅ 補課包含「改時間」關鍵字"
    else
        echo "   ⚠️  補課未包含「改時間」關鍵字"
    fi
else
    echo "❌ 特殊事件配置 API 異常"
    echo "   回應: $SPECIAL_EVENTS_RESPONSE"
fi
echo ""

# 檢查系統設定 API
echo "4️⃣  檢查系統設定 API..."
SYSTEM_SETTINGS_RESPONSE=$(curl -s http://localhost:3002/api/system-settings)
if echo "$SYSTEM_SETTINGS_RESPONSE" | grep -q "success.*true"; then
    echo "✅ 系統設定 API 正常"
else
    echo "❌ 系統設定 API 異常"
    echo "   回應: $SYSTEM_SETTINGS_RESPONSE"
fi
echo ""

# 檢查 LINE 配置 API
echo "5️⃣  檢查 LINE 配置 API..."
LINE_CONFIG_RESPONSE=$(curl -s http://localhost:3002/api/line-config)
if echo "$LINE_CONFIG_RESPONSE" | grep -q "success.*true"; then
    echo "✅ LINE 配置 API 正常"
    if echo "$LINE_CONFIG_RESPONSE" | grep -q '"hasToken":true'; then
        echo "   ✅ LINE Token 已設定"
    else
        echo "   ⚠️  LINE Token 未設定"
    fi
else
    echo "❌ LINE 配置 API 異常"
fi
echo ""

# 檢查 Google API 配置
echo "6️⃣  檢查 Google API 配置..."
GOOGLE_API_RESPONSE=$(curl -s http://localhost:3002/api/google-api-config)
if echo "$GOOGLE_API_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Google API 配置 API 正常"
else
    echo "❌ Google API 配置 API 異常"
fi
echo ""

# 檢查配置文件
echo "7️⃣  檢查配置文件..."
if [ -f "teacher_data.json" ]; then
    echo "✅ teacher_data.json 存在"
    # 檢查 JSON 格式
    if python3 -m json.tool teacher_data.json > /dev/null 2>&1; then
        echo "   ✅ JSON 格式正確"
    else
        echo "   ❌ JSON 格式錯誤"
    fi
else
    echo "❌ teacher_data.json 不存在"
fi

if [ -f "special-events-config.json" ]; then
    echo "✅ special-events-config.json 存在"
else
    echo "⚠️  special-events-config.json 不存在（將使用預設值）"
fi

if [ -f "system-settings.json" ]; then
    echo "✅ system-settings.json 存在"
else
    echo "❌ system-settings.json 不存在"
fi
echo ""

# 檢查前端文件
echo "8️⃣  檢查前端文件..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "✅ perfect-calendar-optimized-complete2.html 存在"
    
    # 檢查講師顏色載入
    if grep -q "loadTeacherColors" "public/perfect-calendar-optimized-complete2.html"; then
        echo "   ✅ 包含講師顏色載入函數"
    else
        echo "   ❌ 缺少講師顏色載入函數"
    fi
    
    # 檢查特殊事件配置
    if grep -q "改時間" "public/perfect-calendar-optimized-complete2.html"; then
        echo "   ✅ 包含「改時間」關鍵字"
    else
        echo "   ⚠️  未包含「改時間」關鍵字"
    fi
else
    echo "❌ perfect-calendar-optimized-complete2.html 不存在"
fi

if [ -f "public/admin-dashboard.html" ]; then
    echo "✅ admin-dashboard.html 存在"
    
    # 檢查 API 調用
    if grep -q "/api/special-events-config" "public/admin-dashboard.html"; then
        echo "   ✅ 包含特殊事件配置 API 調用"
    else
        echo "   ❌ 缺少特殊事件配置 API 調用"
    fi
else
    echo "❌ admin-dashboard.html 不存在"
fi
echo ""

# 總結
echo "======================================"
echo "✅ 系統檢查完成"
echo "======================================"
echo ""
echo "📋 快速測試連結："
echo "   講師資料: http://localhost:3002/api/teachers"
echo "   特殊事件: http://localhost:3002/api/special-events-config"
echo "   系統設定: http://localhost:3002/api/system-settings"
echo "   管理後台: http://localhost:3002/admin-dashboard.html"
echo "   前端頁面: http://localhost:3002/perfect-calendar-optimized-complete2.html"
echo ""
echo "💡 如果有任何問題，請查看詳細報告："
echo "   cat ✅前後端完整對齊-檢查報告.md"
echo ""

