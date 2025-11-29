#!/bin/bash

echo "================================"
echo "Flex Message 同步測試腳本"
echo "================================"

BASE_URL="http://localhost:3002"

echo ""
echo "1️⃣ 測試：讀取當前 Flex 範本"
echo "--------------------------------"
curl -s "${BASE_URL}/api/flex-templates" | jq '.data.enabled, .data.templates.today.header.contents | length'

echo ""
echo "2️⃣ 測試：重新載入範本（從磁碟）"
echo "--------------------------------"
curl -s -X POST "${BASE_URL}/api/flex-templates/reload" | jq '.success, .message'

echo ""
echo "3️⃣ 測試：再次讀取確認"
echo "--------------------------------"
curl -s "${BASE_URL}/api/flex-templates" | jq '.data.templates.today.header.contents | length'

echo ""
echo "4️⃣ 檢查：JSON 檔案中的 header contents 數量"
echo "--------------------------------"
cat flex-message-templates.json | jq '.templates.today.header.contents | length'

echo ""
echo "5️⃣ 測試：發送 today 範本測試"
echo "--------------------------------"
curl -s -X POST "${BASE_URL}/api/flex-templates/today/send-test" | jq '.success, .message'

echo ""
echo "================================"
echo "測試完成！"
echo "================================"

