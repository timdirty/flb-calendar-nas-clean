#!/bin/bash
# 🚀 立即部署 - 手機端今日課程字體優化
# 版本：2025-01-16-MOBILE-FONT-FIX
# 功能：縮小手機端今日課程字體，確保標題在一行內顯示

echo "🚀 開始部署手機端字體優化..."
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

echo "📝 優化說明："
echo "  ✅ 縮小手機端今日課程標題字體（1rem → 0.85rem）"
echo "  ✅ 標題強制單行顯示，超出部分顯示省略號"
echo "  ✅ 縮小時間字體（0.85rem → 0.75rem）"
echo "  ✅ 縮小講師資訊字體（0.85rem → 0.75rem）"
echo "  ✅ 減少卡片內邊距以節省空間"
echo "  ✅ 調整課程數量標籤字體大小"
echo ""

echo "🎯 樣式調整："
echo "  • 標題：white-space: nowrap（不換行）"
echo "  • 標題：overflow: hidden（隱藏溢出）"
echo "  • 標題：text-overflow: ellipsis（省略號）"
echo "  • 卡片內邊距：14px 18px → 12px 14px"
echo "  • 時間寬度：80px → 70px"
echo ""

echo "📋 更新內容："
echo "  1. 修改 styles.css - 手機端響應式樣式"
echo "  2. 更新 HTML 版本註釋"
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
echo "✨ 優化效果："
echo ""
echo "📱 手機端今日課程顯示："
echo "  • 標題字體縮小，更容易在一行內顯示"
echo "  • 過長標題自動顯示省略號（...）"
echo "  • 整體視覺更緊湊，節省螢幕空間"
echo "  • 時間和講師資訊字體協調縮小"
echo ""
echo "💻 電腦端："
echo "  • 不受影響，保持原有字體大小"
echo ""
echo "🔍 對比效果："
echo ""
echo "  修改前："
echo "  ┌─────────────────────────────────┐"
echo "  │ 09:00  超級無敵長的課程標題名稱    │"
echo "  │        可能會換行顯示講師資訊      │"
echo "  └─────────────────────────────────┘"
echo ""
echo "  修改後："
echo "  ┌─────────────────────────────────┐"
echo "  │ 09:00  超級無敵長的課程標題...    │"
echo "  │        👨‍🏫 Tim 老師              │"
echo "  └─────────────────────────────────┘"
echo ""
echo "🌐 訪問網址："
echo "  https://course-viewer.funlearnbar.synology.me"
echo ""
echo "💡 測試建議："
echo "  1. 用手機或調整瀏覽器視窗寬度 < 768px"
echo "  2. 查看「今日課程」區塊"
echo "  3. 確認標題是否都在一行內顯示"
echo "  4. 查看長標題是否正確顯示省略號"
echo ""
echo "📊 查看日誌："
echo "  ssh nas 'cd $NAS_PROJECT_DIR && docker-compose logs -f --tail=50'"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成"

