#!/bin/bash

echo "🔧 修復學生簽到檔案權限問題"
echo "================================"
echo ""

# 設定檔案路徑
STUDENT_DATA="./public/student_data.json"

# 1. 檢查檔案是否存在
if [ ! -f "$STUDENT_DATA" ]; then
    echo "❌ 錯誤：找不到 $STUDENT_DATA"
    exit 1
fi

echo "✅ 找到檔案: $STUDENT_DATA"
echo ""

# 2. 顯示當前權限
echo "📊 當前檔案狀態："
ls -lh "$STUDENT_DATA"
echo ""

# 3. 備份檔案
echo "💾 備份檔案..."
cp "$STUDENT_DATA" "${STUDENT_DATA}.backup-$(date +%Y%m%d-%H%M%S)"
echo "✅ 備份完成"
echo ""

# 4. 修改權限為 666 (所有人可讀寫)
echo "🔒 修改檔案權限為 666..."
chmod 666 "$STUDENT_DATA"
echo "✅ 權限修改完成"
echo ""

# 5. 顯示新權限
echo "📊 新的檔案狀態："
ls -lh "$STUDENT_DATA"
echo ""

# 6. 重啟 Docker 容器以應用變更
echo "🔄 重啟 Docker 容器..."
sudo docker-compose restart
echo ""

# 7. 等待服務啟動
echo "⏳ 等待服務啟動 (10 秒)..."
sleep 10
echo ""

# 8. 檢查容器狀態
echo "📊 容器狀態："
sudo docker-compose ps
echo ""

# 9. 檢查容器內的檔案權限
echo "📊 容器內檔案權限："
sudo docker exec flb-calendar-nas ls -lh /app/public/student_data.json
echo ""

# 10. 檢查最新日誌
echo "📋 最新日誌（檢查是否還有權限錯誤）："
sudo docker-compose logs --tail=20 | grep -E "(EACCES|permission|student_data)" || echo "✅ 沒有發現權限錯誤"
echo ""

echo "================================"
echo "✅ 修復完成！"
echo ""
echo "📝 下一步："
echo "1. 請在前端重新測試學生簽到功能"
echo "2. 簽到後重新打開，確認狀態是否保存"
echo "3. 如果還有問題，請查看完整日誌：sudo docker-compose logs --tail=100"
echo "================================"

