#!/bin/bash

# ===========================================
# 🚀 綁定配對修復 - 立即部署腳本
# ===========================================
# 修復內容：
# 1. 修復綁定配對時序競爭問題
# 2. 優化載入完成後的延遲時間
# 3. 優化 LIFF 初始化超時
# ===========================================

echo "🚀 開始部署綁定配對修復..."
echo "================================================"
echo ""

# 設定變數
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
BACKUP_DIR="backups/binding-fix-$TIMESTAMP"
HTML_FILE="public/perfect-calendar-optimized-complete2.html"
NAS_PATH="/volume1/docker/flb-calendar"

# 創建備份目錄
echo "📦 創建備份目錄..."
mkdir -p "$BACKUP_DIR"

# 備份當前版本
echo "💾 備份當前版本..."
if [ -f "$HTML_FILE" ]; then
    cp "$HTML_FILE" "$BACKUP_DIR/perfect-calendar-optimized-complete2.html.backup"
    echo "✅ 備份完成：$BACKUP_DIR"
else
    echo "❌ 找不到檔案：$HTML_FILE"
    exit 1
fi

echo ""
echo "================================================"
echo "📋 修復內容摘要："
echo "================================================"
echo ""
echo "✅ 修復1：綁定配對時序競爭問題"
echo "   - 在執行 autoMatchTeacher 前，等待下拉選單填充完成"
echo "   - 最多等待 2 秒（20 × 100ms）"
echo "   - 確保配對時下拉選單已經有講師選項"
echo ""
echo "✅ 修復2：優化載入完成後的延遲時間"
echo "   - UI更新延遲：從 300ms → 150ms"
echo "   - LIFF超時：從 5秒 → 3秒"
echo "   - 總延遲減少約 2.15 秒"
echo ""
echo "✅ 修復3：增強錯誤處理"
echo "   - 下拉選單載入超時時顯示友善提示"
echo "   - 詳細的載入進度日誌"
echo ""
echo "================================================"
echo ""

# 檢查 NAS 環境
echo "🔍 檢查部署環境..."
if [ -d "$NAS_PATH" ]; then
    echo "✅ NAS 環境已連接：$NAS_PATH"
    
    # 詢問是否部署到 NAS
    read -p "是否立即部署到 NAS? (y/n): " deploy_choice
    
    if [ "$deploy_choice" = "y" ] || [ "$deploy_choice" = "Y" ]; then
        echo ""
        echo "🚀 開始部署到 NAS..."
        
        # 備份 NAS 上的舊版本
        echo "💾 備份 NAS 上的舊版本..."
        if [ -f "$NAS_PATH/$HTML_FILE" ]; then
            cp "$NAS_PATH/$HTML_FILE" "$NAS_PATH/$HTML_FILE.backup-$TIMESTAMP"
            echo "✅ NAS 備份完成"
        fi
        
        # 複製新版本到 NAS
        echo "📤 複製新版本到 NAS..."
        cp "$HTML_FILE" "$NAS_PATH/$HTML_FILE"
        echo "✅ 部署完成"
        
        # 重啟服務
        echo ""
        echo "🔄 重啟 Docker 服務..."
        cd "$NAS_PATH"
        docker-compose restart
        
        echo ""
        echo "================================================"
        echo "✅ 部署成功！"
        echo "================================================"
        echo ""
        echo "📱 請在 LINE 中測試："
        echo "   1. 完全關閉 LINE 應用程式"
        echo "   2. 重新開啟並進入行事曆"
        echo "   3. 觀察載入速度和自動綁定是否正常"
        echo ""
        echo "🔍 監控日誌："
        echo "   - 載入時會顯示「等待下拉選單載入」進度"
        echo "   - 配對成功會顯示「下拉選單載入完成 (X 位講師)」"
        echo "   - 配對失敗會顯示具體錯誤訊息"
        echo ""
    else
        echo "⏸️  已取消部署到 NAS"
    fi
else
    echo "⚠️  NAS 環境未連接（本機測試模式）"
    echo ""
    echo "📝 手動部署步驟："
    echo "   1. 將 $HTML_FILE 複製到 NAS"
    echo "   2. 在 NAS 上執行：cd $NAS_PATH && docker-compose restart"
fi

echo ""
echo "================================================"
echo "📊 技術詳情"
echo "================================================"
echo ""
echo "🔧 時序修復機制："
echo "   while (下拉選單未填充 && 等待次數 < 20) {"
echo "       await sleep(100ms)"
echo "       等待次數++"
echo "   }"
echo "   if (下拉選單已填充) {"
echo "       執行配對"
echo "   } else {"
echo "       顯示超時警告"
echo "   }"
echo ""
echo "⏱️  效能優化："
echo "   - UI更新延遲：300ms → 150ms (-150ms)"
echo "   - LIFF超時：5000ms → 3000ms (-2000ms)"
echo "   - 預期總改善：約 -2.15 秒"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成！"
echo "================================================"
echo ""
echo "💡 提示："
echo "   - 如果問題仍存在，請執行：npm run test-binding"
echo "   - 查看詳細日誌：tail -f logs/app.log"
echo "   - 回滾版本：cp $BACKUP_DIR/*.backup $HTML_FILE"
echo ""

