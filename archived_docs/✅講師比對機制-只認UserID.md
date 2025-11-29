# ✅ 講師比對機制更新 - 只認 UserID

**更新時間：** 2025-10-16  
**版本：** v2.2  
**重要性：** 🔥 核心邏輯變更

---

## 🎯 重大更新內容

### 核心變更：
**自動跳轉講師機制現在只認 LINE USER ID，完全不管 DisplayName！**

---

## 📊 資料格式變更

### teacher_data.json 新格式

#### ❌ 舊格式（物件）：
```json
{
  "teachers": {
    "TIM": "Udb51363eb6fdc605a6a9816379a38103",
    "YOKI": "Ucf9b239b708001ed44f0710704282655",
    ...
  }
}
```

#### ✅ 新格式（陣列）：
```json
{
  "teachers": [
    { "name": "TIM", "userId": "Udb51363eb6fdc605a6a9816379a38103" },
    { "name": "YOKI", "userId": "Ucf9b239b708001ed44f0710704282655" },
    { "name": "TED", "userId": "U213b36e8024ab1d2b895b24082c21270" },
    ...
  ],
  "last_update": "2025-10-16T08:00:00.000000"
}
```

**優勢：**
- ✅ 標準的 JSON 陣列結構
- ✅ `name` 和 `userId` 欄位明確
- ✅ 易於遍歷和查詢
- ✅ 支援更多擴展欄位（如 email、role 等）

---

## 🔄 自動跳轉邏輯變更

### ❌ 舊邏輯（複雜且不可靠）：

```javascript
// 1. 先比對 userId（精確匹配）
matchedTeacher = teachers.find(t => t.userId === userId);

// 2. userId 失敗，嘗試 displayName 完全匹配
matchedTeacher = teachers.find(t => t.name === displayName);

// 3. displayName 完全匹配失敗，嘗試包含匹配
matchedTeacher = teachers.find(t => 
    t.name.includes(displayName) || displayName.includes(t.name)
);

// 4. 包含匹配失敗，嘗試模糊匹配（移除特殊符號）
matchedTeacher = teachers.find(t => 
    cleanName(t.name) === cleanName(displayName)
);

// 5. 模糊匹配失敗，提取英文部分匹配
matchedTeacher = teachers.find(t => 
    englishParts.some(part => t.name.includes(part))
);
```

**問題：**
- ❌ DisplayName 可能改變（用戶修改 LINE 暱稱）
- ❌ DisplayName 可能重複（如多個 "Tim"）
- ❌ 包含特殊字元、emoji（如 "Tim🙏🏻"）
- ❌ 多種匹配邏輯導致不確定性
- ❌ 可能匹配錯誤的講師

---

### ✅ 新邏輯（簡單且可靠）：

```javascript
// 只進行 userId 精確比對（不區分大小寫）
matchedTeacher = teachers.find(teacher => 
    teacher.userId && 
    teacher.userId.toLowerCase() === userId.toLowerCase()
);

if (matchedTeacher) {
    console.log('✅ UserID 匹配成功:', matchedTeacher.name);
    // 自動跳轉到該講師
} else {
    console.log('❌ UserID 比對失敗，顯示綁定選單');
    // 顯示綁定選單讓用戶手動選擇
}
```

**優勢：**
- ✅ **只認 LINE USER ID**（唯一且不變）
- ✅ 完全不管 DisplayName（避免名稱變更問題）
- ✅ 邏輯簡單清晰（單一比對條件）
- ✅ 100% 準確（UserID 唯一對應）
- ✅ 效能更好（單次查詢）

---

## 📋 完整流程圖

### 用戶開啟系統流程

```
用戶開啟 LINE LIFF 應用
    ↓
LIFF 登入成功
    ↓
取得用戶資訊：
  - userId: "Udb51363eb6fdc605a6a9816379a38103"
  - displayName: "Tim🙏🏻" (可能改變，不使用)
    ↓
調用 GET /api/teachers
    ↓
後端返回：
{
  "success": true,
  "data": {
    "teachers": [
      { "name": "TIM", "userId": "Udb51363..." },
      { "name": "YOKI", "userId": "Ucf9b239..." },
      ...
    ]
  }
}
    ↓
前端比對 userId（只認 USER ID）
    ↓
┌─────────────────┬─────────────────┐
│  找到匹配 ✅     │  找不到匹配 ❌   │
└─────────────────┴─────────────────┘
         ↓                  ↓
  顯示該講師行事曆    自動跳出綁定選單
         ↓                  ↓
  顯示「解除綁定」按鈕  用戶選擇講師
                          ↓
                    寫入 teacher_data.json
                          ↓
                    下次自動比對成功 ✅
```

---

## 🔧 後端 API 變更

### 1. GET /api/teachers

**返回格式（統一）：**
```json
{
  "success": true,
  "data": {
    "teachers": [
      { "name": "TIM", "userId": "Udb51363..." },
      { "name": "YOKI", "userId": "Ucf9b239..." }
    ],
    "count": 12,
    "lastUpdate": "2025-10-16T08:00:00.000000"
  },
  "timestamp": "2025-10-16T08:05:23.731Z"
}
```

**兼容性：**
- ✅ 自動偵測 teacher_data.json 格式（物件 or 陣列）
- ✅ 自動轉換舊格式為新格式
- ✅ 統一返回陣列格式給前端

---

### 2. POST /api/teacher-binding

**請求：**
```json
{
  "userId": "Udb51363eb6fdc605a6a9816379a38103",
  "teacherName": "TIM"
}
```

**處理邏輯：**
```javascript
// 1. 檢查該 userId 是否已綁定
const existingIndex = teachers.findIndex(t => t.userId === userId);

if (existingIndex !== -1) {
  // 已綁定，更新 name
  teachers[existingIndex].name = teacherName;
} else {
  // 未綁定，新增
  teachers.push({ name: teacherName, userId: userId });
}
```

**寫入格式：**
```json
{
  "teachers": [
    { "name": "TIM", "userId": "Udb51363..." },
    { "name": "新講師", "userId": "Uxxx..." }
  ],
  "last_update": "2025-10-16T08:10:00.000000"
}
```

---

### 3. POST /api/teacher-unbinding

**請求：**
```json
{
  "userId": "Udb51363eb6fdc605a6a9816379a38103"
}
```

**處理邏輯：**
```javascript
// 找到該 userId 的索引
const existingIndex = teachers.findIndex(t => t.userId === userId);

if (existingIndex !== -1) {
  // 從陣列中移除
  teachers.splice(existingIndex, 1);
}
```

---

## 💡 為什麼只認 USER ID？

### LINE USER ID 特性：

1. **唯一性** ✅
   - 每個 LINE 帳號有唯一的 User ID
   - 格式：`U` + 32 位英數字
   - 例：`Udb51363eb6fdc605a6a9816379a38103`

2. **不變性** ✅
   - User ID 永久不變
   - 即使用戶改名、換頭像都不影響

3. **可靠性** ✅
   - 由 LINE 系統保證唯一
   - 不會重複或衝突

---

### DisplayName 的問題：

1. **可變性** ❌
   - 用戶可隨時修改 LINE 暱稱
   - 改名後比對失敗

2. **不唯一** ❌
   - 多人可能用相同暱稱
   - 例：多個 "Tim"、"小明"

3. **特殊字元** ❌
   - 包含 emoji：`Tim🙏🏻`
   - 包含空格：`Tim Chen`
   - 大小寫不一致：`tim` vs `TIM`

---

## 🧪 測試驗證

### 測試 1：首次綁定

**步驟：**
1. 使用未綁定的 LINE 帳號開啟系統
2. 取得 userId（如 `Udb51363...`）

**預期結果：**
- Console 顯示：`❌ UserID 比對失敗: Udb51363...`
- 自動跳出綁定選單
- 用戶選擇講師後成功寫入

**驗證：**
```bash
cat teacher_data.json
# 應該看到新增：
# { "name": "選擇的講師", "userId": "Udb51363..." }
```

---

### 測試 2：已綁定用戶

**步驟：**
1. 使用已綁定的 LINE 帳號開啟系統
2. 系統自動比對 userId

**預期結果：**
- Console 顯示：`✅ UserID 匹配成功: TIM (Udb51363...)`
- 自動跳轉到該講師視圖
- 顯示「解除綁定」按鈕

---

### 測試 3：修改 DisplayName 後

**步驟：**
1. 在 LINE 中修改暱稱（如 `Tim` → `Tim🙏🏻`）
2. 重新開啟系統

**預期結果：**
- ✅ **仍然正常比對成功**（因為只認 userId）
- 自動跳轉到正確的講師
- Console 顯示：`✅ UserID 匹配成功: TIM`

---

## 🔄 遷移指南

### 如果您已有舊格式的 teacher_data.json

**不用擔心！系統會自動兼容處理：**

1. **後端自動轉換：**
   ```javascript
   // 偵測到物件格式，自動轉換為陣列
   if (!Array.isArray(teacherData.teachers)) {
     teacherData.teachers = Object.entries(teacherData.teachers)
       .map(([name, userId]) => ({ name, userId }));
   }
   ```

2. **手動遷移（可選）：**
   ```bash
   # 備份舊檔案
   cp teacher_data.json teacher_data.json.old
   
   # 使用新格式
   cat > teacher_data.json << 'EOF'
   {
     "teachers": [
       { "name": "TIM", "userId": "Udb51363..." },
       { "name": "YOKI", "userId": "Ucf9b239..." }
     ],
     "last_update": "2025-10-16T08:00:00.000000"
   }
   EOF
   ```

---

## 📊 比對邏輯對比

| 比對方式 | 舊邏輯 | 新邏輯 |
|---------|--------|--------|
| **主要依據** | userId → displayName → 模糊匹配 | **只認 userId** |
| **準確性** | ⚠️ 中等（displayName 可能錯誤） | ✅ 100%（userId 唯一） |
| **穩定性** | ❌ 不穩定（名稱改變會失敗） | ✅ 永久穩定 |
| **複雜度** | ❌ 複雜（5 種匹配邏輯） | ✅ 簡單（單一邏輯） |
| **效能** | ⚠️ 較慢（多次遍歷） | ✅ 快速（單次查詢） |
| **維護性** | ❌ 難維護（邏輯複雜） | ✅ 易維護（邏輯清晰） |

---

## ⚠️ 注意事項

### 1. 現有綁定不受影響
- ✅ 已綁定用戶繼續正常使用
- ✅ 系統自動兼容舊格式

### 2. 只認 USER ID
- ✅ DisplayName 改變不影響
- ✅ 不會因名稱相似而誤判

### 3. 首次用戶體驗
- ✅ 自動跳出綁定選單
- ✅ 一次綁定，永久有效

---

## 🚀 部署步驟

### 1. 備份現有資料
```bash
cp teacher_data.json teacher_data.json.backup
```

### 2. 更新格式（可選，系統會自動轉換）
```bash
# 如果想手動更新為新格式
cat > teacher_data.json << 'EOF'
{
  "teachers": [
    { "name": "YOKI", "userId": "Ucf9b239..." },
    { "name": "TED", "userId": "U213b36..." }
    # ... 其他講師
  ],
  "last_update": "2025-10-16T08:00:00.000000"
}
EOF
```

### 3. 部署更新
```bash
# 方式 1：使用快速部署腳本
./🚀快速部署HTML.sh

# 方式 2：重啟 Docker 服務
ssh ctctim14@funlearnbar.synology.me -p 1022
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
sudo docker-compose restart
```

---

## ✅ 驗證成功標準

### Console 日誌檢查

**成功比對：**
```javascript
📋 可用講師列表: [{ name: "TIM", userId: "Udb51363..." }, ...]
🔍 比對 UserID: Udb51363eb6fdc605a6a9816379a38103
✅ UserID 匹配成功: TIM (Udb51363...)
🎉 找到匹配講師: TIM
```

**首次用戶：**
```javascript
❌ UserID 比對失敗: Uxxx...
🆕 歡迎首次使用！請選擇您的講師身份
```

---

## 📖 相關文檔

- `✅講師綁定與強制刷新功能更新.md` - 綁定機制說明
- `🧪測試新功能.md` - 測試指南
- `teacher_data.json` - 講師資料檔案

---

**更新完成時間：** 2025-10-16  
**核心變更：** 只認 USER ID，移除所有 DisplayName 相關邏輯  
**狀態：** ✅ 已完成並測試通過

