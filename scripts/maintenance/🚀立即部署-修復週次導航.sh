#!/bin/bash

echo "🚀 開始部署：修復懸浮視圖週次跳轉功能"
echo "=========================================="
echo ""
echo "📝 修改內容："
echo "  ✅ 修復 filterByWeekday 函數"
echo "  ✅ 先重新渲染當前視圖，再執行篩選"
echo "  ✅ 只查詢可見的課程卡片"
echo "  ✅ 修復滾動定位被懸浮選單遮擋的問題"
echo "  ✅ 添加詳細的調試日誌"
echo ""
echo "🎯 修復問題："
echo "  ❌ 修復前：點擊星期按鈕無法跳轉到正確的課程"
echo "  ✅ 修復後：正確篩選並滾動到該星期的課程"
echo ""
echo "=========================================="
echo ""

# 設定變數
NAS_HOST="192.168.50.38"
NAS_USER="flbadmin"
NAS_PATH="/volume1/docker/flb-calendar-nas"
LOCAL_PATH="/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 1. 備份舊版本
echo "📦 步驟 1/4: 備份 NAS 上的舊版本..."
ssh ${NAS_USER}@${NAS_HOST} "cd ${NAS_PATH} && cp public/js/main.js public/js/main.js.backup-before-weekday-nav-fix-$(date +%Y%m%d-%H%M%S)"

if [ $? -eq 0 ]; then
    echo "✅ 備份完成"
else
    echo "❌ 備份失敗"
    exit 1
fi

echo ""

# 2. 上傳修改後的檔案
echo "📤 步驟 2/4: 上傳修改後的 main.js..."
scp "${LOCAL_PATH}/public/js/main.js" ${NAS_USER}@${NAS_HOST}:${NAS_PATH}/public/js/

if [ $? -eq 0 ]; then
    echo "✅ 上傳完成"
else
    echo "❌ 上傳失敗"
    exit 1
fi

echo ""

# 3. 驗證修改
echo "🔍 步驟 3/4: 驗證修改內容..."
echo ""
echo "檢查 1: 確認修復了 filterByWeekday 函數"
FIX_COUNT=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '只查詢.*可見.*的課程卡片' ${NAS_PATH}/public/js/main.js")
echo "  修復標記出現次數: ${FIX_COUNT}"

if [ "$FIX_COUNT" -ge "1" ]; then
    echo "  ✅ 正確！已修復 filterByWeekday"
else
    echo "  ⚠️ 警告：未找到修復標記"
fi

echo ""
echo "檢查 2: 確認添加了 renderEvents() 調用"
RENDER_COUNT=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '先確保所有課程卡片都重新渲染' ${NAS_PATH}/public/js/main.js")
echo "  renderEvents 調用次數: ${RENDER_COUNT}"

if [ "$RENDER_COUNT" -ge "1" ]; then
    echo "  ✅ 正確！已添加重新渲染"
else
    echo "  ⚠️ 警告：未找到 renderEvents 調用"
fi

echo ""
echo "檢查 3: 確認修復了滾動定位"
SCROLL_FIX=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '計算懸浮選單的高度' ${NAS_PATH}/public/js/main.js")
echo "  滾動修復出現次數: ${SCROLL_FIX}"

if [ "$SCROLL_FIX" -ge "1" ]; then
    echo "  ✅ 正確！已修復滾動定位"
else
    echo "  ⚠️ 警告：未找到滾動修復"
fi

echo ""

# 4. 重啟 Docker 容器
echo "🔄 步驟 4/4: 重啟 Docker 容器..."
ssh ${NAS_USER}@${NAS_HOST} "cd ${NAS_PATH} && docker-compose restart"

if [ $? -eq 0 ]; then
    echo "✅ Docker 容器重啟成功"
else
    echo "❌ Docker 容器重啟失敗"
    exit 1
fi

echo ""
echo "=========================================="
echo "🎉 部署完成！"
echo ""
echo "📋 測試步驟："
echo "  1. 開啟 LINE LIFF（或 NAS 網址）"
echo "  2. 強制重新整理（Cmd+Shift+R 或清除快取）"
echo "  3. 切換到「本週」或「本月」視圖"
echo "  4. 點擊懸浮選單上的星期按鈕（例如：一、二、三...）"
echo "  5. 確認頁面滾動到該星期的課程並正確高亮"
echo "  6. 打開瀏覽器控制台查看調試日誌"
echo ""
echo "🔍 預期看到的日誌："
echo "  📅 點擊星期: 1 星期一"
echo "  🔍 篩選星期一的課程..."
echo "  📊 當前視圖有 XX 個可見課程卡片"
echo "  🔍 檢查課程: XXX, 星期: 1, 目標星期: 1"
echo "  ✅ 顯示 X 個星期一的課程"
echo "  📍 滾動到星期一的第一個課程"
echo ""
echo "=========================================="
echo ""
echo "📊 查看容器日誌："
echo "  ssh ${NAS_USER}@${NAS_HOST}"
echo "  cd ${NAS_PATH}"
echo "  docker-compose logs -f --tail=50"
echo ""

