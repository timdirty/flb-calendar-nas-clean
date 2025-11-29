#!/bin/bash

# 🚀 立即部署 - 課程名稱提取修復（支援 SPIKE PRO 等複合名稱）
# 修復日期：2025-10-19
# 問題：SPIKE PRO 課程被誤識別為 SPIKE，導致學生名單錯誤

set -e

echo "🚀 開始部署課程名稱提取修復..."

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檔案路徑
TARGET_FILE="public/js/course-student-matcher.js"

echo ""
echo -e "${BLUE}📋 修復內容：${NC}"
echo "  - 支援複合課程名稱（如 SPIKE PRO、SPIKE ADVANCED 等）"
echo "  - 正則表達式從 /^([A-Z]+)/i 改為 /^([A-Z]+(?:\\s+[A-Z]+)*)/i"
echo "  - 範例：'SPIKE PRO 日 10:00-12:00' → 'SPIKE PRO'（而不是 'SPIKE'）"
echo ""

# 檢查檔案是否存在
if [ ! -f "$TARGET_FILE" ]; then
    echo -e "${RED}❌ 錯誤：找不到檔案 $TARGET_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📦 檔案已準備好（透過 SynologyDrive 自動同步到 NAS）${NC}"
echo -e "${GREEN}✅ 修改的檔案：$TARGET_FILE${NC}"

# 修改檔案時間戳記以觸發同步
touch "$TARGET_FILE"
echo -e "${GREEN}✅ 已觸發 SynologyDrive 同步${NC}"

echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${YELLOW}📝 等待同步完成後，請執行以下測試：${NC}"
echo ""
echo "  ${BLUE}1. 強制重新整理瀏覽器（Cmd+Shift+R 或 Ctrl+Shift+R）${NC}"
echo "     確保載入最新版本的 course-student-matcher.js"
echo ""
echo "  ${BLUE}2. 檢查版本資訊${NC}"
echo "     開啟瀏覽器 Console，應該看到："
echo "     ${GREEN}✅ CourseStudentMatcher v1.0.0 已載入${NC}"
echo ""
echo "  ${BLUE}3. 測試課程名稱提取${NC}"
echo "     在瀏覽器 Console 執行："
echo "     ${GREEN}window.CourseStudentMatcher.extractCourseName('SPIKE PRO 日 10:00-12:00 第5週')${NC}"
echo "     應該返回：${GREEN}'SPIKE PRO'${NC}（而不是 'SPIKE'）"
echo ""
echo "  ${BLUE}4. 測試實際課程${NC}"
echo "     - 開啟學習歷程上傳頁面"
echo "     - 點選 'SPIKE PRO 日 10:00-12:00 第5週'"
echo "     - 確認只顯示 ${GREEN}2 位學生${NC}（陳杰睿、顏世餘）"
echo ""
echo -e "${YELLOW}⚠️ 如果還是顯示 25 位學生：${NC}"
echo "  1. 確認瀏覽器已強制重新整理（清除快取）"
echo "  2. 檢查 student_data.json 中學生的 course 欄位："
echo "     ${GREEN}cat public/student_data.json | grep -A 3 '陳杰睿'${NC}"
echo "     確認 course 是 ${GREEN}'SPIKE PRO'${NC} 而不是 'SPIKE'"
echo ""
echo -e "${BLUE}📖 完整文件：${NC}"
echo "  請查看：${GREEN}✅課程名稱提取修復-複合名稱支援.md${NC}"
echo ""
