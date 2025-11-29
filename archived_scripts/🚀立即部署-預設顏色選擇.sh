#!/bin/bash

echo "🎨 =========================================="
echo "🎨  講師顏色預設選擇器 - 部署腳本"
echo "🎨 =========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 獲取腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}📍 當前工作目錄: $(pwd)${NC}"
echo ""

# 1. 備份檔案
echo -e "${YELLOW}📦 步驟 1/4: 備份檔案...${NC}"
BACKUP_DIR="backups/preset-colors-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "public/admin-dashboard.html" ]; then
    cp public/admin-dashboard.html "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 已備份 admin-dashboard.html${NC}"
else
    echo -e "${RED}❌ admin-dashboard.html 不存在${NC}"
    exit 1
fi

echo ""

# 2. 檢查修改
echo -e "${YELLOW}🔍 步驟 2/4: 檢查修改內容...${NC}"

if grep -q "PRESET_COLORS" public/admin-dashboard.html; then
    echo -e "${GREEN}✅ 已包含預設顏色定義${NC}"
    COLOR_COUNT=$(grep -o "{ name:" public/admin-dashboard.html | wc -l | tr -d ' ')
    echo -e "${BLUE}📊 發現 ${COLOR_COUNT} 種預設顏色${NC}"
else
    echo -e "${RED}❌ 缺少預設顏色定義${NC}"
    exit 1
fi

if grep -q "preset-colors-container" public/admin-dashboard.html; then
    echo -e "${GREEN}✅ 已包含顏色選擇器樣式${NC}"
else
    echo -e "${RED}❌ 缺少顏色選擇器樣式${NC}"
    exit 1
fi

if grep -q "selectTeacherForColoring" public/admin-dashboard.html; then
    echo -e "${GREEN}✅ 已包含顏色選擇邏輯${NC}"
else
    echo -e "${RED}❌ 缺少顏色選擇邏輯${NC}"
    exit 1
fi

echo ""

# 3. 複製到 public 目錄（如果需要）
echo -e "${YELLOW}📁 步驟 3/4: 確認檔案位置...${NC}"
if [ -f "public/admin-dashboard.html" ]; then
    echo -e "${GREEN}✅ 檔案位置正確${NC}"
else
    echo -e "${RED}❌ 檔案位置錯誤${NC}"
    exit 1
fi

echo ""

# 4. 重啟服務（可選）
echo -e "${YELLOW}🔄 步驟 4/4: 準備重啟服務...${NC}"
echo -e "${BLUE}💡 提示：管理控制台是靜態HTML，無需重啟服務即可生效${NC}"
echo -e "${BLUE}   只需重新整理瀏覽器頁面即可看到新功能${NC}"

echo ""
echo -e "${GREEN}🎉 =========================================="
echo -e "🎉  預設顏色選擇器部署完成！"
echo -e "🎉 ==========================================${NC}"
echo ""
echo -e "${BLUE}📋 接下來的測試步驟：${NC}"
echo -e "1. 📱 開啟管理控制台: http://your-domain/admin-dashboard.html"
echo -e "2. 🔄 按 Ctrl+F5 強制重新整理頁面"
echo -e "3. 🎨 進入「講師管理」分頁"
echo -e "4. 👆 點擊講師名稱或顏色預覽方塊"
echo -e "5. 🎨 點擊上方 30 種預設顏色之一"
echo -e "6. ✅ 看到顏色立即套用"
echo -e "7. 💾 點擊「儲存顏色配置」保存"
echo ""
echo -e "${YELLOW}🎨 30 種預設顏色包含：${NC}"
echo -e "   • 櫻花粉、蜜桃粉、玫瑰粉、薰衣草、夢幻紫"
echo -e "   • 天空藍、薄荷藍、海洋藍、冰晶藍、寶石藍"
echo -e "   • 薄荷綠、抹茶綠、青檸綠、森林綠、鮮嫩綠"
echo -e "   • 檸檬黃、奶油黃、陽光黃、金黃色、琥珀黃"
echo -e "   • 蜜橙色、珊瑚橙、柿子橙、番茄紅、西瓜紅"
echo -e "   • 夢幻霓虹、紫羅蘭、灰藍色、玫瑰金、薄荷奶綠"
echo ""
echo -e "${BLUE}📦 備份位置: $BACKUP_DIR${NC}"
echo ""

