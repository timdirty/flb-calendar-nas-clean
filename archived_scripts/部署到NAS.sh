#!/bin/bash

# 補課/體驗學生管理功能 - 部署到 NAS
# 執行方式：在 NAS 的 SSH 中運行此腳本

echo "🚀 開始部署補課/體驗學生管理功能..."

# 1. 進入專案目錄
cd /volume1/web/flb-calendar-nas || {
  echo "❌ 找不到專案目錄"
  exit 1
}

echo "📂 當前目錄: $(pwd)"

# 2. 檢查必要文件
echo "🔍 檢查必要檔案..."

if [ ! -f "server.js" ]; then
  echo "❌ server.js 不存在"
  exit 1
fi

if [ ! -f "public/admin-dashboard.html" ]; then
  echo "❌ admin-dashboard.html 不存在"
  exit 1
fi

echo "✅ 必要檔案檢查完成"

# 3. 建立臨時學生資料檔案（如果不存在）
if [ ! -f "public/temporary_students.json" ]; then
  echo "📝 建立 temporary_students.json..."
  cat > public/temporary_students.json << 'EOF'
{
  "students": []
}
EOF
  chmod 644 public/temporary_students.json
  echo "✅ temporary_students.json 已建立"
else
  echo "✅ temporary_students.json 已存在"
fi

# 4. 檢查 Docker Compose 配置
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml 不存在"
  exit 1
fi

# 5. 重啟 Docker 服務
echo "🔄 重啟 Docker 服務..."
sudo docker-compose down
sudo docker-compose up -d

# 6. 等待服務啟動
echo "⏳ 等待服務啟動..."
sleep 5

# 7. 檢查服務狀態
echo "🔍 檢查服務狀態..."
sudo docker-compose ps

# 8. 測試新 API 端點
echo "🧪 測試臨時學生 API..."
sleep 2

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/temporary-students)

if [ "$RESPONSE" = "200" ]; then
  echo "✅ API 測試成功！臨時學生功能已正常運作"
else
  echo "❌ API 測試失敗 (HTTP $RESPONSE)"
  echo "📋 查看日誌："
  sudo docker-compose logs --tail=50
  exit 1
fi

# 9. 顯示完成訊息
echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 新功能："
echo "  - 補課學生管理"
echo "  - 體驗學生管理"
echo "  - 臨時學生自動清理（每日凌晨 2:00）"
echo ""
echo "🌐 請訪問："
echo "  https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo "  點擊「補課/體驗學生」頁籤開始使用"
echo ""
echo "📊 查看即時日誌："
echo "  sudo docker-compose logs -f"
echo ""

