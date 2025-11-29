#!/bin/bash

# 🚀 Nginx + Node.js 快速啟動腳本
# 用途: 在本地啟動完整的測試環境

echo "================================"
echo "🚀 啟動 Nginx + Node.js 環境"
echo "================================"
echo ""

# 進入專案目錄
cd "$(dirname "$0")"

# 1. 檢查 Nginx 是否已安裝
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx 未安裝"
    echo "正在安裝 Nginx..."
    brew install nginx
fi

# 2. 檢查 Node.js 服務
if ps aux | grep -v grep | grep "node server.js" > /dev/null; then
    echo "✅ Node.js 服務已在運行"
else
    echo "🔄 啟動 Node.js 服務..."
    nohup node server.js > /tmp/flb-backend.log 2>&1 &
    sleep 2
    echo "✅ Node.js 服務已啟動 (port 3000)"
fi

# 3. 檢查 Nginx 服務
if ps aux | grep -v grep | grep nginx > /dev/null; then
    echo "✅ Nginx 服務已在運行"
else
    echo "🔄 啟動 Nginx 服務..."
    brew services start nginx
    sleep 1
    echo "✅ Nginx 服務已啟動 (port 8080)"
fi

# 4. 驗證服務
echo ""
echo "🔍 驗證服務狀態..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/系統設定管理.html)
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 網頁服務正常 (HTTP $HTTP_CODE)"
else
    echo "❌ 網頁服務異常 (HTTP $HTTP_CODE)"
fi

if [ "$API_CODE" = "200" ]; then
    echo "✅ API 服務正常 (HTTP $API_CODE)"
else
    echo "❌ API 服務異常 (HTTP $API_CODE)"
fi

# 5. 顯示訪問資訊
echo ""
echo "================================"
echo "✅ 環境啟動完成"
echo "================================"
echo ""
echo "📱 訪問資訊:"
echo "   🌐 系統設定頁面: http://localhost:8080/系統設定管理.html"
echo "   🔌 API 端點: http://localhost:8080/api/"
echo "   📊 健康檢查: http://localhost:8080/api/health"
echo ""
echo "🛠️  管理指令:"
echo "   停止服務: ./🛑停止服務.sh"
echo "   重啟 Nginx: nginx -s reload"
echo "   查看日誌: tail -f /tmp/flb-backend.log"
echo ""

# 6. 自動打開瀏覽器（可選）
read -p "是否在瀏覽器中打開？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open http://localhost:8080/系統設定管理.html
    echo "✅ 已在瀏覽器中打開"
fi

echo ""
echo "🎉 準備就緒！"


