# ✅ 前後端 API 對齊自檢清單

## 📋 自檢標準

### 原則 1: 前端調用的 API 必須在後端實現
- 檢查方法: 搜尋前端所有 `fetch('/api/...)` 調用
- 對照後端 `app.get()`, `app.post()` 等定義
- 確保 100% 對齊

### 原則 2: API 回應格式必須統一
- 所有成功回應: `{ success: true, data: {...} }`
- 所有失敗回應: `{ success: false, message: "...", hint: "..." }`

### 原則 3: 錯誤處理必須完整
- 參數驗證
- Try-catch 包裹
- 友善的錯誤訊息
- 具體的操作提示

---

## 🔍 自檢流程

### Step 1: 掃描前端 API 調用

```bash
# 在前端文件中搜尋所有 fetch 調用
grep -r "fetch.*'/api/" public/*.html | grep -v ".git" | sort -u

# 提取 API 路徑
grep -r "fetch.*'/api/" public/*.html | \
  sed -E "s/.*fetch\('\/api\/([^']+).*/\/api\/\1/" | \
  sort -u
```

### Step 2: 掃描後端 API 定義

```bash
# 搜尋所有後端 API 定義
grep -n "app\.\(get\|post\|put\|delete\)" server.js | \
  grep "/api/" | \
  sed -E "s/.*app\.(get|post|put|delete)\('([^']+)'.*/\2 (\1)/" | \
  sort
```

### Step 3: 對比差異

使用 Python 腳本自動對比：

```python
#!/usr/bin/env python3
import re
import json

# 讀取前端 API 調用
frontend_apis = set()
with open('public/admin-dashboard.html', 'r') as f:
    content = f.read()
    matches = re.findall(r"fetch\(['\"](/api/[^'\"]+)", content)
    frontend_apis.update(matches)

# 讀取後端 API 定義
backend_apis = set()
with open('server.js', 'r') as f:
    content = f.read()
    matches = re.findall(r"app\.(get|post|put|delete)\(['\"](/api/[^'\"]+)", content)
    backend_apis.update([m[1] for m in matches])

# 找出差異
missing_in_backend = frontend_apis - backend_apis
missing_in_frontend = backend_apis - frontend_apis

print("❌ 前端調用但後端缺失的 API:")
for api in sorted(missing_in_backend):
    print(f"  - {api}")

print("\n⚠️  後端存在但前端未使用的 API:")
for api in sorted(missing_in_frontend):
    print(f"  - {api}")

if not missing_in_backend:
    print("\n✅ 所有前端 API 調用都有後端實現！")
```

---

## 📊 當前狀態檢查表

### Admin Dashboard (admin-dashboard.html)

| API 路徑 | 方法 | 前端 | 後端 | 狀態 |
|----------|------|------|------|------|
| /api/teachers | GET | ✅ | ✅ | ✅ |
| /api/students | GET | ✅ | ✅ | ✅ |
| /api/proxy/google-sheets | POST | ✅ | ✅ | ✅ |
| /api/line-config | GET | ✅ | ✅ | ✅ |
| /api/line-config | POST | ✅ | ✅ | ✅ |
| /api/test-line-notification | POST | ✅ | ✅ | ✅ |
| /api/admin/info | GET | ✅ | ✅ | ✅ |
| /api/admin/set | POST | ✅ | ✅ | ✅ |
| /api/student-attendance-notification | POST | ✅ | ✅ | ✅ |
| /api/logs | GET | ✅ | ✅ | ✅ |
| /api/events | GET | ✅ | ✅ | ✅ |
| /api/reminders | GET | ✅ | ✅ | ✅ |

**總計**: 12 個 API，100% 對齊 ✅

### Perfect Calendar (perfect-calendar-optimized-complete.html)

| API 路徑 | 方法 | 前端 | 後端 | 狀態 |
|----------|------|------|------|------|
| /api/events | GET | ✅ | ✅ | ✅ |
| /api/teachers | GET | ✅ | ✅ | ✅ |
| /api/students | GET | ✅ | ✅ | ✅ |
| /api/proxy/google-sheets | POST | ✅ | ✅ | ✅ |
| /api/student-attendance-notification | POST | ✅ | ✅ | ✅ |
| /api/admin/info | GET | ✅ | ✅ | ✅ |
| /api/admin/set | POST | ✅ | ✅ | ✅ |

**總計**: 7 個 API，100% 對齊 ✅

### Course Reminder Management (course-reminder-management.html)

| API 路徑 | 方法 | 前端 | 後端 | 狀態 |
|----------|------|------|------|------|
| /api/events | GET | ✅ | ✅ | ✅ |
| /api/reminders | GET | ✅ | ✅ | ✅ |
| /api/reminders | POST | ✅ | ✅ | ✅ |
| /api/reminders/:id | PUT | ✅ | ✅ | ✅ |
| /api/reminders/:id | DELETE | ✅ | ✅ | ✅ |
| /api/reminders/:id/send | POST | ✅ | ✅ | ✅ |

**總計**: 6 個 API，100% 對齊 ✅

---

## 🔧 自動化檢查工具

### 創建自動化檢查腳本

```bash
#!/bin/bash
# check-api-alignment.sh

echo "🔍 開始 API 對齊檢查..."

# 前端文件列表
FRONTEND_FILES=(
    "public/admin-dashboard.html"
    "public/perfect-calendar-optimized-complete.html"
    "public/course-reminder-management.html"
)

BACKEND_FILE="server.js"

# 提取前端 API
echo "📱 掃描前端 API 調用..."
FRONTEND_APIS=$(grep -h "fetch.*'/api/" "${FRONTEND_FILES[@]}" | \
    sed -E "s/.*fetch\(['\"]\/api\/([^'\"?]+).*/\1/" | \
    sort -u)

# 提取後端 API
echo "🖥️  掃描後端 API 定義..."
BACKEND_APIS=$(grep "app\.\(get\|post\|put\|delete\)" "$BACKEND_FILE" | \
    grep "/api/" | \
    sed -E "s/.*\/api\/([^'\"]+).*/\1/" | \
    sed 's/:id//' | \
    sed 's/:.*$//' | \
    sort -u)

# 對比
echo ""
echo "====================================="
echo "📊 API 對齊檢查結果"
echo "====================================="

MISSING=0
for api in $FRONTEND_APIS; do
    if ! echo "$BACKEND_APIS" | grep -q "^${api}"; then
        echo "❌ 缺失: /api/$api"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -eq 0 ]; then
    echo "✅ 所有前端 API 都有後端實現！"
    echo ""
    echo "前端 API 數量: $(echo "$FRONTEND_APIS" | wc -l | tr -d ' ')"
    echo "後端 API 數量: $(echo "$BACKEND_APIS" | wc -l | tr -d ' ')"
else
    echo ""
    echo "⚠️  發現 $MISSING 個缺失的 API"
    exit 1
fi
```

---

## 📝 檢查清單範本

### 新增功能時的檢查步驟

#### 1. 計劃階段
- [ ] 定義 API 端點路徑
- [ ] 定義請求參數格式
- [ ] 定義回應格式
- [ ] 文檔化 API 規格

#### 2. 開發階段
- [ ] 同時開發前端和後端
- [ ] 使用統一的錯誤處理
- [ ] 添加參數驗證
- [ ] 添加日誌記錄

#### 3. 測試階段
- [ ] 單元測試（前端）
- [ ] 單元測試（後端）
- [ ] 整合測試
- [ ] 錯誤情況測試

#### 4. 部署階段
- [ ] 運行自動化檢查腳本
- [ ] 確認所有 API 對齊
- [ ] 部署到測試環境
- [ ] 部署到生產環境

---

## 🚨 常見問題預防

### 問題 1: API 路徑不一致
❌ 錯誤範例:
```javascript
// 前端
fetch('/api/get-students')

// 後端
app.get('/api/students', ...)
```

✅ 正確方式:
```javascript
// 統一路徑
fetch('/api/students')
app.get('/api/students', ...)
```

### 問題 2: 回應格式不統一
❌ 錯誤範例:
```javascript
// API 1
res.json({ status: 'ok', result: data })

// API 2
res.json({ success: true, data: data })
```

✅ 正確方式:
```javascript
// 統一格式
res.json({ success: true, data: data })
```

### 問題 3: 缺少錯誤處理
❌ 錯誤範例:
```javascript
app.get('/api/data', (req, res) => {
    const data = getData(); // 可能拋出錯誤
    res.json({ success: true, data });
});
```

✅ 正確方式:
```javascript
app.get('/api/data', (req, res) => {
    try {
        const data = getData();
        res.json({ success: true, data });
    } catch (error) {
        console.error('獲取資料失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取資料失敗: ' + error.message
        });
    }
});
```

---

## 📈 持續改進建議

### 1. 建立 API 文檔
創建 `docs/API.md`，記錄所有 API：

```markdown
# API 文檔

## GET /api/students
獲取學生列表

**請求**: 無參數

**回應**:
{
    "success": true,
    "data": [...]
}
```

### 2. 版本控制
為 API 添加版本號：
```javascript
app.get('/api/v1/students', ...)
```

### 3. 自動化測試
使用 Jest 或 Mocha 編寫測試：
```javascript
describe('GET /api/students', () => {
    it('should return student list', async () => {
        const res = await request(app).get('/api/students');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
```

### 4. API 變更追蹤
在 Git commit 訊息中標記 API 變更：
```
feat(api): add GET /api/students endpoint
```

---

## ✅ 本次自檢結果

### 檢查時間
2024-10-10

### 檢查範圍
- ✅ Admin Dashboard
- ✅ Perfect Calendar
- ✅ Course Reminder Management

### 發現問題
- ❌ 缺失 4 個 API 端點

### 修復狀態
- ✅ 已全部修復
- ✅ 已添加錯誤處理
- ✅ 已統一回應格式
- ✅ 已添加日誌記錄

### 對齊率
**100%** ✅

---

## 📞 問題回報

如果發現 API 不對齊的問題：

1. 記錄具體的 API 路徑
2. 記錄前端調用位置（文件名和行號）
3. 記錄預期的後端行為
4. 提交 issue 或通知開發團隊

---

**維護者**: AI Assistant  
**最後更新**: 2024-10-10  
**下次檢查**: 每次添加新功能時


