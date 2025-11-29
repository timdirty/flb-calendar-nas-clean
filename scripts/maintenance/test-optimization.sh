#!/bin/bash

# 學習歷程上傳系統 - 優化測試腳本
# 啟動開發伺服器並在瀏覽器中運行測試

echo "══════════════════════════════════════════════════════"
echo "🧪 學習歷程上傳系統 - 優化測試"
echo "══════════════════════════════════════════════════════"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "server.js" ]; then
  echo "❌ 錯誤：請在專案根目錄執行此腳本"
  exit 1
fi

echo "📦 檢查依賴..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 未安裝"
  exit 1
fi

echo "✅ Node.js 已安裝"
echo ""

echo "🚀 啟動開發伺服器..."
echo "   端口: 3002"
echo "   測試頁面: http://localhost:3002/learning-record-upload.html"
echo ""
echo "⚠️  注意："
echo "   - 頁面載入後會自動執行測試（3 秒後）"
echo "   - 請檢查瀏覽器控制台查看測試結果"
echo "   - 按 Ctrl+C 停止伺服器"
echo ""
echo "══════════════════════════════════════════════════════"
echo ""

# 啟動開發伺服器
npm run dev

