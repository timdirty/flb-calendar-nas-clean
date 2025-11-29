#!/bin/bash

echo "🚀 手動同步前端文件到 NAS..."
echo ""

# 本地文件路径
LOCAL_FILE="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/perfect-calendar-optimized-complete.html"

# NAS 目标路径
REMOTE_PATH="ctctim14@funlearnbar.synology.me:/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/"

echo "📂 本地文件: $LOCAL_FILE"
ls -lh "$LOCAL_FILE"
echo ""

echo "🔐 请输入 NAS 密码..."
scp "$LOCAL_FILE" "$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 文件上传成功！"
    echo ""
    echo "📋 下一步："
    echo "1. SSH 到 NAS: ssh ctctim14@funlearnbar.synology.me"
    echo "2. 执行: cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
    echo "3. 执行: ./scripts/quick-restart.sh"
    echo "4. 在浏览器中按 Cmd+Shift+R 强制刷新"
else
    echo ""
    echo "❌ 上传失败，请检查密码或网络连接"
fi

