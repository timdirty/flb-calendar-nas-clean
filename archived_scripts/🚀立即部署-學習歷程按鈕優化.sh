#!/bin/bash

echo "🚀 開始部署學習歷程按鈕優化..."
echo ""
echo "📋 更新內容："
echo "  ✅ 移除頂部學習歷程上傳按鈕"
echo "  ✅ 在課程已結束區塊新增「上傳學習歷程」按鈕"
echo "  ✅ 新增漂亮的按鈕樣式和hover效果"
echo ""

# 複製更新的 HTML 文件到 public 目錄
echo "📦 複製更新的檔案..."
docker cp public/perfect-calendar-optimized-complete2.html flb-calendar-nas:/app/public/

# 重啟 Docker 容器以應用更改
echo "🔄 重啟 Docker 容器..."
docker restart flb-calendar-nas

echo ""
echo "⏳ 等待容器啟動..."
sleep 5

# 檢查容器狀態
if docker ps | grep -q flb-calendar-nas; then
    echo "✅ 容器啟動成功"
    echo ""
    echo "🎉 部署完成！"
    echo ""
    echo "📱 測試步驟："
    echo "  1. 開啟行事曆頁面"
    echo "  2. 找到已經結束的課程"
    echo "  3. 確認倒數計時區塊顯示「課程已結束」"
    echo "  4. 確認下方有紫色的「上傳學習歷程」按鈕"
    echo "  5. 點擊按鈕應該跳轉到學習歷程上傳頁面"
    echo ""
    echo "🔍 視覺效果："
    echo "  • 按鈕使用紫色漸層背景"
    echo "  • hover 時有光澤效果掃過"
    echo "  • 區塊整體使用淡紫色背景"
    echo "  • 統一的設計風格"
else
    echo "❌ 容器啟動失敗，請檢查日誌："
    echo "docker logs flb-calendar-nas --tail 50"
fi

