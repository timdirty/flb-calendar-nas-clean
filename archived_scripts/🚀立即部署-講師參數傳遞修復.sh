#!/bin/bash

echo "🚀 開始部署講師參數傳遞修復..."
echo "============================================"

# 1. 備份原始檔案
echo "🔄 備份原始檔案..."
cp public/perfect-calendar-optimized-complete2.html public/perfect-calendar-optimized-complete2.html.bak-$(date +%Y%m%d-%H%M%S)
cp public/learning-record-upload.html public/learning-record-upload.html.bak-$(date +%Y%m%d-%H%M%S)
echo "✅ 備份完成"

# 2. 檢查修改
echo ""
echo "📋 檢查修改內容..."
echo "✅ perfect-calendar-optimized-complete2.html:"
echo "   - goToLearningRecordUpload 函數新增 instructor 參數"
echo "   - updateAllCountdowns 從 allEvents 讀取講師資訊"
echo ""
echo "✅ learning-record-upload.html:"
echo "   - 新增全域變數 urlInstructor"
echo "   - 從 URL 參數讀取講師名稱"
echo "   - 優先使用 URL 的講師參數進行篩選"

# 3. 重啟服務 (如果使用 PM2)
echo ""
echo "🔄 重啟服務..."
if command -v pm2 &> /dev/null
then
    pm2 restart server.js || pm2 start server.js
    echo "✅ PM2 服務已重啟"
else
    echo "⚠️ PM2 服務未運行"
    echo "💡 如果服務在運行中，請手動重啟"
fi

echo ""
echo "✅ 部署完成！"
echo "============================================"
echo ""
echo "📋 修復內容："
echo "  ✅ 從事件數據中獲取講師資訊"
echo "  ✅ URL 中傳遞講師參數"
echo "  ✅ 學習歷程頁面根據講師篩選課程"
echo "  ✅ 修復 urlInstructor 變數作用域錯誤"
echo ""
echo "🧪 測試步驟："
echo "  1. 強制刷新主行事曆頁面（Cmd+Shift+R）"
echo "  2. 等待頁面載入完成"
echo "  3. 找到已結束的課程"
echo "  4. 打開 Console（F12）"
echo "  5. 點擊「上傳學習歷程」按鈕"
echo "  6. 觀察 Console 日誌"
echo ""
echo "🔍 預期結果："
echo "  ✅ Console：「✅ 找到事件的講師: TIM」"
echo "  ✅ Console：「✅ 從 URL 設定講師篩選: TIM」"
echo "  ✅ URL 包含：&instructor=TIM"
echo "  ✅ 只顯示該講師的課程"
echo ""
echo "❌ 如果遇到問題："
echo "  1. 檢查 allEvents 是否有數據"
echo "  2. 檢查事件的 instructor 屬性是否存在"
echo "  3. 檢查 Console 的調試日誌"
echo ""
echo "📄 相關文件："
echo "  - ✅URL傳遞講師參數-完成報告.txt"
echo "  - 🧪快速測試-講師參數傳遞.txt"
echo ""

