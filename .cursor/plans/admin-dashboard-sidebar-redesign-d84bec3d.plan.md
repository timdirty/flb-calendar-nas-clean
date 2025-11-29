<!-- d84bec3d-2963-4202-8cce-35c3badc1cbe 6bb454ce-c55f-43ed-b801-b4986b68073b -->
# Admin Dashboard 側邊欄改版與 API 修復

## 階段 1：API 功能對應修復

### 1.1 檢查並補齊缺失的 API 端點
**檔案：`server.js`**

需要新增以下缺失的 API：

1. **課程類別配置 API**（最重要，前端已在使用）
   ```javascript
   // GET /api/course-categories-config
   // POST /api/course-categories-config
   ```
   - 創建 `course-categories-config.json` 配置檔
   - 支援前端 `perfect-calendar-optimized-complete2.html` 的教案按鈕功能
   - 包含預設類別：ESM, EV3, SPIKE-PRO, SPIKE, WeDo2.0, Scratch, Python

2. **特殊事件配置檔案檢查**
   - 確認 `special-events-config.json` 是否存在
   - 若不存在，創建預設配置檔
   - 驗證 API `/api/special-events-config` 正常運作

3. **時段管理 API**（若需持久化）
   - 評估是否需要後端 API（目前僅前端分析）
   - 若需要，新增 `/api/period-config` 端點

### 1.2 驗證現有 API 對應關係
檢查以下 API 是否在前端正確使用：
- `/api/teachers` - 講師管理 ✓
- `/api/students` - 學生管理 ✓
- `/api/temporary-students` - 臨時學生 ✓
- `/api/student-filter-config` - 學生篩選規則 ✓
- `/api/notification-config` - 通知設定 ✓
- `/api/google-api-config` - Google API ✓
- `/api/cache/clear-all` - 緩存管理 ✓
- `/api/logs` - 系統日誌 ✓

## 階段 2：側邊欄介面改版

### 2.1 建立側邊欄結構
**檔案：`public/admin-dashboard.html`**

參考附圖設計，實作以下結構：

```html
<div class="admin-layout">
  <aside class="sidebar">
    <div class="logo-section">
      <i class="fas fa-user-shield"></i>
      <span>樂程坊FunLearnBar</span>
    </div>
    <nav class="sidebar-nav">
      <!-- 儀表板 -->
      <a href="#" class="nav-item active">
        <i class="fas fa-th-large"></i> 儀表板
      </a>
      
      <!-- 基礎設定 -->
      <div class="nav-group">
        <div class="nav-group-header">基礎設定</div>
        <a class="nav-item"><i class="fas fa-cog"></i> 系統配置</a>
      </div>
      
      <!-- 人員管理 -->
      <div class="nav-group">
        <div class="nav-group-header">人員管理</div>
        <a class="nav-item"><i class="fas fa-user-tie"></i> 講師管理</a>
        <a class="nav-item"><i class="fas fa-user-graduate"></i> 學生管理</a>
        <a class="nav-item"><i class="fas fa-user-plus"></i> 補課/體驗學生</a>
      </div>
      
      <!-- 課程設定 -->
      <div class="nav-group">
        <div class="nav-group-header">課程設定</div>
        <a class="nav-item"><i class="fas fa-star"></i> 特殊事件設定</a>
        <a class="nav-item"><i class="fas fa-book-open"></i> 課程類別管理</a>
        <a class="nav-item"><i class="fas fa-clock"></i> 時段管理</a>
        <a class="nav-item"><i class="fas fa-filter"></i> 學生篩選規則</a>
      </div>
      
      <!-- 整合設定 -->
      <div class="nav-group">
        <div class="nav-group-header">整合設定</div>
        <a class="nav-item"><i class="fas fa-bell"></i> 通知設定</a>
        <a class="nav-item"><i class="fab fa-google"></i> Google API</a>
      </div>
      
      <!-- 系統工具 -->
      <div class="nav-group">
        <div class="nav-group-header">系統工具</div>
        <a class="nav-item"><i class="fas fa-database"></i> 緩存管理</a>
        <a class="nav-item"><i class="fas fa-list"></i> 系統日誌</a>
        <a class="nav-item"><i class="fas fa-exchange-alt"></i> 匯入/匯出</a>
      </div>
    </nav>
  </aside>
  
  <main class="main-content">
    <header class="top-bar">
      <button class="sidebar-toggle">☰</button>
      <h1 class="page-title">當前頁面標題</h1>
      <div class="user-info">管理員</div>
    </header>
    <div class="content-area">
      <!-- 原有的 tab-content 內容 -->
    </div>
  </main>
</div>
```

### 2.2 CSS 樣式設計
參考附圖配色方案（藍色系），實作以下樣式：

**配色方案：**
- 側邊欄背景：`#1e3a8a`（深藍）
- 側邊欄文字：`#ffffff`
- 活躍項目：`#3b82f6`（亮藍）
- 群組標題：`#93c5fd`（淺藍，半透明）
- 主內容背景：`#f5f7fa`

**響應式設計：**
- 桌面（≥1024px）：固定側邊欄，寬度 250px
- 平板（768-1023px）：可收合側邊欄
- 手機（<768px）：漢堡選單，覆蓋式側邊欄

### 2.3 JavaScript 功能重構
1. **移除舊的 tab 切換邏輯**
   - 將 `switchTab()` 改為 `switchSection()`
   - 使用 `data-section` 屬性綁定內容區域

2. **新增側邊欄互動**
   - 側邊欄收合/展開功能
   - 活躍項目高亮切換
   - 手機版漢堡選單

3. **保持所有現有功能**
   - 確保所有 API 呼叫函數不變
   - 保持資料載入、儲存邏輯完整
   - 維持錯誤處理機制

## 階段 3：測試與驗證

### 3.1 功能測試
- [ ] 所有 API 端點回應正常
- [ ] 側邊欄導航切換正確
- [ ] 資料載入/儲存功能正常
- [ ] 響應式設計在各裝置正常運作

### 3.2 前後端整合測試
- [ ] `perfect-calendar` 可正確讀取課程類別配置
- [ ] 特殊事件配置正確套用到前端
- [ ] 學生篩選規則正確運作

### 3.3 UI/UX 檢查
- [ ] 側邊欄視覺與附圖一致
- [ ] 階層分類清晰易懂
- [ ] 手機版操作流暢

## 重要檔案清單

**需修改：**
- `server.js` - 新增缺失的 API 端點
- `public/admin-dashboard.html` - 完整改版為側邊欄設計

**需創建：**
- `course-categories-config.json` - 課程類別配置檔
- `special-events-config.json` - 特殊事件配置檔（若不存在）

**需驗證：**
- `public/perfect-calendar-optimized-complete2.html` - 確認可正確讀取新 API


### To-dos

- [ ] 新增課程類別配置 API 端點 (/api/course-categories-config) 到 server.js
- [ ] 創建 course-categories-config.json 預設配置檔
- [ ] 檢查並創建 special-events-config.json（若缺失）
- [ ] 測試所有 API 端點回應正常
- [ ] 重構 admin-dashboard.html 為側邊欄結構（HTML 部分）
- [ ] 實作側邊欄 CSS 樣式（包含響應式設計）
- [ ] 重構 JavaScript：側邊欄互動、導航切換、保持現有功能
- [ ] 前後端整合測試：驗證 perfect-calendar 可讀取課程類別配置
- [ ] 測試響應式設計（桌面/平板/手機）