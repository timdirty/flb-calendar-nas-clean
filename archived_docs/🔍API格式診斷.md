# 🔍 API 格式診斷指南

**目的**：找出 `/api/teachers` API 的實際回應格式

---

## ⚠️ 當前問題

您看到的錯誤：
```
API回應格式錯誤: {success: true, data: {…}, timestamp: '2025-10-16T07:00:31.461Z'}
```

這表示 API 回應了，但程式無法找到 `teachers` 陣列。

---

## 🔍 新增的除錯訊息

我已經在程式碼中添加了詳細的除錯訊息。下次重新整理頁面後，Console 會顯示：

### 1️⃣ API 回應結構檢查
```javascript
API回應完整結構: {...}
檢查 data.teachers: ...
檢查 data.data: ...
檢查 data.data?.teachers: ...
```

### 2️⃣ 格式偵測
```javascript
✅ 使用格式 1: data.teachers
或
✅ 使用格式 2: data.data.teachers
或
✅ 使用格式 3: data.data 是陣列
或
✅ 使用格式 4: data 本身是陣列
```

### 3️⃣ 最終結果
```javascript
🔍 最終 teachers 陣列: [...]
🔍 teachers 長度: X
```

### 4️⃣ 如果失敗
```javascript
❌ API回應格式錯誤 - 無法找到講師陣列
完整 API 回應: {...}
data 的所有 key: [...]
```

---

## 📋 下一步驟

### 步驟 1：等待同步完成
⏳ 等待 10-30 秒讓 Synology Drive 同步最新檔案

### 步驟 2：清除快取並重新整理
```
按 Cmd+Shift+R (macOS) 或 Ctrl+Shift+R (Windows)
```

### 步驟 3：開啟 Console 並複製訊息

開啟瀏覽器 Console (F12 或右鍵 → 檢查)，找到以下訊息：

#### ✅ 如果成功
```
API回應完整結構: {...}
✅ 使用格式 X: ...
🔍 最終 teachers 陣列: [...]
🔍 teachers 長度: 15
👥 找到 15 個講師，開始比對...
```

#### ❌ 如果失敗
```
API回應完整結構: {...}
❌ API回應格式錯誤 - 無法找到講師陣列
完整 API 回應: {...}
data 的所有 key: ["success", "data", "timestamp"]
```

### 步驟 4：提供診斷資訊

**請複製以下訊息給我**：

1. `API回應完整結構:` 後面的完整物件
2. `檢查 data.teachers:` 的值
3. `檢查 data.data:` 的值
4. `data 的所有 key:` 的陣列

這樣我就能準確知道 API 的實際格式並修正程式碼。

---

## 🔧 可能的 API 格式

我已經在程式碼中支援以下 4 種格式：

### 格式 1：直接在根層級
```json
{
  "teachers": [
    {"name": "Tim", "userId": "..."},
    {"name": "Ted", "userId": "..."}
  ]
}
```

### 格式 2：嵌套在 data.data
```json
{
  "success": true,
  "data": {
    "teachers": [...]
  }
}
```

### 格式 3：data 直接是陣列
```json
{
  "success": true,
  "data": [
    {"name": "Tim", "userId": "..."},
    {"name": "Ted", "userId": "..."}
  ]
}
```

### 格式 4：完全是陣列
```json
[
  {"name": "Tim", "userId": "..."},
  {"name": "Ted", "userId": "..."}
]
```

---

## 💡 快速測試

### 在 Console 中直接測試 API

```javascript
// 測試 API 回應格式
fetch('/api/teachers')
  .then(r => r.json())
  .then(data => {
    console.log('📊 完整 API 回應:', data);
    console.log('📊 data 的類型:', typeof data);
    console.log('📊 data 是否為陣列:', Array.isArray(data));
    console.log('📊 data 的所有 key:', Object.keys(data));
    console.log('📊 data.teachers:', data.teachers);
    console.log('📊 data.data:', data.data);
    console.log('📊 data.data?.teachers:', data.data?.teachers);
  });
```

### 或使用 curl（在終端機）

```bash
# 在 NAS 上執行
curl -X GET http://localhost:3000/api/teachers | jq .

# 或從外部
curl -X GET https://calendar.funlearnbar.synology.me/api/teachers | jq .
```

---

## 🎯 目標

找出正確的 API 格式後，我可以：

1. ✅ 修正程式碼中的格式判斷邏輯
2. ✅ 確保講師比對功能正常運作
3. ✅ 移除不必要的錯誤訊息

---

## 📞 需要協助

如果您不確定如何操作，請：

1. 重新整理頁面
2. 開啟 Console (F12)
3. 截圖或複製所有以下開頭的訊息：
   - `API回應完整結構:`
   - `檢查 data.`
   - `完整 API 回應:`
   - `data 的所有 key:`

然後提供給我，我就能立即修復！

---

**修復版本**：2025-10-16 15:00
**狀態**：⏳ 等待同步並測試
**預計時間**：10-30 秒後生效

