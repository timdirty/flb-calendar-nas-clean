# Flex Message 範本同步問題 - 完整修復報告

## 🔍 問題診斷

### 發現的問題
1. **前端編輯器修改無法同步到後端**
   - 用戶在編輯器改了 JSON
   - 按「儲存所有設定」時，送到後端的 payload 裡 `templates` 是舊的
   - 因為 `saveAllFlexSettings()` 沒有先把編輯器的內容同步到 `flexTemplatesData.templates[當前類型]`

2. **測試發送讀取的是後端記憶體**
   - 測試發送是呼叫後端 API
   - 後端直接讀 `notificationManager.flexTemplates`（記憶體中的版本）
   - 如果前端沒有先儲存，後端記憶體還是舊的

3. **JSON 檔案 enabled 為 false**
   - `flex-message-templates.json` 中 `"enabled": false`
   - 雖然測試發送會強制使用 Flex，但前端 UI 狀態可能不一致

## ✅ 已完成的修復

### 1. 前端修復：`course-reminder-management.html`

#### 修復 A：儲存所有設定前自動同步編輯器內容
**位置**：`saveAllFlexSettings()` 函數（約第 7127 行）

**修改內容**：
```javascript
async function saveAllFlexSettings() {
    try {
        // 確保把「目前編輯中的 JSON」一併同步到要儲存的 templates
        const templateType = document.getElementById('flexTemplateType').value;
        const editorEl = document.getElementById('flexJsonEditor');
        if (editorEl && templateType) {
            try {
                const parsed = JSON.parse(editorEl.value);
                if (!flexTemplatesData) flexTemplatesData = {};
                if (!flexTemplatesData.templates) flexTemplatesData.templates = {};
                flexTemplatesData.templates[templateType] = parsed;
            } catch (e) {
                // 當前 JSON 不合法就阻止儲存，避免覆蓋成空
                showError('請先修正 Flex JSON 格式再儲存所有設定。');
                return;
            }
        }
        
        // ... 其餘儲存邏輯
    }
}
```

**效果**：
- ✅ 儲存前自動驗證並同步編輯器內容
- ✅ JSON 不合法會阻止儲存，避免覆蓋
- ✅ 確保送到後端的是最新版本

#### 修復 B：測試發送前先同步到後端
**位置**：`sendTestFlexTemplate()` 函數（約第 7222 行）

**修改內容**：
```javascript
async function sendTestFlexTemplate() {
    try {
        // 驗證 JSON
        const validation = validateFlexJson();
        if (!validation || !validation.valid) {
            showError('請先修正 Flex JSON 格式再測試發送');
            return;
        }

        showInfo('正在同步範本到後端並發送測試...');

        // 🔥 先把編輯器中的 JSON 同步到 flexTemplatesData
        if (!flexTemplatesData) flexTemplatesData = { templates: {}, quickReply: {}, carousel: {} };
        if (!flexTemplatesData.templates) flexTemplatesData.templates = {};
        flexTemplatesData.templates[templateType] = validation.parsed;

        // 🔥 先儲存到後端，確保後端記憶體是最新版本
        const savePayload = {
            enabled: document.getElementById('flexMessageEnabled')?.checked || false,
            templates: flexTemplatesData.templates,
            quickReply: flexTemplatesData.quickReply || { enabled: true, perType: {}, options: [], leaveReasons: [] },
            carousel: flexTemplatesData.carousel || { maxBubbles: 10 }
        };

        const saveResponse = await fetch('/api/flex-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savePayload)
        });

        const saveData = await saveResponse.json();
        if (!saveData.success) {
            throw new Error('同步範本到後端失敗: ' + saveData.message);
        }

        console.log('✅ 範本已同步到後端');

        // 🔥 再執行測試發送
        const response = await fetch(`/api/flex-templates/${templateType}/send-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.success) {
            showSuccess(`✅ 測試訊息已發送給管理員！\n範本類型: ${templateType}\n（範本已自動儲存）`);
        }
    } catch (error) {
        showError('測試發送時發生錯誤: ' + error.message);
    }
}
```

**效果**：
- ✅ 測試發送前自動先儲存到後端
- ✅ 確保測試的是最新編輯的內容
- ✅ 提示用戶「範本已自動儲存」

### 2. 後端修復：`server.js`

#### 新增重新載入 API
**位置**：第 3528 行（在 GET /api/flex-templates 之後）

**新增內容**：
```javascript
// 重新載入 Flex Message 範本（從磁碟讀取，更新後端記憶体）
app.post('/api/flex-templates/reload', (req, res) => {
  try {
    notificationManager.flexTemplates = notificationManager.loadFlexTemplates();
    res.json({
      success: true,
      message: 'Flex Message 範本已重新載入',
      data: notificationManager.flexTemplates
    });
  } catch (error) {
    console.error('❌ 重新載入 Flex 範本失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '重新載入 Flex 範本失敗', 
      error: error.message 
    });
  }
});
```

**效果**：
- ✅ 提供手動重新載入功能
- ✅ 無需重啟容器即可更新後端記憶體
- ✅ 可用於手動同步 JSON 檔案的修改

### 3. JSON 範本修復：`flex-message-templates.json`

**已添加 logo 到所有範本的 header**：
```json
{
  "type": "image",
  "url": "https://calendar.funlearnbar.synology.me/logo.jpg",
  "size": "xxs",
  "position": "absolute",
  "offsetTop": "6px",
  "offsetEnd": "6px",
  "gravity": "top",
  "aspectMode": "cover",
  "aspectRatio": "1:1"
}
```

**影響的範本**：
- ✅ today（當日課程提醒）
- ✅ tomorrow（明日課程提醒）
- ✅ beforeClass（課前提醒）
- ✅ student（學生課程通知）

## 📋 完整測試步驟

### 前置條件
1. 確保 Docker 容器正在運行
2. 瀏覽器開啟 `course-reminder-management.html`

### 測試流程 A：前端編輯器測試

1. **開啟 Flex Message 編輯器**
   - 勾選「啟用 Flex Message」
   - 選擇範本類型（例如：today）

2. **編輯 JSON 範本**
   - 在編輯器中修改某個欄位（例如改標題文字）
   - 點擊「驗證 JSON」確認格式正確

3. **測試發送**
   - 直接點擊「測試發送」按鈕
   - 應該看到提示：「正在同步範本到後端並發送測試...」
   - 成功後顯示：「✅ 測試訊息已發送給管理員！（範本已自動儲存）」

4. **驗證同步**
   - 重新載入頁面
   - 選擇同一個範本類型
   - 確認編輯器中顯示的是剛才修改的版本

### 測試流程 B：手動儲存測試

1. **編輯 JSON 範本**
   - 在編輯器中修改內容

2. **儲存所有設定**
   - 點擊「儲存所有 Flex Message 設定」按鈕
   - 應該看到：「✅ Flex Message 設定已儲存」

3. **重新載入伺服器資料**
   - 點擊「重新載入伺服器資料」按鈕
   - 確認編輯器顯示最新內容

4. **測試發送驗證**
   - 點擊「測試發送」
   - 收到的 LINE 訊息應該包含最新修改

### 測試流程 C：後端 API 直接測試

使用提供的測試腳本：

```bash
cd /path/to/flb-calendar-nas
chmod +x test-flex-sync.sh
./test-flex-sync.sh
```

預期輸出：
```
1️⃣ 讀取當前 Flex 範本
false
2  ← header.contents 數量（包含 text 和 image）

2️⃣ 重新載入範本（從磁碟）
true
"Flex Message 範本已重新載入"

3️⃣ 再次讀取確認
2  ← 應該和 JSON 檔案一致

4️⃣ JSON 檔案中的 header contents 數量
2  ← 確認

5️⃣ 測試發送
true
"測試 Flex 範本已發送給管理員"
```

### 測試流程 D：驗證 Logo 顯示

1. **發送測試訊息**
   - 對每個範本類型（today、tomorrow、beforeClass、student）執行測試發送

2. **檢查 LINE 訊息**
   - 打開 LINE，查看管理員收到的測試訊息
   - 確認每個訊息的右上角都有 logo 圖片
   - Logo 應該是小尺寸（xxs）、圓形或方形

3. **如果 Logo 未顯示**
   - 檢查 `https://calendar.funlearnbar.synology.me/logo.jpg` 是否可公開存取
   - 在瀏覽器直接開啟該 URL 確認
   - LINE 的 Flex Message 只支援公開 HTTPS URL

## 🐛 常見問題排查

### 問題 1：修改後測試發送，收到的還是舊版本

**原因**：可能是以下之一
1. JSON 格式錯誤，儲存被阻止
2. 瀏覽器快取

**解決方法**：
1. 檢查瀏覽器 Console 是否有錯誤訊息
2. 按 F12 → Network 面板 → 清除快取並重新整理
3. 確認「測試發送」的提示訊息包含「範本已自動儲存」

### 問題 2：Logo 沒有顯示

**原因**：
1. 圖片 URL 無法存取
2. LINE 快取舊版本訊息

**解決方法**：
1. 在瀏覽器開啟 `https://calendar.funlearnbar.synology.me/logo.jpg` 確認可存取
2. 修改 URL 參數強制 LINE 重新抓取：`logo.jpg?v=2`
3. 確認 logo.jpg 檔案在 `public/` 目錄下

### 問題 3：重新載入後顯示舊版本

**原因**：
1. 後端記憶體沒有更新
2. JSON 檔案沒有被正確寫入

**解決方法**：
1. 執行 `POST /api/flex-templates/reload`
2. 檢查 Docker 容器內的 JSON 檔案：
   ```bash
   docker exec flb-calendar-nas cat flex-message-templates.json | jq '.templates.today.header.contents | length'
   ```
3. 如果數量不是 2，表示儲存失敗

### 問題 4：Docker 容器未運行

**檢查方法**：
```bash
docker ps | grep flb-calendar
```

**啟動容器**：
```bash
docker start flb-calendar-nas
# 或
docker-compose up -d
```

## 📊 資料流向圖

```
前端編輯器
    │
    │ 修改 JSON
    ↓
flexTemplatesData (前端記憶體)
    │
    │ 點擊「測試發送」或「儲存所有設定」
    ↓
POST /api/flex-templates (同步到後端)
    │
    ↓
flex-message-templates.json (磁碟檔案)
    │
    ↓
notificationManager.flexTemplates (後端記憶體)
    │
    │ 測試發送時讀取
    ↓
LINE Messaging API (實際發送)
    │
    ↓
管理員收到訊息
```

## ✅ 驗證檢查表

- [ ] 前端編輯 JSON 後，點擊「測試發送」能看到最新內容
- [ ] 前端編輯 JSON 後，點擊「儲存所有設定」→「重新載入」能看到最新內容
- [ ] 重新整理頁面後，之前的修改仍然存在
- [ ] 所有四個範本類型（today/tomorrow/beforeClass/student）的右上角都有 logo
- [ ] Logo 圖片可以正常顯示（大小、位置正確）
- [ ] Quick Reply 僅在 student 類型顯示（today/tomorrow/beforeClass 沒有）
- [ ] 修改 enabled 開關後，實際發送時會生效

## 🎯 總結

### 核心修改
1. **前端測試發送自動儲存**：確保測試的永遠是最新編輯的內容
2. **前端儲存前自動同步**：避免編輯器的修改被遺漏
3. **後端提供重新載入 API**：無需重啟即可更新
4. **JSON 範本添加 Logo**：所有範本統一添加右上角 logo

### 使用建議
1. **日常編輯流程**：編輯 → 測試發送（自動儲存）→ 查看 LINE 訊息
2. **批量修改流程**：編輯所有範本 → 儲存所有設定 → 逐一測試發送
3. **緊急修復流程**：直接編輯 JSON 檔案 → 呼叫 reload API

### 未來優化建議
1. 前端增加「儲存單個範本」按鈕
2. 測試發送前顯示確認對話框（含預覽）
3. 支援範本版本控制（儲存歷史記錄）
4. 提供範本匯入/匯出功能

