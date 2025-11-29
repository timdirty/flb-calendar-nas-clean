#!/bin/bash

echo "🚀 開始部署學習歷程上傳頁面修復..."
echo "============================================"

# 檢查檔案是否存在
if [ ! -f "public/learning-record-upload.html" ]; then
    echo "❌ 找不到 learning-record-upload.html"
    exit 1
fi

# 重啟服務以載入修復
echo "🔄 重啟服務..."
if pm2 describe flb-calendar-nas > /dev/null 2>&1; then
    pm2 restart flb-calendar-nas
    echo "✅ PM2 服務重啟完成"
else
    echo "⚠️ PM2 服務未運行，跳過重啟"
fi

echo ""
echo "✅ 部署完成！"
echo "============================================"
echo ""
echo "📋 修復內容："
echo "  ✅ 從 URL 參數正確獲取課程日期"
echo "  ✅ 頁面標題顯示正確的日期"
echo "  ✅ 添加詳細調試日誌以診斷問題"
echo ""
echo "🧪 測試步驟："
echo "  1. 打開主行事曆頁面"
echo "  2. 找到已結束的課程"
echo "  3. 點擊「上傳學習歷程」按鈕"
echo "  4. 檢查瀏覽器控制台的調試訊息"
echo "  5. 查看是否能正確載入該課程"
echo ""
echo "🔍 調試資訊："
echo "  - 打開瀏覽器開發者工具 (F12)"
echo "  - 切換到 Console 標籤"
echo "  - 查找以下關鍵訊息："
echo "    • 📅 日期設定"
echo "    • 📦 收到事件資料"
echo "    • 📊 正常化後的事件資料"
echo "    • 📊 日期範圍篩選結果"
echo "    • 📊 已結束課程篩選結果"
echo ""

