#!/bin/bash

echo "======================================"
echo "🔧 修復 Synology Drive 同步問題"
echo "======================================"
echo ""

# 目標檔案
FILE="public/perfect-calendar-optimized-complete.html"

# 檢查檔案是否存在
if [ ! -f "$FILE" ]; then
    echo "❌ 錯誤：找不到檔案 $FILE"
    exit 1
fi

echo "📁 目標檔案：$FILE"
echo ""

# 顯示當前狀態
echo "📊 當前檔案狀態："
ls -lh@ "$FILE"
echo ""

# 1. 移除 macOS 壓縮屬性
echo "1️⃣  移除 macOS 壓縮屬性..."
xattr -d com.apple.decmpfs "$FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 已移除壓縮屬性"
else
    echo "   ℹ️  沒有壓縮屬性（或已移除）"
fi

# 2. 移除隔離屬性
echo "2️⃣  移除隔離屬性..."
xattr -d com.apple.quarantine "$FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 已移除隔離屬性"
else
    echo "   ℹ️  沒有隔離屬性（或已移除）"
fi

# 3. 確保權限正確
echo "3️⃣  修正檔案權限..."
chmod 644 "$FILE"
echo "   ✅ 權限已設為 644"

# 4. 觸發重新同步
echo "4️⃣  觸發 Synology Drive 重新同步..."
touch "$FILE"
echo "   ✅ 已更新檔案時間戳"

echo ""
echo "======================================"
echo "✅ 修復完成！"
echo "======================================"
echo ""

# 顯示修復後狀態
echo "📊 修復後檔案狀態："
ls -lh@ "$FILE"
echo ""

echo "⏳ 請等待 10-30 秒讓 Synology Drive 同步檔案"
echo ""

# 提供檢查指令
echo "🔍 檢查同步狀態（執行以下指令）："
echo "   ssh flbadmin@192.168.50.139 'ls -lh /volume1/docker/flb-calendar/public/perfect-calendar-optimized-complete.html'"
echo ""

# 提供備用方案
echo "💡 如果仍未同步，可以使用 SCP 直接上傳："
echo "   ./🚀立即測試-效能優化.sh"
echo ""
echo "======================================"

