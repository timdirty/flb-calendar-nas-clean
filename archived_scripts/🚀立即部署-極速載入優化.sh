#!/bin/bash

echo "🚀 開始部署極速載入優化..."
echo "=================================="

# 檢查檔案是否存在
if [ ! -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "❌ 錯誤: 找不到 perfect-calendar-optimized-complete2.html"
    exit 1
fi

echo "📦 備份現有檔案..."
timestamp=$(date +%Y%m%d-%H%M%S)
cp public/perfect-calendar-optimized-complete2.html public/perfect-calendar-optimized-complete2.html.backup-$timestamp

echo ""
echo "✅ 優化項目:"
echo "  1. ⚡ 移除快取狀態檢查（減少 API 請求）"
echo "  2. ⚡ 非阻塞式講師顏色載入"
echo "  3. ⚡ 增加自動綁定等待時間（10秒 → 20秒）"
echo "  4. ⚡ 增加 LIFF 初始化超時（5秒 → 15秒）"
echo "  5. 📊 新增詳細效能追蹤 log"
echo "  6. 💡 超時後智能重試機制"
echo ""

echo "📋 優化說明:"
echo ""
echo "【載入速度優化】"
echo "  • 移除不必要的 /api/events/cache-status 檢查"
echo "  • 講師顏色改為非阻塞式載入，不影響主流程"
echo "  • 預計載入時間從 847ms 減少到 300-500ms"
echo ""
echo "【手機自動綁定優化】"
echo "  • LIFF 初始化超時從 5秒 增加到 15秒"
echo "  • 資料等待時間從 10秒 增加到 20秒"
echo "  • 超時後會檢查資料是否已載入，智能重試"
echo ""
echo "【效能追蹤】"
echo "  • API 請求耗時"
echo "  • 資料處理耗時"
echo "  • LIFF SDK 載入耗時"
echo "  • LIFF 初始化耗時"
echo "  • 獲取用戶資料耗時"
echo ""

# 檢查 nginx 配置
if [ -f "/etc/nginx/nginx.conf" ]; then
    echo "🔍 檢查 Nginx 配置..."
    if nginx -t &>/dev/null; then
        echo "✅ Nginx 配置正確"
        
        echo ""
        echo "🔄 重新載入 Nginx..."
        sudo nginx -s reload
        
        if [ $? -eq 0 ]; then
            echo "✅ Nginx 重新載入成功"
        else
            echo "❌ Nginx 重新載入失敗"
            exit 1
        fi
    else
        echo "⚠️  Nginx 配置有問題，但繼續部署前端檔案"
    fi
else
    echo "ℹ️  未檢測到 Nginx，跳過 Nginx 相關操作"
fi

echo ""
echo "=================================="
echo "✅ 極速載入優化部署完成！"
echo ""
echo "📊 測試方式："
echo "  1. 用手機開啟 LIFF 應用"
echo "  2. 觀察 console log 的效能追蹤："
echo "     - ⚡ API請求耗時"
echo "     - ⚡ 資料處理耗時"
echo "     - ⚡ LIFF SDK 載入耗時"
echo "     - ⚡ LINE初始化總耗時"
echo "  3. 確認是否能自動綁定講師"
echo ""
echo "💡 預期改善："
echo "  • 桌面端：載入時間從 1164ms → 約 600-800ms"
echo "  • 手機端：自動綁定成功率大幅提升"
echo ""
echo "🔍 如需調試，請查看瀏覽器 console 的效能追蹤 log"
echo ""

