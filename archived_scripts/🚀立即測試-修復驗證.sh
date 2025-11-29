#!/bin/bash

# 🚀 修復驗證測試腳本
# 快速測試所有修復項目

echo "================================"
echo "🧪 開始驗證修復項目..."
echo "================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 檢查 teacher_data.json 是否存在
echo "1️⃣ 檢查講師顏色資料檔案..."
if [ -f "teacher_data.json" ]; then
    echo -e "${GREEN}✅ teacher_data.json 存在${NC}"
    
    # 驗證 JSON 格式
    if jq empty teacher_data.json 2>/dev/null; then
        echo -e "${GREEN}✅ JSON 格式正確${NC}"
        
        # 顯示講師數量
        TEACHER_COUNT=$(jq '.teachers | length' teacher_data.json)
        echo -e "${GREEN}✅ 找到 ${TEACHER_COUNT} 位講師${NC}"
    else
        echo -e "${RED}❌ JSON 格式錯誤${NC}"
    fi
else
    echo -e "${RED}❌ teacher_data.json 不存在${NC}"
fi
echo ""

# 2. 測試課程顏色 API
echo "2️⃣ 測試課程顏色 API..."
API_RESPONSE=$(curl -s "https://course-viewer.funlearnbar.synology.me/api/course-colors")
if [ ! -z "$API_RESPONSE" ]; then
    echo -e "${GREEN}✅ API 回應正常${NC}"
    
    # 檢查 colors 欄位
    if echo "$API_RESPONSE" | jq -e '.colors' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ colors 欄位存在${NC}"
        
        # 顯示課程類型數量
        COLOR_COUNT=$(echo "$API_RESPONSE" | jq '.colors | length')
        echo -e "${GREEN}✅ 找到 ${COLOR_COUNT} 種課程顏色${NC}"
    else
        echo -e "${YELLOW}⚠️  API 格式可能有誤${NC}"
    fi
else
    echo -e "${RED}❌ API 無回應${NC}"
fi
echo ""

# 3. 檢查 HTML 檔案是否存在
echo "3️⃣ 檢查前端檔案..."
if [ -f "public/perfect-calendar-optimized-complete2.html" ]; then
    echo -e "${GREEN}✅ HTML 檔案存在${NC}"
    
    # 檢查關鍵函數是否存在
    if grep -q "loadTeacherColors" "public/perfect-calendar-optimized-complete2.html"; then
        echo -e "${GREEN}✅ loadTeacherColors() 函數已添加${NC}"
    else
        echo -e "${RED}❌ loadTeacherColors() 函數不存在${NC}"
    fi
    
    if grep -q "loadCourseColors" "public/perfect-calendar-optimized-complete2.html"; then
        echo -e "${GREEN}✅ loadCourseColors() 函數存在${NC}"
    else
        echo -e "${RED}❌ loadCourseColors() 函數不存在${NC}"
    fi
    
    # 檢查是否移除了未實現的按鈕
    if grep -q "data-mode=\"calendar-week\"" "public/perfect-calendar-optimized-complete2.html"; then
        echo -e "${YELLOW}⚠️  週視圖按鈕仍存在（可能需要清除瀏覽器快取）${NC}"
    else
        echo -e "${GREEN}✅ 週視圖按鈕已移除${NC}"
    fi
else
    echo -e "${RED}❌ HTML 檔案不存在${NC}"
fi
echo ""

# 4. 檢查伺服器狀態
echo "4️⃣ 檢查伺服器狀態..."
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✅ 伺服器正在運行${NC}"
    
    # 測試本地連線
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
        echo -e "${GREEN}✅ 伺服器回應正常 (HTTP 200)${NC}"
    else
        echo -e "${YELLOW}⚠️  伺服器可能未正常回應${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  伺服器未運行${NC}"
    echo -e "${YELLOW}提示：執行 'node server.js' 啟動伺服器${NC}"
fi
echo ""

# 5. 檢查響應式設計
echo "5️⃣ 檢查響應式設計..."
if grep -q "@media (max-width: 1024px)" "public/perfect-calendar-optimized-complete2.html"; then
    echo -e "${GREEN}✅ 響應式設計已設定${NC}"
    
    if grep -A5 "@media (max-width: 1024px)" "public/perfect-calendar-optimized-complete2.html" | grep -q "calendar-view-container"; then
        echo -e "${GREEN}✅ 手機端隱藏日曆容器已設定${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  響應式設計可能未設定${NC}"
fi
echo ""

# 總結
echo "================================"
echo "🎉 驗證完成！"
echo "================================"
echo ""
echo "📋 下一步建議："
echo "1. 在瀏覽器開啟 http://localhost:3000"
echo "2. 打開開發者工具 (F12)"
echo "3. 檢查控制台是否有錯誤訊息"
echo "4. 測試講師篩選、時段篩選、日期篩選功能"
echo "5. 切換到手機模式測試響應式設計 (F12 > Toggle device toolbar)"
echo ""
echo "🔍 檢查顏色載入："
echo "在控制台執行："
echo "  console.log('講師顏色:', instructorColors)"
echo "  console.log('課程顏色:', COURSE_TYPE_COLORS)"
echo ""

