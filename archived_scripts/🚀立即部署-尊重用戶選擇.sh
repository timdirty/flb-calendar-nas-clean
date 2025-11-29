#!/bin/bash

echo "🚀 部署修復：尊重用戶選擇 - 只在初次載入自動跳轉綁定"
echo "================================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1️⃣ 複製修復後的 HTML
echo -e "${BLUE}1️⃣ 複製修復後的前端檔案...${NC}"
cp public/perfect-calendar-optimized-complete2.html /volume1/web/flb-calendar/perfect-calendar-optimized-complete2.html

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ HTML 檔案已更新${NC}"
else
    echo -e "${YELLOW}⚠️ HTML 更新失敗，請檢查路徑${NC}"
    exit 1
fi

# 2️⃣ 設置權限
echo ""
echo -e "${BLUE}2️⃣ 設置檔案權限...${NC}"
chmod 644 /volume1/web/flb-calendar/perfect-calendar-optimized-complete2.html
chown http:http /volume1/web/flb-calendar/perfect-calendar-optimized-complete2.html

# 3️⃣ 重啟 Nginx（可選）
echo ""
echo -e "${BLUE}3️⃣ 重啟 Nginx...${NC}"
nginx -s reload

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo -e "${YELLOW}修復內容：${NC}"
echo "  • ✅ 新增 window.hasAutoBindedOnce 標記"
echo "  • ✅ 只在初次載入時執行自動綁定"
echo "  • ✅ 切換講師、切換視圖不再自動跳轉"
echo "  • ✅ 完全尊重用戶的手動選擇"
echo ""
echo -e "${YELLOW}測試步驟：${NC}"
echo "  1. 清除瀏覽器快取並重新載入"
echo "  2. 登入後應自動綁定到您的講師身份（僅初次）"
echo "  3. 切換到「所有講師」- 不會再跳回綁定"
echo "  4. 切換到「本月視圖」- 不會再跳回綁定"
echo "  5. 選擇其他講師 - 系統會尊重您的選擇"
echo ""
echo -e "${GREEN}🎉 現在系統完全尊重用戶選擇了！${NC}"

