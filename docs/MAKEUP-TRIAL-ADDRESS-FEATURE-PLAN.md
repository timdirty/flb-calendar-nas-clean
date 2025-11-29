# 📍 補課/體驗學生地址欄位與 Google Maps 導航功能規劃

## 📋 需求摘要

為補課/體驗學生表單新增「具體地址」欄位，當有輸入地址時，在 LINE Flex Message 通知中自動加入「導航」按鈕，點擊後直接跳轉至 Google Maps 進行導航。

---

## 🎯 需求分析

### 現況問題
1. ❌ **地點欄位不夠具體**：目前只有簡短地點（如「樂程坊」、「小樹屋」、「到府」）
2. ❌ **地址只能寫在備註**：具體地址只能打在「備註」欄位，家長看得到但無法點擊導航
3. ❌ **缺少導航功能**：家長收到通知後需要手動複製地址到 Google Maps

### 解決方案
1. ✅ **新增專屬欄位**：在表單中新增「具體地址」輸入欄
2. ✅ **智能顯示邏輯**：
   - 若有具體地址 → 顯示完整地址 + 導航按鈕
   - 若無具體地址 → 只顯示簡短地點（如現在）
3. ✅ **一鍵導航**：點擊「導航」按鈕直接開啟 Google Maps

---

## 🏗️ 系統架構分析

### 涉及檔案與模組

| 檔案 | 路徑 | 修改內容 |
|------|------|---------|
| **前端表單** | `public/admin-dashboard.html` | 新增「具體地址」輸入欄位 |
| **資料模型** | `public/temporary_students.json` | 新增 `detailedAddress` 欄位 |
| **後端 Handler** | `routes/handlers/temporaryStudentsHandler.js` | 支援 `detailedAddress` 的 CRUD |
| **後端 API** | `server.js` | 組裝 Google Maps URL 並替換範本變數 |
| **Flex 範本** | `flex-message-templates.json` | 為 `makeupSuccess` 和 `trialSuccess` 加入導航按鈕 |

---

## 📝 詳細實作規劃

### 1️⃣ 前端表單修改（`public/admin-dashboard.html`）

#### 位置：第 5646-5653 行（課程時間區塊內）

**現有程式碼**：
```html
<div class="form-group">
    <label>📍 上課地點</label>
    <input type="text" id="tempStudentLocation" placeholder="例如: 樂程坊 或 到府" value="樂程坊">
    <small style="color: #666; display: block; margin-top: 5px;">
        💡 此資訊會顯示在 LINE 補課通知中
    </small>
</div>
```

**修改為**：
```html
<div class="form-group">
    <label>📍 上課地點（簡稱）<span style="color: #f59e0b;">*</span></label>
    <input type="text" id="tempStudentLocation" placeholder="例如: 樂程坊 或 小樹屋" value="樂程坊">
    <small style="color: #666; display: block; margin-top: 5px;">
        💡 顯示在通知中的簡短地點名稱
    </small>
</div>

<!-- 🔥 新增：具體地址欄位 -->
<div class="form-group">
    <label>🗺️ 具體地址（選填）</label>
    <input type="text" id="tempStudentAddress" placeholder="例如: 10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）">
    <small style="color: #666; display: block; margin-top: 5px;">
        🧭 若填寫，通知訊息中會出現「導航」按鈕，家長可一鍵跳轉 Google Maps
    </small>
</div>
```

#### 位置：第 12600-12654 行（`addTemporaryStudent` 函數）

**現有程式碼**：
```javascript
const location = document.getElementById('tempStudentLocation').value.trim() || '樂程坊';
```

**修改為**：
```javascript
const location = document.getElementById('tempStudentLocation').value.trim() || '樂程坊';
const detailedAddress = document.getElementById('tempStudentAddress').value.trim(); // 🔥 新增
```

**在 previewData 中加入**：
```javascript
const previewData = {
    action: 'add',
    name,
    type,
    course,
    scheduledDate,
    scheduledTime,
    location,
    detailedAddress,  // 🔥 新增
    notificationNote,
    originalPeriod,
    userId
};
```

#### 位置：第 12981-13036 行（`executeAddTemporaryStudent` 函數）

**在 postData 中加入**：
```javascript
const postData = {
    name: data.name,
    type: data.type,
    course: data.course,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    location: data.location,
    detailedAddress: data.detailedAddress,  // 🔥 新增
    notificationNote: data.notificationNote,
    originalPeriod: data.originalPeriod,
    originalCourse: data.course,
    userId: data.userId,
    skipNotification: skipNotification
};
```

#### 位置：第 12482-12529 行（`editTemporaryStudent` 函數）

**在表單填充中加入**：
```javascript
document.getElementById('editStudentLocation').value = student.location || '樂程坊';
document.getElementById('editStudentAddress').value = student.detailedAddress || '';  // 🔥 新增
```

#### 位置：第 12539-12596 行（`saveEditedStudent` 函數）

**在 data 中加入**：
```javascript
const data = {
    name: document.getElementById('editStudentName').value.trim(),
    course: document.getElementById('editStudentCourse').value.trim(),
    scheduledDate: document.getElementById('editStudentDate').value,
    scheduledTime: document.getElementById('editStudentTime').value.trim(),
    location: document.getElementById('editStudentLocation').value.trim() || '樂程坊',
    detailedAddress: document.getElementById('editStudentAddress').value.trim(),  // 🔥 新增
    notificationNote: document.getElementById('editStudentNote').value.trim(),
    userId: document.getElementById('editStudentUserId').value.trim()
};
```

#### 位置：編輯 Modal（需要新增對應的輸入欄位）

**在編輯 Modal 中加入**（約在第 5800 行附近，需搜尋 `editStudentModal`）：
```html
<div class="form-group">
    <label>🗺️ 具體地址（選填）</label>
    <input type="text" id="editStudentAddress" placeholder="例如: 台北市中山區復興北路15號9樓">
</div>
```

---

### 2️⃣ 資料模型修改

#### `public/temporary_students.json` 結構

**新增欄位**：
```json
{
  "students": [
    {
      "id": "temp-student-1234567890",
      "name": "簡喬伊",
      "type": "trial",
      "course": "ESM",
      "scheduledDate": "2025-12-07",
      "scheduledTime": "日 10:00-11:00",
      "location": "小樹屋",
      "detailedAddress": "10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）",
      "notificationNote": "請提前10分鐘到教室準備",
      "userId": "Uxxxxxxxxxxxxxxx",
      "createdAt": "2025-11-28T14:30:00.000Z",
      "updatedAt": "2025-11-28T14:30:00.000Z"
    }
  ]
}
```

**欄位說明**：
- `detailedAddress`：具體地址（選填），若填寫則自動產生 Google Maps 導航連結

---

### 3️⃣ 後端 API 修改

#### A. `routes/handlers/temporaryStudentsHandler.js`

**位置：第 112-155 行（`updateTemporaryStudent` 方法）**

✅ **無需修改**，因為使用了展開運算符 `...updateData`，會自動接收 `detailedAddress`：

```javascript
tempStudents[index] = {
    ...tempStudents[index],
    ...updateData,  // ✅ 自動包含 detailedAddress
    id,
    updatedAt: new Date().toISOString()
};
```

#### B. `server.js` - 通知邏輯修改

**位置：第 14373-14489 行（`/api/send-temporary-student-notification`）**

**修改點 1：準備變數時加入 Google Maps URL**

**現有程式碼（第 14424-14435 行）**：
```javascript
const variables = {
  '{studentName}': student.name || '學生',
  '{courseName}': student.course || '課程',
  '{courseDate}': student.scheduledDate || '',
  '{weekday}': weekday || '',
  '{courseTime}': (student.scheduledTime && student.scheduledTime.trim() !== '') ? student.scheduledTime : '時段未指定',
  '{originalPeriod}': (student.originalPeriod && student.originalPeriod.trim() !== '') ? student.originalPeriod : '無',
  '{teacherName}': '樂程坊講師',
  '{location}': (student.location && student.location.trim() !== '') ? student.location : '樂程坊',
  '{note}': (student.notificationNote && student.notificationNote.trim() !== '') ? student.notificationNote : '無'
};
```

**修改為**：
```javascript
// 🔥 組裝地點顯示文字
let locationDisplay = (student.location && student.location.trim() !== '') ? student.location : '樂程坊';
if (student.detailedAddress && student.detailedAddress.trim() !== '') {
  locationDisplay = `${locationDisplay} | ${student.detailedAddress}`;
}

// 🔥 組裝 Google Maps 導航 URL
let googleMapsUrl = '';
if (student.detailedAddress && student.detailedAddress.trim() !== '') {
  const encodedAddress = encodeURIComponent(student.detailedAddress);
  googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

const variables = {
  '{studentName}': student.name || '學生',
  '{courseName}': student.course || '課程',
  '{courseDate}': student.scheduledDate || '',
  '{weekday}': weekday || '',
  '{courseTime}': (student.scheduledTime && student.scheduledTime.trim() !== '') ? student.scheduledTime : '時段未指定',
  '{originalPeriod}': (student.originalPeriod && student.originalPeriod.trim() !== '') ? student.originalPeriod : '無',
  '{teacherName}': '樂程坊講師',
  '{location}': locationDisplay,  // 🔥 修改：完整地點顯示
  '{note}': (student.notificationNote && student.notificationNote.trim() !== '') ? student.notificationNote : '無',
  '{googleMapsUrl}': googleMapsUrl  // 🔥 新增：Google Maps 導航 URL
};
```

**修改點 2：條件性移除導航按鈕**

**在第 14447 行後新增**：
```javascript
// 🔥 清理 Flex Message：移除空白 text 欄位
template = cleanFlexMessage(template);

// 🔥 新增：若無具體地址，則移除導航按鈕（footer）
if (!googleMapsUrl) {
  delete template.footer;
}
```

---

### 4️⃣ Flex Message 範本修改

#### `flex-message-templates.json`

**位置 1：`makeupSuccess` 範本（第 4188-4371 行）**

**在 body 結束後新增 footer**：
```json
{
  "type": "bubble",
  "size": "kilo",
  "header": { ... },
  "body": { ... },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "primary",
        "action": {
          "type": "uri",
          "label": "🧭 Google Maps 導航",
          "uri": "{googleMapsUrl}"
        },
        "color": "#1877f2",
        "height": "sm"
      }
    ],
    "paddingAll": "15px"
  }
}
```

**位置 2：`trialSuccess` 範本（第 4372-4556 行）**

**在 body 結束後新增 footer**：
```json
{
  "type": "bubble",
  "size": "kilo",
  "header": { ... },
  "body": { ... },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "primary",
        "action": {
          "type": "uri",
          "label": "🧭 Google Maps 導航",
          "uri": "{googleMapsUrl}"
        },
        "color": "#FFD700",
        "height": "sm"
      }
    ],
    "paddingAll": "15px"
  }
}
```

---

### 5️⃣ 前端預覽邏輯修改

#### `public/admin-dashboard.html` - `renderFlexMessage` 函數

**位置：第 12723-12805 行**

**修改點 1：準備變數時加入 googleMapsUrl**

**現有程式碼（第 12771-12781 行）**：
```javascript
const variables = {
    '{studentName}': name,
    '{courseName}': course,
    '{courseDate}': scheduledDate,
    '{weekday}': weekday,
    '{courseTime}': scheduledTime,
    '{originalPeriod}': originalPeriod || '無',
    '{teacherName}': '樂程坊講師',
    '{location}': location || '樂程坊',
    '{note}': notificationNote || ''
};
```

**修改為**：
```javascript
// 🔥 組裝地點顯示文字
const { detailedAddress } = data;
let locationDisplay = location || '樂程坊';
if (detailedAddress && detailedAddress.trim() !== '') {
  locationDisplay = `${locationDisplay} | ${detailedAddress}`;
}

// 🔥 組裝 Google Maps 導航 URL
let googleMapsUrl = '';
if (detailedAddress && detailedAddress.trim() !== '') {
  const encodedAddress = encodeURIComponent(detailedAddress);
  googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

const variables = {
    '{studentName}': name,
    '{courseName}': course,
    '{courseDate}': scheduledDate,
    '{weekday}': weekday,
    '{courseTime}': scheduledTime,
    '{originalPeriod}': originalPeriod || '無',
    '{teacherName}': '樂程坊講師',
    '{location}': locationDisplay,  // 🔥 修改
    '{note}': notificationNote || '',
    '{googleMapsUrl}': googleMapsUrl  // 🔥 新增
};
```

**修改點 2：條件性移除導航按鈕**

**在第 12788 行後新增**：
```javascript
template = JSON.parse(templateString);

// 🔥 新增：若無具體地址，則移除導航按鈕（footer）
if (!googleMapsUrl) {
    delete template.footer;
}

// 🔥 渲染 Flex Message（轉換成 HTML 預覽）
renderFlexBubble(template);
```

#### `renderFlexBubble` 函數修改

**位置：第 12807-12860 行**

**新增 footer 渲染邏輯**（在第 12856 行 `</div>` 前）：

```javascript
<!-- Body -->
<div style="padding: 20px; background: white;">
    ${renderBodyContents(bodyContents)}
</div>

<!-- Footer (🔥 新增) -->
${bubble.footer ? `
    <div style="padding: 15px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        ${renderFooterButtons(bubble.footer.contents)}
    </div>
` : ''}
```

**新增 `renderFooterButtons` 函數**（在第 12916 行後）：

```javascript
// 🔥 新增：渲染 footer 按鈕
function renderFooterButtons(buttons) {
    return buttons.map(button => {
        if (button.type === 'button') {
            const label = button.action?.label || '按鈕';
            const uri = button.action?.uri || '#';
            const color = button.color || '#4f46e5';
            const style = button.style === 'link' ? 'background: transparent; color: #4f46e5; border: 1px solid #4f46e5;' : `background: ${color}; color: white;`;
            
            return `
                <a href="${uri}" target="_blank" style="
                    display: block;
                    text-align: center;
                    padding: 10px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-weight: bold;
                    margin-bottom: 8px;
                    ${style}
                ">${label}</a>
            `;
        }
        return '';
    }).join('');
}
```

---

## ✅ 測試驗證計畫

### 測試案例 1：有具體地址的補課學生

**步驟**：
1. 前往「新增補課/體驗學生」頁面
2. 選擇「補課學生」
3. 填寫必要欄位：
   - 學生：從名單選擇
   - 課程：SPIKE PRO
   - 日期：2025-12-07
   - 時段：選擇現有時段
   - **地點：小樹屋**
   - **具體地址：10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）**
   - 備註：請提前10分鐘到教室準備
4. 點擊「新增補課/體驗學生」
5. 檢查預覽 Modal：
   - ✅ 地點應顯示：`小樹屋 | 10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）`
   - ✅ 應出現「🧭 Google Maps 導航」按鈕
   - ✅ 點擊按鈕應開啟新分頁，跳轉至 Google Maps 並搜尋該地址
6. 確認發送通知：
   - ✅ LINE 訊息中應包含導航按鈕
   - ✅ 家長點擊應能正確導航

**預期結果**：
```
📝 補課設定成功

簡喬伊
ESM

✏️ 已成功安排補課

📅 2025-12-07 六
⏰ 日 10:00-11:00  
🔄 原本時段: 週四 18:30-19:30
📍 小樹屋 | 10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）
💡 請提前10分鐘到教室準備

[🧭 Google Maps 導航] ← 藍色按鈕
```

---

### 測試案例 2：無具體地址的體驗學生

**步驟**：
1. 選擇「體驗學生」
2. 填寫必要欄位：
   - 學生名字：陳小明
   - 課程：BOOST
   - 日期：2025-12-10
   - 時段：自訂「二 14:00-16:00」
   - **地點：樂程坊**
   - **具體地址：（留空）**
3. 點擊「新增補課/體驗學生」
4. 檢查預覽 Modal：
   - ✅ 地點應只顯示：`樂程坊`
   - ✅ 應**不出現**導航按鈕
5. 確認發送通知：
   - ✅ LINE 訊息中應**不包含**導航按鈕

**預期結果**：
```
🌟 體驗課程建立成功

陳小明
BOOST

⚡️ 歡迎來體驗課程！

👨‍🏫 樂程坊講師
📅 2025-12-10 二
⏰ 二 14:00-16:00
📍 樂程坊

（無導航按鈕）
```

---

### 測試案例 3：編輯既有學生的地址

**步驟**：
1. 在臨時學生列表中點擊「編輯」
2. 修改「具體地址」欄位
3. 儲存後重新發送通知
4. 驗證地址和導航按鈕已更新

---

## 📊 影響範圍評估

### 資料庫/儲存
- ✅ **影響等級：低**
- 只新增一個選填欄位 `detailedAddress`
- 現有資料不受影響（向後相容）

### API
- ✅ **影響等級：低**
- 使用展開運算符，自動接收新欄位
- 無需修改 CRUD 邏輯

### 前端
- ⚠️ **影響等級：中**
- 需新增輸入欄位和驗證
- 需修改多處函數（新增、編輯、預覽）

### Flex Message
- ⚠️ **影響等級：中**
- 需修改兩個範本（makeupSuccess、trialSuccess）
- 需實作條件性顯示邏輯

### 通知邏輯
- ⚠️ **影響等級：中**
- 需組裝 Google Maps URL
- 需實作條件性移除 footer

---

## 🚀 實作順序建議

### Phase 1：資料層（15 分鐘）
1. ✅ 修改 `temporary_students.json` 範例資料（加入 `detailedAddress`）
2. ✅ 確認後端 Handler 自動支援（測試 API）

### Phase 2：Flex Message 範本（20 分鐘）
1. ✅ 修改 `makeupSuccess` 範本（加入 footer）
2. ✅ 修改 `trialSuccess` 範本（加入 footer）
3. ✅ 測試範本語法正確性

### Phase 3：後端通知邏輯（30 分鐘）
1. ✅ 修改 `server.js` 中的變數組裝邏輯
2. ✅ 實作 Google Maps URL 生成
3. ✅ 實作條件性移除 footer 邏輯
4. ✅ 測試 API `/api/send-temporary-student-notification`

### Phase 4：前端表單（45 分鐘）
1. ✅ 新增「具體地址」輸入欄位（新增 Modal）
2. ✅ 新增「具體地址」輸入欄位（編輯 Modal）
3. ✅ 修改 `addTemporaryStudent` 函數
4. ✅ 修改 `executeAddTemporaryStudent` 函數
5. ✅ 修改 `editTemporaryStudent` 函數
6. ✅ 修改 `saveEditedStudent` 函數

### Phase 5：前端預覽（30 分鐘）
1. ✅ 修改 `renderFlexMessage` 函數
2. ✅ 修改 `renderFlexBubble` 函數
3. ✅ 新增 `renderFooterButtons` 函數
4. ✅ 測試預覽 Modal 顯示

### Phase 6：整合測試（30 分鐘）
1. ✅ 測試案例 1（有地址）
2. ✅ 測試案例 2（無地址）
3. ✅ 測試案例 3（編輯地址）
4. ✅ 手機實測 LINE 訊息與導航功能

**總預估時間：2.5 小時**

---

## 🔐 安全性考量

### Google Maps URL 安全性
- ✅ 使用 `encodeURIComponent()` 編碼地址，防止 URL 注入
- ✅ LINE Bot 會自動驗證 `uri` 格式，拒絕不安全的連結
- ✅ 使用官方 Google Maps Search API 格式：
  ```
  https://www.google.com/maps/search/?api=1&query={address}
  ```

### 輸入驗證
- ✅ 前端：限制地址長度（建議 200 字元以內）
- ✅ 後端：Trim 空白字元
- ✅ 資料庫：儲存原始文字（不執行任何指令）

---

## 📚 參考資料

### Google Maps URL Scheme
- **搜尋地址**：`https://www.google.com/maps/search/?api=1&query={address}`
- **座標導航**：`https://www.google.com/maps/search/?api=1&query={lat},{lng}`
- **Place ID**：`https://www.google.com/maps/search/?api=1&query_place_id={placeId}`

### LINE Flex Message Button
- **文檔**：[LINE Developers - Flex Message](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/)
- **URI Action**：支援 `http://`、`https://`、`tel://` 等協定

---

## ✅ 完成檢查清單

### 開發階段
- [ ] Phase 1：資料層修改完成
- [ ] Phase 2：Flex Message 範本修改完成
- [ ] Phase 3：後端通知邏輯修改完成
- [ ] Phase 4：前端表單修改完成
- [ ] Phase 5：前端預覽修改完成

### 測試階段
- [ ] 測試案例 1：有地址的補課學生（桌面）
- [ ] 測試案例 2：無地址的體驗學生（桌面）
- [ ] 測試案例 3：編輯地址功能（桌面）
- [ ] 手機實測：LINE 訊息顯示正確
- [ ] 手機實測：導航按鈕可點擊並跳轉
- [ ] 手機實測：Google Maps 正確搜尋地址

### 部署階段
- [ ] 備份現有 `temporary_students.json`
- [ ] 備份現有 `flex-message-templates.json`
- [ ] 備份現有 `server.js` 和 `admin-dashboard.html`
- [ ] 部署修改檔案
- [ ] 重啟伺服器
- [ ] 生產環境驗證

### 文檔階段
- [ ] 更新 `AGENTS.md` 記錄此功能
- [ ] 建立使用者操作手冊（截圖說明）
- [ ] 更新 API 文檔（若需要）

---

## 📝 備註

1. **向後相容性**：所有修改均向後相容，不影響現有資料
2. **可選功能**：具體地址為選填，不填寫時功能與現在完全相同
3. **擴展性**：未來可擴展支援座標定位、多個地址等進階功能
4. **Google Maps 替代方案**：若需要支援其他地圖（如 Apple Maps），可在按鈕中使用 Universal Links

---

**文檔版本**：v1.0  
**建立日期**：2025-11-28  
**最後更新**：2025-11-28  
**負責人**：AI Assistant (Cascade)
