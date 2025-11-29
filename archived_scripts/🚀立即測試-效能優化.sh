#!/bin/bash

# 🚀 立即測試效能優化
# 這個腳本會將優化後的檔案部署到 NAS 並重啟服務

echo "======================================"
echo "🚀 效能優化 - 分批渲染部署腳本"
echo "======================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

# NAS 設定
NAS_HOST="192.168.50.139"
NAS_USER="flbadmin"
NAS_PATH="/volume1/docker/flb-calendar"

echo "📦 準備部署優化後的檔案..."
echo "   目標 NAS: $NAS_HOST"
echo "   目標路徑: $NAS_PATH"
echo ""

# 1. 同步優化後的檔案到 NAS
echo "1️⃣  同步檔案到 NAS..."
scp -r public/perfect-calendar-optimized-complete.html "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/public/"

if [ $? -eq 0 ]; then
    echo "   ✅ 檔案同步成功"
else
    echo "   ❌ 檔案同步失敗"
    exit 1
fi

echo ""
echo "2️⃣  重啟 Docker 容器..."

# 2. 在 NAS 上重啟服務
ssh "${NAS_USER}@${NAS_HOST}" << 'ENDSSH'
cd /volume1/docker/flb-calendar
echo "   停止容器..."
docker-compose down
echo "   啟動容器..."
docker-compose up -d
echo "   ✅ 容器重啟完成"
ENDSSH

if [ $? -eq 0 ]; then
    echo "   ✅ 服務重啟成功"
else
    echo "   ❌ 服務重啟失敗"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "🌐 請開啟瀏覽器測試："
echo "   https://calendar.funlearnbar.synology.me"
echo ""
echo "📊 觀察以下改進："
echo "   • 首批課程顯示時間：< 100ms"
echo "   • 進度條從 50% 平滑更新到 100%"
echo "   • 載入訊息顯示渲染進度"
echo "   • 畫面不再凍結，可以立即互動"
echo ""
echo "🔍 檢查瀏覽器 Console："
echo "   應該看到類似訊息："
echo "   🚀 開始分批渲染 223 個課程，共 12 批"
echo "   📦 渲染第 1/12 批 (0-20), 進度: 54%"
echo "   📦 渲染第 2/12 批 (20-40), 進度: 58%"
echo "   ..."
echo "   ✅ 所有課程渲染完成"
echo ""
echo "======================================"

