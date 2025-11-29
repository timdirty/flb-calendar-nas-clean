#!/bin/bash

echo "================================"
echo "🚀 部署即時簽到更新功能"
echo "================================"
echo ""

# 檢查是否在 NAS 環境
if [ ! -d "/volume1" ]; then
    echo "⚠️  警告：不在 NAS 環境，請在 NAS 上執行此腳本"
    echo ""
fi

# 設定工作目錄
WORK_DIR="/volume1/docker/flb-calendar"
if [ -d "$WORK_DIR" ]; then
    cd "$WORK_DIR"
    echo "📂 工作目錄: $WORK_DIR"
else
    echo "❌ 找不到工作目錄: $WORK_DIR"
    echo "請確認路徑是否正確"
    exit 1
fi

echo ""
echo "📋 修改內容："
echo "1. ✅ 後端：為 student_data.json 設定不快取的 HTTP header"
echo "2. ✅ 前端：所有 fetch 請求都加上 no-cache"
echo "3. ✅ 確保多裝置即時同步簽到狀態"
echo ""

# 備份現有檔案
echo "💾 備份現有檔案..."
BACKUP_DIR="backups/realtime-update-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp server.js "$BACKUP_DIR/" 2>/dev/null
cp public/perfect-calendar-optimized-complete2.html "$BACKUP_DIR/" 2>/dev/null
echo "✅ 備份完成: $BACKUP_DIR"
echo ""

# 重啟 Docker 容器
echo "🔄 重啟 Docker 容器..."
docker-compose restart

echo ""
echo "⏳ 等待服務啟動..."
sleep 5

# 檢查服務狀態
echo ""
echo "🔍 檢查服務狀態..."
docker-compose ps

echo ""
echo "================================"
echo "✅ 部署完成！"
echo "================================"
echo ""
echo "📱 測試步驟："
echo "1. 在手機 A 開啟行事曆並進行學生簽到"
echo "2. 在手機 B 重新載入頁面或開啟課程"
echo "3. 確認手機 B 能立即看到手機 A 的簽到結果"
echo ""
echo "🔍 檢查方式："
echo "- 打開瀏覽器開發者工具 > Network"
echo "- 觀察 student_data.json 請求的 Cache-Control header"
echo "- 應該顯示: no-store, no-cache, must-revalidate, private"
echo ""
echo "📊 查看日誌："
echo "docker-compose logs -f --tail=100"
echo ""

