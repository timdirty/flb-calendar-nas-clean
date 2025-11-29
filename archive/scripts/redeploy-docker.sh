#!/bin/bash
#cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
echo "🚀 開始重新部署 FLB 講師行事曆 Docker 服務..."

# 載入環境變數
if [ -f .env.nas ]; then
    echo "📋 載入環境變數..."
    # 安全地載入環境變數，過濾空行和註解
    while IFS= read -r line; do
        # 跳過空行和註解行
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            # 檢查是否包含等號
            if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
                export "$line"
            fi
        fi
    done < .env.nas
    echo "✅ 環境變數已載入："
    echo "  - CALDAV_URL: $CALDAV_URL"
    echo "  - CALDAV_USERNAME: $CALDAV_USERNAME"
    echo "  - LIFF_CLIENT_ID: $LIFF_CLIENT_ID"
    echo "  - PORT: $PORT"
else
    echo "⚠️ 未找到 .env.nas 文件，使用預設值"
    export PORT=3000
fi

# 停止現有容器
echo "🛑 停止現有容器..."
sudo docker-compose down

# 清理舊的映像（可選）
echo "🧹 清理舊的 Docker 映像..."
sudo docker system prune -f

# 重新構建映像
echo "🔨 重新構建 Docker 映像..."
sudo docker-compose build --no-cache

# 啟動服務
echo "🚀 啟動服務..."
sudo docker-compose up -d

# 等待服務啟動
echo "⏳ 等待服務啟動..."

sleep 10

# 檢查服務狀態
echo "🔍 檢查服務狀態..."
sudo docker-compose ps

# 檢查健康狀態
echo "🏥 檢查健康狀態..."
for i in {1..5}; do
    if curl -s http://localhost:${PORT:-3000}/api/health > /dev/null; then
        echo "✅ 服務健康檢查通過！"
        break
    else
        echo "⏳ 等待服務啟動... ($i/5)"
        sleep 5
    fi
done

# 顯示日誌
echo "📋 顯示服務日誌..."
sudo docker-compose logs --tail=20

# 顯示訪問信息
echo ""
echo "🎉 重新部署完成！"
echo "📋 服務信息："
echo "  - 本地訪問: http://localhost:${PORT:-3000}"
echo "  - 外部訪問: https://calendar.funlearnbar.synology.me"
echo "  - 健康檢查: http://localhost:${PORT:-3000}/api/health"
echo ""
echo "🔧 常用命令："
echo "  - 查看日誌: sudo docker-compose logs -f"
echo "  - 停止服務: sudo docker-compose down"
echo "  - 重啟服務: sudo docker-compose restart"
echo "  - 查看狀態: sudo docker-compose ps"
