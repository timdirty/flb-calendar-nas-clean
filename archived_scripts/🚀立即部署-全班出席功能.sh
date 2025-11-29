#!/bin/bash

# 🚀 立即部署 - 全班出席功能
# 用途：快速部署全班出席功能到 NAS 伺服器
# 日期：2025-10-19

echo "════════════════════════════════════════════════════════"
echo "🚀 開始部署全班出席功能"
echo "════════════════════════════════════════════════════════"
echo ""

# 設定顏色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檔案路徑
SOURCE_FILE="public/perfect-calendar-optimized-complete2.html"
BACKUP_DIR="backups/mark-all-present-$(date +%Y%m%d-%H%M%S)"
TARGET_DIR="/volume1/web/calendar"

echo -e "${BLUE}📋 部署資訊${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "來源檔案: $SOURCE_FILE"
echo "備份位置: $BACKUP_DIR"
echo "目標位置: $TARGET_DIR"
echo ""

# 檢查來源檔案是否存在
if [ ! -f "$SOURCE_FILE" ]; then
    echo -e "${RED}❌ 錯誤：找不到來源檔案 $SOURCE_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 來源檔案檢查通過${NC}"
echo ""

# 創建備份目錄
echo -e "${YELLOW}📦 創建備份...${NC}"
mkdir -p "$BACKUP_DIR"

# 備份目標檔案（如果存在）
if [ -f "$TARGET_DIR/perfect-calendar-optimized-complete2.html" ]; then
    cp "$TARGET_DIR/perfect-calendar-optimized-complete2.html" "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份現有檔案到 $BACKUP_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  目標位置沒有現有檔案，跳過備份${NC}"
fi
echo ""

# 複製檔案到目標位置
echo -e "${YELLOW}📤 部署檔案到伺服器...${NC}"

# 檢查目標目錄是否存在
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠️  目標目錄不存在，嘗試建立...${NC}"
    sudo mkdir -p "$TARGET_DIR"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 錯誤：無法建立目標目錄${NC}"
        exit 1
    fi
fi

# 複製檔案
sudo cp "$SOURCE_FILE" "$TARGET_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 檔案複製成功${NC}"
else
    echo -e "${RED}❌ 錯誤：檔案複製失敗${NC}"
    exit 1
fi
echo ""

# 設定檔案權限
echo -e "${YELLOW}🔐 設定檔案權限...${NC}"
sudo chmod 644 "$TARGET_DIR/perfect-calendar-optimized-complete2.html"
sudo chown http:http "$TARGET_DIR/perfect-calendar-optimized-complete2.html"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 權限設定完成${NC}"
else
    echo -e "${YELLOW}⚠️  警告：權限設定可能失敗，但檔案已複製${NC}"
fi
echo ""

# 顯示部署資訊
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "════════════════════════════════════════════════════════"
echo ""

echo -e "${BLUE}📊 部署總結${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅${NC} 檔案已部署到: $TARGET_DIR"
echo -e "${GREEN}✅${NC} 備份已保存到: $BACKUP_DIR"
echo ""

echo -e "${BLUE}🆕 新增功能${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  「全班出席」按鈕（位於學生名單標題右側）"
echo "2️⃣  智能跳過已出席學生"
echo "3️⃣  自動更新簽到統計"
echo "4️⃣  Toast 通知顯示處理結果"
echo "5️⃣  完整的錯誤處理機制"
echo ""

echo -e "${BLUE}🌐 測試連結${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "https://calendar.funlearnbar.synology.me/perfect-calendar-optimized-complete2.html"
echo ""

echo -e "${BLUE}🧪 快速測試步驟${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 打開上面的測試連結"
echo "2. 長按任一課程（1.5秒）打開簽到頁面"
echo "3. 在學生名單標題右側找到「全班出席」按鈕"
echo "4. 點擊按鈕測試功能"
echo "5. 確認所有學生被標記為出席"
echo ""

echo -e "${YELLOW}💡 提示${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• 如果看不到新按鈕，請按 Ctrl+Shift+R (Mac: Cmd+Shift+R) 清除快取"
echo "• 已出席的學生會自動被跳過"
echo "• 課程開始前 10 分鐘內無法簽到"
echo "• 詳細測試指南請參考: 🧪快速測試-全班出席功能.md"
echo ""

echo -e "${BLUE}📖 相關文件${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• ✅全班出席功能-完成報告.md"
echo "• 🧪快速測試-全班出席功能.md"
echo ""

echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}✨ 部署腳本執行完成${NC}"
echo "════════════════════════════════════════════════════════"


