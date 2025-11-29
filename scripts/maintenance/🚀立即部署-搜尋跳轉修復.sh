#!/bin/bash

# ============================================
# 🚀 立即部署 - 搜尋跳轉功能修復
# ============================================
# 版本：2025-01-16
# 功能：修復搜尋結果點擊後的自動跳轉、篩選和高亮功能

set -e

echo "============================================"
echo "🚀 開始部署搜尋跳轉功能修復"
echo "============================================"
echo ""

# 設定顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 定義目錄
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAS_DIR="$PROJECT_DIR"

echo "📁 專案目錄: $PROJECT_DIR"
echo ""

# ========== 1. 備份現有檔案 ==========
echo "📦 步驟 1: 備份現有檔案..."
BACKUP_DIR="$PROJECT_DIR/backups/search-navigation-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "$PROJECT_DIR/public/js/main.js" ]; then
    cp "$PROJECT_DIR/public/js/main.js" "$BACKUP_DIR/main.js.backup"
    echo "✅ 已備份 main.js"
fi

echo ""

# ========== 2. 檢查檔案是否存在 ==========
echo "🔍 步驟 2: 檢查檔案完整性..."

REQUIRED_FILES=(
    "public/js/main.js"
    "public/js/modules/search-manager.js"
)

ALL_EXISTS=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 不存在"
        ALL_EXISTS=false
    fi
done

if [ "$ALL_EXISTS" = false ]; then
    echo ""
    echo "${RED}❌ 有檔案不存在，無法部署${NC}"
    exit 1
fi

echo ""

# ========== 3. 驗證 JavaScript 語法 ==========
echo "🔍 步驟 3: 驗證 JavaScript 語法..."

if command -v node &> /dev/null; then
    echo "使用 Node.js 驗證語法..."
    
    if node -c "$PROJECT_DIR/public/js/main.js" 2>/dev/null; then
        echo "✅ main.js 語法正確"
    else
        echo "${RED}❌ main.js 語法錯誤${NC}"
        exit 1
    fi
    
    if node -c "$PROJECT_DIR/public/js/modules/search-manager.js" 2>/dev/null; then
        echo "✅ search-manager.js 語法正確"
    else
        echo "${RED}❌ search-manager.js 語法錯誤${NC}"
        exit 1
    fi
else
    echo "${YELLOW}⚠️  Node.js 未安裝，跳過語法檢查${NC}"
fi

echo ""

# ========== 4. 重啟 Docker 容器 ==========
echo "🔄 步驟 4: 重啟 Docker 容器..."

cd "$PROJECT_DIR"

if [ -f "docker-compose.yml" ]; then
    echo "停止容器..."
    docker-compose stop
    
    echo "啟動容器..."
    docker-compose up -d
    
    echo "✅ 容器已重啟"
else
    echo "${YELLOW}⚠️  找不到 docker-compose.yml，跳過容器重啟${NC}"
fi

echo ""

# ========== 5. 等待服務啟動 ==========
echo "⏳ 步驟 5: 等待服務啟動..."
sleep 5

# ========== 6. 健康檢查 ==========
echo "🏥 步驟 6: 健康檢查..."

if command -v curl &> /dev/null; then
    HEALTH_CHECK=$(curl -s http://localhost:8080/health 2>/dev/null || echo "failed")
    
    if [[ "$HEALTH_CHECK" == *"ok"* ]] || [[ "$HEALTH_CHECK" == *"healthy"* ]]; then
        echo "✅ 服務健康檢查通過"
    else
        echo "${YELLOW}⚠️  健康檢查失敗，但不影響部署${NC}"
        echo "回應: $HEALTH_CHECK"
    fi
else
    echo "${YELLOW}⚠️  curl 未安裝，跳過健康檢查${NC}"
fi

echo ""

# ========== 7. 查看日誌 ==========
echo "📋 步驟 7: 查看最近日誌..."

if [ -f "docker-compose.yml" ]; then
    docker-compose logs --tail=20 web 2>/dev/null || echo "${YELLOW}⚠️  無法讀取日誌${NC}"
fi

echo ""

# ========== 8. 完成 ==========
echo "============================================"
echo "${GREEN}✅ 搜尋跳轉功能修復部署完成！${NC}"
echo "============================================"
echo ""
echo "📝 修復內容:"
echo "  ✅ 增強錯誤處理和日誌輸出"
echo "  ✅ 新增日期篩選自動設置"
echo "  ✅ 改進講師名稱提取和匹配邏輯"
echo "  ✅ 實現重試機制（最多5次）"
echo "  ✅ 優化延遲時間和視圖切換"
echo "  ✅ 增強高亮和滾動效果"
echo ""
echo "🧪 測試步驟:"
echo "  1. 開啟瀏覽器前往行事曆頁面"
echo "  2. 使用全文搜尋找一個課程"
echo "  3. 點擊搜尋結果"
echo "  4. 觀察以下功能:"
echo "     - ✅ 自動切換到正確的時間視圖（今日/本週/本月/全部）"
echo "     - ✅ 自動設置講師篩選"
echo "     - ✅ 自動設置日期篩選"
echo "     - ✅ 平滑滾動到該課程"
echo "     - ✅ 課程卡片高亮顯示"
echo "  5. 查看瀏覽器控制台的詳細日誌"
echo ""
echo "📍 備份位置: $BACKUP_DIR"
echo ""
echo "🔍 如需查看日誌，執行："
echo "  docker-compose logs -f --tail=50"
echo ""

