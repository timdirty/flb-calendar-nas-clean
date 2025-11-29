#!/bin/bash

echo "🔄 重啟 Synology Drive（套用 .syncignore 設定）"
echo "================================================"
echo ""

# 確認 .syncignore 存在
if [ -f ".syncignore" ]; then
    echo "✅ .syncignore 檔案存在"
    echo ""
    echo "📋 忽略清單內容："
    cat .syncignore | grep -v "^#" | grep -v "^$" | sed 's/^/   - /'
    echo ""
else
    echo "❌ .syncignore 檔案不存在"
    exit 1
fi

# 關閉 Synology Drive Client
echo "1️⃣ 關閉 Synology Drive Client..."
osascript -e 'quit app "Synology Drive Client"' 2>/dev/null

# 等待關閉
sleep 3

# 檢查是否已關閉
if pgrep -i "synology" > /dev/null; then
    echo "   ⚠️  Synology Drive Client 仍在執行中，強制關閉..."
    killall "Synology Drive Client" 2>/dev/null
    killall "synologydrive" 2>/dev/null
    sleep 2
fi

echo "   ✅ 已關閉"
echo ""

# 重新啟動
echo "2️⃣ 啟動 Synology Drive Client..."
open -a "Synology Drive Client"

sleep 3
echo "   ✅ 已啟動"
echo ""

echo "✅ 完成！"
echo ""
echo "📋 後續檢查："
echo "   1. 等待 10-20 秒讓 Synology Drive 完全載入"
echo "   2. 檢查 FETCH_HEAD 是否還出現在更新清單中"
echo "   3. 如果還出現，請查看下方的手動設定方法"
echo ""
echo "💡 如果 .syncignore 未生效："
echo "   可能需要在 Synology Drive 設定中手動指定忽略模式"
echo "   或者使用 .gitignore 檔案（Synology Drive 也會參考它）"

