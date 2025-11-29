# 🔧 重啟後重複發送課前提醒問題修復總結

## 📌 問題描述

系統重啟後，**已經發送過的課前提醒會重複發送**，即使課程時間已經過了。

### 實際案例

用戶在 2025-10-02 16:53 收到了兩個課前提醒：
1. 資訊課402 四 14:10-14:50 (課程時間 14:10，已經過了)
2. 資訊課501 四 13:20-14:00 (課程時間 13:20，已經過了)

## 🔍 根本原因分析

### 問題流程

1. ✅ 課前提醒正常發送 → `status: 'sent'`, `sentAt: 發送時間`
2. ❌ `cleanupExpiredReminders()` 執行時發現課程時間已過 → **無條件刪除提醒**（無論是否已發送）
3. ❌ `reminders.json` 中不再有該提醒的記錄
4. ❌ 系統重啟後 → 重新從行事曆創建提醒（因為沒有已存在的記錄）
5. ❌ 再次發送 → **造成重複發送**

### 問題代碼

**位置**: `reminder-scheduler.js` 第 341-344 行（修復前）

```javascript
if (courseTime <= now) {
  // 課程已結束，移除課前提醒
  console.log(`🗑️ 移除過期課前提醒: ${reminder.courseName} - ${reminder.teacherName}`);
  // 不加入 activeReminders，即移除
}
```

**問題**: 這個邏輯會無條件刪除課程時間已過的課前提醒，**不管它是否已經發送過**。

## 🛠️ 修復方案

### 核心思路

**保留已發送過的課前提醒記錄（即使課程時間已過）**，並標記為 `completed` 狀態。這樣系統重啟後能識別該提醒已發送，不會重複創建。

### 修復內容

#### 1️⃣ 保留已發送的課前提醒記錄

**文件**: `reminder-scheduler.js`  
**位置**: 第 339-364 行

```javascript
} else if (reminder.type === 'before-class') {
  // 課前提醒：如果課程已經結束，檢查是否需要保留記錄
  if (courseTime <= now) {
    // 課程已結束
    // ⭐ 關鍵修復：如果已發送過，保留記錄（防止重啟後重複發送）
    if (reminder.status === 'sent' && reminder.sentAt) {
      // 已發送過的課前提醒，保留記錄但標記為 completed
      reminder.status = 'completed';
      activeReminders.push(reminder);
      console.log(`✅ 課前提醒已發送並完成，保留記錄: ${reminder.courseName}`);
    } else {
      // 未發送過且已過期，可以安全移除
      console.log(`🗑️ 移除未發送的過期課前提醒: ${reminder.courseName}`);
      // 不加入 activeReminders，即移除
    }
  } else {
    // 課程還沒開始，只重置未發送的提醒
    if (reminder.status !== 'sent' && !reminder.sentAt) {
      reminder.status = 'pending';
      console.log(`🔄 重置課前提醒狀態: ${reminder.courseName}`);
    } else {
      console.log(`⏭️ 課前提醒已發送，保持狀態: ${reminder.courseName}`);
    }
    activeReminders.push(reminder);
  }
}
```

#### 2️⃣ 創建提醒時檢查 completed 狀態

**文件**: `reminder-scheduler.js`  
**位置**: 第 775-785 行

```javascript
if (!existingReminder) {
  existingReminders.push(reminder);
  console.log(`✅ 創建${typeName}: ${event.title} - ${event.instructor}`);
} else {
  // 檢查提醒是否已經發送過或已完成
  if ((existingReminder.status === 'sent' || existingReminder.status === 'completed') 
      && existingReminder.sentAt) {
    console.log(`⏭️ ${typeName}已發送，跳過創建: ${event.title} (狀態: ${existingReminder.status})`);
  } else {
    console.log(`⏭️ ${typeName}已存在: ${event.title} (狀態: ${existingReminder.status})`);
  }
}
```

#### 3️⃣ 定期清理舊的 completed 提醒

**文件**: `reminder-scheduler.js`  
**位置**: 第 426-448 行

```javascript
// 清理超過 24 小時的 completed 狀態提醒（避免數據文件無限增長）
const oneDayAgo = new Date(nowUTC.getTime() - (24 * 60 * 60 * 1000));
const beforeCleanupCount = remindersData.reminders.length;
remindersData.reminders = remindersData.reminders.filter(reminder => {
  if (reminder.status === 'completed' && reminder.sentAt) {
    const sentTime = new Date(reminder.sentAt);
    if (sentTime < oneDayAgo) {
      console.log(`🗑️ 清理舊的 completed 提醒: ${reminder.courseName}`);
      return false; // 移除
    }
  }
  return true; // 保留
});
```

## 🛡️ 防護機制

### 三層防護

1. **保留層** (`cleanupExpiredReminders`)
   - 已發送的課前提醒標記為 `completed` 並保留
   - 未發送的過期提醒才會被刪除

2. **創建層** (`createRemindersForEvent`)
   - 檢查 `sent` 或 `completed` 狀態的提醒
   - 跳過重複創建

3. **清理層** (定期清理)
   - 清理超過 24 小時的 `completed` 提醒
   - 避免數據文件無限增長

## 📊 修復效果

### 修復前

```
課前提醒發送 → sent → 課程結束 → 被刪除 → 重啟 → 重新創建 → 重複發送 ❌
```

### 修復後

```
課前提醒發送 → sent → 課程結束 → 標記 completed 保留 → 重啟 → 檢查到已存在 → 跳過創建 ✅
                                              ↓
                                         24小時後清理
```

## ✅ 驗證方法

### 1. 重啟測試

```bash
cd "/Users/apple/Library/CloudStorage/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
./redeploy-docker.sh
```

### 2. 查看日誌

```bash
sudo docker-compose logs -f | grep "課前提醒"
```

**應該看到**:

```
✅ 課前提醒已發送並完成，保留記錄: 資訊課402 四 14:10-14:50 外 第5週 - TIM (發送時間: 2025-10-02T08:53:15.123Z)
⏭️ 課前提醒已發送，跳過創建: 資訊課402 四 14:10-14:50 外 第5週 - TIM (狀態: completed, 發送時間: 2025-10-02T08:53:15.123Z)
```

**不應該看到**:

```
📤 發送提醒給 TIM: 資訊課402... (重複發送)
```

### 3. 檢查 reminders.json

```bash
cat data/reminders.json | grep -A 10 "before-class"
```

**應該看到 completed 狀態的提醒**:

```json
{
  "id": "reminder_xxx",
  "courseName": "資訊課402 四 14:10-14:50 外 第5週",
  "type": "before-class",
  "status": "completed",
  "sentAt": "2025-10-02T08:53:15.123Z"
}
```

## 📅 修復日期

2025-10-02

## ✍️ 修復者

AI Assistant (Claude Sonnet 4.5)

## 🔗 相關文檔

- `BUGFIX_SUMMARY.md` - 之前的重複發送問題修復
- `final-protection-report.md` - 課前提醒防護機制報告
- `TEST_GUIDE.md` - 測試指南






