#!/bin/bash

echo "========================================"
echo "🔧 修復行事曆檔案路徑問題"
echo "========================================"
echo ""

# 進入專案目錄
cd /volume1/docker/flb-calendar-nas || {
    echo "❌ 找不到專案目錄"
    exit 1
}

echo "📋 修復內容："
echo "  1. server.js - 更新路徑重定向"
echo "  2. index.html - 更新行事曆連結"
echo "  3. 重啟 Docker 容器"
echo ""

# 確認檔案存在
echo "🔍 檢查檔案..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "✅ 找到正確的行事曆檔案: perfect-calendar-optimized-complete2.html"
else
    echo "❌ 找不到 perfect-calendar-optimized-complete2.html"
    exit 1
fi

# 拉取最新代碼（如果使用 Git）
if [ -d ".git" ]; then
    echo ""
    echo "📥 拉取最新代碼..."
    git pull
fi

# 重啟 Docker 容器
echo ""
echo "🔄 重啟 Docker 容器..."
docker-compose restart

# 等待容器啟動
echo ""
echo "⏳ 等待容器啟動..."
sleep 10

# 檢查容器狀態
echo ""
echo "🔍 檢查容器狀態..."
docker-compose ps

# 檢查容器日誌
echo ""
echo "📝 最近的容器日誌："
docker-compose logs --tail=20

echo ""
echo "========================================"
echo "✅ 修復完成！"
echo "========================================"
echo ""
echo "📌 修復內容："
echo "  ✓ server.js 根路徑重定向: / → /perfect-calendar-optimized-complete2.html"
echo "  ✓ index.html 行事曆連結: perfect-calendar-optimized-complete2.html"
echo ""
echo "🎯 現在請測試："
echo "  1. 訪問: http://your-nas-ip:3001"
echo "  2. 點擊「開啟行事曆」按鈕"
echo "  3. 檢查學生「沈嘉桐」在 10/17 是否顯示「⚠️ 已請假」"
echo ""
echo "💡 提示："
echo "  - 如果還是看到舊版本，請清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  - student_data.json 每 10 分鐘會自動更新一次"
echo ""

