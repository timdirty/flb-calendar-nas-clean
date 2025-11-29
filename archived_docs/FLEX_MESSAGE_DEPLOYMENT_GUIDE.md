# 📱 Flex Message 提醒系統 - 完整部署與使用指南

## ✅ 系統功能總覽

### 已完成功能

#### 🔧 後端功能
1. ✅ **Flex Message 建構器** (`notification-manager.js`)
   - `buildFlexMessage()` - 單一 Flex Message 建構
   - `buildCarousel()` - 多事件 Carousel 組合（最多10個bubbles）
   - `buildQuickReply()` - Quick Reply 快速回覆按鈕
   - `sendLineMessage()` - 支援 Flex/文字/Quick Reply 發送
   - `sendTestMessage()` - 測試模式（僅發給管理員）

2. ✅ **API 端點** (`server.js`)
   - `GET /api/flex-templates` - 讀取 Flex 範本
   - `POST /api/flex-templates` - 儲存 Flex 範本
   - `POST /api/reminders/:id/send` - 正式發送（支援 Flex Message）
   - `POST /api/reminders/:id/send-test` - 測試發送
   - `POST /api/reminders/batch-send` - 批次發送（支援 Carousel 分組）
   - `POST /webhook/line` - LINE Webhook 接收 Quick Reply
   - `POST /api/quick-reply/attendance` - 處理出席回覆
   - `GET /api/student-responses` - 查詢學生回應記錄

3. ✅ **資料檔案**
   - `flex-message-templates.json` - 4種預設範本
   - `student-responses.json` - 學生出席回應記錄

#### 🎨 前端功能
1. ✅ **Flex Message 設定介面**
   - 啟用/停用切換開關
   - 範本類型選擇（當日/隔日/課前/學生）
   - 雙模式編輯器（可視化 + JSON）

2. ✅ **JSON 編輯器**
   - 深色主題 code editor
   - 即時 JSON 語法驗證
   - 載入預設範本功能

3. ✅ **可視化編輯器**
   - 元件庫（標題、文字、按鈕、分隔線）
   - 顏色選擇器（標題背景色、主題色、文字色）
   - 快速變數插入按鈕
   - 即時預覽（HTML 模擬器）

4. ✅ **Quick Reply 設定**
   - 自訂回覆選項（會出席/請假/待確認）
   - 動態新增/移除選項
   - 請假原因設定

5. ✅ **測試模式**
   - 每個提醒都有「測試發送」按鈕
   - 顯示使用的訊息格式（Flex/文字）

## 🚀 部署步驟

### 1. 確認文件已更新
```bash
# 確認以下文件存在
ls -la notification-manager.js
ls -la server.js
ls -la public/course-reminder-management.html
ls -la flex-message-templates.json
ls -la student-responses.json
```

### 2. 重啟服務
```bash
# 停止現有服務
pm2 stop flb-calendar

# 重新啟動
pm2 start server.js --name flb-calendar

# 查看日誌
pm2 logs flb-calendar
```

### 3. 設定 LINE Webhook
在 LINE Developers Console 設定：
```
Webhook URL: https://your-domain.com/webhook/line
```

## 📋 使用流程

### 方案 A：使用預設範本（推薦新手）

1. **訪問管理介面**
   ```
   https://your-domain/course-reminder-management.html
   ```

2. **進入「訊息範本」頁面**

3. **啟用 Flex Message**
   - 點擊「啟用 Flex Message」切換開關

4. **載入預設範本**
   - 選擇範本類型（例如：當日提醒範本）
   - 點擊「載入預設範本」
   - 查看預覽

5. **儲存設定**
   - 點擊「儲存所有 Flex Message 設定」

6. **測試發送**
   - 回到「提醒管理」頁面
   - 找到任一提醒，點擊「🧪 測試」按鈕
   - 檢查管理員的 LINE 是否收到 Flex Message

### 方案 B：自訂範本（進階使用者）

#### 使用 JSON 編輯器

1. **切換到 JSON 編輯器模式**

2. **編輯 JSON**
   ```json
   {
     "type": "bubble",
     "header": {
       "type": "box",
       "layout": "vertical",
       "contents": [{
         "type": "text",
         "text": "📚 課程提醒",
         "color": "#ffffff",
         "size": "lg",
         "weight": "bold"
       }],
       "backgroundColor": "#4f46e5",
       "paddingAll": "15px"
     },
     "body": {
       "type": "box",
       "layout": "vertical",
       "contents": [
         {
           "type": "text",
           "text": "{teacherName} 講師",
           "weight": "bold"
         },
         {
           "type": "text",
           "text": "{courseName}",
           "margin": "md"
         }
       ]
     }
   }
   ```

3. **驗證 JSON**
   - 點擊「驗證 JSON」
   - 確認格式正確

4. **預覽效果**
   - 點擊「預覽 Flex Message」
   - 在可視化編輯器中查看效果

#### 使用可視化編輯器

1. **切換到可視化編輯器模式**

2. **使用元件庫**
   - 點擊「標題區塊」添加 header
   - 點擊「文字」添加內容
   - 點擊「按鈕」添加按鈕

3. **調整顏色**
   - 使用顏色選擇器設定
   - 再次點擊元件按鈕應用新顏色

4. **插入變數**
   - 切換到 JSON 編輯器
   - 點擊快速變數按鈕
   - 例如插入 `{teacherName}`

5. **即時預覽**
   - 點擊「預覽 Flex Message」
   - 查看實際效果

## 🎯 多事件 Carousel 發送

### 自動分組模式

當使用批次發送時，系統會自動：

1. **按收件者分組**
   - 同一講師的多個提醒合併

2. **生成 Carousel**
   - 2-10 個提醒 → Carousel（橫向滑動）
   - 1 個提醒 → 單一 Bubble

3. **批次發送 API**
   ```javascript
   POST /api/reminders/batch-send
   {
     "reminderIds": ["id1", "id2", "id3"],
     "groupByRecipient": true,  // 啟用分組
     "sendDelay": 3000
   }
   ```

### 手動測試 Carousel

1. 創建多個提醒給同一講師
2. 確保 Flex Message 已啟用
3. 使用批次發送功能
4. 講師會收到 Carousel 格式訊息

## 📱 Quick Reply 使用

### 設定 Quick Reply 選項

1. **進入訊息範本頁面**

2. **設定回覆選項**
   - 預設：會出席、請假、待確認
   - 可自訂標籤文字

3. **設定請假原因**
   - 逗號分隔：生病, 家庭因素, 臨時有事, 其他

### Quick Reply 流程

1. **家長收到學生提醒**
   - 顯示 Flex Message
   - 底部顯示 Quick Reply 按鈕

2. **點擊回覆**
   - 家長點擊「會出席」或「請假」

3. **系統記錄**
   - 儲存到 `student-responses.json`
   - 發送確認訊息給家長
   - 通知管理員

4. **查詢記錄**
   ```
   GET /api/student-responses
   ```

## 🧪 測試檢查清單

### 基本功能測試

- [ ] Flex Message 開關可正常切換
- [ ] 範本可正常載入和儲存
- [ ] JSON 驗證功能正常
- [ ] 預覽功能正常顯示

### 發送測試

- [ ] 測試發送成功（管理員收到）
- [ ] 正式發送成功（講師收到）
- [ ] Flex Message 格式正確
- [ ] 變數替換正確

### Carousel 測試

- [ ] 單一提醒 → 單一 Bubble
- [ ] 多個提醒 → Carousel
- [ ] 橫向滑動正常
- [ ] 最多 10 個 Bubbles

### Quick Reply 測試

- [ ] 學生提醒顯示 Quick Reply 按鈕
- [ ] 點擊按鈕有回應
- [ ] 記錄正確儲存
- [ ] 確認訊息正常發送

### Webhook 測試

- [ ] Webhook URL 設定正確
- [ ] 接收 Quick Reply 回應
- [ ] 處理 Postback 正常
- [ ] 通知管理員正常

## 📊 可用變數列表

在 Flex Message JSON 中可使用以下變數：

### 基本資訊
- `{teacherName}` - 講師姓名
- `{courseName}` - 課程名稱
- `{courseTime}` - 課程時間
- `{courseDate}` - 課程日期
- `{location}` - 地點
- `{description}` - 描述

### 連結
- `{lessonPlanUrl}` - 教案連結
- `{googleMapsUrl}` - Google 地圖連結

### 時間相關
- `{weekday}` - 星期幾
- `{currentTime}` - 當前時間
- `{currentDate}` - 當前日期
- `{timeUntilClass}` - 距離上課時間

### 提醒類型
- `{reminderType}` - 提醒類型（today/tomorrow/before-class）
- `{reminderTypeText}` - 提醒類型文字（當日/隔日/課前）

### 系統資訊
- `{systemName}` - 系統名稱
- `{reminderId}` - 提醒ID

## 🔧 故障排除

### Flex Message 沒有發送

1. **檢查是否啟用**
   ```
   GET /api/flex-templates
   → 確認 enabled: true
   ```

2. **檢查範本是否存在**
   - 確認 `flex-message-templates.json` 檔案存在
   - 確認有對應的範本類型

3. **查看日誌**
   ```bash
   pm2 logs flb-calendar
   ```

### Quick Reply 沒有反應

1. **檢查 Webhook 設定**
   - LINE Developers Console
   - 確認 Webhook URL 正確
   - 確認 Webhook 已啟用

2. **測試 Webhook**
   ```bash
   curl -X POST https://your-domain/webhook/line \
     -H "Content-Type: application/json" \
     -d '{"events":[]}'
   ```

### 預覽無法顯示

1. **檢查 JSON 格式**
   - 使用「驗證 JSON」功能
   - 確認是 bubble 或 carousel 類型

2. **清除瀏覽器快取**
   - Ctrl+F5 強制重新載入

## 📝 維護建議

### 定期備份

```bash
# 備份範本
cp flex-message-templates.json flex-message-templates.json.backup

# 備份學生回應記錄
cp student-responses.json student-responses.json.backup
```

### 監控日誌

```bash
# 即時監控
pm2 logs flb-calendar --lines 100

# 搜尋錯誤
pm2 logs flb-calendar | grep "ERROR"
```

### 效能監控

```bash
# 檢查記憶體使用
pm2 monit

# 檢查 API 回應時間
# 在瀏覽器開發者工具 Network 面板查看
```

## 🎉 完成！

系統現已完全整合 Flex Message 功能。所有提醒都會：
- 自動檢測是否啟用 Flex Message
- 支援文字訊息作為備用方案
- 支援多事件 Carousel 組合
- 支援學生提醒 Quick Reply
- 提供完整的測試模式

如有問題，請查看日誌或聯繫技術支援。

