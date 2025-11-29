#!/bin/bash

# 日曆點擊與懸浮資訊修復部署腳本 v2

echo "🔧 日曆點擊與懸浮資訊修復部署 v2"
echo "================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "❌ 請在專案根目錄執行此腳本"
    exit 1
fi

echo "📋 修復內容（v2 - 完全依靠事件委派）："
echo "  1. ✅ 移除所有 inline onclick（避免 event 變數衝突）"
echo "  2. ✅ 完全依靠事件委派處理點擊"
echo "  3. ✅ 使用 capture 模式確保事件優先捕獲"
echo "  4. ✅ 優先處理 event-chip 避免被父元素攔截"
echo "  5. ✅ 添加詳細的點擊事件調試日誌"
echo "  6. ✅ 保留原有 title 懸浮提示功能"
echo ""

# 備份當前文件
echo "💾 備份當前文件..."
BACKUP_FILE="public/perfect-calendar-optimized-complete2.html.backup-calendar-click-v2-$(date +%Y%m%d-%H%M%S)"
cp public/perfect-calendar-optimized-complete2.html "$BACKUP_FILE"
echo "✅ 備份完成: $BACKUP_FILE"
echo ""

# 檢查 Docker 容器狀態
echo "🔍 檢查 Docker 容器狀態..."
if docker ps | grep -q "flb-calendar"; then
    echo "✅ Docker 容器正在運行"
    
    # 重啟容器以應用變更
    echo ""
    echo "🔄 重啟 Docker 容器..."
    docker-compose restart
    
    # 等待服務啟動
    echo "⏳ 等待服務啟動..."
    sleep 3
    
    # 檢查服務狀態
    echo ""
    echo "🔍 檢查服務狀態..."
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ 服務已成功啟動"
    else
        echo "⚠️  服務可能尚未完全啟動，請稍候再試"
    fi
else
    echo "⚠️  Docker 容器未運行"
    echo "📝 請執行以下命令啟動："
    echo "   docker-compose up -d"
fi

echo ""
echo "🧪 測試步驟："
echo "================================"
echo "1. 開啟瀏覽器訪問 http://localhost:3000"
echo "2. **務必打開開發者工具（F12）查看 Console**"
echo "3. 切換到「本週」或「本月」視圖"
echo "4. Console 應該顯示：「✅ 日曆視圖事件委派已設置完成」"
echo ""
echo "5. 測試懸浮提示："
echo "   ✓ 滑鼠懸停在日曆方塊上（應顯示日期和課程摘要）"
echo "   ✓ 滑鼠懸停在事件方塊上（應顯示詳細課程資訊）"
echo ""
echo "6. 測試點擊功能："
echo "   ✓ 點擊日曆方塊（空白區域）"
echo "     → Console 應顯示：🗓️ 點擊日曆方塊（事件委派）"
echo "     → 頁面應滾動到該日期的課程列表"
echo "   "
echo "   ✓ 點擊事件方塊（課程方塊）"
echo "     → Console 應顯示：🎯 點擊事件方塊（事件委派）"
echo "     → 頁面應滾動並高亮對應的課程卡片"
echo ""

echo "📊 調試資訊："
echo "================================"
echo "每次點擊都應該在 Console 顯示："
echo "  🖱️ 點擊事件觸發: [className] [tagName]"
echo ""
echo "如果點擊無效："
echo "1. 檢查 Console 是否有「🖱️ 點擊事件觸發」"
echo "2. 如果沒有，可能是瀏覽器快取問題，請強制重新載入（Ctrl+Shift+R）"
echo "3. 如果有「🖱️」但沒有「🗓️」或「🎯」，請截圖 Console 並回報"
echo ""

echo "🎉 部署完成！"
echo "📝 如需回復，執行："
echo "   cp $BACKUP_FILE public/perfect-calendar-optimized-complete2.html"
echo "   docker-compose restart"
echo ""
echo "⚠️  重要：請務必清除瀏覽器快取後再測試！"
echo "   Windows/Linux: Ctrl+Shift+R"
echo "   macOS: Cmd+Shift+R"

