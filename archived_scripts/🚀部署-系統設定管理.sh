#!/bin/bash

# ===========================================
# 🚀 系統設定管理功能 - 部署腳本
# ===========================================
# 新增功能：
# 1. 右上角設定按鈕
# 2. teacher_data.json 管理介面
# 3. teacher_list_data.csv 管理介面
# 4. system-settings.json 管理介面
# ===========================================

echo "🚀 開始部署系統設定管理功能..."
echo "================================================"
echo ""

# 設定變數
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
BACKUP_DIR="backups/settings-feature-$TIMESTAMP"
NAS_PATH="/volume1/docker/flb-calendar"

# 創建備份目錄
echo "📦 創建備份目錄..."
mkdir -p "$BACKUP_DIR"

# 備份當前版本
echo "💾 備份當前版本..."
cp public/perfect-calendar-optimized-complete2.html "$BACKUP_DIR/"
cp server.js "$BACKUP_DIR/"
echo "✅ 備份完成：$BACKUP_DIR"

echo ""
echo "================================================"
echo "📋 新增功能摘要："
echo "================================================"
echo ""
echo "✅ 功能1：右上角設定按鈕"
echo "   - 位置：系統標題右上角"
echo "   - 樣式：金色漸變按鈕，齒輪圖標旋轉動畫"
echo "   - 響應式設計：手機版自動適配"
echo ""
echo "✅ 功能2：設定面板模態框"
echo "   - 三個分頁：講師資料、講師列表、系統設定"
echo "   - 美觀的漸變設計"
echo "   - 響應式布局"
echo ""
echo "✅ 功能3：講師資料管理 (teacher_data.json)"
echo "   - 新增/編輯/刪除講師"
echo "   - 實時編輯表格"
echo "   - 自動備份"
echo ""
echo "✅ 功能4：講師列表管理 (teacher_list_data.csv)"
echo "   - 管理講師連結、API 網址、User ID"
echo "   - CSV 格式讀寫"
echo "   - 自動備份"
echo ""
echo "✅ 功能5：系統設定管理 (system-settings.json)"
echo "   - 排程器設定"
echo "   - 時區設定"
echo "   - 提醒設定"
echo "   - 即時生效"
echo ""
echo "✅ 功能6：後端 API"
echo "   - GET  /api/settings/teachers"
echo "   - POST /api/settings/teachers"
echo "   - GET  /api/settings/teacher-list"
echo "   - POST /api/settings/teacher-list"
echo "   - GET  /api/settings/system"
echo "   - POST /api/settings/system"
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
        if [ -f "$NAS_PATH/public/perfect-calendar-optimized-complete2.html" ]; then
            cp "$NAS_PATH/public/perfect-calendar-optimized-complete2.html" "$NAS_PATH/public/perfect-calendar-optimized-complete2.html.backup-$TIMESTAMP"
        fi
        if [ -f "$NAS_PATH/server.js" ]; then
            cp "$NAS_PATH/server.js" "$NAS_PATH/server.js.backup-$TIMESTAMP"
        fi
        echo "✅ NAS 備份完成"
        
        # 複製新版本到 NAS
        echo "📤 複製新版本到 NAS..."
        cp public/perfect-calendar-optimized-complete2.html "$NAS_PATH/public/"
        cp public/js/settings-manager.js "$NAS_PATH/public/js/"
        cp server.js "$NAS_PATH/"
        echo "✅ 檔案複製完成"
        
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
        echo "📱 使用方式："
        echo ""
        echo "1. 開啟行事曆系統"
        echo "2. 點擊右上角的「設定」按鈕（齒輪圖標）"
        echo "3. 選擇要管理的分頁："
        echo "   - 講師資料：管理 teacher_data.json"
        echo "   - 講師列表：管理 teacher_list_data.csv"
        echo "   - 系統設定：管理 system-settings.json"
        echo "4. 編輯完成後，點擊「儲存」按鈕"
        echo ""
        echo "⚠️ 注意事項："
        echo "   - 每次儲存都會自動備份舊檔案"
        echo "   - 系統設定變更會立即生效"
        echo "   - 講師資料變更需要用戶重新載入頁面"
        echo ""
    else
        echo "⏸️  已取消部署到 NAS"
    fi
else
    echo "⚠️  NAS 環境未連接（本機測試模式）"
    echo ""
    echo "📝 手動部署步驟："
    echo "   1. 複製檔案到 NAS："
    echo "      - public/perfect-calendar-optimized-complete2.html"
    echo "      - public/js/settings-manager.js"
    echo "      - server.js"
    echo "   2. 在 NAS 上執行：cd $NAS_PATH && docker-compose restart"
fi

echo ""
echo "================================================"
echo "📊 檔案清單"
echo "================================================"
echo ""
echo "✅ 前端檔案："
echo "   - public/perfect-calendar-optimized-complete2.html (已更新)"
echo "   - public/js/settings-manager.js (新增)"
echo ""
echo "✅ 後端檔案："
echo "   - server.js (已更新)"
echo ""
echo "✅ 配置檔案："
echo "   - teacher_data.json (可透過介面管理)"
echo "   - public/teacher_list_data.csv (可透過介面管理)"
echo "   - system-settings.json (可透過介面管理)"
echo ""
echo "================================================"
echo "🎨 設計特色"
echo "================================================"
echo ""
echo "🌈 視覺設計："
echo "   - 藍色漸變主題 (#1e3c72 → #2a5298)"
echo "   - 金色設定按鈕，齒輪旋轉動畫"
echo "   - 現代化卡片設計"
echo "   - 流暢的動畫效果"
echo ""
echo "📱 響應式設計："
echo "   - 桌面版：寬度 90%，最大 1200px"
echo "   - 手機版：寬度 95%，垂直布局"
echo "   - 自動適配表格滾動"
echo ""
echo "💫 用戶體驗："
echo "   - 實時編輯，無需頁面跳轉"
echo "   - 自動儲存提示"
echo "   - 友善的錯誤提示"
echo "   - 確認刪除對話框"
echo ""
echo "================================================"
echo "🔧 API 端點說明"
echo "================================================"
echo ""
echo "📚 講師資料 API："
echo "   GET  /api/settings/teachers"
echo "        - 獲取 teacher_data.json"
echo "        - 返回：{ success, data: { teachers: [] }, timestamp }"
echo ""
echo "   POST /api/settings/teachers"
echo "        - 儲存 teacher_data.json"
echo "        - 參數：{ teachers: [{ name, userId }] }"
echo "        - 自動備份舊檔案"
echo ""
echo "📋 講師列表 API："
echo "   GET  /api/settings/teacher-list"
echo "        - 讀取 teacher_list_data.csv"
echo "        - 轉換為 JSON 格式返回"
echo ""
echo "   POST /api/settings/teacher-list"
echo "        - 儲存 teacher_list_data.csv"
echo "        - 參數：{ teachers: [{ teacher, link, webApi, readApi, userId }] }"
echo "        - 轉換為 CSV 格式儲存"
echo ""
echo "⚙️ 系統設定 API："
echo "   GET  /api/settings/system"
echo "        - 獲取 system-settings.json"
echo "        - 使用現有的 loadSystemSettings() 函數"
echo ""
echo "   POST /api/settings/system"
echo "        - 儲存 system-settings.json"
echo "        - 參數：完整的設定物件"
echo "        - 自動重新載入到記憶體"
echo ""
echo "================================================"
echo "✅ 部署腳本執行完成！"
echo "================================================"
echo ""
echo "💡 提示："
echo "   - 查看備份：$BACKUP_DIR"
echo "   - 測試功能：開啟行事曆系統，點擊右上角設定按鈕"
echo "   - 查看日誌：docker-compose logs -f --tail=50"
echo ""

