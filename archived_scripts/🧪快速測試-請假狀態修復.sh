#!/bin/bash

echo "========================================"
echo "🧪 快速測試 - 請假狀態顯示修復"
echo "========================================"
echo ""

# 檢查檔案是否存在
echo "1️⃣ 檢查檔案..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "   ✅ 找到正確的行事曆檔案"
    FILE_SIZE=$(wc -l < public/perfect-calendar-optimized-complete2.html)
    echo "   📄 檔案行數: $FILE_SIZE"
else
    echo "   ❌ 找不到 perfect-calendar-optimized-complete2.html"
    exit 1
fi

# 檢查 server.js 是否有正確的路徑
echo ""
echo "2️⃣ 檢查 server.js 路徑配置..."
if grep -q "perfect-calendar-optimized-complete2.html" server.js; then
    echo "   ✅ server.js 路徑正確"
else
    echo "   ❌ server.js 路徑錯誤"
fi

# 檢查 index.html 是否有正確的路徑
echo ""
echo "3️⃣ 檢查 index.html 路徑配置..."
if grep -q "perfect-calendar-optimized-complete2.html" public/index.html; then
    echo "   ✅ index.html 路徑正確"
else
    echo "   ❌ index.html 路徑錯誤"
fi

# 檢查前端代碼是否有處理 leave 狀態
echo ""
echo "4️⃣ 檢查前端代碼邏輯..."
if grep -q "present === 'leave'" public/perfect-calendar-optimized-complete2.html; then
    echo "   ✅ 前端代碼有處理請假狀態"
else
    echo "   ❌ 前端代碼缺少請假狀態處理"
fi

# 檢查 student_data.json 是否有請假記錄
echo ""
echo "5️⃣ 檢查學生資料..."
if [ -f "public/student_data.json" ]; then
    LEAVE_COUNT=$(grep -o '"present": "leave"' public/student_data.json | wc -l)
    echo "   ✅ 找到 student_data.json"
    echo "   📊 請假記錄數量: $LEAVE_COUNT"
    
    # 檢查沈嘉桐的資料
    if grep -q "沈嘉桐" public/student_data.json; then
        echo "   ✅ 找到沈嘉桐的資料"
        
        # 檢查 10/17 的請假記錄
        if grep -A 2 "2025-10-17" public/student_data.json | grep -q '"present": "leave"'; then
            echo "   ✅ 沈嘉桐在 10/17 有請假記錄"
        else
            echo "   ⚠️  沈嘉桐在 10/17 沒有請假記錄"
        fi
    fi
else
    echo "   ❌ 找不到 student_data.json"
fi

# 檢查 Docker 容器狀態
echo ""
echo "6️⃣ 檢查 Docker 容器..."
if docker ps | grep -q "flb-calendar-nas"; then
    echo "   ✅ Docker 容器正在運行"
    
    # 檢查容器健康狀態
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' flb-calendar-nas 2>/dev/null)
    if [ -n "$HEALTH" ]; then
        echo "   📊 容器健康狀態: $HEALTH"
    fi
else
    echo "   ⚠️  Docker 容器未運行"
fi

echo ""
echo "========================================"
echo "📋 測試總結"
echo "========================================"
echo ""
echo "✅ 所有檢查完成！"
echo ""
echo "🎯 下一步："
echo "   1. 如果路徑配置錯誤，請執行: bash 🚀立即修復-路徑問題.sh"
echo "   2. 如果容器未運行，請執行: docker-compose up -d"
echo "   3. 訪問系統並測試請假狀態顯示"
echo ""
echo "🌐 測試方式："
echo "   1. 訪問: http://your-nas-ip:3001"
echo "   2. 點擊 2025/10/17 的「SPM 六 0930-1100」課程"
echo "   3. 確認沈嘉桐顯示「⚠️ 已請假」（黃色標籤）"
echo ""
echo "💡 如果瀏覽器看到舊版本："
echo "   - 清除快取: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)"
echo ""

