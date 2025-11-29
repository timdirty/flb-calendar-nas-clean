# 🚨 緊急修復：課前提醒無限循環問題

**發現時間**: 2025-10-02 17:06-17:16  
**嚴重程度**: 🔴 **嚴重** - 導致重複發送訊息，騷擾用戶  
**狀態**: ✅ **已修復**

---

## 📌 問題描述

### 用戶報告

系統在 17:06-17:16 期間不停地發送課前提醒：
- 17:06 - 發送今日課程提醒（正常）
- 17:07 - 發送課前提醒（第1次）
- 17:16 - 發送課前提醒（第2次）❌
- 持續發送... ❌

### 關鍵問題

**課程已經在 13:20 和 14:10 開始並結束，但系統在 17:07 和 17:16 仍在發送課前提醒！**

---

## 🔍 根本原因分析

### 問題代碼

**文件**: `reminder-scheduler.js`  
**函數**: `processRemindersByType()`  
**位置**: 第 1043-1049 行（修復前）

```javascript
if (type === 'before-class') {
  filteredReminders = reminders.filter(reminder => 
    reminder.courseDate === today &&           // ✅ 檢查日期
    reminder.status === 'pending' &&           // ✅ 檢查狀態
    reminder.type === type &&                  // ✅ 檢查類型
    new Date(reminder.scheduledTime) <= nowUTC // ✅ 檢查提醒時間
  );
}
```

### 致命漏洞

**缺少課程時間檢查！** ❌

系統只檢查：
1. ✅ 是否為今天的課程
2. ✅ 提醒狀態是否為 pending
3. ✅ 提醒時間是否已到

**但沒有檢查課程是否已經開始或結束！**

### 導致問題

```
課程時間: 13:20
課前提醒時間: 12:50 (提前30分鐘)

12:50 → 發送課前提醒 ✅
13:20 → 課程開始
14:00 → 課程結束

但是提醒狀態仍然是 pending！

每5分鐘排程器檢查一次：
14:00 → 檢查提醒 → status=pending → 再次發送 ❌
14:05 → 檢查提醒 → status=pending → 再次發送 ❌
14:10 → 檢查提醒 → status=pending → 再次發送 ❌
...無限循環...
```

---

## 🛠️ 修復方案

### 核心修復

**位置**: `reminder-scheduler.js` 第 1044-1073 行

**修復前**:
```javascript
if (type === 'before-class') {
  filteredReminders = reminders.filter(reminder => 
    reminder.courseDate === today && 
    reminder.status === 'pending' &&
    reminder.type === type &&
    new Date(reminder.scheduledTime) <= nowUTC
  );
}
```

**修復後**:
```javascript
if (type === 'before-class') {
  // ⭐ 關鍵修復：過濾出課程還沒開始的課前提醒
  filteredReminders = reminders.filter(reminder => {
    if (reminder.courseDate !== today || 
        reminder.status !== 'pending' ||
        reminder.type !== type) {
      return false;
    }
    
    // 檢查課程時間是否還沒開始
    try {
      const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
      const now = new Date();
      
      // ⭐ 如果課程已經開始，不發送課前提醒
      if (courseTime <= now) {
        console.log(`⏭️ 跳過已開始的課程課前提醒: ${reminder.courseName}`);
        // 標記為 expired，避免重複檢查
        reminder.status = 'expired';
        reminder.error = '課程已開始';
        return false;
      }
      
      // 檢查提醒時間是否已到
      const scheduledTime = new Date(reminder.scheduledTime);
      return scheduledTime <= nowUTC;
    } catch (error) {
      console.error(`⚠️ 解析課程時間失敗: ${reminder.courseName}`);
      return false;
    }
  });
}
```

### 保存 expired 狀態

**位置**: `reminder-scheduler.js` 第 1164-1169 行

```javascript
// ⭐ 保存被標記為 expired 的提醒（避免重複檢查）
const expiredCount = reminders.filter(r => r.status === 'expired' && !r.sentAt).length;
if (expiredCount > 0) {
  this.saveReminders(remindersData);
  console.log(`💾 已保存 ${expiredCount} 個 expired 提醒`);
}
```

---

## ✅ 修復效果

### 修復前

```
12:50 → 發送課前提醒 ✅
13:20 → 課程開始
14:00 → 課程結束
14:05 → 再次發送 ❌
14:10 → 再次發送 ❌
14:15 → 再次發送 ❌
...無限循環...
```

### 修復後

```
12:50 → 發送課前提醒 ✅ status: sent
13:20 → 課程開始
14:00 → 課程結束
14:05 → 檢查 → 課程已開始 → 標記 expired → 跳過 ✅
14:10 → 檢查 → status=expired → 跳過 ✅
14:15 → 檢查 → status=expired → 跳過 ✅
...不再發送...
```

---

## 🛡️ 完整防護流程

```
排程器每5分鐘執行
      ↓
檢查課前提醒 (pending 狀態)
      ↓
檢查課程時間
      ↓
    ┌─────────────────┐
    │ 課程已開始？     │
    └─────────────────┘
         ↓          ↓
       是 ↓        否 ↓
         ↓          ↓
標記 expired    檢查提醒時間
         ↓          ↓
    跳過發送      是否已到？
         ↓          ↓
    保存狀態      是 → 發送
                   ↓
              標記 sent
```

---

## 🧪 驗證方法

### 1. 重新部署

```bash
cd "/Users/apple/Library/CloudStorage/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
./redeploy-docker.sh
```

### 2. 觀察日誌

```bash
sudo docker-compose logs -f | grep "課前提醒"
```

**應該看到**:
```
⏭️ 跳過已開始的課程課前提醒: 資訊課402 四 14:10-14:50 (課程時間: 2025-10-02T06:10:00.000Z)
⏭️ 跳過已開始的課程課前提醒: 資訊課501 四 13:20-14:00 (課程時間: 2025-10-02T05:20:00.000Z)
💾 已保存 2 個 expired 提醒
```

**不應該看到**:
```
📤 發送提醒給 TIM: 資訊課402... (重複發送)
```

### 3. 檢查數據

```bash
cat data/reminders.json | grep -A 5 "expired"
```

**應該看到**:
```json
{
  "status": "expired",
  "error": "課程已開始",
  "type": "before-class"
}
```

---

## 📊 影響範圍

### ✅ 解決的問題

1. ✅ 完全阻止課程開始後的課前提醒
2. ✅ 自動標記過期提醒，避免重複檢查
3. ✅ 保存 expired 狀態，持久化防護
4. ✅ 每個排程週期只檢查一次，不再重複

### ⚠️ 為什麼之前的修復沒有生效？

之前的修復針對的是：
- ✅ 系統重啟後不重複創建
- ✅ 清理時保留已發送記錄
- ✅ 重置時檢查 completed 狀態

**但遺漏了最關鍵的一點**：
- ❌ **發送時沒有檢查課程是否已開始**

這個漏洞導致即使有其他防護措施，系統仍然會在每個排程週期檢查並嘗試發送已開始課程的課前提醒。

---

## 🔗 相關修復

1. `BUGFIX_RESTART_DUPLICATE.md` - 重啟重複發送問題
2. `CODE_REVIEW_COMPLETE.md` - 完整代碼審查
3. `BUGFIX_SUMMARY.md` - 原始重複發送修復

本次修復補充了之前遺漏的**最關鍵的運行時檢查**。

---

## ✅ 修復確認

- [x] 修復代碼已完成
- [x] Linter 檢查通過
- [x] 邏輯驗證完成
- [x] 文檔已更新

**緊急程度**: 🔴 **立即部署**

**修復者**: AI Assistant (Claude Sonnet 4.5)  
**日期**: 2025-10-02  
**狀態**: ✅ **已完成，等待部署**

---

## 📝 部署步驟

```bash
# 1. 停止當前服務（立即停止騷擾）
cd "/Users/apple/Library/CloudStorage/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
sudo docker-compose down

# 2. 重新部署修復版本
./redeploy-docker.sh

# 3. 監控日誌
sudo docker-compose logs -f | grep -E "(expired|課前提醒|跳過)"
```

---

## ⚡ 緊急建議

**立即執行部署，停止無限循環！**





