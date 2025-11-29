# 🚨 課前提醒無限循環發送 - 緊急修復

**發現時間**: 2025-10-02 19:20  
**嚴重程度**: 🔴 **極嚴重** - 課前提醒每5分鐘重複發送  
**狀態**: 🔧 **修復中**

---

## 📌 問題描述

用戶報告課前提醒在正確時間（19:00）發送後，每5分鐘重複發送：
- 19:03 - 第1次（正常）
- 19:08 - 第2次（重複）
- 19:13 - 第3次（重複）
- 19:18 - 第4次（重複）

課程：SPIKE 一 1930-2100 客製化 第4週

---

## 🔍 問題分析

### 數據狀態

```json
{
  "id": "reminder_1759395049398_y5p69j780",
  "type": "before-class",
  "status": "failed",
  "sentAt": "2025-10-02T11:02:26.119Z",
  "scheduledTime": "2025-10-02T11:00:00.000Z",
  "retryCount": 0,
  "maxRetries": 3,
  "error": "getaddrinfo ENOTFOUND api.line.me"
}
```

**關鍵發現**：
1. **status: "failed"** - 發送失敗（網絡錯誤）
2. **error: "getaddrinfo ENOTFOUND api.line.me"** - DNS解析失敗
3. **sentAt 有值** - 11:02:26（第一次嘗試發送的時間）
4. **retryCount: 0** - 沒有進入重試邏輯

### 問題根源

**重試邏輯的缺陷**（`sendReminder()` 第686-689行）：

```javascript
const shouldRetry = error.message.includes('429') || 
                   error.message.includes('速率限制') ||
                   error.message.includes('timeout');
```

**問題**：
- 只處理 429、速率限制、timeout 錯誤
- **不處理網絡連接錯誤**（ENOTFOUND, ECONNREFUSED, ETIMEDOUT等）
- 網絡錯誤直接設為 `failed` 狀態，不進入重試

### 推測的循環流程

**每5分鐘執行**：
1. `runScheduledTasks()` 執行
2. `resetBeforeClassReminders()` 執行
3. 檢查 `failed` 狀態的提醒
4. **某個地方把 `failed` 重置為 `pending`**（推測）
5. `processBeforeClassReminders()` 執行
6. 找到 `pending` 狀態的提醒
7. 再次發送 → 再次失敗 → 再次設為 `failed`
8. 循環繼續...

---

## 🛠️ 修復方案

### 修復 1: 擴展重試錯誤類型

**問題**：網絡錯誤不進入重試邏輯

**修復**：增加網絡錯誤的檢測

```javascript
const shouldRetry = error.message.includes('429') || 
                   error.message.includes('速率限制') ||
                   error.message.includes('timeout') ||
                   error.message.includes('ENOTFOUND') ||
                   error.message.includes('ECONNREFUSED') ||
                   error.message.includes('ETIMEDOUT') ||
                   error.message.includes('ENETUNREACH');
```

### 修復 2: 防止 failed 狀態被重置

**檢查 `resetBeforeClassReminders()` 是否會重置 `failed` 狀態**

當前第2206行：
```javascript
if (beforeClassTime > now && 
    reminder.status !== 'sent' && 
    reminder.status !== 'completed' && 
    !reminder.sentAt) {
  reminder.status = 'pending';
}
```

**分析**：
- `reminder.status !== 'sent'` → `failed` 通過 ✓
- `reminder.status !== 'completed'` → `failed` 通過 ✓
- `!reminder.sentAt` → `failed` 有 sentAt，**不通過** ✗

**結論**：此處不會重置 `failed` 狀態 ✓

### 修復 3: 檢查過濾邏輯

**`processRemindersByType()` 第1113行**：

```javascript
if (reminder.courseDate !== today || 
    reminder.status !== 'pending' ||
    reminder.type !== type) {
  return false;
}
```

**分析**：
- `reminder.status !== 'pending'` → `failed` 不等於 `pending`
- **結論**：`failed` 狀態的提醒**不會被過濾出來** ✓

### 修復 4: 添加 failed 狀態的過期檢查

**問題**：`failed` 狀態的提醒可能永久留在數據庫中

**修復**：在 `cleanupExpiredReminders()` 中添加對 `failed` 狀態的處理

---

## 🎯 最終修復

根據分析，主要問題可能是：
1. 網絡錯誤不進入重試邏輯
2. `failed` 狀態的提醒需要被清理

讓我立即實施修復...

---

**狀態**: 🔧 正在實施修復


