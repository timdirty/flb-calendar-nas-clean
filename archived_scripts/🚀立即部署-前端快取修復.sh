#!/bin/bash

echo "======================================"
echo "🔥 部署前端空快取修復"
echo "======================================"
echo ""

echo "📋 修復內容："
echo "  ✅ 智能快取驗證：自動忽略空快取"
echo "  ✅ 空快取自動清除"
echo "  ✅ 確保從後端獲取完整資料"
echo ""

echo "🔄 步驟 1/2: 強制同步 HTML 到 NAS..."
# 只同步 HTML 檔案，不需要重建 Docker
rsync -avz --progress \
  "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/perfect-calendar-optimized-complete2.html" \
  "ctctim14@funlearnbar.synology.me:/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/"

echo ""
echo "✅ HTML 同步完成"
echo ""

echo "🔄 步驟 2/2: 驗證檔案..."
ssh ctctim14@funlearnbar.synology.me "ls -lh /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/public/perfect-calendar-optimized-complete2.html"

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "📱 測試步驟："
echo "  1. 在 LINE 中開啟行事曆"
echo "  2. 清除瀏覽器快取（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "  3. 或點選右下角重新整理按鈕（長按 3 秒完全重置）"
echo "  4. 應該會自動顯示 216 個事件"
echo ""
echo "🔍 預期行為："
echo "  ✅ 正常打開就顯示完整課程（不再是 0 堂課）"
echo "  ✅ 不需要按重新整理按鈕"
echo "  ✅ 自動從後端獲取資料"
echo ""

