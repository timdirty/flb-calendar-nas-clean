#!/bin/bash

# 日曆點擊與懸浮資訊修復部署腳本

echo "🔧 日曆點擊與懸浮資訊修復部署"
echo "================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "❌ 請在專案根目錄執行此腳本"
    exit 1
fi

echo "📋 修復內容："
echo "  1. ✅ 添加事件委派處理日曆方塊點擊"
echo "  2. ✅ 添加事件委派處理事件方塊點擊"
echo "  3. ✅ 添加全域函數定義驗證"
echo "  4. ✅ 優化點擊事件處理流程"
echo "  5. ✅ 保留原有 title 懸浮提示功能"
echo ""

# 備份當前文件
echo "💾 備份當前文件..."
BACKUP_FILE="public/perfect-calendar-optimized-complete2.html.backup-calendar-click-$(date +%Y%m%d-%H%M%S)"
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
echo "2. 切換到「本週」或「本月」視圖"
echo "3. 查看日曆視圖是否正確顯示"
echo "4. 嘗試以下操作："
echo "   ✓ 滑鼠懸停在日曆方塊上（應顯示日期和課程摘要）"
echo "   ✓ 滑鼠懸停在事件方塊上（應顯示詳細課程資訊）"
echo "   ✓ 點擊日曆方塊（應滾動到該日期的課程列表）"
echo "   ✓ 點擊事件方塊（應高亮顯示對應的課程卡片）"
echo "5. 打開瀏覽器開發者工具（F12），查看 Console"
echo "   ✓ 應該看到「✅ 日曆視圖事件委派已設置完成」"
echo "   ✓ 應該看到「✅ 正在定義全域點擊處理函數...」"
echo "   ✓ 點擊時應該看到對應的日誌輸出"
echo ""

echo "📊 調試資訊："
echo "================================"
echo "如果點擊無效，請檢查："
echo "1. Console 中是否有「window.scrollToDateCourses: function」"
echo "2. Console 中是否有「window.highlightEventCardFromCalendar: function」"
echo "3. 點擊時是否有「🗓️ 點擊日曆方塊（事件委派）」或「🎯 點擊事件方塊（事件委派）」"
echo ""

echo "🎉 部署完成！"
echo "📝 如需回復，執行："
echo "   cp $BACKUP_FILE public/perfect-calendar-optimized-complete2.html"
echo "   docker-compose restart"

