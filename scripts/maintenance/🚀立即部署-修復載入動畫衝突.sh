#!/bin/bash

echo "🚀 開始部署：修復載入動畫衝突"
echo "=========================================="
echo ""
echo "📝 修改內容："
echo "  ✅ 移除 HTML 內嵌的'正在發牌中...'卡牌動畫"
echo "  ✅ 移除'載入學生名單中...'文字提示（2處）"
echo "  ✅ 在 showStudentLoadingState 添加衝突檢查"
echo "  ✅ 統一使用 showOptimizedLoadingAnimation()"
echo ""
echo "🎯 修復問題："
echo "  ❌ 修復前：兩個載入動畫疊在一起"
echo "  ✅ 修復後：只顯示一個清晰的液態玻璃動畫"
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
ssh ${NAS_USER}@${NAS_HOST} "cd ${NAS_PATH} && cp public/js/main.js public/js/main.js.backup-before-loading-fix-$(date +%Y%m%d-%H%M%S)"

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
echo "檢查 1: 確認只有一個'正在發牌中...'（在函數內）"
DEALING_COUNT=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '正在發牌中' ${NAS_PATH}/public/js/main.js")
echo "  '正在發牌中...' 出現次數: ${DEALING_COUNT}"

if [ "$DEALING_COUNT" -eq "1" ]; then
    echo "  ✅ 正確！只有一個載入動畫"
else
    echo "  ⚠️ 警告：發現 ${DEALING_COUNT} 處'正在發牌中...'"
fi

echo ""
echo "檢查 2: 確認移除了'載入學生名單中...'"
LOADING_COUNT=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '載入學生名單中' ${NAS_PATH}/public/js/main.js")
echo "  '載入學生名單中...' 出現次數: ${LOADING_COUNT}"

if [ "$LOADING_COUNT" -eq "0" ]; then
    echo "  ✅ 正確！已完全移除"
else
    echo "  ⚠️ 警告：仍有 ${LOADING_COUNT} 處'載入學生名單中...'"
fi

echo ""
echo "檢查 3: 確認添加了衝突檢查"
CONFLICT_CHECK=$(ssh ${NAS_USER}@${NAS_HOST} "grep -c '如果已經有優化的載入動畫' ${NAS_PATH}/public/js/main.js")
echo "  衝突檢查出現次數: ${CONFLICT_CHECK}"

if [ "$CONFLICT_CHECK" -ge "1" ]; then
    echo "  ✅ 正確！已添加衝突檢查"
else
    echo "  ⚠️ 警告：未找到衝突檢查"
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
echo "  3. 點擊任一課程開啟簽到"
echo "  4. 確認只看到一個液態玻璃載入動畫"
echo "  5. 確認沒有'正在發牌中...'和'載入學生名單中...'同時出現"
echo ""
echo "🔗 測試網址："
echo "  LINE LIFF: https://liff.line.me/YOUR-LIFF-ID"
echo "  直接訪問: https://192.168.50.38:YOUR-PORT"
echo ""
echo "=========================================="
echo ""
echo "📊 查看容器日誌："
echo "  ssh ${NAS_USER}@${NAS_HOST}"
echo "  cd ${NAS_PATH}"
echo "  docker-compose logs -f --tail=50"
echo ""

