#!/bin/bash

# 前端更新部署腳本
echo "📦 準備部署前端更新..."

# 檢查文件是否存在
if [ ! -f "public/perfect-calendar-optimized-complete.html" ]; then
    echo "❌ 找不到前端文件"
    exit 1
fi

echo "📄 文件資訊:"
ls -lh public/perfect-calendar-optimized-complete.html

echo ""
echo "🚀 請在 NAS 上執行以下命令："
echo "========================================"
echo "cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
echo "./scripts/quick-restart.sh"
echo "========================================"
echo ""
echo "💡 提示："
echo "1. Synology Drive 會自動同步文件到 NAS"
echo "2. 執行 quick-restart.sh 重啟 Docker 容器"
echo "3. 在瀏覽器中按 Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows) 強制刷新"

