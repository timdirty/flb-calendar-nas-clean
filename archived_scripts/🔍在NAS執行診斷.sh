#!/bin/bash
# 🔍 在NAS上執行事件時間診斷

echo "🔍 開始在NAS上診斷事件時間..."
echo ""

# 上傳診斷腳本到NAS
echo "📤 上傳診斷腳本到NAS..."
scp 診斷事件時間.js ftpuser@192.168.50.242:/volume1/docker/flb-calendar-nas/

echo "✅ 上傳完成"
echo ""

# 在NAS上執行診斷
echo "🔄 在NAS Docker容器中執行診斷..."
echo ""

ssh ftpuser@192.168.50.242 << 'ENDSSH'
cd /volume1/docker/flb-calendar-nas
docker exec flb-calendar-nas node 診斷事件時間.js
ENDSSH

echo ""
echo "✅ 診斷完成！"


