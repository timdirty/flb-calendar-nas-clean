#!/bin/bash
# 🚀 立即部署 - 智能視圖切換功能
# 版本：2025-01-16-SMART-VIEW-SWITCH
# 功能：電腦端點擊日曆課程時，自動切換到最小適合視圖並定位課程

echo "🚀 開始部署智能視圖切換功能..."
echo "================================================"
echo ""

# 設定變數
PROJECT_DIR="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
NAS_PROJECT_DIR="/volume1/docker/flb-calendar-nas"

echo "📦 專案目錄: $PROJECT_DIR"
echo "🌐 NAS 目錄: $NAS_PROJECT_DIR"
echo ""

# 檢查是否在正確的目錄
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 錯誤：找不到專案目錄"
    exit 1
fi

cd "$PROJECT_DIR"

echo "📝 功能說明："
echo "  ✅ 電腦端點擊日曆課程時自動切換視圖"
echo "  ✅ 智能判斷最小適合視圖（今日/本週/本月/全部）"
echo "  ✅ 課程在3個月內優先使用月視圖"
echo "  ✅ 自動更新視圖日期到課程所在月份"
echo "  ✅ 視圖切換完成後自動滾動並高亮課程"
echo "  ✅ 手機端保持原有行為（不自動切換）"
echo ""

echo "📋 更新內容："
echo "  1. 修改 main.js - highlightEventCardFromCalendar 函數"
echo "  2. 新增 autoSwitchViewForEvent 智能視圖切換函數"
echo "  3. 更新 HTML 版本註釋"
echo ""

# 複製檔案到 NAS
echo "🔄 開始複製檔案到 NAS..."
echo ""

# 確保 NAS 目錄存在
if ssh nas "[ -d $NAS_PROJECT_DIR ]"; then
    echo "✅ NAS 專案目錄存在"
else
    echo "❌ 錯誤：NAS 專案目錄不存在"
    echo "💡 提示：請確認 Docker 容器是否正確設置"
    exit 1
fi

# 複製 HTML 檔案
echo "📄 複製 HTML 檔案..."
scp public/perfect-calendar-modular.html nas:$NAS_PROJECT_DIR/public/
if [ $? -eq 0 ]; then
    echo "✅ HTML 檔案已複製"
else
    echo "❌ HTML 檔案複製失敗"
    exit 1
fi

# 複製 main.js 檔案
echo "📄 複製 main.js 檔案..."
scp public/js/main.js nas:$NAS_PROJECT_DIR/public/js/
if [ $? -eq 0 ]; then
    echo "✅ main.js 檔案已複製"
else
    echo "❌ main.js 檔案複製失敗"
    exit 1
fi

echo ""
echo "🔄 重啟 Docker 容器..."
ssh nas "cd $NAS_PROJECT_DIR && docker-compose restart"

if [ $? -eq 0 ]; then
    echo "✅ Docker 容器已重啟"
else
    echo "❌ Docker 容器重啟失敗"
    exit 1
fi

echo ""
echo "⏳ 等待服務啟動..."
sleep 5

echo ""
echo "🎉 部署完成！"
echo "================================================"
echo ""
echo "✨ 新功能使用說明："
echo ""
echo "📱 電腦端："
echo "  1. 在日曆（週視圖或月視圖）中點擊任意課程方塊"
echo "  2. 如果課程不在當前視圖範圍內："
echo "     → 系統自動判斷課程所在的最小視圖"
echo "     → 自動切換視圖（今日/本週/本月/全部）"
echo "     → 如果是其他月份，自動跳轉到該月份"
echo "     → 自動滾動並高亮該課程"
echo "  3. 如果課程在當前視圖範圍內："
echo "     → 直接滾動並高亮該課程（原有行為）"
echo ""
echo "📱 手機端："
echo "  → 保持原有行為（不自動切換視圖）"
echo "  → 顯示提示訊息引導用戶手動切換"
echo ""
echo "🎯 智能切換邏輯："
echo "  → 今日課程 → 切換到「今日」視圖"
echo "  → 本週課程 → 切換到「本週」視圖"
echo "  → 本月課程 → 切換到「本月」視圖"
echo "  → 3個月內其他月份 → 切換到該月份的「月」視圖"
echo "  → 超過3個月 → 切換到「全部」視圖"
echo ""
echo "🌐 訪問網址："
echo "  https://course-viewer.funlearnbar.synology.me"
echo ""
echo "💡 測試建議："
echo "  1. 切換到「本週」視圖"
echo "  2. 在日曆中點擊下個月的課程"
echo "  3. 觀察系統是否自動切換到該月份"
echo "  4. 檢查課程是否正確高亮和滾動"
echo ""
echo "📊 查看日誌："
echo "  ssh nas 'cd $NAS_PROJECT_DIR && docker-compose logs -f --tail=50'"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成"

