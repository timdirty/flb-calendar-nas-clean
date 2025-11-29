#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "🔍 檢查檔案同步狀態"
echo "════════════════════════════════════════════════════════"
echo ""

# 檢查 server.js 的修改
echo "1️⃣ 檢查 server.js 是否包含修復內容..."
if grep -q "🚀 CalDAV 初始化完成，立即執行首次快取更新" server.js; then
    echo "   ✅ server.js 包含修復內容"
    echo ""
    echo "   📍 相關代碼："
    grep -A 2 "🚀 CalDAV 初始化完成" server.js | head -3
else
    echo "   ❌ server.js 不包含修復內容！"
fi

echo ""
echo "2️⃣ 檢查前端檔案是否包含修復內容..."
if grep -q "修復：正確判斷載入結果" public/perfect-calendar-optimized-complete2.html; then
    echo "   ✅ 前端檔案包含修復內容"
else
    echo "   ❌ 前端檔案不包含修復內容！"
fi

echo ""
echo "3️⃣ 檢查檔案最後修改時間..."
echo "   server.js: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" server.js 2>/dev/null || stat -c "%y" server.js 2>/dev/null)"
echo "   前端檔案: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" public/perfect-calendar-optimized-complete2.html 2>/dev/null || stat -c "%y" public/perfect-calendar-optimized-complete2.html 2>/dev/null)"

echo ""
echo "════════════════════════════════════════════════════════"
echo ""
echo "💡 如果檔案包含修復內容，請在 NAS 上執行："
echo ""
echo "   cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
echo "   # 檢查檔案內容"
echo "   grep '🚀 CalDAV 初始化完成' server.js"
echo "   "
echo "   # 如果看到內容，重新構建"
echo "   sudo docker-compose down"
echo "   sudo docker-compose up -d --build"
echo "   "
echo "   # 查看啟動日誌"
echo "   sudo docker-compose logs -f"
echo ""
echo "   ⚠️ 特別注意日誌中是否出現："
echo "      '🚀 CalDAV 初始化完成，立即執行首次快取更新...'"
echo "      '✅ 事件快取更新成功'"
echo ""

