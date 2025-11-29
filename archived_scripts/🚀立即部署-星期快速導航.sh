#!/bin/bash
# 🚀 立即部署 - 手機端懸浮選單星期快速導航
# 版本：2025-01-16-WEEKDAY-NAV
# 功能：在非今日視圖時，懸浮選單顯示一二三四五六日快速導航按鈕

echo "🚀 開始部署星期快速導航功能..."
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
echo "  ✅ 在懸浮選單添加星期快速導航（日一二三四五六）"
echo "  ✅ 只在非今日視圖時顯示"
echo "  ✅ 根據視圖範圍自動更新星期按鈕狀態"
echo "  ✅ 有課程的星期會高亮顯示"
echo "  ✅ 無課程的星期變暗並無法點擊"
echo "  ✅ 點擊星期按鈕快速滾動到該天的第一個課程"
echo ""

echo "🎯 顯示邏輯："
echo "  • 今日視圖：隱藏星期導航"
echo "  • 本週視圖：顯示星期導航，根據本週課程更新狀態"
echo "  • 本月視圖：顯示星期導航，根據本月課程更新狀態"
echo "  • 全部視圖：顯示星期導航，根據所有課程更新狀態"
echo ""

echo "🎨 視覺設計："
echo "  • 星期按鈕：圓形設計"
echo "  • 有課程：金色邊框和背景，顯示課程數量"
echo "  • 無課程：灰色半透明，無法點擊"
echo "  • 今天：金色高亮"
echo "  • 手機端：自動換行，平均分布"
echo ""

echo "📋 更新內容："
echo "  1. 修改 HTML - 添加星期導航區塊"
echo "  2. 修改 CSS - 添加星期按鈕樣式"
echo "  3. 修改 main.js - 添加星期導航邏輯"
echo "  4. 更新版本註釋"
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

# 複製 CSS 檔案
echo "📄 複製 styles.css 檔案..."
scp public/css/styles.css nas:$NAS_PROJECT_DIR/public/css/
if [ $? -eq 0 ]; then
    echo "✅ styles.css 檔案已複製"
else
    echo "❌ styles.css 檔案複製失敗"
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
echo "  2. 切換到「本週」、「本月」或「全部」視圖"
echo "  3. 向下滾動，當視圖按鈕消失時懸浮選單出現"
echo "  4. 懸浮選單會顯示「日一二三四五六」按鈕"
echo "  5. 有課程的星期會有金色邊框"
echo "  6. 點擊星期按鈕會滾動到該天的第一個課程"
echo ""
echo "🔍 功能演示："
echo ""
echo "  懸浮選單（本週視圖）："
echo "  ┌──────────────────────────────────┐"
echo "  │ [今日][本週][本月][全部]          │"
echo "  ├──────────────────────────────────┤"
echo "  │ [日][一][二][三][四][五][六]      │"
echo "  │  灰  金  金  金  灰  金  灰       │"
echo "  └──────────────────────────────────┘"
echo "  說明：金色=有課程，灰色=無課程"
echo ""
echo "  點擊「二」後："
echo "  • 自動滾動到星期二的第一個課程"
echo "  • 星期二的所有課程會高亮顯示"
echo "  • 其他課程變暗"
echo "  • 3秒後自動取消高亮"
echo ""
echo "💻 電腦端："
echo "  • 懸浮選單不會出現"
echo "  • 星期導航僅在手機端顯示"
echo ""
echo "🎯 視圖切換效果："
echo "  • 今日視圖：星期導航隱藏"
echo "  • 本週視圖：星期導航顯示，計算本週課程"
echo "  • 本月視圖：星期導航顯示，計算本月課程"
echo "  • 全部視圖：星期導航顯示，計算所有課程"
echo ""
echo "🌐 訪問網址："
echo "  https://course-viewer.funlearnbar.synology.me"
echo ""
echo "💡 測試建議："
echo "  1. 切換到本週視圖"
echo "  2. 向下滾動到懸浮選單出現"
echo "  3. 查看星期按鈕狀態（哪些天有課程）"
echo "  4. 點擊有課程的星期按鈕"
echo "  5. 確認是否滾動到該天的第一個課程"
echo ""
echo "🔍 調試方法："
echo "  打開 Console (F12) 查看日誌："
echo "  • ✅ 星期快速導航已初始化"
echo "  • 📅 非今日視圖：顯示星期導航"
echo "  • 📅 星期導航狀態已更新: [2, 3, 5, 2, 1, 4, 0]"
echo "  • 📅 點擊星期: 2"
echo "  • 🎯 滾動到星期二的第一個課程"
echo ""
echo "📊 查看日誌："
echo "  ssh nas 'cd $NAS_PROJECT_DIR && docker-compose logs -f --tail=50'"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成"

