# 特殊事件設定功能 - 完整技術文檔

**版本**：2.0  
**最後更新**：2025-11-22  
**狀態**：✅ 生產就緒

---

## 📋 目錄

- [功能概述](#功能概述)
- [特殊事件類型](#特殊事件類型)
- [前端實現](#前端實現)
- [後端實現](#後端實現)
- [API 文檔](#api-文檔)
- [使用範例](#使用範例)
- [測試指南](#測試指南)
- [故障排除](#故障排除)

---

## 功能概述

特殊事件設定功能允許管理員為行事曆事件添加特殊標記，包括停課、體驗、代課、改時間和公告。

### 核心特性

- ✅ **5 種特殊事件類型**：停課、體驗、代課、改時間、公告
- ✅ **互斥規則自動處理**：防止不合理的標記組合
- ✅ **多標記支援**：可同時套用多個相容的標記
- ✅ **前後端雙重驗證**：確保資料完整性
- ✅ **描述保留機制**：預設保留原事件描述
- ✅ **代課日曆移動**：自動將事件移動到代課講師的日曆
- ✅ **增量模式**：保留現有標記，追加新標記

---

## 特殊事件類型

### 1. 停課 🔴

**關鍵字**：停課、取消、暫停、休息、放假、請假  
**顏色**：#ef4444  
**行為**：標題加上 `[停課]`  
**互斥**：與體驗、代課、改時間互斥

### 2. 體驗 🟢

**關鍵字**：體驗、體驗課、體驗班  
**顏色**：#10b981  
**行為**：標題加上 `[體驗]`  
**互斥**：與停課互斥

### 3. 代課 🔵

**關鍵字**：代課、代理、支援  
**顏色**：#3b82f6  
**行為**：
- 標題加上 `[代課]`
- 描述加上 `[代課講師] XXX`
- **自動移動事件到代課講師的日曆**

**必要欄位**：
- 代課講師（必須選擇，不能為空，不能選原講師）

**互斥**：與停課互斥

### 4. 改時間 🟠

**關鍵字**：調課、延後、提前、改時間  
**顏色**：#f59e0b  
**行為**：
- 標題加上 `[改時間]`
- **更新事件的開始和結束時間**

**必要欄位**：
- 新的開始時間
- 新的結束時間（必須晚於開始時間）

**互斥**：與停課互斥

### 5. 公告 🟣

**關鍵字**：公告、通知、提醒  
**顏色**：#9333ea  
**行為**：
- **不改變標題**
- 描述加上 `[公告] XXX`
- **可與任何標記組合**

**必要欄位**：
- 公告內容（必填，最多 500 字）

---

## 前端實現

### 檔案位置
```
public/admin-dashboard.html
```

### 核心變數

```javascript
// 第 14795-14798 行
let adminSelectedEventId = null;           // 當前選擇的事件 ID
let adminSelectedEventTypes = [];           // 多選陣列
let adminCurrentEventData = null;           // 快取當前事件完整資料
```

### 互斥規則

```javascript
// 第 14803-14808 行
const MUTUALLY_EXCLUSIVE_RULES = {
    '停課': ['體驗', '代課', '改時間'],
    '體驗': ['停課'],
    '代課': ['停課'],
    '改時間': ['停課']
    // 公告不在規則中，可與任何標記組合
};
```

### 主要函數

#### 1. 打開模態框

```javascript
// 第 15729 行
function openSpecialEventModal(eventId) {
    const event = adminAllEvents.find(e => e.id === eventId);
    adminCurrentEventData = event;
    adminSelectedEventId = eventId;
    adminSelectedEventTypes = [];
    
    // 顯示模態框並預設勾選「保留原描述」
    document.getElementById('preserveDescriptionToggle').checked = true;
}
```

#### 2. 選擇特殊事件類型

```javascript
// 第 16093 行
function selectSpecialEventType(type) {
    if (adminSelectedEventTypes.includes(type)) {
        // 取消選擇
        adminSelectedEventTypes = adminSelectedEventTypes.filter(t => t !== type);
    } else {
        // 檢查互斥規則
        const mutexTypes = MUTUALLY_EXCLUSIVE_RULES[type] || [];
        const conflictingTypes = adminSelectedEventTypes.filter(t => mutexTypes.includes(t));
        
        if (conflictingTypes.length > 0) {
            // 自動取消衝突的標記
            adminSelectedEventTypes = adminSelectedEventTypes.filter(t => !mutexTypes.includes(t));
            showToast(`⚠️ 「${type}」與「${conflictNames}」互斥\n已自動取消`, 'warning');
        }
        
        adminSelectedEventTypes.push(type);
    }
    
    updateSpecialEventButtonsUI();
    updateSpecialEventFields();
}
```

#### 3. 提交特殊事件標記

```javascript
// 第 16600 行
async function confirmSpecialEventMark() {
    // 驗證：至少選擇一個標記
    if (adminSelectedEventTypes.length === 0) {
        showToast('❌ 請至少選擇一個特殊事件類型', 'error');
        return;
    }
    
    // 代課驗證
    if (adminSelectedEventTypes.includes('代課')) {
        const substituteTeacher = document.getElementById('substituteTeacher').value;
        
        // 驗證 1：空值檢查
        if (!substituteTeacher || substituteTeacher.trim() === '') {
            showToast('❌ 請選擇代課講師', 'error');
            return;
        }
        
        // 驗證 2：原講師檢查
        const originalInstructor = adminCurrentEventData?.instructor;
        if (originalInstructor && substituteTeacher === originalInstructor) {
            showToast(`❌ 不能選擇原授課講師「${originalInstructor}」作為代課講師`, 'error');
            return;
        }
        
        requestData.substituteTeacher = substituteTeacher;
    }
    
    // 改時間驗證
    if (adminSelectedEventTypes.includes('改時間')) {
        const newStartTimeStr = document.getElementById('newStartTime').value;
        const newEndTimeStr = document.getElementById('newEndTime').value;
        
        if (!newStartTimeStr || !newEndTimeStr) {
            showToast('❌ 請選擇新的上課時間', 'error');
            return;
        }
        
        // 轉換為 Unix timestamp（台灣時區）
        const convertToTaipeiTimestamp = (dateTimeStr) => {
            const dateTimeWithTimezone = dateTimeStr + ':00+08:00';
            return Math.floor(new Date(dateTimeWithTimezone).getTime() / 1000);
        };
        
        const newStartTime = convertToTaipeiTimestamp(newStartTimeStr);
        const newEndTime = convertToTaipeiTimestamp(newEndTimeStr);
        
        if (newEndTime <= newStartTime) {
            showToast('❌ 結束時間必須晚於開始時間', 'error');
            return;
        }
        
        requestData.newStartTime = newStartTime;
        requestData.newEndTime = newEndTime;
    }
    
    // 公告驗證
    if (adminSelectedEventTypes.includes('公告')) {
        const announcementContent = announcementRaw.trim();
        if (!announcementContent) {
            showToast('❌ 請輸入公告內容', 'error');
            return;
        }
        requestData.announcementContent = announcementContent;
    }
    
    // 發送請求
    const response = await fetch('/api/events/mark-special', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    
    if (result.success) {
        if (result.warning) {
            showToast(`⚠️ ${result.warning}`, 'warning');
        } else {
            showToast('✅ 特殊事件標記成功！', 'success');
        }
        closeSpecialEventModal();
        await reloadAdminEvents();
    }
}
```

---

## 後端實現

### 檔案位置
```
server.js (第 4430-5250 行)
```

### API 端點

#### POST /api/events/mark-special

**請求參數**：
```javascript
{
    eventId: string,                    // 必填：事件 ID
    specialTypes: string[],             // 必填：特殊事件類型陣列
    note: string,                       // 選填：備註
    preserveDescription: boolean,       // 選填：保留原描述（預設 true）
    
    // 代課相關
    substituteTeacher: string,          // 必填（當包含代課時）
    
    // 改時間相關
    newStartTime: number,               // 必填（當包含改時間時）
    newEndTime: number,                 // 必填（當包含改時間時）
    
    // 公告相關
    announcementContent: string         // 必填（當包含公告時）
}
```

**成功回應**：
```javascript
{
    success: true,
    message: '事件標記成功',
    updatedEvent: {
        id: string,
        title: string,
        description: string,
        markers: string[]
    },
    warning: string  // 選填：警告訊息
}
```

### 核心流程

#### 1. 參數驗證

```javascript
// 第 4448-4533 行
// 驗證 eventId
if (!eventId) {
    return res.status(400).json({ error: '缺少必要參數: eventId' });
}

// 驗證代課必須提供代課講師
if (markers.includes('代課')) {
    if (!substituteTeacher || substituteTeacher.trim() === '') {
        return res.status(400).json({ error: '代課需要提供代課講師' });
    }
}

// 驗證公告必須提供公告內容
if (markers.includes('公告')) {
    if (!announcementContent || announcementContent.trim() === '') {
        return res.status(400).json({ error: '公告需要提供 announcementContent' });
    }
}
```

#### 2. 代課講師二次驗證

```javascript
// 第 4599-4618 行
// 在找到事件後，檢查代課講師是否為原講師
if (markers.includes('代課') && substituteTeacher) {
    const originalInstructor = event.instructor;
    if (originalInstructor && substituteTeacher === originalInstructor) {
        console.error('❌ 代課驗證失敗：選擇的代課講師與原講師相同');
        return res.status(400).json({
            error: `不能選擇原授課講師「${originalInstructor}」作為代課講師`
        });
    }
}
```

#### 3. 代課日曆移動

```javascript
// 第 4784-4847 行
if (markers.includes('代課') && substituteTeacher) {
    // 獲取所有日曆
    const calendars = await caldavClient.getCalendars();
    
    // 模糊比對講師名稱
    const normalizeStr = (str) => str.replace(/\s+/g, '').toLowerCase();
    targetCalendar = calendars.find(cal => {
        const calName = normalizeStr(cal.displayName);
        const targetName = normalizeStr(substituteTeacher);
        return calName === targetName || 
               calName.includes(targetName) || 
               targetName.includes(calName);
    });
    
    if (targetCalendar && targetId !== currentId) {
        needMoveCalendar = true;
    } else if (!targetCalendar) {
        console.warn(`找不到「${substituteTeacher}」的日曆，將使用原日曆`);
        substitutionWarning = `找不到講師「${substituteTeacher}」的日曆，事件已標記為代課但保留在原日曆`;
    }
}
```

#### 4. 移動事件流程

```javascript
// 第 4943-5127 行
if (needMoveCalendar && targetCalendar) {
    // 步驟 1：獲取完整事件資料
    const fullEvent = await caldavClient.getEventByIcalUid(calendarId, eventIcalUid);
    
    // 步驟 2：補回描述（如需保留）
    if (preserveOriginalDescription && !baseDescription && fullEvent.description) {
        baseDescription = fullEvent.description;
        newDescription = buildNewDescription(baseDescription);
    }
    
    // 步驟 3：構建新事件資料
    const newEventData = {
        title: newTitle,
        description: newDescription,
        dtstart: fullEvent.dtstart,
        dtend: fullEvent.dtend,
        is_repeat_evt: false  // 代課事件強制為單次事件
    };
    
    // 步驟 4：創建新事件
    const createResult = await caldavClient.createEvent(
        targetCalendarId, 
        newEventData, 
        targetOriginalCalId
    );
    
    // 步驟 5：刪除原事件
    await caldavClient.deleteEvent(calendarId, eventIcalUid);
}
```

#### 5. 描述保留機制

```javascript
// 第 4676-4714 行
const buildNewDescription = (baseDesc = '') => {
    // 1. 根據參數決定是否保留原描述
    let newDesc = preserveOriginalDescription ? (baseDesc || '') : '';
    
    // 2. 清理舊的特殊事件標記
    newDesc = cleanDescriptionMarkers(newDesc);
    
    // 3. 添加新的特殊事件資訊
    const sections = [];
    if (note && note.trim()) {
        sections.push(`[特殊事件備註] ${note.trim()}`);
    }
    if (markers.includes('代課') && substituteTeacher) {
        sections.push(`[代課講師] ${substituteTeacher}`);
    }
    if (markers.includes('公告') && announcementContent) {
        sections.push(`[公告] ${announcementContent.trim()}`);
    }
    
    // 4. 組合描述
    if (sections.length > 0) {
        newDesc = newDesc ? `${newDesc}\n\n${sections.join('\n\n')}` : sections.join('\n\n');
    }
    
    return newDesc.trim();
};
```

---

## API 文檔

### POST /api/events/mark-special

標記事件為特殊事件。

**請求標頭**：
```
Content-Type: application/json
```

**請求體**：
```json
{
  "eventId": "event-123",
  "specialTypes": ["代課", "改時間"],
  "note": "原講師臨時有事",
  "preserveDescription": true,
  "substituteTeacher": "YOKI",
  "newStartTime": 1700000000,
  "newEndTime": 1700003600
}
```

**成功回應（200）**：
```json
{
  "success": true,
  "message": "事件標記成功",
  "updatedEvent": {
    "id": "event-123",
    "title": "[代課][改時間] 原標題",
    "description": "原描述\n\n[特殊事件備註] 原講師臨時有事\n\n[代課講師] YOKI",
    "markers": ["代課", "改時間"]
  },
  "warning": "找不到講師「XX」的日曆，事件已標記為代課但保留在原日曆"
}
```

**錯誤回應（400）**：
```json
{
  "success": false,
  "error": "代課需要提供代課講師"
}
```

### POST /api/events/remove-special

移除特殊事件標記。

**請求體**：
```json
{
  "eventId": "event-123"
}
```

**成功回應（200）**：
```json
{
  "success": true,
  "message": "特殊事件標記已移除"
}
```

---

## 使用範例

### 範例 1：標記停課

```javascript
const response = await fetch('/api/events/mark-special', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        eventId: 'event-123',
        specialTypes: ['停課'],
        note: '颱風天停課',
        preserveDescription: true
    })
});
```

### 範例 2：代課 + 改時間

```javascript
const response = await fetch('/api/events/mark-special', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        eventId: 'event-123',
        specialTypes: ['代課', '改時間'],
        substituteTeacher: 'YOKI',
        newStartTime: 1700000000,
        newEndTime: 1700003600,
        note: '原講師請假',
        preserveDescription: true
    })
});
```

### 範例 3：公告（不改標題）

```javascript
const response = await fetch('/api/events/mark-special', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        eventId: 'event-123',
        specialTypes: ['公告'],
        announcementContent: '請攜帶教材',
        preserveDescription: true
    })
});
```

---

## 測試指南

### 手動測試清單

```
□ 基本功能
  □ 停課標記
  □ 體驗標記
  □ 代課標記（正常流程）
  □ 改時間標記
  □ 公告標記

□ 驗證測試
  □ 代課：不選講師 → 顯示錯誤
  □ 代課：選原講師 → 顯示錯誤
  □ 改時間：不填時間 → 顯示錯誤
  □ 公告：不填內容 → 顯示錯誤

□ 互斥規則
  □ 停課 + 體驗 → 自動取消停課
  □ 停課 + 代課 → 自動取消停課
  □ 代課 + 改時間 → 兩者保留
  □ 任何 + 公告 → 兩者保留

□ 描述保留
  □ 勾選保留 → 原描述 + 新資訊
  □ 取消勾選 → 僅新資訊
  □ 代課移動 → 保留描述
```

### 自動化測試

```bash
# 啟動測試伺服器
npm run dev

# 執行完整測試
node tests/manual/test-special-event-full-cycle.js
```

---

## 故障排除

### 問題 1：代課後事件沒有移動

**原因**：找不到代課講師的日曆  
**解決方案**：
1. 確認講師名稱拼寫正確
2. 檢查講師是否有 Synology Calendar 日曆
3. 查看日誌中的警告訊息

### 問題 2：描述被清空

**原因**：未勾選「保留原描述」  
**解決方案**：
1. 打開特殊事件模態框時，預設會勾選
2. 確認提交前勾選狀態
3. 檢查 `preserveDescription` 參數是否為 `true`

### 問題 3：互斥標記未自動取消

**原因**：前端 UI 更新延遲  
**解決方案**：
1. 檢查 `updateSpecialEventButtonsUI()` 是否被調用
2. 確認 `MUTUALLY_EXCLUSIVE_RULES` 規則正確
3. 清除瀏覽器快取重試

### 問題 4：改時間後時間不正確

**原因**：時區處理錯誤  
**解決方案**：
1. 確認使用台灣時區（UTC+8）
2. 檢查時間戳記轉換邏輯
3. 驗證 `convertToTaipeiTimestamp` 函數

---

## 技術規格

### 前端技術棧
- 原生 JavaScript（ES6+）
- 無框架依賴
- Fetch API

### 後端技術棧
- Node.js + Express
- Synology Calendar API
- Synology Drive API

### 資料格式
- 時間：Unix timestamp（秒）
- 字符編碼：UTF-8
- 日曆 ID 格式：`/calendar-name/`

### 效能指標
- 前端驗證：< 10ms
- API 響應時間：< 500ms
- 代課移動操作：1-2 秒

---

**文檔版本**：2.0  
**維護者**：FLB 開發團隊  
**最後更新**：2025-11-22
