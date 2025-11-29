#!/bin/bash

echo "========================================"
echo "🔧 浮動通知修復 - 講師問候功能"
echo "========================================"
echo ""

# 進入專案目錄
cd /volume1/docker/flb-calendar-nas || {
    echo "❌ 找不到專案目錄"
    exit 1
}

echo "📋 修復內容："
echo "  1. 擴展關鍵字列表（添加「你好」）"
echo "  2. 更改通知文字為「講師名稱 你好～」"
echo "  3. 重啟 Docker 容器"
echo ""

# 確認檔案存在
echo "🔍 檢查檔案..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "✅ 找到行事曆檔案"
    
    # 檢查是否包含修復內容
    if grep -q "'你好'" public/perfect-calendar-optimized-complete2.html; then
        echo "✅ 已包含關鍵字「你好」"
    else
        echo "⚠️  未找到關鍵字「你好」，可能需要手動更新"
    fi
    
    if grep -q "你好～" public/perfect-calendar-optimized-complete2.html; then
        echo "✅ 已包含新的問候格式"
    else
        echo "⚠️  未找到新的問候格式，可能需要手動更新"
    fi
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
echo "✅ 修復部署完成！"
echo "========================================"
echo ""
echo "📌 修復內容："
echo "  ✓ 關鍵字列表：['綁定', '比對', '成功', '失敗', '錯誤', '完成', '你好']"
echo "  ✓ 通知格式：講師名稱 你好～"
echo ""
echo "🎯 測試步驟："
echo ""
echo "1️⃣ 清除瀏覽器快取："
echo "   - Chrome/Edge: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)"
echo "   - Safari: Cmd+Option+R"
echo ""
echo "2️⃣ 清除 localStorage："
echo "   - 開啟開發者工具 (F12)"
echo "   - 前往 Application > Storage > Local Storage"
echo "   - 刪除所有 'teacher_match_' 開頭的項目"
echo ""
echo "3️⃣ 重新載入頁面："
echo "   - 應該會看到「TIM 你好～」或其他講師名稱的浮動通知"
echo ""
echo "4️⃣ 手動測試（在瀏覽器 Console 執行）："
echo "   showMatchingProcess('TIM 你好～', 'success');"
echo ""
echo "🧪 使用測試工具："
echo "   開啟瀏覽器訪問: http://your-nas-ip:3001/🧪快速測試-浮動通知.html"
echo ""
echo "📖 詳細說明："
echo "   查看檔案: ✅浮動通知修復-講師問候.md"
echo ""
echo "💡 如果通知還是沒有顯示："
echo "   1. 確認瀏覽器沒有阻擋浮動元素"
echo "   2. 檢查開發者工具 Console 是否有錯誤"
echo "   3. 嘗試無痕模式訪問"
echo ""

