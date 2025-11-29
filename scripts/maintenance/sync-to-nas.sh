#!/bin/bash
# 同步本地檔案到 NAS 並重啟服務

echo "🚀 開始同步檔案到 NAS..."
echo ""

# NAS 配置
NAS_USER="ctctim14"
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 本地路徑
LOCAL_PATH="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

echo "📂 同步前端檔案 (public/)..."
rsync -avz --progress -e "ssh -p $NAS_PORT" \
    "$LOCAL_PATH/public/" \
    "$NAS_USER@$NAS_HOST:$NAS_PATH/public/"

echo ""
echo "📂 同步後端檔案..."
rsync -avz --progress -e "ssh -p $NAS_PORT" \
    --include="*.js" \
    --include="*.json" \
    --exclude="node_modules/" \
    --exclude="logs/" \
    --exclude="archive/" \
    --exclude="backups/" \
    "$LOCAL_PATH/" \
    "$NAS_USER@$NAS_HOST:$NAS_PATH/"

echo ""
echo "🔄 重啟 Docker 服務..."
ssh -p $NAS_PORT "$NAS_USER@$NAS_HOST" << 'EOF'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
sudo docker-compose restart
echo ""
echo "⏳ 等待服務啟動..."
sleep 5
echo ""
echo "📋 查看日誌..."
sudo docker-compose logs --tail=30
EOF

echo ""
echo "✅ 同步完成！"
echo ""
echo "📍 訪問網址:"
echo "   管理控制台: https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo "   行事曆: https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete.html"
echo "   主頁: https://calendar.funlearnbar.synology.me/"





