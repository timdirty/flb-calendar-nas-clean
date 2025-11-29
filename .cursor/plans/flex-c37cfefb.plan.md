<!-- c37cfefb-e676-4a5b-84d8-27d29fb2fa1d f2023fff-82d7-482e-bfa5-a880eaf449d3 -->
# Flex 工作流程強化計畫

## 工作項目

1. 現況檢視

- 釐清 `public/course-reminder-management.html` 既有 Flex 編輯器與按鈕掛載行為
- 盤點 `server.js`、`notification-manager.js`、`flex-message-templates.json` 對 Flex 範本的讀寫與測試發送邏輯

2. 前端功能實作

- 補齊 `previewFlexMessage()`、`renderFlexMessagePreview()` 等流程，將 JSON 解析結果渲染到 `#flexMessagePreview`
- 強化 JSON 驗證訊息、錯誤提示與變數摘要，必要時提供預設示例資料
- 完成 `saveFlexTemplate()`/`saveAllFlexSettings()` 實際更新 `flexTemplatesData` 並呼叫後端 API
- 在 Flex 區域新增「測試發送」按鈕，透過 Fetch 呼叫新後端介面，顯示進度與回饋

3. 後端 API 擴充

- 優化 `/api/flex-templates` 讀寫：驗證輸入、確保與 `flex-message-templates.json` 同步
- 新增 `POST /api/flex-templates/:type/send-test` 或類似端點，組合預設變數與目標範本，呼叫 `notificationManager` 送測試訊息給管理員
- 覆核 `notification-manager.js` Flex 組裝流程，必要時補齊 altText、Quick Reply 支援

4. 測試與文件

- 於前端介面手動驗證：預覽、儲存、重新載入、測試發送全流程
- 使用真實/模擬資料執行一次後端到前端的全流程測試
- 視需要更新 `FLEX_MESSAGE_DEPLOYMENT_GUIDE.md` 或相關文件，註明新流程與限制

## 待辦追蹤

- [ ] audit-current
- [ ] frontend-preview-save
- [ ] backend-api-test-send
- [ ] manual-verification-docs

### To-dos

- [ ] 檢視現有 Flex 編輯器、後端範本與測試發送邏輯現況
- [ ] 實作用戶端 Flex 預覽、驗證、儲存與測試發送流程
- [ ] 擴充 Flex 範本 API 並提供管理員測試發送支援
- [ ] 手動驗證 Flex 工作流程並更新相關文件說明