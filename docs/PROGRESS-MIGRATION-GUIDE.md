# 🔄 進度條系統遷移指南

## 📋 目標

將舊的進度條系統遷移到新的 `FileProgressManager`，實現：
- ✅ 統一的進度管理
- ✅ 事件驅動，不用輪詢
- ✅ 清晰的代碼結構
- ✅ 自動資源清理

---

## 🎯 架構對比

### 舊系統（Before）

```javascript
// ❌ 問題：多處重複邏輯，難以維護
function setPreviewProgress(preview, percent) {
  var helpers = ensureFilePreviewOverlay(preview);
  helpers.progressFill.style.width = bounded + '%'; // 百分比
  // ... 大量手動 DOM 操作
}

// ❌ 問題：需要輪詢檢查
setInterval(checkAllProgressBars, 500);

// ❌ 問題：進度條監控器 (progress-monitor.js) 轉換百分比為像素
function fixProgressBar(preview) {
  if (currentWidth && currentWidth.includes('%')) {
    var pixelWidth = Math.round(70 * percent / 100);
    progressFill.style.width = pixelWidth + 'px';
  }
}
```

### 新系統（After）

```javascript
// ✅ 優點：統一管理，事件驅動
const progressId = FileProgressManager.create(preview, {
  fileName: 'photo.jpg',
  onComplete: () => console.log('完成')
});

// ✅ 優點：直接更新，即時生效
FileProgressManager.update(progressId, 50); // 自動轉換為像素

// ✅ 優點：自動清理，無需輪詢
FileProgressManager.complete(progressId);
```

---

## 📝 遷移步驟

### Step 1: 引入新模組

在 `learning-record-upload.html` 中添加：

```html
<!-- 🆕 新的進度管理系統 -->
<link rel="stylesheet" href="css/file-progress.css?v=20251118-refactor">
<script src="js/modules/file-progress-manager.js?v=20251118-refactor" defer></script>
```

### Step 2: 替換進度創建邏輯

**舊代碼：**
```javascript
// ❌ 舊方式
var helpers = ensureFilePreviewOverlay(preview);
preview.setAttribute('data-temp-id', tempId);
```

**新代碼：**
```javascript
// ✅ 新方式
const progressId = FileProgressManager.create(preview, {
  id: tempId, // 使用現有的 tempId
  fileName: file.name,
  onComplete: function() {
    console.log('✅ 上傳完成:', file.name);
    // 可選：更新其他 UI 狀態
  },
  onError: function(error) {
    console.error('❌ 上傳失敗:', error);
  }
});
```

### Step 3: 替換進度更新邏輯

**舊代碼：**
```javascript
// ❌ 舊方式
function updateProgress(preview, percent) {
  setPreviewProgress(preview, percent);
}
```

**新代碼：**
```javascript
// ✅ 新方式
FileProgressManager.update(progressId, percent, '上傳中...');
```

### Step 4: 替換完成邏輯

**舊代碼：**
```javascript
// ❌ 舊方式
setPreviewProgress(preview, 100);
setTimeout(function() {
  overlay.style.opacity = '0';
  setTimeout(function() {
    overlay.style.display = 'none';
  }, 400);
}, 200);
```

**新代碼：**
```javascript
// ✅ 新方式（自動淡出並隱藏）
FileProgressManager.complete(progressId);
```

### Step 5: 移除舊文件

完成遷移後，可以安全刪除：

```bash
# ⚠️ 確認測試通過後再刪除
rm public/js/progress-monitor.js
rm public/css/progress-bar-override.css
rm public/js/progress-bar-fix.js
```

---

## 🔍 關鍵變更點

### 1. ensureFilePreviewOverlay → FileProgressManager.create

```javascript
// Before
var helpers = ensureFilePreviewOverlay(preview);
if (helpers && helpers.progressFill) {
  helpers.progressFill.style.width = percent + '%';
}

// After
const id = FileProgressManager.create(preview);
FileProgressManager.update(id, percent);
```

### 2. setPreviewProgress → FileProgressManager.update

```javascript
// Before
setPreviewProgress(preview, 50);

// After
FileProgressManager.update(progressId, 50);
```

### 3. 完成處理

```javascript
// Before
setPreviewProgress(preview, 100);
preview.classList.add('upload-success');
setTimeout(() => {
  overlay.style.display = 'none';
}, 600);

// After
FileProgressManager.complete(progressId);
// 自動處理所有狀態變更和動畫
```

---

## 🧪 測試計畫

### 測試 1：單檔上傳
```javascript
// 測試代碼
const preview = document.querySelector('.file-preview');
const id = FileProgressManager.create(preview, {
  fileName: 'test.jpg'
});

// 模擬進度更新
let percent = 0;
const timer = setInterval(() => {
  percent += 10;
  FileProgressManager.update(id, percent);
  
  if (percent >= 100) {
    clearInterval(timer);
    FileProgressManager.complete(id);
  }
}, 200);
```

**期望結果：**
- ✅ 進度條平滑增長
- ✅ 到達 100% 後自動淡出
- ✅ overlay 完全隱藏

### 測試 2：批次上傳
```javascript
// 測試代碼
const files = Array.from(document.querySelectorAll('.file-preview'));
const ids = files.map(preview => 
  FileProgressManager.create(preview, { fileName: 'file.jpg' })
);

// 模擬批次更新
ids.forEach((id, index) => {
  setTimeout(() => {
    FileProgressManager.update(id, 100);
    FileProgressManager.complete(id);
  }, index * 500);
});
```

**期望結果：**
- ✅ 多個進度條獨立運作
- ✅ 依序完成並淡出
- ✅ 無記憶體洩漏

### 測試 3：Hover 顯示
```javascript
// 測試代碼
const preview = document.querySelector('.file-preview');
const id = FileProgressManager.create(preview);
FileProgressManager.update(id, 50);

// 手動 hover 測試
preview.dispatchEvent(new MouseEvent('mouseenter'));
```

**期望結果：**
- ✅ Hover 時顯示進度條
- ✅ 移開後隱藏（上傳中除外）
- ✅ CSS 動畫流暢

### 測試 4：錯誤處理
```javascript
// 測試代碼
const preview = document.querySelector('.file-preview');
const id = FileProgressManager.create(preview, {
  onError: (error) => console.log('錯誤回調觸發:', error)
});

FileProgressManager.update(id, 30);
FileProgressManager.fail(id, '網路連線失敗');
```

**期望結果：**
- ✅ 顯示錯誤訊息
- ✅ 觸發 onError 回調
- ✅ 預覽標記為 .upload-error

---

## 📊 效能對比

| 指標 | 舊系統 | 新系統 | 改善 |
|------|--------|--------|------|
| **輪詢頻率** | 每 500ms | 無輪詢 | ✅ CPU 使用降低 |
| **記憶體洩漏** | 可能發生 | 自動清理 | ✅ 無洩漏 |
| **代碼複雜度** | 高（3個檔案） | 低（1個檔案） | ✅ 維護簡單 |
| **百分比/像素轉換** | 手動（monitor.js） | 自動 | ✅ 一致性佳 |
| **事件回調** | 無 | 支援 | ✅ 擴展性強 |

---

## ⚠️ 注意事項

### 1. 向後相容性

新系統完全獨立，可以與舊系統並存：

```javascript
// ✅ 可以同時使用
if (window.FileProgressManager) {
  // 使用新系統
  const id = FileProgressManager.create(preview);
} else {
  // 回退到舊系統
  ensureFilePreviewOverlay(preview);
}
```

### 2. 漸進式遷移

建議分階段遷移：

**階段 1**：學生卡片上傳
- 遷移 `handleFileSelect` 中的進度邏輯
- 測試驗證

**階段 2**：課程總覽上傳
- 遷移 `handleOverviewFileSelect`
- 測試驗證

**階段 3**：編輯功能
- 遷移 `saveEditStudentRecord`
- 最終測試

### 3. 除錯模式

啟用除錯模式查看進度條邊框：

```javascript
// 啟用除錯
document.body.classList.add('debug-progress');

// 查看統計
console.log(FileProgressManager.getStats());

// 監聽事件
FileProgressManager.on('updated', (task) => {
  console.log('進度更新:', task.id, task.percent + '%');
});
```

---

## 🚀 rollback 計畫

如果遇到問題，可以快速回退：

### 方法 1：移除新檔案引入

```html
<!-- 註釋掉新模組 -->
<!-- <link rel="stylesheet" href="css/file-progress.css"> -->
<!-- <script src="js/modules/file-progress-manager.js"></script> -->
```

### 方法 2：使用舊版本

```bash
# 回退到上一個穩定版本
git checkout HEAD~1 -- public/css/progress-bar-override.css
git checkout HEAD~1 -- public/js/progress-monitor.js
```

---

## 📞 問題回報

如果遇到任何問題，請記錄：

1. **問題描述**：具體現象
2. **復現步驟**：如何觸發
3. **控制台日誌**：錯誤訊息
4. **統計資訊**：`FileProgressManager.getStats()`

---

## ✅ 完成檢查清單

- [ ] 新模組檔案已引入
- [ ] 學生上傳進度已遷移
- [ ] 課程總覽進度已遷移
- [ ] 編輯功能進度已遷移
- [ ] 所有測試通過
- [ ] 舊檔案已移除
- [ ] 文檔已更新
- [ ] 團隊成員已通知

---

## 📚 相關文件

- [FileProgressManager API 文檔](./FILE-PROGRESS-MANAGER-API.md)
- [進度條 CSS 規範](./PROGRESS-CSS-SPEC.md)
- [測試報告](./PROGRESS-TEST-REPORT.md)

---

**版本**: 1.0.0  
**日期**: 2025-11-18  
**作者**: Cascade AI Assistant
