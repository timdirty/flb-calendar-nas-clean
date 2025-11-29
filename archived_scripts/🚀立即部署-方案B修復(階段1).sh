#!/bin/bash

# 🚀 立即部署 - 方案 B 修復 (階段 1)
# 已完成的修復:
# 1. ✅ 綁定功能載入順序修復
# 2. ✅ 系統配置調用後端 API
# 3. ✅ 講師資料調用後端 API
# 4. ✅ 提醒設定調用後端 API

echo "=========================================="
echo "🚀 方案 B 修復 - 階段 1 部署"
echo "=========================================="
echo ""

# 檢查是否在正確的目錄
if [ ! -f "server.js" ]; then
    echo "❌ 錯誤：找不到 server.js"
    echo "請在專案根目錄執行此腳本"
    exit 1
fi

# 1. 停止現有服務
echo "1️⃣ 停止現有服務..."
pm2 stop calendar-server 2>/dev/null || echo "   (服務未運行)"

# 2. 部署前端檔案
echo ""
echo "2️⃣ 部署前端檔案..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo "   ✅ 前端檔案存在"
else
    echo "   ❌ 找不到前端檔案"
    exit 1
fi

if [ -f "public/admin-dashboard.html" ]; then
    echo "   ✅ 管理控制台檔案存在"
else
    echo "   ❌ 找不到管理控制台檔案"
    exit 1
fi

# 3. 啟動服務
echo ""
echo "3️⃣ 啟動服務..."
pm2 start ecosystem.config.js || pm2 start server.js --name calendar-server
pm2 save

echo ""
echo "4️⃣ 檢查服務狀態..."
pm2 status calendar-server

echo ""
echo "=========================================="
echo "✅ 階段 1 部署完成"
echo "=========================================="
echo ""
echo "📋 已完成的修復："
echo ""
echo "1. ✅ 綁定功能載入順序修復"
echo "   - 新增資料載入狀態追蹤"
echo "   - 實作等待資料載入完成的機制"
echo "   - 增強 localStorage 快取驗證"
echo "   - 確保綁定選單有講師列表"
echo ""
echo "2. ✅ 系統配置 API 對齊"
echo "   - loadSystemConfig() 改為調用 GET /api/system-settings"
echo "   - saveSystemConfig() 改為調用 POST /api/system-settings"
echo ""
echo "3. ✅ 講師資料 API 對齊"
echo "   - loadTeachers() 已正確調用 GET /api/teachers"
echo "   - saveTeachers() 改為調用 POST /api/settings/teachers"
echo ""
echo "4. ✅ 提醒設定 API 對齊"
echo "   - loadNotificationConfig() 改為調用 GET /api/schedule-settings"
echo "   - saveNotificationConfig() 改為調用 POST /api/schedule-settings"
echo ""
echo "=========================================="
echo "🧪 測試步驟"
echo "=========================================="
echo ""
echo "測試 1: 綁定功能載入順序"
echo "  1. 在 LINE 中打開系統"
echo "  2. 觀察載入過程，等待完成"
echo "  3. 檢查綁定選單是否有講師列表"
echo "  4. 確認綁定功能正常運作"
echo ""
echo "測試 2: 管理控制台 - 系統配置"
echo "  1. 打開管理控制台"
echo "  2. 切換到「系統配置」頁籤"
echo "  3. 修改任何設定並儲存"
echo "  4. 重新載入頁面，確認設定已保存"
echo ""
echo "測試 3: 管理控制台 - 講師管理"
echo "  1. 切換到「講師管理」頁籤"
echo "  2. 編輯講師顏色並儲存"
echo "  3. 重新載入頁面，確認設定已保存"
echo ""
echo "測試 4: 管理控制台 - 提醒設定"
echo "  1. 切換到「通知設定」頁籤"
echo "  2. 修改提醒時間並儲存"
echo "  3. 重新載入頁面，確認設定已保存"
echo ""
echo "=========================================="
echo "📝 檢查日誌"
echo "=========================================="
echo ""
echo "查看即時日誌："
echo "pm2 logs calendar-server --lines 100"
echo ""
echo "查看錯誤日誌："
echo "pm2 logs calendar-server --err --lines 50"
echo ""
echo "=========================================="
echo "🔄 待完成項目（階段 2）"
echo "=========================================="
echo ""
echo "1. ⏳ Google API 設定 - 需要新增後端 API"
echo "2. ⏳ 緩存管理 - 需要新增後端 API"
echo "3. ⏳ 管理員登入功能 - 需要實作完整驗證"
echo ""
echo "=========================================="

# 顯示訪問連結
echo ""
echo "🌐 訪問連結："
echo "   前端系統: https://calendar.funlearnbar.synology.me"
echo "   管理控制台: https://calendar.funlearnbar.synology.me/admin-dashboard.html"
echo ""

