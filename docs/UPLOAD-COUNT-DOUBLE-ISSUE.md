# 🐛 上傳數量重複計算問題

> **發現日期**: 2025-11-26  
> **狀態**: 🔍 待修復

---

## 🎯 問題描述

學生卡片顯示的照片和影片數量是實際數量的**兩倍**。

### 實際情況
- **實際檔案**: 9 照片，2 影片
- **索引記錄**: 18 照片，4 影片
- **前端顯示**: 36 照片，8 影片（？）

---

## 🔍 問題分析

### 1. 索引數量錯誤

**索引中的數據**:
```json
{
  "studentName": "王奕甯，王奕棋",
  "photoCount": 18,  // ← 應該是 9
  "videoCount": 4,   // ← 應該是 2
  "hasComment": true,
  "hasAnyUpload": true
}
```

**實際 Drive 檔案**:
- `photos`: 9 個檔案
- `videos`: 2 個檔案
- `newMediaPhotos`: 9 個檔案
- `newMediaVideos`: 2 個檔案

### 2. 可能的原因

#### 原因 A: 上傳被調用兩次
- 前端可能重複提交上傳請求
- 或者後端處理了兩次相同的上傳

#### 原因 B: 索引更新邏輯錯誤
- 雖然 `updateStudentRecordSummary` 是替換而非累加
- 但可能在某個環節被調用了兩次

#### 原因 C: 上傳時計算錯誤
- `uploadResults.photos.length` 可能包含了重複的檔案
- 或者計算方式有誤

---

## 🔧 臨時解決方案

### 方案 1: 手動修正索引

```bash
# 備份索引
cp /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/data/learning-records-index.json /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/data/learning-records-index.json.backup

# 手動修正數量（將 18 改為 9，4 改為 2）
```

### 方案 2: 重建索引

建立一個腳本，掃描所有 Drive 資料夾，重新計算實際的檔案數量，並更新索引。

---

## 🎯 根本解決方案

### 1. 追蹤上傳流程

在 `learning-upload-helper.js` 中加入詳細日誌：

```javascript
console.log('📤 [上傳] 開始上傳:', {
  studentName,
  photoCount: photos.length,
  videoCount: videos.length,
  timestamp: new Date().toISOString()
});

// ... 上傳邏輯 ...

console.log('✅ [上傳] 完成上傳:', {
  studentName,
  photoCount: uploadResults.photos.length,
  videoCount: uploadResults.videos.length,
  timestamp: new Date().toISOString()
});

console.log('🔄 [索引] 更新索引:', {
  studentName,
  photoCount: metadata.totalPhotos,
  videoCount: metadata.totalVideos,
  timestamp: new Date().toISOString()
});
```

### 2. 檢查前端是否重複提交

在前端上傳函數中加入防重複提交機制：

```typescript
const [isUploading, setIsUploading] = useState(false);

const handleUpload = async () => {
  if (isUploading) {
    console.warn('⚠️ 上傳進行中，忽略重複請求');
    return;
  }
  
  setIsUploading(true);
  try {
    await uploadFiles();
  } finally {
    setIsUploading(false);
  }
};
```

### 3. 索引更新時驗證數量

在 `updateStudentRecordSummary` 中加入驗證：

```javascript
// 如果新數量是舊數量的倍數，可能有問題
if (existing.photoCount > 0 && photoCount === existing.photoCount * 2) {
  console.warn('⚠️ [索引] 檢測到可能的重複計算:', {
    studentName,
    oldPhotoCount: existing.photoCount,
    newPhotoCount: photoCount
  });
}
```

---

## 📝 調查步驟

1. **檢查上傳日誌**
   - 查看是否有重複的上傳記錄
   - 確認每次上傳的數量

2. **檢查前端請求**
   - 使用瀏覽器開發工具查看 Network 面板
   - 確認是否有重複的 POST 請求

3. **檢查索引更新日誌**
   - 查看索引更新的時間戳
   - 確認是否在短時間內更新了兩次

---

## 🎯 下一步

1. ✅ 加入詳細日誌追蹤上傳流程
2. ⏳ 檢查前端是否有重複提交
3. ⏳ 檢查後端是否有重複處理
4. ⏳ 建立索引重建工具
5. ⏳ 修復根本問題

---

**發現人員**: Tim (ctctim14)  
**記錄人員**: Cascade AI  
**優先級**: 🔴 高（影響數據準確性）
