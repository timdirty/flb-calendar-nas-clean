<!-- ff8b3223-f226-44b9-a383-31dc15e42ab3 7540cd77-a518-4810-ae83-f6d72f224b09 -->
# 对齐学生页面与课程总览的所有逻辑（基于截图问题）

## 核心问题分析（截图）

用户截图显示：

1. 大量404错误：`/api/learning-records/file?filename=IMG_5198-...webm` (旧API路径)
2. 文件已删除但UI仍显示照片和视频缩略图
3. 控制台显示 `previewUrl` 和 `videoUrl` 都指向旧路径
4. 评语显示正常但不确定读写路径

**根本原因**：

- `buildRecordFileUrl()` 函数生成旧API路径
- 抽屉渲染使用 `r.files.videos` 而非 `r.newMediaVideos`
- 前端有缓存机制未正确清除
- 后端可能未返回新媒体系统数据结构

## 修复步骤

### 步骤1：修复 buildRecordFileUrl() 核心函数

**文件**：`public/js/pages/learning-record-upload.js`

**位置**：约第1480-1520行

**问题**：返回旧路径 `/api/learning-records/file?filename=...`

**修复方案**：

```javascript
function buildRecordFileUrl(record, filename) {
  var isThumbnail = isGeneratedThumbnailName(filename);
  var isVideo = isVideoFilename(filename);
  
  // 优先检查新媒体系统
  if (record.newMediaVideos && Array.isArray(record.newMediaVideos)) {
    var video = record.newMediaVideos.find(function(v) {
      return v.filename === filename || v.originalName === filename;
    });
    if (video && video.id) {
      if (isThumbnail) {
        return '/api/media/videos/' + video.id + '/thumbnail';
      }
      return '/api/media/videos/' + video.id + '/download';
    }
  }
  
  if (record.newMediaPhotos && Array.isArray(record.newMediaPhotos)) {
    var photo = record.newMediaPhotos.find(function(p) {
      return p.filename === filename || p.originalName === filename;
    });
    if (photo && photo.id) {
      return '/api/media/photos/' + photo.id;
    }
  }
  
  // 降级到旧系统（仅用于兼容历史数据）
  var relativePath = record.relativePath || record.relativePathUnified || '';
  return '/api/learning-records/file?filename=' + 
         encodeURIComponent(filename) + 
         '&relativePath=' + encodeURIComponent(relativePath);
}
```

### 步骤2：修复抽屉渲染数据来源

**文件**：`public/js/pages/learning-record-upload.js`

**位置**：`renderUploadedRecords()` 约第6450-6520行

**问题**：使用 `r.files.videos` 而非 `r.newMediaVideos`

**修复方案**：

在抽屉渲染视频部分，优先使用新媒体系统数据：

```javascript
var videos = [];
var videoThumbnails = {};

if (r.newMediaVideos && Array.isArray(r.newMediaVideos)) {
  videos = r.newMediaVideos;
  r.newMediaVideos.forEach(function(v) {
    if (v.thumbnailFilename) {
      videoThumbnails[v.filename] = v.thumbnailFilename;
    }
  });
} else if (r.files && r.files.videos) {
  videos = r.files.videos.map(function(fn) { return { filename: fn }; });
  videoThumbnails = r.videoThumbnails || r.files.videoThumbnails || {};
}

var videoBlocks = videos.map(function(vItem) {
  var fn = typeof vItem === 'string' ? vItem : vItem.filename;
  var url = buildRecordFileUrl(r, fn);
  var thumbUrl = '';
  
  if (vItem.id) {
    thumbUrl = '/api/media/videos/' + vItem.id + '/thumbnail';
  } else {
    var thumbName = videoThumbnails[fn];
    if (thumbName) thumbUrl = buildRecordFileUrl(r, thumbName);
  }
  
  return buildMediaPreviewHtml({
    type: 'video',
    previewUrl: url,
    thumbUrl: thumbUrl,
    filename: fn,
    removable: true,
    removeHandler: "deleteStudentFile('" + r.studentName + "', '" + fn + "')"
  });
}).join('');
```

同样修复照片部分：

```javascript
var photos = [];
if (r.newMediaPhotos && Array.isArray(r.newMediaPhotos)) {
  photos = r.newMediaPhotos;
} else if (r.files && r.files.photos) {
  photos = r.files.photos.map(function(fn) { return { filename: fn }; });
}

var photoBlocks = photos.map(function(pItem) {
  var fn = typeof pItem === 'string' ? pItem : pItem.filename;
  var url = buildRecordFileUrl(r, fn);
  return buildMediaPreviewHtml({
    type: 'image',
    previewUrl: url,
    filename: fn,
    removable: true,
    removeHandler: "deleteStudentFile('" + r.studentName + "', '" + fn + "')"
  });
}).join('');
```

### 步骤3：确保后端返回新媒体系统数据

**文件**：`server.js`

**检查API 1**：`/api/learning-records/by-course` (约第2100-2400行)

- 确认读取 `media-index.json`
- 解析 `mediaIds` 并构建 `newMediaVideos` 和 `newMediaPhotos` 数组
- 返回格式包含这些字段

**检查API 2**：`/api/learning-records/lookup-student` (约第2500-2700行)

- 同样需要返回 `newMediaVideos` 和 `newMediaPhotos`
- 已在之前修改中添加 `videoThumbnails`，确认此修改生效

**期望返回格式**：

```javascript
{
  studentName: '菲菲 11401',
  comment: '评语内容',
  newMediaVideos: [
    { 
      id: 'xxx', 
      filename: 'IMG_5198-1762...webm', 
      originalName: 'IMG_5198.mov',
      thumbnailFilename: 'IMG_5198-...thumb.jpg'
    }
  ],
  newMediaPhotos: [
    { 
      id: 'yyy', 
      filename: 'IMG_5313-...jpg', 
      originalName: 'IMG_5313.jpg' 
    }
  ],
  files: { photos: [], videos: [] }  // 旧系统兼容
}
```

### 步骤4：修复删除后的缓存清除

**文件**：`public/js/pages/learning-record-upload.js`

**位置**：`deleteStudentFile()` 函数

**修复方案**：

```javascript
function deleteStudentFile(studentName, filename) {
  // ... 现有删除API调用 ...
  
  .then(function(data) {
    if (data.success) {
      // 立即清除所有相关缓存
      clearServerMediaCache(studentName, 'photos');
      clearServerMediaCache(studentName, 'videos');
      
      // 清除视频缩图缓存
      Object.keys(videoThumbnailReadyCache).forEach(function(key) {
        if (key.indexOf(studentName) === 0) {
          delete videoThumbnailReadyCache[key];
        }
      });
      
      // 清除 localStorage
      var courseKey = (currentCourse.courseName || '') + '_' + (currentCourse.date || '');
      localStorage.removeItem('uploadedRecords_' + courseKey);
      
      // 强制重新加载（不使用缓存）
      loadUploadedRecordsForCurrentCourse({ force: true, clearCache: true });
      
      showToast('删除成功', 'success');
    }
  });
}
```

### 步骤5：统一评语保存路径

**学生评语保存**：

- 函数：`uploadStudentRecord()` (约第4900-5300行)
- 确认调用 `/api/learning-records/save`
- 移除任何 `/api/learning-records/upload` 调用

**课程总览评语保存**：

- 函数：`uploadOverview()` (约第5640-5930行)
- 确认调用 `/api/learning-records/save`
- 参数：`{ coursePeriod, date, relativePath, comment: overviewText, mediaIds: [] }`

### 步骤6：统一评语读取路径

**后端**：`server.js` 的 `/api/learning-records/by-course`

- 课程总览评语：优先读取 `overview.txt`，降级读取 `summary.txt`
- 学生评语：从 `record-meta.json` 的 `comment` 字段读取

**前端**：

- 课程总览：`hydrateOverviewFieldsFromSummary()` 回填
- 学生评语：`applyExistingRecordToCard()` 回填

### 步骤7：验证修复效果

**测试1：删除文件**

1. 打开学生页面，确认显示文件
2. 点击删除按钮
3. 确认控制台无404错误
4. 确认UI立即清空
5. 刷新页面，确认仍为空

**测试2：上传文件**

1. 上传照片/影片
2. 检查控制台URL是否为新路径：

   - 视频：`/api/media/videos/:id/download`
   - 照片：`/api/media/photos/:id`

3. 确认缩图显示正常

**测试3：抽屉同步**

1. 打开抽屉
2. 确认显示的文件与主卡片一致
3. 确认控制台无404错误
4. 确认可以正常预览

**测试4：评语保存**

1. 输入学生评语，保存
2. 刷新页面，确认评语显示
3. 输入课程总览评语，保存
4. 刷新页面，确认评语显示

## 关键文件和函数

**前端** (`public/js/pages/learning-record-upload.js`)：

- `buildRecordFileUrl()` - 1480-1520行 - **核心修复**
- `renderUploadedRecords()` - 6440-6700行 - 抽屉渲染
- `applyExistingRecordToCard()` - 3600-3900行 - 主卡片渲染
- `deleteStudentFile()` - 需查找具体位置 - 删除逻辑
- `uploadStudentRecord()` - 4900-5300行 - 学生评语保存
- `uploadOverview()` - 5640-5930行 - 总览评语保存

**后端** (`server.js`)：

- `/api/learning-records/by-course` - 2100-2400行
- `/api/learning-records/lookup-student` - 2500-2700行
- `/api/learning-records/save` - 需确认位置

## 预期结果

修复完成后：

1. 控制台不再有404错误
2. 所有媒体URL使用新API路径
3. 删除文件后UI立即清空
4. 抽屉和主卡片数据完全一致
5. 评语读写使用新格式

### To-dos

- [ ] 修复 buildRecordFileUrl() 返回新媒体 API 路径
- [ ] 修复抽屉视频渲染，使用 newMediaVideos
- [ ] 修复抽屉照片渲染，使用 newMediaPhotos
- [ ] 确认后端 API 返回 newMediaVideos/Photos
- [ ] 修复删除后的缓存清除逻辑
- [ ] 统一评语保存路径（使用新 API）
- [ ] 统一评语读取路径（优先新格式）
- [ ] 测试删除流程（无404，UI清空）
- [ ] 测试上传流程（新 URL，正确显示）
- [ ] 测试抽屉与主卡片数据同步
- [ ] 测试评语保存和读取