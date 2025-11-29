# Drive 上传重构补丁说明

**文件**: `public/js/pages/learning-record-upload.js`  
**目标**: 将分片上传逻辑改为 Drive API 批量上传

## 需要替换的代码块

### 位置：约 8638-9300 行

**当前逻辑**：
```javascript
if (USE_PARALLEL_UPLOADS) {
  // 1. 定义 uploadOneChunked 函数 (8673-8948)
  // 2. 定义 uploadOne 函数 (8950-9110)
  // 3. 定义 runWithLimit 函数 (9112-9128)
  // 4. 创建任务列表并执行 (9130-9300)
}
```

**新逻辑**：使用 Drive API 批量上传

```javascript
if (includePhotos || includeVideos || includeComment) {
  // 显示上传中状态
  try { mergeLocalUploadedRecord(studentIndex, student); } catch (e) {}

  // 🔥 构建 FormData（包含所有文件）
  var formData = new FormData();
  
  // 添加元数据
  formData.append('semester', '114-1'); // TODO: 从系统设置获取当前学期
  formData.append('courseName', courseValue + ' ' + periodValue);
  formData.append('date', dateValue);
  formData.append('studentName', student.name);
  if (pendingComment) formData.append('comment', pendingComment);
  
  // 添加所有照片
  if (includePhotos) {
    for (var i = 0; i < pendingPhotos.length; i++) {
      var photoFile = pendingPhotos[i];
      formData.append('photos', photoFile, photoFile.name);
    }
  }
  
  // 添加所有影片
  if (includeVideos) {
    for (var j = 0; j < pendingVideos.length; j++) {
      var videoFile = pendingVideos[j];
      formData.append('videos', videoFile, videoFile.name);
    }
  }
  
  // 使用 XMLHttpRequest 上传（支持进度）
  var xhr = new XMLHttpRequest();
  
  xhr.upload.addEventListener('progress', function(e) {
    if (e.lengthComputable) {
      var percent = Math.round((e.loaded / e.total) * 100);
      updateUploadProgressDisplay(studentIndex, percent);
      console.log('📤 上传进度:', percent + '%');
    }
  });
  
  xhr.addEventListener('load', function() {
    if (xhr.status === 200) {
      try {
        var response = JSON.parse(xhr.responseText);
        if (response.success) {
          console.log('✅ 上传成功:', response);
          
          // 清空待上传列表
          baseState.photos = [];
          baseState.videos = [];
          baseState.baselineComment = pendingComment;
          
          // 更新 UI
          uploadSucceeded = true;
          btn.classList.remove('uploading');
          btn.disabled = false;
          updateUploadProgressDisplay(studentIndex, 100);
          
          // 刷新学生记录
          setTimeout(function() {
            fetchStudentFsRecord(studentIndex, student);
          }, 500);
          
          if (typeof showToast === 'function') {
            showToast('✅ 上传成功', 'success');
          }
        } else {
          throw new Error(response.error || '上传失败');
        }
      } catch (error) {
        console.error('❌ 解析响应失败:', error);
        handleUploadError(error);
      }
    } else {
      handleUploadError(new Error('HTTP ' + xhr.status));
    }
    uploadingStudents[studentIndex] = false;
  });
  
  xhr.addEventListener('error', function() {
    console.error('❌ 网络错误');
    handleUploadError(new Error('网络错误'));
    uploadingStudents[studentIndex] = false;
  });
  
  xhr.addEventListener('abort', function() {
    console.log('⚠️ 上传已取消');
    uploadingStudents[studentIndex] = false;
  });
  
  function handleUploadError(error) {
    btn.classList.remove('uploading');
    btn.disabled = false;
    console.error('❌ 上传失败:', error);
    if (typeof showToast === 'function') {
      showToast('❌ 上传失败: ' + error.message, 'error');
    }
  }
  
  // 发送请求
  xhr.open('POST', '/api/learning-records/upload-drive', true);
  xhr.send(formData);
  
} else {
  // 没有内容需要上传
  console.log('ℹ️ 没有内容需要上传');
  uploadingStudents[studentIndex] = false;
  btn.classList.remove('uploading');
  btn.disabled = false;
}
```

## 其他需要删除的代码

### 1. ChunkedUploader 引用
- 删除 ChunkedUploader 相关的所有代码
- 删除 `uploadOneChunked` 函数
- 删除 `uploadOne` 函数
- 删除 `runWithLimit` 函数

### 2. 课程总览上传（约 9700-10500 行）
需要类似的修改，将分片上传改为 Drive API 批量上传

## 注意事项

1. **学期获取**：需要从系统设置或当前课程中获取当前学期（114-1）
2. **进度更新**：使用 `xhr.upload.progress` 事件更新进度条
3. **错误处理**：确保所有错误都被正确处理并显示给用户
4. **取消功能**：可以通过 `xhr.abort()` 取消上传
5. **响应格式**：Drive API 返回的格式与旧 API 不同，需要相应调整

## 测试检查清单

- [ ] 单张照片上传
- [ ] 多张照片上传
- [ ] 单个影片上传
- [ ] 多个影片上传
- [ ] 照片 + 影片混合上传
- [ ] 照片 + 评语上传
- [ ] 进度显示正确
- [ ] 错误处理正确
- [ ] 上传后自动刷新
- [ ] 课程总览上传

---

**状态**: 概念设计完成，需要实际编码实施  
**难度**: 高（涉及大量代码重构）  
**优先级**: 高（必须完成以移除本地媒体系统）

