#!/bin/bash
# 遠程重啟 NAS 上的 Docker 服務

echo "🚀 準備遠程重啟 NAS 上的 Docker 服務..."

# NAS 配置（請根據實際情況修改）
NAS_HOST="funlearnbar.synology.me"
NAS_USER="ctctim14"  # 或您的 NAS 管理員帳號
NAS_PROJECT_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 檢查是否需要輸入密碼
echo "📡 連接到 NAS: $NAS_HOST"
echo "👤 使用帳號: $NAS_USER"
echo "📁 項目路徑: $NAS_PROJECT_PATH"
echo ""
echo "⚠️  請準備好 NAS 登入密碼..."
echo ""

# 通過 SSH 執行重啟指令
ssh ${NAS_USER}@${NAS_HOST} << 'ENDSSH'
echo "✅ 已連接到 NAS"
echo "📂 切換到項目目錄..."

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 檢查 .env.nas 文件..."
if [ -f .env.nas ]; then
    echo "✅ .env.nas 文件存在"
    cat .env.nas | grep -v PASSWORD
else
    echo "❌ .env.nas 文件不存在！"
fi

echo ""
echo "🛑 停止當前容器..."
sudo docker-compose down

echo ""
echo "🔨 重新構建映像..."
sudo docker-compose build --no-cache

echo ""
echo "🚀 啟動服務..."
sudo docker-compose up -d

echo ""
echo "⏳ 等待服務啟動（10秒）..."
sleep 10

echo ""
echo "🔍 檢查容器狀態..."
sudo docker-compose ps

echo ""
echo "📋 檢查最新日誌..."
sudo docker-compose logs --tail=50

echo ""
echo "✅ 部署完成！"
ENDSSH

echo ""
echo "🎉 遠程部署完成！"
echo ""
echo "💡 提示："
echo "  - 請檢查上方日誌確認服務正常運行"
echo "  - 如果需要查看即時日誌，執行："
echo "    ssh ${NAS_USER}@${NAS_HOST} 'cd ${NAS_PROJECT_PATH} && sudo docker-compose logs -f'"
echo ""


