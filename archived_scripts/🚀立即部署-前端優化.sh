#!/bin/bash

echo "=========================================="
echo "🎨 前端優化部署腳本"
echo "=========================================="
echo ""

# 顯示當前位置
echo "📍 當前目錄: $(pwd)"
echo ""

# 檢查文件
echo "🔍 檢查優化檔案..."
if [ ! -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "❌ 找不到 public/perfect-calendar-optimized-complete2.html"
    exit 1
fi
echo "✅ 檔案確認完成"
echo ""

# 顯示優化項目
echo "📋 本次優化項目："
echo "   ✅ 液態玻璃綁定通知效果"
echo "   ✅ 手機端性能優化"
echo "   ✅ 低端設備適配"
echo "   ✅ Touch 事件優化"
echo "   ✅ 滾動性能提升"
echo ""

# 建立備份
echo "💾 建立備份..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp public/perfect-calendar-optimized-complete2.html "public/perfect-calendar-optimized-complete2.html.backup-$TIMESTAMP" 2>/dev/null || true
echo "✅ 備份完成: perfect-calendar-optimized-complete2.html.backup-$TIMESTAMP"
echo ""

# 部署
echo "🚀 開始部署..."
echo ""

# 停止容器
echo "⏹️  停止 Docker 容器..."
docker-compose down
echo ""

# 清理
echo "🧹 清理舊容器和快取..."
docker system prune -f > /dev/null 2>&1
echo ""

# 重新建構（使用 --no-cache 確保完全更新）
echo "🔨 重新建構 Docker 映像（完整重建）..."
docker-compose build --no-cache
echo ""

# 啟動容器
echo "▶️  啟動 Docker 容器..."
docker-compose up -d
echo ""

# 等待服務啟動
echo "⏳ 等待服務啟動..."
sleep 8
echo ""

# 檢查服務狀態
echo "📊 檢查服務狀態..."
docker-compose ps
echo ""

# 檢查日誌
echo "📝 顯示最新日誌..."
docker-compose logs --tail=30
echo ""

echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "📱 優化效果："
echo "   • 綁定通知現在使用液態玻璃效果"
echo "   • 手機端滾動更加流暢"
echo "   • 低端設備自動簡化動畫"
echo "   • Touch 反饋更加靈敏"
echo ""
echo "🧪 測試建議："
echo "   1. 在手機上打開系統"
echo "   2. 測試講師綁定流程（查看液態玻璃通知）"
echo "   3. 測試滾動性能"
echo "   4. 檢查載入速度"
echo ""
echo "📍 系統網址："
echo "   http://localhost:3040"
echo "   或您的 NAS IP:3040"
echo ""
echo "🔍 查看即時日誌："
echo "   docker-compose logs -f"
echo ""

