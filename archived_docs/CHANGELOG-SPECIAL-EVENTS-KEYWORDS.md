# 特殊事件關鍵字動態化更新日誌

## 📅 2025-10-19

### ✨ 新功能：從後端 API 動態讀取特殊事件關鍵字

#### 🎯 目標
統一管理特殊事件關鍵字，在 Admin Dashboard 修改時自動同步到學生篩選邏輯。

#### 🔧 實施內容

##### 1. `public/js/student-filter.js` 更新 (v2.1.0)

**新增功能：**
- ✅ `getSpecialEventsKeywords()` - 從後端 API 獲取特殊事件關鍵字配置
- ✅ `getDefaultKeywords()` - 降級方案，提供預設關鍵字
- ✅ 本地快取機制（5分鐘有效期）
- ✅ 動態正則表達式建立，支援所有配置的關鍵字

**修改內容：**
- 🔄 `filterStudentsByCourseAndTime()` 改為 `async` 函數
- 🔄 `extractBaseTime()` 使用動態關鍵字替代硬編碼
- 🔄 自動從 `/api/special-events-config` 讀取關鍵字

**快取策略：**
```javascript
localStorage.setItem('special_events_keywords_cache', JSON.stringify(keywordsData));
localStorage.setItem('special_events_keywords_cache_time', Date.now().toString());
// 快取有效期：5分鐘
```

##### 2. `public/admin-dashboard.html` 更新

**特殊事件設定頁面：**
- ✅ 新增關聯功能說明
- ✅ 保存配置時自動清除快取
- ✅ 添加與學生篩選的關聯提示
- ✅ 提供跳轉到學生篩選頁面的連結

**學生篩選規則頁面：**
- ✅ 新增特殊事件關鍵字來源說明
- ✅ 說明自動從後端讀取機制
- ✅ 提供跳轉到特殊事件設定的連結

**自動清除快取：**
```javascript
// 在 saveSpecialEventsConfig() 中
localStorage.removeItem('special_events_keywords_cache');
localStorage.removeItem('special_events_keywords_cache_time');
```

##### 3. 前端調用更新

**修改的文件：**
- ✅ `public/perfect-calendar-optimized-complete2.html`
  - 添加 `await` 調用 `filterStudentsByCourseAndTime()`
  - 添加註解說明自動讀取關鍵字

- ✅ `public/learning-record-upload.html`
  - 改用 `Promise.all()` + `async map`
  - 確保所有課程並行處理學生篩選

- ✅ `public/test-student-filter.html`
  - 所有測試調用添加 `await`

#### 📊 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                    特殊事件關鍵字動態化                       │
└─────────────────────────────────────────────────────────────┘

1️⃣ 管理員在 Admin Dashboard 修改特殊事件關鍵字
   ↓
2️⃣ 保存到後端 API (/api/special-events-config)
   ↓
3️⃣ 自動清除本地快取
   ↓
4️⃣ 前端調用 filterStudentsByCourseAndTime()
   ↓
5️⃣ 自動從後端讀取最新關鍵字
   ↓
6️⃣ 使用動態關鍵字進行時間匹配
   ↓
7️⃣ 返回精確篩選的學生列表
```

#### 🎨 UI 改進

**特殊事件設定頁面：**
- 🔗 關聯功能提示（黃色警告框）
- 📘 與學生篩選的關聯說明（藍色資訊框）
- 🔗 快速跳轉連結

**學生篩選規則頁面：**
- 🔗 特殊事件關鍵字來源提示（黃色警告框）
- 📘 自動同步機制說明（藍色資訊框）
- 🔗 快速跳轉連結

#### 📝 範例

**使用場景：**
```javascript
// 課程時間：「日 10:00-12:00 停課」
// 學生時間：「日 10:00-12:00」

// 系統會：
// 1. 從後端讀取關鍵字配置（包含「停課」）
// 2. 自動移除「停課」關鍵字
// 3. 比對：「日 10:00-12:00」 === 「日 10:00-12:00」 ✓
// 4. 成功匹配！
```

**管理員操作：**
1. 前往「特殊事件設定」頁面
2. 修改關鍵字（例如：新增「放假」）
3. 點擊「儲存所有設定」
4. 系統自動清除快取
5. 下次學生篩選時自動使用新關鍵字

#### ⚡ 效能優化

- 📦 本地快取（5分鐘）減少 API 請求
- 🔄 降級方案確保系統穩定性
- ⚙️ 正則表達式自動轉義特殊字符
- 🚀 並行處理多個課程的學生篩選

#### 🔒 向後兼容

- ✅ 保留預設關鍵字作為降級方案
- ✅ API 失敗時自動使用本地配置
- ✅ 所有現有功能正常運作

#### 🧪 測試建議

**測試步驟：**
1. 前往 Admin Dashboard > 特殊事件設定
2. 修改關鍵字（例如：新增「補課新」）
3. 儲存配置
4. 前往 perfect-calendar 或 learning-record-upload
5. 查看 console 日誌確認：
   - 已載入最新關鍵字
   - 時間匹配使用新關鍵字
   - 學生篩選結果正確

**預期結果：**
- ✅ Console 顯示：「🔍 開始篩選學生: { specialKeywords: 'X 個關鍵字' }」
- ✅ 時間後綴正確移除
- ✅ 學生匹配成功

#### 📚 相關文件

- `public/js/student-filter.js` - 核心篩選邏輯
- `public/admin-dashboard.html` - 管理界面
- `public/perfect-calendar-optimized-complete2.html` - 主日曆
- `public/learning-record-upload.html` - 學習記錄上傳
- `server.js` - 後端 API (`/api/special-events-config`)

#### 🎉 預期效果

1. **統一管理** - 關鍵字集中在一處配置
2. **即時生效** - 修改後自動同步
3. **易於維護** - 不需要修改多處代碼
4. **用戶友好** - 管理界面直觀易用
5. **系統穩定** - 降級方案保證可用性

---

## 🚀 部署注意事項

1. **無需重啟服務** - 所有變更即時生效
2. **清除瀏覽器快取** - 建議用戶硬刷新（Ctrl+F5）
3. **測試驗證** - 修改關鍵字後測試學生篩選功能

---

## 📞 技術支援

如有問題，請檢查：
- 瀏覽器 Console 日誌
- `/api/special-events-config` API 回應
- `localStorage` 中的快取資料

