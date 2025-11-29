#!/bin/bash

# ============================================
# FLB V2 快速啟動腳本
# ============================================

echo "🚀 啟動 FLB 學習歷程上傳系統 V2.0..."

# 檢查是否在正確的目錄
if [ ! -d "frontend-v2" ]; then
    echo "❌ 錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

# 進入專案目錄
cd frontend-v2

# 檢查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 首次運行，正在安裝依賴..."
    npm install
fi

# 啟動開發伺服器
echo "✅ 啟動開發伺服器..."
echo ""
echo "🌐 訪問地址："
echo "   Local:   http://localhost:5173"
echo ""
echo "💡 按 Ctrl+C 停止伺服器"
echo ""

npm run dev
