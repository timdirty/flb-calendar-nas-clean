# 🚀 特殊事件標記測試 - 快速啟動指南

**5 分鐘開始測試！**

---

## 📋 第一步：準備環境（2 分鐘）

### 1. 打開測試頁面

```
http://calendar.funlearnbar.synology.me/admin-dashboard.html
```

### 2. 打開瀏覽器 Console

- **Mac**：`Cmd + Option + J`
- **Windows**：`F12` 或 `Ctrl + Shift + J`

### 3. 載入測試輔助工具

複製以下 URL 到瀏覽器新分頁，複製全部內容：

```
/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/tests/manual/test-helper-console.js
```

或直接從 GitHub/專案檔案中打開 `tests/manual/test-helper-console.js`

然後貼到 Console 中執行。

**看到這個訊息表示成功**：
```
✅ 特殊事件測試輔助工具已載入！
💡 輸入 SpecialEventTestHelper.help() 查看使用說明
🚀 輸入 SpecialEventTestHelper.runAllBasicTests() 開始測試
```

---

## 🧪 第二步：執行基礎測試（3 分鐘）

### 測試 1：停課標記 ⏱️ 30 秒

**1. 在 Console 輸入：**
```javascript
SpecialEventTestHelper.test_1_1_停課標記()
```

**2. 按照提示手動操作：**
- 找到「【測試】SPIKE 基礎班」課程
- 點擊課程卡片
- 勾選「停課」標記
- 點擊「確認標記」
- 確認預覽彈窗

**3. 驗證結果：**
```javascript
SpecialEventTestHelper.verify_1_1()
```

**預期輸出**：
```
✅ 標題包含 [停課]
✅ 原始標題保留
✅ 描述保留原始內容
✅ 課程有紅色樣式

測試結果: ✅ 通過
```

---

### 測試 2：代課標記（含錯誤處理）⏱️ 1 分鐘

**1. 在 Console 輸入：**
```javascript
SpecialEventTestHelper.test_1_3A_代課標記()
```

**2. 手動操作：**
- 找到「【測試】Minecraft 程式班」課程
- 記錄原授課講師名稱
- 勾選「代課」標記
- 選擇**不同的**代課講師
- 輸入備註：「原講師請假」
- 確認標記

**3. 驗證結果：**
```javascript
SpecialEventTestHelper.verify_1_3A()
```

**預期輸出**：
```
✅ 標題包含 [代課]
✅ 描述包含代課講師
✅ 描述包含備註
✅ 課程有藍色樣式

⚠️ 請手動確認：
- 課程是否移動到代課講師的日曆
- 原講師日曆中該課程是否消失
```

---

### 測試 3：描述保留測試（最關鍵）⏱️ 1.5 分鐘

這是**最重要**的測試，驗證多次操作後原始描述不會丟失。

**1. 開始測試：**
```javascript
SpecialEventTestHelper.test_5_5_描述保留()
```

**2. 步驟 1 - 添加體驗標記：**
- 找到「【測試】Scratch 創意班」
- 勾選「體驗」
- 確認標記
- 驗證：
```javascript
SpecialEventTestHelper.verify_5_5_step1()
```

**3. 步驟 2 - 增量添加公告：**
- 切換到「增量模式」（勾選「保留現有標記」）
- 勾選「公告」
- 輸入：「測試公告內容」
- 確認標記
- 驗證：
```javascript
SpecialEventTestHelper.verify_5_5_step2()
```

**4. 步驟 3 - 移除公告：**
- 勾選「公告」
- 點擊「移除標記」
- 確認移除
- 驗證：
```javascript
SpecialEventTestHelper.verify_5_5_step3()
```

**5. 步驟 4 - 移除體驗：**
- 勾選「體驗」
- 點擊「移除標記」
- 確認移除
- 驗證：
```javascript
SpecialEventTestHelper.verify_5_5_step4()
```

**6. 最終驗證：**
```javascript
SpecialEventTestHelper.verify_5_5_final()
```

**預期輸出**：
```
🎯 最終驗證：描述完全恢復
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 原始描述:
豐富的描述內容，包含：
- 特殊字元 !@#$%
- 多行文字
- 空行測試

📋 當前描述:
豐富的描述內容，包含：
- 特殊字元 !@#$%
- 多行文字
- 空行測試

檢查結果:
✅ 完全一致: true
✅ 包含原始內容: true
```

---

## 🎯 快速檢查清單

完成以上測試後，檢查以下項目：

- [ ] 停課標記添加成功，標題有 `[停課]` 前綴
- [ ] 原始標題和描述都保留
- [ ] 代課標記添加成功，描述包含代課講師
- [ ] 課程移動到代課講師日曆（如果該講師有日曆）
- [ ] **描述保留測試**：多次添加/移除後，原始描述完全恢復 ⭐

---

## 🐛 如果測試失敗

### 常見問題處理

**問題 1：找不到測試課程**
```javascript
// 列出所有課程
SpecialEventTestHelper.listAllEvents()

// 查找特定課程
SpecialEventTestHelper.findEvent("SPIKE")
```

**問題 2：描述丟失**
- 立即停止測試
- 記錄失敗的操作步驟
- 截圖保存當前狀態
- 在 Console 執行：
```javascript
const event = adminAllEvents.find(e => e.title.includes('失敗的課程名稱'));
console.log('當前描述:', event.description);
```

**問題 3：標記未生效**
- 檢查 Console 是否有錯誤訊息
- 刷新頁面重新載入課程
- 重新執行測試

---

## 📊 測試完成後

### 填寫測試報告

打開測試報告模板：
```
tests/manual/special-events-basic-test.md
```

記錄所有測試結果，包括：
- 通過/失敗狀態
- 截圖
- 發現的問題
- 建議改進

### 提交測試結果

如果發現問題，請提供：
1. 測試案例編號
2. 操作步驟
3. 預期結果 vs 實際結果
4. Console 錯誤訊息（如果有）
5. 截圖

---

## 💡 進階技巧

### 快速查看課程資訊
```javascript
// 查找課程
SpecialEventTestHelper.findEvent("SPIKE")

// 查看詳細資訊
const event = adminAllEvents.find(e => e.title.includes('SPIKE'));
SpecialEventTestHelper.showEventDetail(event)
```

### 批次驗證
```javascript
// 驗證多個課程的標記
['SPIKE', 'Python', 'Minecraft'].forEach(keyword => {
  const event = adminAllEvents.find(e => e.title.includes(keyword));
  if (event) {
    console.log(`${keyword}:`, SpecialEventTestHelper.getEventMarkers(event));
  }
});
```

### 監控描述變化
```javascript
// 儲存原始描述
const originalDesc = adminAllEvents.find(e => e.title.includes('SPIKE')).description;

// 執行操作後比對
const currentDesc = adminAllEvents.find(e => e.title.includes('SPIKE')).description;
console.log('描述是否一致:', originalDesc === currentDesc);
```

---

## ✅ 成功標準

**基礎測試完全通過的標準**：
1. ✅ 所有測試案例驗證函數返回 `true`
2. ✅ Console 無錯誤訊息
3. ✅ 原始描述在所有操作後完全保留
4. ✅ 視覺樣式正確（紅/綠/藍/橘/紫）

**如果所有測試通過**：
- 系統基礎功能正常 ✅
- 可以進行下一階段測試（多標記、互斥規則）

**如果有測試失敗**：
- 記錄詳細資訊
- 暫停後續測試
- 優先修復問題

---

## 🔗 相關文檔

- 完整測試計畫：`/docs/SPECIAL-EVENTS-VERIFICATION-PLAN.md`
- 待辦清單：`/docs/SPECIAL-EVENTS-TODO.md`
- 詳細測試指南：`/tests/manual/special-events-basic-test.md`

---

**預估總測試時間**：5-10 分鐘  
**建議測試環境**：Chrome 或 Safari 最新版本  
**測試人員**：管理員權限帳號

🎯 **立即開始測試吧！**
