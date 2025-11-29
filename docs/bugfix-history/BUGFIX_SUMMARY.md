# 重複發送提醒問題修復總結

## 📌 問題描述
執行 `redeploy-docker.sh` 重新部署後，已經發送過的提醒會重複發送。

## 🔍 根本原因
在多個地方，系統重置提醒狀態時沒有檢查 `sentAt` 字段，導致已發送的提醒（`status: 'sent'` 且 `sentAt` 有值）被錯誤地重置為 `pending`，從而重複發送。

## 🛠️ 修復內容

### 1. reminder-scheduler.js - cleanupExpiredReminders() 函數

**文件**：`reminder-scheduler.js`  
**行數**：第 324-403 行

**修復點**：
- ✅ 當日提醒（today）：添加 `sentAt` 檢查
- ✅ 隔日提醒（tomorrow）：添加 `sentAt` 檢查  
- ✅ 學生提醒：添加 `sentAt` 檢查

**修復前後對比**：
```javascript
// 修復前
if (scheduledTime && scheduledTime > now) {
  reminder.status = 'pending';  // 無條件重置
}

// 修復後
if (reminder.status === 'sent' && reminder.sentAt) {
  // 已發送過的提醒，保持狀態不變
  console.log(`✅ XXX提醒已發送，保持狀態...`);
} else if (scheduledTime && scheduledTime > now) {
  // 未發送且提醒時間還沒到，重置為 pending
  reminder.status = 'pending';
}
```

### 2. server.js - /api/reminders/reset-today API

**文件**：`server.js`  
**行數**：第 2957-3000 行

**修復點**：
- ✅ 重置今日提醒前檢查是否已發送

**修復前後對比**：
```javascript
// 修復前
reminders.forEach(reminder => {
  if (reminder.courseDate === today) {
    reminder.status = 'pending';  // 無條件重置
  }
});

// 修復後
reminders.forEach(reminder => {
  if (reminder.courseDate === today) {
    if (reminder.status !== 'sent' && !reminder.sentAt) {
      reminder.status = 'pending';  // 只重置未發送的
    } else {
      console.log(`⏭️ 提醒已發送，跳過...`);
    }
  }
});
```

### 3. server.js - /api/reminders/reset-before-class-individual API

**文件**：`server.js`  
**行數**：第 3196-3285 行

**修復點**：
- ✅ 重置個別課前提醒前檢查是否已發送

**修復前後對比**：
```javascript
// 修復前
reminder.status = 'pending';  // 無條件重置
reminder.sentAt = null;

// 修復後
if (reminder.status === 'sent' && reminder.sentAt) {
  return res.status(400).json({
    success: false,
    message: '此提醒已發送過，無法重置',
    sentAt: reminder.sentAt
  });
}
reminder.status = 'pending';
reminder.sentAt = null;
```

## ✅ 已驗證正確的部分

以下部分已有正確的檢查機制，無需修改：

1. **resetBeforeClassReminders()** - 已檢查 `sentAt`
2. **/api/reminders/reset-by-calendar** - 已檢查 `sentAt`
3. **/api/reminders/reset-before-class** - 已檢查 `sentAt`
4. **Docker volumes 配置** - 數據持久化正確
5. **重試機制** - 不會重試已成功的提醒

## 🔐 防護機制

### 三層防護
1. **自動清理層**：`cleanupExpiredReminders()` 不重置已發送的提醒
2. **API 層**：所有重置 API 都檢查 `sentAt` 狀態
3. **數據層**：Docker volumes 確保 `sentAt` 記錄持久化

### 核心原則
**只有 `status !== 'sent'` 且 `!sentAt` 的提醒才能被重置為 `pending`**

## 📋 測試指南

詳見 `TEST_GUIDE.md`

## 🚀 部署步驟

```bash
cd "/Users/apple/Library/CloudStorage/SynologyDrive-樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
./redeploy-docker.sh
```

## 🔍 驗證方法

部署後查看日誌：
```bash
sudo docker-compose logs -f | grep "已發送，保持狀態"
```

應該看到：
```
✅ 當日提醒已發送，保持狀態: SPM 三1630-1730 到府 第4週 - TED (發送時間: 2025-10-01T00:07:29.091Z)
✅ 隔日提醒已發送，保持狀態: ...
✅ 學生提醒已發送，保持狀態: ...
```

## 📊 影響範圍

- ✅ 解決重複發送問題
- ✅ 保持現有功能不變
- ✅ 提高系統可靠性
- ✅ 無需修改資料庫結構
- ✅ 向後兼容

## 📅 修復日期
2025-10-01

## ✍️ 修復者
AI Assistant (Claude Sonnet 4.5)

