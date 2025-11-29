# Drive API 调试指南

## 🐛 当前已知问题

### 问题 1: 前端无法正确读取 Drive 上的内容

**症状**：上传成功但页面刷新后看不到内容

**可能原因**：
1. 后端返回的数据格式与前端期望不匹配
2. `getRecordsByCourse` 的数据转换逻辑有误
3. metadata.json 中的字段缺失

**调试步骤**：

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 查找以下日志：
```javascript
🔍 [Drive 歷史記錄] 查詢參數
✅ [Drive 歷史記錄] 查詢成功
```

4. 检查返回的数据结构：
```javascript
// 打开 Network 标签，找到 history-drive 请求
// 查看 Response，应该类似：
{
  "success": true,
  "records": [
    {
      "semester": "114-1",
      "courseName": "课程名",
      "date": "2025-11-08",
      "isOverview": true,
      "studentName": "課程總覽",
      "recordPath": "/Fun Learn Bar/FLB-Learning-Portfolio/...",
      "photos": [
        { "name": "xxx.jpg", "path": "/...", "url": "/api/drive-media/..." }
      ],
      "videos": []
    }
  ]
}
```

### 问题 2: 照片上传卡在前端动画

**症状**：选择照片后预览出现，点击上传按钮后一直转圈

**可能原因**：
1. 文件未正确保存到全局变量
2. 上传按钮绑定失败
3. `uploadOverview` 函数未执行

**调试步骤**：

1. 选择照片后，在 Console 执行：
```javascript
console.log('Photos:', window.overviewPhotosFiles);
console.log('Videos:', window.overviewVideosFiles);
```

应该看到：
```javascript
Photos: [File, File, ...]  // 有值
Videos: []                 // 可能为空
```

2. 检查上传按钮是否绑定：
```javascript
var btn = document.getElementById('overviewSyncStatus');
console.log('Button:', btn);
console.log('onclick:', btn.onclick);
```

3. 手动触发上传：
```javascript
uploadOverview({ silent: false });
```

4. 查看上传日志：
```javascript
📤 [Drive 總覽上傳] 開始上傳
📊 [Drive 總覽上傳] 待上傳: { photos: X, videos: Y, summary: Z }
```

---

## 🔧 临时修复方案

### 修复 1: 手动触发上传

如果上传按钮不工作，在 Console 执行：

```javascript
// 1. 确保文件已选择
console.log('Files:', window.overviewPhotosFiles?.length || 0);

// 2. 手动触发上传
uploadOverview({ silent: false });
```

### 修复 2: 强制刷新历史记录

如果看不到已上传的内容，在 Console 执行：

```javascript
// 强制重新加载
loadUploadedRecordsForCurrentCourse({ force: true, clearCache: true });
```

---

## 📊 预期行为

### 正常上传流程

1. **选择文件** → 应该看到：
```
✅ [課程總覽] 文件已保存到全局變數: { photos: X, videos: Y }
```

2. **点击上传** → 应该看到：
```
🚀 [手動上傳] 課程總覽上傳被觸發
📤 [Drive 總覽上傳] 開始上傳
📊 [Drive 總覽上傳] 待上傳: { ... }
📤 總覽上傳進度: 0%
📤 總覽上傳進度: 50%
📤 總覽上傳進度: 100%
✅ [Drive 總覽上傳] 上傳成功
```

3. **后端处理** → 应该看到（在服务器日志）：
```
📤 [Drive 上傳] 接收上傳請求
📋 [Drive 上傳] 處理課程總覽
📤 [學習歷程] 上傳課程總覽
✅ [Drive 上傳] 課程總覽上傳成功
```

4. **刷新页面** → 应该看到：
```
🔍 [Drive 歷史記錄] 查詢參數
✅ [Drive 歷史記錄] 查詢成功，找到 X 筆記錄
```

---

## 🚨 常見錯誤

### 错误 1: "沒有內容可上傳"

**原因**：文件未保存到全局变量

**解决**：检查 `handleOverviewPhotosSelect` 是否正确执行

### 错误 2: "上傳失敗: 缺少必要欄位"

**原因**：courseName 或 date 缺失

**解决**：确保 `currentCourse` 对象包含完整信息

### 错误 3: "網絡錯誤"

**原因**：后端未启动或端口不对

**解决**：检查 `npm run dev` 是否在运行

---

## 📞 需要提供的调试信息

如果问题持续，请提供：

1. **浏览器 Console 日志**（完整）
2. **Network 标签中的请求详情**（特别是 upload-drive 和 history-drive）
3. **服务器日志**（最后 50 行）
4. **Synology Drive 截图**（显示实际文件）
