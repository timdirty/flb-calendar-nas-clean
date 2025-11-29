#!/bin/bash

# ========================================
# 🎯 學習歷程上傳頁面優化部署腳本
# ========================================
# 功能：
# 1. ✅ 修復講師篩選邏輯（支援完全匹配和部分匹配）
# 2. ✅ 增強 highlight 課程的視覺效果
# 3. ✅ 添加詳細的 debug 日誌
# 4. ✅ 支援 warning 類型的 Toast 通知
# ========================================

echo "======================================"
echo "🚀 開始部署學習歷程上傳頁面優化"
echo "======================================"
echo ""

# 設定路徑
PROJECT_ROOT="/volume1/docker/flb-calendar"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "📋 部署資訊："
echo "   專案路徑: $PROJECT_ROOT"
echo "   備份路徑: $BACKUP_DIR"
echo "   時間戳記: $TIMESTAMP"
echo ""

# 建立備份目錄
echo "📁 建立備份目錄..."
mkdir -p "$BACKUP_DIR"

# 備份現有檔案
echo "💾 備份現有檔案..."
if [ -f "$PROJECT_ROOT/public/learning-record-upload.html" ]; then
    cp "$PROJECT_ROOT/public/learning-record-upload.html" "$BACKUP_DIR/learning-record-upload.html.backup-$TIMESTAMP"
    echo "✅ 已備份 learning-record-upload.html"
else
    echo "⚠️  找不到 learning-record-upload.html"
fi

# 複製更新的檔案
echo ""
echo "📦 複製更新的檔案..."
cp public/learning-record-upload.html "$PROJECT_ROOT/public/" && echo "✅ learning-record-upload.html"

# 設定權限
echo ""
echo "🔐 設定檔案權限..."
chmod 644 "$PROJECT_ROOT/public/learning-record-upload.html"

# 重啟服務（可選）
echo ""
echo "🔄 重啟服務..."
cd "$PROJECT_ROOT"

# 檢查是否使用 Docker
if [ -f "docker-compose.yml" ]; then
    echo "📦 偵測到 Docker Compose，重啟容器..."
    docker-compose restart
else
    echo "📦 使用 PM2 重啟服務..."
    pm2 restart flb-calendar 2>/dev/null || echo "⚠️  PM2 未運行或服務名稱不同"
fi

# 完成
echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "📝 更新內容："
echo "   1. ✅ 修復講師篩選邏輯"
echo "      - 支援完全匹配和部分匹配"
echo "      - 添加 trim() 處理空白字元"
echo "      - 改善大小寫比對"
echo ""
echo "   2. ✅ 增強 highlight 效果"
echo "      - 添加放大效果 (scale 1.05)"
echo "      - 添加脈衝動畫"
echo "      - 添加「從日曆跳轉」標籤"
echo "      - 增加邊框寬度和陰影"
echo ""
echo "   3. ✅ 改善 debug 功能"
echo "      - 添加詳細的比對日誌"
echo "      - 顯示所有可用講師列表"
echo "      - 篩選失敗時顯示提示"
echo ""
echo "   4. ✅ 添加 warning Toast"
echo "      - 支援警告類型通知"
echo "      - 延長顯示時間至 4 秒"
echo ""
echo "🧪 測試建議："
echo "   1. 從主日曆點擊「上傳學習歷程」"
echo "   2. 檢查是否只顯示當前講師的課程"
echo "   3. 檢查 highlight 課程的視覺效果"
echo "   4. 打開瀏覽器 Console 查看 debug 日誌"
echo ""
echo "🔍 Debug 方法："
echo "   打開瀏覽器 Console (F12)，查看："
echo "   - 「🔍 講師篩選檢查」"
echo "   - 「🔍 課程比對」"
echo "   - 「✅ 講師篩選完成」"
echo ""
echo "📌 如果還是顯示所有課程，請檢查："
echo "   1. localStorage 中是否有 currentUser"
echo "   2. URL 參數是否正確傳遞 ?instructor=xxx"
echo "   3. 講師名稱是否與課程中的 instructor 欄位一致"
echo ""

# 顯示服務狀態
echo "📊 服務狀態："
docker-compose ps 2>/dev/null || pm2 list 2>/dev/null || echo "   無法取得服務狀態"
echo ""

echo "🎉 完成！請重新載入頁面測試"

