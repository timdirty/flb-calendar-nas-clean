# 📢 公告便條貼 & 🎓 課程類別管理 完整說明

## 🎯 功能概述

本次更新新增了兩大功能：

### 1️⃣ **公告便條貼功能**
- ✅ 自動從課程描述中提取「公告：」後面的內容
- ✅ 在課程卡片右上角顯示黃色便條貼
- ✅ 滑鼠懸停時自動展開顯示完整內容
- ✅ 支援手機版響應式設計

### 2️⃣ **課程類別動態管理**
- ✅ 課程教案類別不再硬編碼
- ✅ 在 admin-dashboard.html 可視化管理
- ✅ 支援自訂類別名稱、關鍵字、顏色
- ✅ 支援啟用/停用控制

---

## 📋 目前解析日曆摘要的完整邏輯

### **第一步：提取公告內容**
```javascript
// 📝 提取公告內容
let announcementText = '';
const announcementMatch = (event.description || '').match(/公告[：:]\s*(.+?)(?=\n|$)/i);
if (announcementMatch && announcementMatch[1]) {
    announcementText = announcementMatch[1].trim();
}
```

**匹配規則：**
- 關鍵字：`公告：` 或 `公告:`（支援中英文冒號）
- 大小寫不敏感
- 提取冒號後到換行符或字串結尾的所有文字

**範例：**
```
描述內容：
公告：明天停課一次，請注意！
講師：Tim
```
→ 提取到：`明天停課一次，請注意！`

---

### **第二步：清理描述內容**
```javascript
cleanDescription = cleanDescription
    .replace(/\[NOTION_SYNC\]/g, '')              // 移除同步標籤
    .replace(/公告[：:]\s*.+?(?=\n|$)/gi, '')     // 🆕 移除公告文字
    .replace(/時間:.*?講師:/g, '')                 // 移除時間資訊
    .replace(/講師:.*?TA:/g, '')                   // 移除講師資訊
    .replace(/TA:.*?第一期:/g, '')                 // 移除TA資訊
    .replace(/第一期:/g, '')                       // 移除期數標籤
    .replace(/\s+/g, ' ')                         // 壓縮空白
    .trim();
```

**清理項目：**
1. `[NOTION_SYNC]` 技術標籤
2. `公告：xxx` 公告內容（🆕 新增）
3. `時間:xxx` 時間資訊
4. `講師:xxx` 講師資訊
5. `TA:xxx` TA 資訊
6. `第一期:` 期數標籤
7. 多餘的空白字元

---

### **第三步：動態載入課程類別配置**
```javascript
// 🆕 動態載入課程類別配置（優先使用快取）
const courseCategories = await loadCourseCategoriesForRendering();
```

**載入策略：**
1. **優先使用快取**（5分鐘有效期）
2. **從後端 API 載入** `/api/course-categories-config`
3. **失敗則使用預設值**

**預設配置：**
```javascript
[
    { id: 'esm', name: 'ESM', keyword: 'ESM教案', color: '#FF6B6B', enabled: true },
    { id: 'spm', name: 'SPM', keyword: 'SPM教案', color: '#4ECDC4', enabled: true },
    { id: 'spike', name: 'SPIKE', keyword: 'SPIKE教案', color: '#45B7D1', enabled: true },
    { id: 'boost', name: 'BOOST', keyword: 'BOOST教案', color: '#96CEB4', enabled: true },
    { id: 'ev3', name: 'EV3', keyword: 'EV3教案', color: '#FFEAA7', enabled: true },
    { id: 'minecraft', name: 'MINECRAFT', keyword: 'MINECRAFT教案', color: '#DFE6E9', enabled: true }
]
```

---

### **第四步：提取教案連結與資訊**
```javascript
// 尋找 Notion 連結
const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
let notionMatch = event.description.match(notionUrlRegex);

// 如果沒有找到括號內的連結，則匹配一般的 Notion 連結
if (!notionMatch) {
    const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
    notionMatch = event.description.match(generalNotionRegex);
}
```

**匹配格式：**
1. `(https://www.notion.so/xxx)` - 括號內的連結
2. `https://www.notion.so/xxx` - 一般連結

---

### **第五步：動態匹配教案類別**
```javascript
// 🆕 使用動態配置匹配教案格式
let matched = false;
for (const category of courseCategories) {
    if (!category.enabled) continue; // 跳過停用的類別
    
    // 動態生成正則表達式
    const regex = new RegExp(
        `(${category.keyword})[:\\s]*([^(]+?)(?:\\s*\\(https:\\/\\/www\\.notion\\.so)`, 
        'i'
    );
    const lessonMatch = originalDescription.match(regex);
    
    if (lessonMatch && lessonMatch[2]) {
        lessonName = lessonMatch[2].trim();
        lessonType = category.name;
        lessonColor = category.color || '#667eea';
        matched = true;
        break;
    }
}
```

**匹配邏輯：**
- 遍歷所有**已啟用**的類別
- 使用類別的 `keyword` 動態生成正則表達式
- 提取關鍵字後、Notion 連結前的教案名稱
- 使用類別的 `color` 設定按鈕顏色

**範例描述：**
```
SPIKE教案: 機器人大戰 (https://www.notion.so/abc123)
```
- 匹配到類別：SPIKE
- 提取名稱：機器人大戰
- 按鈕顏色：#45B7D1（SPIKE 的顏色）

---

### **第六步：生成教案按鈕**
```javascript
lessonButton = `
    <div class="lesson-section">
        <div class="lesson-label">${lessonType}教案</div>
        <a href="${lessonUrl}" target="_blank" 
           class="lesson-button" 
           style="background: ${lessonColor}; border-color: ${lessonColor};">
            <i class="fas fa-book"></i> ${lessonName}
        </a>
    </div>
`;
```

**視覺效果：**
- 標籤顯示：`{類別名稱}教案`（例如：SPIKE教案）
- 按鈕顏色：使用類別的自訂顏色
- 按鈕文字：提取的教案名稱
- 點擊行為：在新分頁開啟 Notion 連結

---

### **第七步：渲染公告便條貼**
```javascript
${announcementText ? `
<div class="announcement-note" title="點擊展開完整公告">
    <span class="announcement-note-icon">📢</span>
    <span class="announcement-note-content">${announcementText}</span>
</div>
` : ''}
```

**視覺呈現：**
- 位置：課程卡片右上角
- 樣式：黃色便條貼效果
- 圖示：📌 圖釘 + 📢 喇叭
- 互動：懸停時展開顯示完整內容

---

## 🎓 課程類別自動提取機制說明

### **核心邏輯**
系統會根據**管理員設定的關鍵字**自動從描述中提取教案資訊，不需要手動硬編碼。

### **匹配流程**
```
描述內容：
SPIKE教案: 機器人大戰 (https://www.notion.so/abc123)

↓ 系統處理 ↓

1. 載入課程類別配置
   → SPIKE類別：關鍵字="SPIKE教案", 顏色="#45B7D1"

2. 動態生成正則表達式
   → /(SPIKE教案)[:\s]*([^(]+?)(?:\s*\(https:\/\/www\.notion\.so)/

3. 匹配結果
   → lessonType = "SPIKE"
   → lessonName = "機器人大戰"
   → lessonColor = "#45B7D1"

4. 生成按鈕
   → 顏色：#45B7D1
   → 文字："📚 SPIKE教案 → 機器人大戰"
```

### **支援的格式**
```
✅ ESM教案: 入門基礎 (https://...)
✅ SPIKE教案：進階機器人 (https://...)  // 中文冒號
✅ BOOST教案  探索世界(https://...)     // 無冒號
✅ 自訂類別教案: 特殊課程 (https://...)   // 管理員自訂
```

---

## ⚙️ 在 Admin Dashboard 中管理課程類別

### **位置**
1. 開啟 `/admin-dashboard.html`
2. 點擊頂部分頁：**🎓 課程類別管理**

### **功能介面**

#### **1. 查看現有類別**
- 顯示所有已設定的類別
- 顯示每個類別的：
  - 名稱（例如：SPIKE）
  - 關鍵字（例如：SPIKE教案）
  - 顏色（色塊預覽）
  - 啟用狀態（✓ 已啟用 / ✗ 已停用）

#### **2. 新增類別**
1. 點擊 **➕ 新增類別** 按鈕
2. 填寫資料：
   - **類別名稱**：顯示在按鈕上的名稱（例如：PYTHON）
   - **關鍵字**：用於匹配描述的關鍵字（例如：PYTHON教案）
   - **按鈕顏色**：使用色彩選擇器選擇顏色
   - **啟用此類別**：勾選以啟用
3. 點擊 **💾 儲存所有設定**

#### **3. 編輯類別**
- 直接在表單中修改任何欄位
- 即時預覽效果
- 修改後點擊 **💾 儲存所有設定**

#### **4. 刪除類別**
- 點擊類別卡片右上角的 **🗑️ 刪除** 按鈕
- 確認刪除
- 點擊 **💾 儲存所有設定** 以生效

#### **5. 啟用/停用類別**
- 取消勾選「啟用此類別」可暫時停用
- 停用的類別不會在前端顯示

#### **6. 恢復預設值**
- 點擊 **↩️ 恢復預設值** 按鈕
- 確認後恢復到系統預設的 6 個類別

---

## 🎨 視覺效果展示

### **公告便條貼**
```
┌─────────────────────────────────┐
│  📌                             │
│  ┌───────────────────────┐     │
│  │ 📢 明天停課一次，請注意│     │
│  └───────────────────────┘     │
│                                 │
│  📚 SPIKE PRO 課程              │
│  👨‍🏫 講師：Tim                  │
│  ...                            │
└─────────────────────────────────┘
```

### **課程類別按鈕**
```
┌──────────────────────────┐
│ SPIKE教案                │
│ ┌──────────────────────┐ │
│ │ 📚 機器人大戰        │ │  ← 使用 SPIKE 的顏色 #45B7D1
│ └──────────────────────┘ │
└──────────────────────────┘
```

---

## 🔗 API 端點需求

### **GET `/api/course-categories-config`**
**用途：** 載入課程類別配置

**回應格式：**
```json
{
    "success": true,
    "data": [
        {
            "id": "spike",
            "name": "SPIKE",
            "keyword": "SPIKE教案",
            "color": "#45B7D1",
            "enabled": true
        },
        ...
    ]
}
```

---

### **POST `/api/course-categories-config`**
**用途：** 儲存課程類別配置

**請求格式：**
```json
[
    {
        "id": "spike",
        "name": "SPIKE",
        "keyword": "SPIKE教案",
        "color": "#45B7D1",
        "enabled": true
    },
    ...
]
```

**回應格式：**
```json
{
    "success": true,
    "message": "課程類別配置已儲存"
}
```

---

## 📝 使用範例

### **範例 1：基本公告**
**描述內容：**
```
公告：下週一停課
SPIKE教案: 入門機器人 (https://www.notion.so/abc123)
講師：Tim
```

**前端顯示：**
- ✅ 便條貼顯示：「下週一停課」
- ✅ 教案按鈕：「📚 入門機器人」（SPIKE 顏色）
- ✅ 描述區域：不顯示「公告：下週一停課」

---

### **範例 2：自訂課程類別**
**管理員設定：**
```json
{
    "name": "PYTHON",
    "keyword": "PYTHON教案",
    "color": "#3776AB",
    "enabled": true
}
```

**描述內容：**
```
PYTHON教案: 基礎語法入門 (https://www.notion.so/xyz789)
```

**前端顯示：**
- ✅ 教案按鈕：「📚 基礎語法入門」
- ✅ 按鈕顏色：#3776AB（Python 藍）
- ✅ 標籤：「PYTHON教案」

---

### **範例 3：停用類別**
**管理員操作：**
1. 在課程類別管理中取消勾選「啟用此類別」
2. 儲存設定

**效果：**
- ❌ 該類別的教案不會被提取
- ❌ 不會生成對應的教案按鈕

---

## ✅ 功能完成檢查清單

### **前端（perfect-calendar-optimized-complete2.html）**
- [x] 新增公告提取邏輯
- [x] 新增便條貼 CSS 樣式
- [x] 新增便條貼 HTML 結構
- [x] 新增 `loadCourseCategoriesForRendering()` 函數
- [x] 修改教案匹配邏輯為動態
- [x] 移除硬編碼的教案類別
- [x] 支援自訂顏色的教案按鈕

### **後端管理（admin-dashboard.html）**
- [x] 新增「課程類別管理」分頁
- [x] 新增類別列表 UI
- [x] 新增新增/編輯/刪除功能
- [x] 新增顏色選擇器
- [x] 新增啟用/停用控制
- [x] 新增預覽功能
- [x] 新增恢復預設值功能

### **後端 API（需要實作）**
- [ ] `GET /api/course-categories-config` - 載入配置
- [ ] `POST /api/course-categories-config` - 儲存配置

---

## 🚀 下一步

### **必須完成**
1. **實作後端 API 端點**
   - 建立 `/api/course-categories-config` GET/POST 端點
   - 讀寫 `course_categories_config.json` 檔案

2. **測試流程**
   - 在 admin-dashboard 新增自訂類別
   - 在日曆描述中使用新類別
   - 驗證前端正確顯示

### **可選優化**
1. 支援教案圖示自訂
2. 支援多語言關鍵字
3. 新增教案統計功能
4. 新增教案使用率分析

---

## 📞 聯絡資訊

如有問題或建議，請聯繫系統管理員。

**文檔版本：** v1.0  
**更新日期：** 2025-01-20  
**作者：** AI Assistant (Claude Sonnet 4.5)

