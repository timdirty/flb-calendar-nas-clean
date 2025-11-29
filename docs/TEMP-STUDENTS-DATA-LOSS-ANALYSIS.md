# 臨時學生資料遺失問題分析報告

## 🔴 問題現象

**回報時間**: 2025-11-28  
**問題描述**: `public/temporary_students.json` 檔案會被清空，甚至備份檔案也會被清空

---

## 🔍 根本原因分析

### 原因 1：手動還原操作 ⚠️ **最可能**

**檔案**: `server.js` 第 13865-13915 行  
**API**: `POST /api/temporary-students/restore`

#### 觸發條件
1. 用戶在管理介面點選「還原」按鈕
2. 系統會**直接覆蓋**當前的 `temporary_students.json`

#### 日誌證據
從您提供的日誌可以看到：
```
📝 [臨時學生備份] 已建立備份 (before-restore)：...（1 筆）
✅ [臨時學生還原] 已從備份還原: {
  backupPath: '.../temporary_students-20251128-124755-before-restore.json',
  count: 5
}
```

這表示：
- **當前有 1 筆學生資料**
- **被還原成 12:47 的備份（5 筆）**
- **導致最新的資料遺失**

#### 問題所在
如果還原的備份是**空的**或**過期的**，就會導致資料清空。

---

### 原因 2：自動清理過期學生 ✅ **非資料遺失原因**

**檔案**: `server.js` 第 3381-3438 行  
**函數**: `cleanupExpiredTemporaryStudents()`

#### 觸發條件
- **每天凌晨 01:00（台灣時間）**自動執行
- 清理所有 `scheduledDate` 或 `expiryDate` 已過期的學生

#### 執行邏輯
```javascript
// 1. 從 temporary_students.json 移除過期學生
await safeFile.writeJSON(tempDataPath, { students: validStudents });

// 2. 將過期學生移到封存檔案（不會永久刪除）
await safeFile.atomicUpdate(
  TEMP_STUDENTS_ARCHIVE_PATH,  // data/temporary-students-archive.json
  async (archiveData = { students: [] }) => {
    const existing = Array.isArray(archiveData.students) ? archiveData.students : [];
    return {
      students: [...archivedEntries, ...existing]  // 加入封存
    };
  }
);
```

#### ✅ 重要說明
**自動清理不會導致資料遺失**，過期學生會被移到 `data/temporary-students-archive.json` 封存檔案，可以從管理介面的「封存」分頁查看。資料永久保留，不會被刪除。

#### 影響
- `temporary_students.json` 中看不到過期學生
- 前端「待處理」列表會變空（如果所有學生都過期）
- 但資料仍在封存檔案中，可以隨時查看

---

### 原因 3：GET API 自動過濾 📋

**檔案**: `server.js` 第 13918-13971 行  
**API**: `GET /api/temporary-students`

#### 執行邏輯
每次前端調用 GET API 時，**會自動過濾過期學生**（但不會修改檔案）：

```javascript
const validStudents = tempData.students.filter(s => {
  const expiry = new Date(expirySource + 'T23:59:59');
  return expiry >= now;  // 只返回未過期的
});

res.json({ success: true, data: validStudents });
```

這會導致前端**看不到**過期學生，但檔案本身**未被修改**。

---

## 🎯 確認方法

### 步驟 1：檢查封存檔案
```bash
cat data/temporary-students-archive.json | jq '.students | length'
```

如果封存檔案中有資料，表示是被清理過期學生功能移除的。

### 步驟 2：檢查備份檔案
```bash
ls -lh backups/temporary-students/ | head -20
```

查看最近的備份檔案：
- `*-before-restore.json`：還原前的備份
- `*-auto-cleanup.json`：清理前的備份
- `*-manual-api.json`：手動備份

### 步驟 3：檢查伺服器日誌
搜尋以下關鍵字：
- `✅ [臨時學生還原]`：還原操作
- `🗂️ 已封存`：清理過期學生
- `🗑️ 過濾過期臨時學生`：GET API 過濾

---

## 🛡️ 解決方案

### 方案 1：加強還原確認機制 ⭐ **建議**

#### 修改位置
`public/admin-dashboard.html` 第 12153 行

#### 現有代碼
```javascript
if (!window.confirm('確定要從備份還原臨時學生列表嗎？目前列表將被覆蓋。')) {
    return;
}
```

#### 改進方案
```javascript
// 顯示當前資料筆數和備份資料筆數
const currentCount = tempStudentsCache ? tempStudentsCache.length : 0;
const backupInfo = tempBackupList.find(b => b.fileName === fileName);
const backupCount = backupInfo ? backupInfo.count : '?';

const message = `⚠️ 確定要還原嗎？\n\n當前資料：${currentCount} 筆\n備份資料：${backupCount} 筆\n\n還原後，當前資料將被覆蓋！`;

if (!window.confirm(message)) {
    return;
}
```

---

### 方案 2：修改清理邏輯 - 延長保留時間

#### 修改位置
`server.js` 第 3400 行

#### 現有邏輯
```javascript
const expiry = new Date(`${expirySource}T23:59:59`);
if (expiry >= now) {
  validStudents.push(student);  // 課程當天 23:59:59 前都保留
}
```

#### 改進方案（保留 7 天）
```javascript
const expiry = new Date(`${expirySource}T23:59:59`);
expiry.setDate(expiry.getDate() + 7);  // 課程結束後保留 7 天

if (expiry >= now) {
  validStudents.push(student);
}
```

---

### 方案 3：禁用自動清理 🔒

#### 修改位置
`server.js` 第 3441-3449 行

#### 現有代碼
```javascript
scheduleTask(
    { hour: 1, minute: 0, tz: 'Asia/Taipei' },
    async () => {
      console.log('⏰ [定時任務] 開始清理過期的臨時學生... (台灣時間 01:00)');
      await cleanupExpiredTemporaryStudents();
    }
  );
```

#### 改進方案（加入環境變數控制）
```javascript
const AUTO_CLEANUP_ENABLED = process.env.AUTO_CLEANUP_TEMP_STUDENTS !== 'false';

if (AUTO_CLEANUP_ENABLED) {
  scheduleTask(
      { hour: 1, minute: 0, tz: 'Asia/Taipei' },
      async () => {
        console.log('⏰ [定時任務] 開始清理過期的臨時學生... (台灣時間 01:00)');
        await cleanupExpiredTemporaryStudents();
      }
    );
  console.log('✅ 臨時學生自動清理已啟用（每日 01:00）');
} else {
  console.log('⚠️ 臨時學生自動清理已禁用');
}
```

在 `.env.nas` 中加入：
```bash
# 禁用臨時學生自動清理（設為 false 以禁用）
AUTO_CLEANUP_TEMP_STUDENTS=false
```

---

### 方案 4：還原前顯示備份內容預覽

#### 新增 API
`server.js` 新增 API：
```javascript
// 0.4 預覽備份檔內容
app.get('/api/temporary-students/backups/:fileName/preview', async (req, res) => {
  try {
    const { fileName } = req.params;
    const backupsDir = path.join(__dirname, 'backups', 'temporary-students');
    const backupPath = path.join(backupsDir, fileName);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, message: '找不到備份檔' });
    }

    const raw = await fs.promises.readFile(backupPath, 'utf8');
    const parsed = JSON.parse(raw);
    const students = Array.isArray(parsed.students) ? parsed.students : [];

    res.json({
      success: true,
      data: {
        fileName,
        count: students.length,
        students: students.map(s => ({
          name: s.name,
          type: s.type,
          course: s.course,
          scheduledDate: s.scheduledDate
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## 📊 建議實施優先順序

1. **立即實施**（高優先）
   - ✅ 方案 1：加強還原確認（顯示當前與備份資料筆數）
   - ✅ 方案 3：加入環境變數控制自動清理

2. **短期實施**（中優先）
   - 🔄 方案 2：延長保留時間為 7 天
   - 🔄 方案 4：還原前顯示備份內容預覽

3. **長期優化**（低優先）
   - 📋 建立完整的資料版本控制機制
   - 📋 實現軟刪除（soft delete）而非直接清理

---

## 🧪 測試建議

### 測試 1：還原操作測試
1. 建立 2 筆測試學生
2. 點選「備份」
3. 新增 1 筆學生（共 3 筆）
4. 點選「還原」（應還原為 2 筆）
5. 確認提示訊息正確顯示筆數

### 測試 2：自動清理測試
1. 建立 1 筆過期學生（`scheduledDate: '2025-11-20'`）
2. 建立 1 筆未來學生（`scheduledDate: '2025-12-10'`）
3. 手動觸發清理：`curl -X POST http://localhost:3002/api/cleanup-expired-temp-students`
4. 確認過期學生已移到封存檔案

### 測試 3：GET API 過濾測試
1. 直接修改檔案加入過期學生
2. 調用 `GET /api/temporary-students`
3. 確認回應中**不包含**過期學生
4. 確認檔案本身**未被修改**

---

## 📝 總結

### ⚠️ **真正的資料遺失風險**

**唯一會導致資料永久遺失的原因**：
1. ⚠️ **手動還原操作**：用戶誤操作還原到舊備份或空備份

### ✅ **不會導致資料遺失的機制**

以下機制**不會**導致資料永久遺失：
1. ✅ **自動清理過期學生**：只是移到封存檔案（`data/temporary-students-archive.json`），資料永久保留
2. ✅ **GET API 自動過濾**：不會修改檔案，只是前端顯示時過濾掉過期學生

### 🛡️ **已實施的修復**

**核心修復**（針對真正的風險）：
- ✅ 加強還原確認（顯示當前與備份資料筆數對比）
- ✅ 加入環境變數控制自動清理（可選功能，非必要）

**長期優化目標**：
- 建立完整的資料版本控制
- 還原前顯示備份內容預覽

---

**文檔更新日期**: 2025-11-28  
**回報者**: User  
**分析者**: AI Assistant
