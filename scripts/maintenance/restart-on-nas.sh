#!/bin/bash

# ====================================
# NAS 本地重啟腳本（在 NAS 上執行）
# ====================================

echo "🚀 開始重啟服務..."
echo "======================================"

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "📂 當前目錄: $(pwd)"
echo ""

echo "📄 檢查 server.js..."
if [ -f "server.js" ]; then
    FILE_SIZE=$(ls -lh server.js | awk '{print $5}')
    echo "✅ server.js 存在 (${FILE_SIZE})"
    
    # 檢查新增的 API
    echo ""
    echo "🔍 檢查新增的 API..."
    
    if grep -q "GET /api/students" server.js; then
        echo "  ✅ GET /api/students"
    else
        echo "  ❌ GET /api/students - 缺失！"
    fi
    
    if grep -q "GET /api/admin/info" server.js; then
        echo "  ✅ GET /api/admin/info"
    else
        echo "  ❌ GET /api/admin/info - 缺失！"
    fi
    
    if grep -q "POST /api/admin/set" server.js; then
        echo "  ✅ POST /api/admin/set"
    else
        echo "  ❌ POST /api/admin/set - 缺失！"
    fi
    
    if grep -q "POST /api/test-line-notification" server.js; then
        echo "  ✅ POST /api/test-line-notification"
    else
        echo "  ❌ POST /api/test-line-notification - 缺失！"
    fi
else
    echo "❌ server.js 不存在！"
    exit 1
fi

echo ""
echo "🔄 重啟 Docker 容器..."
sudo docker-compose restart

echo ""
echo "⏳ 等待 10 秒..."
sleep 10

echo ""
echo "📊 檢查容器狀態..."
sudo docker-compose ps

echo ""
echo "📋 查看最新日誌（最後 50 行）..."
sudo docker-compose logs --tail=50

echo ""
echo "======================================"
echo "✅ 重啟完成！"
echo "======================================"
echo ""
echo "🧪 測試 API:"
echo "  curl https://calendar.funlearnbar.synology.me/api/students"
echo "  curl https://calendar.funlearnbar.synology.me/api/admin/info"
echo ""
