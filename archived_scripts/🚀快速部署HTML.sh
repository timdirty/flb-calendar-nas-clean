#!/bin/bash

echo "🚀 快速部署 HTML 到 NAS"
echo "====================================="
echo ""

# NAS 配置
NAS_USER="ctctim14"
NAS_HOST="funlearnbar.synology.me"
NAS_PORT="1022"
NAS_PATH="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public"

# 本地檔案
LOCAL_FILE="public/perfect-calendar-optimized-complete.html"

# 檢查檔案是否存在
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ 錯誤：找不到檔案 $LOCAL_FILE"
    exit 1
fi

# 顯示檔案資訊
echo "📁 準備上傳："
ls -lh "$LOCAL_FILE"
echo ""

# 使用 SCP 上傳
echo "📤 上傳中..."
scp -P $NAS_PORT "$LOCAL_FILE" "$NAS_USER@$NAS_HOST:$NAS_PATH/"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "🌐 訪問網址："
    echo "   https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete.html"
    echo ""
    echo "💡 提示：如果看不到更新，請："
    echo "   1. 清除瀏覽器快取（Cmd+Shift+R）"
    echo "   2. 等待 10 秒後重新整理"
else
    echo ""
    echo "❌ 上傳失敗"
    echo ""
    echo "請檢查："
    echo "  1. 網路連線是否正常"
    echo "  2. SSH 金鑰是否已設定"
    echo "  3. NAS 是否正在執行"
    echo ""
    echo "或使用完整部署腳本："
    echo "  ./scripts/sync-to-nas.sh"
fi


