#!/bin/bash
# 部署 Synology Calendar API 更新到 NAS

echo "🚀 開始部署 Synology Calendar API 更新..."
echo ""

# 確認文件存在
echo "📋 檢查必要文件..."
if [ ! -f "synology-calendar-client.js" ]; then
    echo "❌ 找不到 synology-calendar-client.js"
    exit 1
fi

if [ ! -f ".env.nas" ]; then
    echo "❌ 找不到 .env.nas"
    exit 1
fi

echo "✅ 所有必要文件都存在"
echo ""

# 顯示更新內容
echo "📦 本次更新內容："
echo "  ✅ 新增 Synology Calendar API 客戶端"
echo "  ✅ 更新環境變數配置"
echo "  ✅ 修改 server.js 使用新 API"
echo ""

# 檢查 SynologyDrive 同步狀態
echo "🔍 等待 SynologyDrive 同步文件到 NAS..."
echo "   （請確保 SynologyDrive 正在運行）"
echo ""
sleep 3

# 提示用戶
echo "⚠️  接下來需要連接到 NAS 重啟服務"
echo ""
echo "請選擇部署方式："
echo "  1) 自動通過 SSH 部署（需要密碼）"
echo "  2) 顯示手動部署指令（複製貼上到 SSH）"
echo "  3) 取消"
echo ""
read -p "請選擇 [1/2/3]: " choice

case $choice in
    1)
        echo ""
        echo "🔐 準備連接 NAS..."
        ./remote-redeploy.sh
        ;;
    2)
        echo ""
        echo "📋 請依序執行以下指令："
        echo ""
        echo "# 1. SSH 連接到 NAS"
        echo "ssh ctctim14@funlearnbar.synology.me"
        echo ""
        echo "# 2. 進入項目目錄"
        echo "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
        echo ""
        echo "# 3. 確認文件已同步"
        echo "ls -la synology-calendar-client.js .env.nas"
        echo ""
        echo "# 4. 重啟 Docker 服務"
        echo "sudo docker-compose down"
        echo "sudo docker-compose build --no-cache"
        echo "sudo docker-compose up -d"
        echo ""
        echo "# 5. 查看日誌"
        echo "sudo docker-compose logs -f"
        echo ""
        ;;
    *)
        echo "❌ 已取消部署"
        exit 0
        ;;
esac

echo ""
echo "🎉 部署腳本執行完成！"
echo ""
echo "📊 下一步："
echo "  1. 等待服務啟動（約 10-30 秒）"
echo "  2. 在瀏覽器中清除快取："
echo "     localStorage.clear();"
echo "     sessionStorage.clear();"
echo "     location.reload();"
echo "  3. 測試 API："
echo "     fetch('/api/events').then(r => r.json()).then(console.log)"
echo ""
echo "📚 詳細文檔：請參閱 SYNOLOGY_API_MIGRATION.md"
echo ""


