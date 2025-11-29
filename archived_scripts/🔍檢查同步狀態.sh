#!/bin/bash

echo "🔍 檢查 Synology Drive 同步狀態"
echo "================================"
echo ""

# 目標檔案
FILE="public/perfect-calendar-optimized-complete.html"

echo "📁 檔案：$FILE"
echo ""

# 1. 檢查檔案是否存在且可讀
if [ ! -f "$FILE" ]; then
    echo "❌ 檔案不存在！"
    exit 1
fi

# 2. 檢查檔案大小
SIZE=$(ls -lh "$FILE" | awk '{print $5}')
echo "📊 檔案大小：$SIZE"

# 3. 檢查權限
PERMS=$(ls -l "$FILE" | awk '{print $1}')
echo "🔒 檔案權限：$PERMS"

# 4. 檢查擴展屬性
echo ""
echo "🏷️  擴展屬性："
ATTRS=$(xattr "$FILE" 2>/dev/null)
if [ -z "$ATTRS" ]; then
    echo "   ✅ 無擴展屬性"
else
    echo "$ATTRS" | while read attr; do
        echo "   - $attr"
    done
fi

# 5. 檢查最後修改時間
echo ""
echo "⏰ 最後修改："
stat -f "   %Sm" -t "%Y-%m-%d %H:%M:%S" "$FILE"

# 6. 檢查檔案內容（前 3 行和後 3 行）
echo ""
echo "📄 檔案內容檢查："
echo "   前 3 行："
head -3 "$FILE" | sed 's/^/   /'
echo "   ..."
echo "   後 3 行："
tail -3 "$FILE" | sed 's/^/   /'

echo ""
echo "================================"
echo ""
echo "💡 診斷建議："
echo ""
echo "如果檔案在 Synology Drive 中顯示「線上存取」："
echo ""
echo "1️⃣ 手動固定檔案："
echo "   - 在 Synology Drive 中右鍵點擊檔案"
echo "   - 選擇「保留在此裝置上」"
echo ""
echo "2️⃣ 關閉智慧同步："
echo "   - 開啟 Synology Drive 偏好設定"
echo "   - 前往「進階」→「智慧同步」"
echo "   - 取消勾選或調整設定"
echo ""
echo "3️⃣ 使用部署腳本直接上傳："
echo "   ./scripts/sync-to-nas.sh"
echo ""


