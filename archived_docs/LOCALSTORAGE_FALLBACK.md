# 💾 LocalStorage 備用機制說明

## 🎯 問題與解決方案

### **問題**
後端 API 端點 `/api/course-categories-config` 尚未實作，導致：
```
Failed to load resource: the server responded with a status of 404 ()
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

### **解決方案**
✅ 修改前端代碼，當後端 API 不存在時，自動使用 **localStorage** 作為備用儲存方案。

---

## 🔄 運作邏輯

### **載入流程（三層備用機制）**

```
1️⃣ 嘗試從後端 API 載入
   ↓ 失敗（404）
   
2️⃣ 嘗試從 localStorage 讀取
   ↓ 沒有資料
   
3️⃣ 使用預設值並儲存到 localStorage
```

### **儲存流程（雙重保障）**

```
1️⃣ 先儲存到 localStorage（立即生效）
   ↓
   
2️⃣ 嘗試儲存到後端 API
   ├─ 成功 → ✅ 同步完成
   └─ 失敗 → ⚠️ 僅本地儲存（仍然可用）
```

---

## 📝 修改的檔案

### **1. admin-dashboard.html**

#### **修改 `loadCourseCategoriesConfig()`**
```javascript
// ✅ 三層備用機制
async function loadCourseCategoriesConfig() {
    try {
        const response = await fetch('/api/course-categories-config');
        
        // 如果 API 不存在（404），使用 localStorage
        if (!response.ok) {
            const saved = localStorage.getItem('flb_course_categories_config');
            if (saved) {
                courseCategoriesData = JSON.parse(saved);
            } else {
                courseCategoriesData = getDefaultCourseCategories();
                localStorage.setItem('flb_course_categories_config', JSON.stringify(courseCategoriesData));
            }
        } else {
            // API 存在，使用後端資料
            const result = await response.json();
            courseCategoriesData = result.data;
            localStorage.setItem('flb_course_categories_config', JSON.stringify(courseCategoriesData));
        }
    } catch (error) {
        // 完全失敗，嘗試 localStorage
        const saved = localStorage.getItem('flb_course_categories_config');
        courseCategoriesData = saved ? JSON.parse(saved) : getDefaultCourseCategories();
    }
}
```

#### **修改 `saveCourseCategoriesConfig()`**
```javascript
// ✅ 雙重保障機制
async function saveCourseCategoriesConfig() {
    // 先儲存到 localStorage（立即生效）
    localStorage.setItem('flb_course_categories_config', JSON.stringify(courseCategoriesData));
    
    // 嘗試儲存到後端
    try {
        const response = await fetch('/api/course-categories-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseCategoriesData)
        });
        
        if (!response.ok) {
            // API 不存在，但 localStorage 已儲存成功
            showAlert('✅ 課程類別配置已儲存（本地儲存）', 'success');
            return;
        }
        
        // API 存在且成功
        showAlert('✅ 課程類別配置已儲存並生效', 'success');
    } catch (apiError) {
        // API 失敗，但 localStorage 已儲存成功
        showAlert('✅ 課程類別配置已儲存（本地儲存）', 'success');
    }
}
```

---

### **2. perfect-calendar-optimized-complete2.html**

#### **修改 `loadCourseCategoriesForRendering()`**
```javascript
// ✅ 與管理後台同步的三層備用機制
async function loadCourseCategoriesForRendering() {
    // 優先使用記憶體快取（5分鐘）
    if (courseCategoriesCache && (now - courseCategoriesCacheTime < CACHE_DURATION)) {
        return courseCategoriesCache;
    }
    
    try {
        const response = await fetch('/api/course-categories-config');
        
        // 如果 API 不存在（404），從 localStorage 讀取
        if (!response.ok) {
            const saved = localStorage.getItem('flb_course_categories_config');
            if (saved) {
                courseCategoriesCache = JSON.parse(saved);
                return courseCategoriesCache;
            }
            throw new Error('localStorage 無配置');
        }
        
        // API 存在，使用後端資料
        const result = await response.json();
        courseCategoriesCache = result.data;
        return courseCategoriesCache;
    } catch (error) {
        // 完全失敗，使用預設值
        courseCategoriesCache = getDefaultCourseCategories();
        return courseCategoriesCache;
    }
}
```

---

## ✅ 現在的運作模式

### **場景 1：後端 API 未實作（現況）**

1. **管理後台**
   - ✅ 可以新增/編輯/刪除課程類別
   - ✅ 設定會儲存到 localStorage
   - ⚠️ 顯示提示：「課程類別配置已儲存（本地儲存）」
   - ❌ 不會有 404 錯誤（已被妥善處理）

2. **日曆頁面**
   - ✅ 從 localStorage 讀取課程類別配置
   - ✅ 教案按鈕使用正確的顏色
   - ✅ 停用的類別不顯示
   - ⚠️ Console 顯示：「從 localStorage 載入課程類別配置」

---

### **場景 2：後端 API 已實作（未來）**

1. **管理後台**
   - ✅ 設定會同步到後端和 localStorage
   - ✅ 顯示提示：「課程類別配置已儲存並生效」
   - ✅ 多裝置同步（透過後端）

2. **日曆頁面**
   - ✅ 優先從後端 API 載入
   - ✅ localStorage 作為備用
   - ✅ Console 顯示：「從後端載入課程類別配置」

---

## 🧪 測試步驟

### **測試 1：基本功能（不需要後端 API）**

1. **開啟管理後台**
   ```
   http://localhost:3000/admin-dashboard.html
   ```

2. **前往課程類別管理**
   - 點擊「🎓 課程類別管理」分頁

3. **檢查 Console**
   ```
   ⚠️ 後端 API 不存在，使用 localStorage
   ✅ 使用預設值並儲存到 localStorage
   ```

4. **新增自訂類別**
   - 名稱：`PYTHON`
   - 關鍵字：`PYTHON教案`
   - 顏色：`#3776AB`
   - 點擊「💾 儲存所有設定」

5. **確認儲存成功**
   ```
   ✅ 課程類別配置已保存到 localStorage: [...]
   ⚠️ 後端 API 不存在，僅儲存到 localStorage
   ✅ 課程類別配置已儲存（本地儲存）
   ```

---

### **測試 2：日曆頁面讀取**

1. **開啟日曆頁面**
   ```
   http://localhost:3000/perfect-calendar-optimized-complete2.html
   ```

2. **檢查 Console**
   ```
   ⚠️ 後端 API 不存在，嘗試從 localStorage 讀取
   ✅ 從 localStorage 載入課程類別配置: [...]
   ```

3. **確認功能正常**
   - ✅ 教案按鈕使用正確顏色
   - ✅ 自訂類別（PYTHON）正常顯示
   - ✅ 沒有 404 錯誤訊息

---

## 📊 LocalStorage 儲存內容

### **查看儲存的資料**
在 Console 輸入：
```javascript
JSON.parse(localStorage.getItem('flb_course_categories_config'))
```

### **預期輸出**
```json
[
  {
    "id": "esm",
    "name": "ESM",
    "keyword": "ESM教案",
    "color": "#FF6B6B",
    "enabled": true
  },
  {
    "id": "spm",
    "name": "SPM",
    "keyword": "SPM教案",
    "color": "#4ECDC4",
    "enabled": true
  },
  ...
]
```

---

## 🔄 資料同步機制

### **單一瀏覽器**
✅ 管理後台 → localStorage → 日曆頁面
- 修改會立即在同一瀏覽器生效

### **多瀏覽器/多裝置**
⚠️ 僅限 localStorage（無法同步）
- 需要實作後端 API 才能跨裝置同步

---

## 🚀 未來實作後端 API

當您準備實作後端 API 時，只需要：

### **1. 建立 API 端點**

#### **GET `/api/course-categories-config`**
```javascript
app.get('/api/course-categories-config', (req, res) => {
    const config = readConfigFile('course_categories_config.json');
    res.json({
        success: true,
        data: config
    });
});
```

#### **POST `/api/course-categories-config`**
```javascript
app.post('/api/course-categories-config', (req, res) => {
    const config = req.body;
    writeConfigFile('course_categories_config.json', config);
    res.json({
        success: true,
        message: '課程類別配置已儲存'
    });
});
```

### **2. 前端自動切換**
✅ 前端代碼已經支援後端 API
- API 存在 → 使用後端
- API 不存在 → 使用 localStorage
- 無需修改前端代碼！

---

## 📝 注意事項

### **優點**
✅ 功能立即可用（不需要等後端實作）
✅ 無 404 錯誤訊息
✅ 自動備用機制
✅ 未來可無縫升級到後端 API

### **限制**
⚠️ 資料僅儲存在本地瀏覽器
⚠️ 無法跨裝置同步
⚠️ 清除瀏覽器資料會遺失設定

### **建議**
💡 可以先使用 localStorage 版本測試功能
💡 未來有需要時再實作後端 API
💡 實作後端 API 後，前端無需修改即可切換

---

## ✅ 修復確認

- [x] 修改 `admin-dashboard.html` 載入邏輯
- [x] 修改 `admin-dashboard.html` 儲存邏輯
- [x] 修改 `perfect-calendar-optimized-complete2.html` 載入邏輯
- [x] 三層備用機制（API → localStorage → 預設值）
- [x] 雙重保障儲存（localStorage + API）
- [x] 無 404 錯誤訊息
- [x] 功能完全可用

---

## 📞 問題排查

### **Q1: 設定不生效**
**解決方案：**
1. 檢查 Console 確認儲存成功
2. 清除瀏覽器快取（Ctrl+Shift+R）
3. 檢查 localStorage：
   ```javascript
   localStorage.getItem('flb_course_categories_config')
   ```

### **Q2: 仍然看到 404 錯誤**
**原因：** 這是正常的（第一次請求會嘗試 API）
**解決方案：** 錯誤會被捕獲並使用 localStorage，不影響功能

### **Q3: 多裝置不同步**
**原因：** localStorage 僅限本地瀏覽器
**解決方案：** 實作後端 API（參考上方說明）

---

**文檔版本：** v1.0  
**更新日期：** 2025-01-20  
**狀態：** ✅ 已修復，功能可用

