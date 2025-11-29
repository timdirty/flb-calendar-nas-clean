#!/bin/bash
# 強制重新部署到 NAS（解決同步延遲問題）

echo "🚀 強制重新部署到 NAS"
echo "================================"
echo ""

# NAS 連線資訊
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_USER="root"
NAS_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

echo "📋 步驟："
echo "  1. 檢查文件同步狀態"
echo "  2. 強制重啟 Docker 容器"
echo "  3. 查看最新日誌"
echo ""

echo "🔄 正在連接到 NAS..."
ssh -p $NAS_PORT $NAS_USER@$NAS_HOST << 'ENDSSH'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo ""
echo "📁 檢查關鍵文件..."
echo "================================"
ls -lh server.js synology-calendar-client.js public/perfect-calendar-optimized-complete.html | tail -3

echo ""
echo "🔄 重啟 Docker 容器..."
echo "================================"
sudo docker-compose restart

echo ""
echo "⏳ 等待容器重啟..."
sleep 5

echo ""
echo "📊 查看最新日誌..."
echo "================================"
sudo docker-compose logs --tail=50 | grep -E "調試|事件|成功|錯誤|uid|title"

echo ""
echo "✅ 部署完成！"
echo ""
ENDSSH

echo ""
echo "================================"
echo "下一步："
echo "================================"
echo "1. 在瀏覽器中強制刷新: Cmd+Shift+R"
echo "2. 在控制台執行測試："
echo ""
echo "   fetch('/api/events')"
echo "     .then(res => res.json())"
echo "     .then(data => {"
echo "       const sample = data.data[0];"
echo "       console.log('樣本事件:', {"
echo "         id: sample.id,"
echo "         title: sample.title,"
echo "         instructor: sample.instructor"
echo "       });"
echo "     });"
echo ""

