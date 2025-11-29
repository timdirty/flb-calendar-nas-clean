#!/bin/bash
# 🚀 立即部署 - 懸浮選單邏輯修正
# 版本：2025-01-16-FLOATING-MENU-FIX
# 功能：修正手機端懸浮選單顯示邏輯，當視圖按鈕（今日/本週/本月/全部）離開視窗時自動顯示

echo "🚀 開始部署懸浮選單邏輯修正..."
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

echo "📝 修正說明："
echo "  ✅ 修改懸浮選單顯示邏輯"
echo "  ✅ 當視圖按鈕（今日/本週/本月/全部）消失時自動顯示"
echo "  ✅ 不再需要等到課程卡片碰到上方"
echo "  ✅ 僅在手機端（≤ 768px）啟用"
echo "  ✅ 添加調試日誌方便追蹤"
echo ""

echo "🎯 新邏輯："
echo "  • 偵測視圖按鈕（.view-buttons）位置"
echo "  • 當視圖按鈕底部 < 0（離開視窗頂部）時顯示懸浮選單"
echo "  • 當視圖按鈕回到視窗內時隱藏懸浮選單"
echo "  • 電腦端不顯示懸浮選單"
echo ""

echo "📋 更新內容："
echo "  1. 修改 main.js - initializeFloatingMenu 函數"
echo "  2. 簡化判斷邏輯，移除今日課程檢查"
echo "  3. 添加初始化檢查"
echo "  4. 添加調試日誌"
echo "  5. 更新 HTML 版本註釋"
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
echo "✨ 使用說明："
echo ""
echo "📱 手機端測試步驟："
echo "  1. 用手機打開網站（或調整瀏覽器寬度 < 768px）"
echo "  2. 向下滾動頁面"
echo "  3. 當「今日/本週/本月/全部」按鈕消失時"
echo "  4. 懸浮選單會自動出現在螢幕頂部"
echo ""
echo "🔍 調試方法："
echo "  1. 打開瀏覽器開發者工具（F12）"
echo "  2. 切換到 Console 面板"
echo "  3. 滾動頁面時會看到日誌："
echo "     • 🎬 初始化懸浮選單..."
echo "     • 📍 懸浮選單狀態變化..."
echo "     • ✅ 懸浮選單已顯示"
echo "     • ❌ 懸浮選單已隱藏"
echo ""
echo "💻 電腦端："
echo "  • 懸浮選單不會出現（視窗寬度 > 768px）"
echo ""
echo "🎯 預期行為："
echo ""
echo "  滾動前（視圖按鈕可見）："
echo "  ┌──────────────────────┐"
echo "  │ [今日][本週][本月][全部] │"
echo "  │                      │"
echo "  │ 今日課程區塊          │"
echo "  │                      │"
echo "  │ 課程卡片列表          │"
echo "  └──────────────────────┘"
echo ""
echo "  滾動後（視圖按鈕消失）："
echo "  ┌──────────────────────┐"
echo "  │ [懸浮選單] 🔼         │ ← 自動出現"
echo "  ├──────────────────────┤"
echo "  │ 今日課程區塊          │"
echo "  │                      │"
echo "  │ 課程卡片列表          │"
echo "  └──────────────────────┘"
echo ""
echo "🌐 訪問網址："
echo "  https://course-viewer.funlearnbar.synology.me"
echo ""
echo "💡 如果懸浮選單沒有出現，請："
echo "  1. 清除瀏覽器快取（Ctrl+Shift+R / Cmd+Shift+R）"
echo "  2. 查看 Console 日誌確認元素是否正確找到"
echo "  3. 確認視窗寬度是否 ≤ 768px"
echo ""
echo "📊 查看日誌："
echo "  ssh nas 'cd $NAS_PROJECT_DIR && docker-compose logs -f --tail=50'"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成"

