/**
 * 分片上傳整合範例
 * 
 * 這個檔案展示如何將 ChunkedUploader 整合到現有的上傳流程中
 * 請參考此範例修改 learning-record-upload.js
 * 
 * 檔案位置: public/js/modules/upload-integration-example.js
 * 請勿直接使用此檔案，這僅是參考範例
 */

// ==================== 範例 1: 簡單上傳函數整合 ====================

/**
 * 上傳單一檔案（自動判斷是否使用分片上傳）
 * @param {File} file - 檔案物件
 * @param {string} targetPath - 目標路徑
 * @param {Function} onProgress - 進度回調
 * @returns {Promise<Object>} 上傳結果
 */
async function uploadSingleFile(file, targetPath, onProgress) {
    try {
        // 判斷檔案大小，決定上傳方式
        if (window.ChunkedUploader && ChunkedUploader.shouldUseChunkedUpload(file)) {
            console.log('📦 使用分片上傳:', file.name, ChunkedUploader.formatFileSize(file.size));
            
            // 使用分片上傳
            return await ChunkedUploader.uploadFileChunked(
                file,
                (percent, uploadedBytes, totalBytes) => {
                    if (onProgress) {
                        onProgress({
                            type: 'chunked',
                            percent,
                            uploadedBytes,
                            totalBytes,
                            filename: file.name
                        });
                    }
                },
                (chunkIndex, totalChunks) => {
                    console.log(`✅ 分片 ${chunkIndex}/${totalChunks} 完成`);
                }
            );
        } else {
            console.log('📤 使用標準上傳:', file.name);
            
            // 使用傳統 FormData 上傳
            return await traditionalUpload(file, targetPath, onProgress);
        }
    } catch (error) {
        console.error('❌ 上傳失敗:', error);
        throw error;
    }
}

/**
 * 傳統 FormData 上傳（原有方式）
 */
async function traditionalUpload(file, targetPath, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetPath', targetPath);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress({
                    type: 'traditional',
                    percent,
                    uploadedBytes: e.loaded,
                    totalBytes: e.total,
                    filename: file.name
                });
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    resolve(result);
                } catch (e) {
                    reject(new Error('解析回應失敗'));
                }
            } else {
                reject(new Error(`上傳失敗: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('網路錯誤')));
        xhr.addEventListener('abort', () => reject(new Error('上傳已取消')));

        xhr.open('POST', '/api/learning-records/upload');
        xhr.send(formData);
    });
}

// ==================== 範例 2: 批次上傳整合 ====================

/**
 * 批次上傳多個檔案（自動選擇最佳上傳方式）
 * @param {File[]} files - 檔案陣列
 * @param {string} targetPath - 目標路徑
 * @param {Function} onProgress - 總體進度回調
 * @returns {Promise<Object[]>} 上傳結果陣列
 */
async function uploadMultipleFiles(files, targetPath, onProgress) {
    const results = [];
    let completedCount = 0;
    let totalSize = files.reduce((sum, f) => sum + f.size, 0);
    let uploadedSize = 0;

    for (const file of files) {
        try {
            const result = await uploadSingleFile(
                file,
                targetPath,
                (fileProgress) => {
                    // 計算總體進度
                    const currentFileSize = file.size;
                    const currentFileProgress = (fileProgress.percent / 100) * currentFileSize;
                    const totalProgress = Math.round(((uploadedSize + currentFileProgress) / totalSize) * 100);

                    if (onProgress) {
                        onProgress({
                            totalPercent: totalProgress,
                            currentFile: file.name,
                            currentFilePercent: fileProgress.percent,
                            completedCount,
                            totalCount: files.length
                        });
                    }
                }
            );

            results.push({ file: file.name, success: true, result });
            uploadedSize += file.size;
            completedCount++;

            console.log(`✅ 檔案上傳成功 [${completedCount}/${files.length}]:`, file.name);

        } catch (error) {
            results.push({ file: file.name, success: false, error: error.message });
            console.error(`❌ 檔案上傳失敗 [${file.name}]:`, error);
        }
    }

    return results;
}

// ==================== 範例 3: UI 進度條更新 ====================

/**
 * 更新 UI 進度條（範例）
 */
function updateProgressUI(progressInfo) {
    const progressBar = document.getElementById('uploadProgress');
    const statusText = document.getElementById('uploadStatus');
    const speedText = document.getElementById('uploadSpeed');

    if (progressBar) {
        progressBar.value = progressInfo.percent || 0;
    }

    if (statusText) {
        if (progressInfo.type === 'chunked') {
            statusText.textContent = `上傳中 (分片): ${progressInfo.percent}% - ${progressInfo.filename}`;
        } else {
            statusText.textContent = `上傳中: ${progressInfo.percent}% - ${progressInfo.filename}`;
        }
    }

    if (speedText && progressInfo.uploadedBytes && progressInfo.totalBytes) {
        const uploaded = ChunkedUploader.formatFileSize(progressInfo.uploadedBytes);
        const total = ChunkedUploader.formatFileSize(progressInfo.totalBytes);
        speedText.textContent = `${uploaded} / ${total}`;
    }
}

// ==================== 範例 4: 學習記錄上傳整合 ====================

/**
 * 完整的學習記錄上傳流程整合範例
 * 這個函數展示如何在現有的學習記錄上傳中整合分片上傳
 */
async function uploadLearningRecord(formData) {
    try {
        // 1. 提取檔案
        const photos = formData.getAll('photos');
        const videos = formData.getAll('videos');
        const allFiles = [...photos, ...videos];

        // 2. 分離大檔案和小檔案
        const largeFiles = allFiles.filter(f => ChunkedUploader.shouldUseChunkedUpload(f));
        const smallFiles = allFiles.filter(f => !ChunkedUploader.shouldUseChunkedUpload(f));

        console.log('📊 檔案分類:', {
            total: allFiles.length,
            large: largeFiles.length,
            small: smallFiles.length
        });

        // 3. 先上傳大檔案（使用分片上傳）
        const largeFileResults = [];
        for (const file of largeFiles) {
            try {
                const result = await ChunkedUploader.uploadFileChunked(
                    file,
                    (percent) => {
                        console.log(`📦 ${file.name}: ${percent}%`);
                        updateProgressUI({
                            type: 'chunked',
                            percent,
                            filename: file.name
                        });
                    }
                );
                largeFileResults.push({ file: file.name, success: true, path: result.path });
            } catch (error) {
                largeFileResults.push({ file: file.name, success: false, error: error.message });
                console.error(`❌ 大檔案上傳失敗 [${file.name}]:`, error);
            }
        }

        // 4. 再上傳小檔案 + 其他資料（使用原有方式）
        let smallFileResult = null;
        if (smallFiles.length > 0 || formData.has('comment') || formData.has('studentName')) {
            // 建立新的 FormData，只包含小檔案和文字資料
            const newFormData = new FormData();
            
            // 複製小檔案
            smallFiles.forEach(file => {
                if (photos.includes(file)) {
                    newFormData.append('photos', file);
                } else if (videos.includes(file)) {
                    newFormData.append('videos', file);
                }
            });

            // 複製其他表單欄位
            for (const [key, value] of formData.entries()) {
                if (key !== 'photos' && key !== 'videos') {
                    newFormData.append(key, value);
                }
            }

            // 使用原有 API 上傳
            const response = await fetch('/api/learning-records/upload', {
                method: 'POST',
                body: newFormData
            });

            smallFileResult = await response.json();
        }

        // 5. 合併結果
        return {
            success: true,
            largeFiles: largeFileResults,
            smallFiles: smallFileResult,
            message: '上傳完成'
        };

    } catch (error) {
        console.error('❌ 學習記錄上傳失敗:', error);
        throw error;
    }
}

// ==================== 範例 5: 實際使用範例 ====================

/**
 * 在表單提交事件中使用
 */
function exampleFormSubmitHandler() {
    const form = document.getElementById('uploadForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const progressBar = document.getElementById('uploadProgress');
        const statusText = document.getElementById('uploadStatus');

        try {
            statusText.textContent = '準備上傳...';
            progressBar.value = 0;

            const result = await uploadLearningRecord(formData);

            console.log('✅ 上傳成功:', result);
            statusText.textContent = '上傳完成！';
            progressBar.value = 100;

            // 顯示成功訊息
            alert('學習記錄上傳成功！');

        } catch (error) {
            console.error('❌ 上傳失敗:', error);
            statusText.textContent = `上傳失敗: ${error.message}`;
            alert(`上傳失敗: ${error.message}`);
        }
    });
}

// ==================== 範例 6: 取消上傳功能 ====================

let currentUploadId = null;

async function startUploadWithCancel(file) {
    const cancelButton = document.getElementById('cancelUpload');
    
    try {
        cancelButton.disabled = false;
        
        const result = await uploadSingleFile(file, null, (progress) => {
            currentUploadId = progress.uploadId; // 假設在進度回調中傳遞 uploadId
            console.log(`進度: ${progress.percent}%`);
        });
        
        console.log('✅ 上傳完成:', result);
        
    } catch (error) {
        if (error.message === 'Upload cancelled') {
            console.log('🚫 上傳已取消');
        } else {
            console.error('❌ 上傳失敗:', error);
        }
    } finally {
        cancelButton.disabled = true;
        currentUploadId = null;
    }
}

function setupCancelButton() {
    const cancelButton = document.getElementById('cancelUpload');
    
    cancelButton.addEventListener('click', async () => {
        if (currentUploadId && window.ChunkedUploader) {
            const confirmed = confirm('確定要取消上傳嗎？');
            if (confirmed) {
                const success = await ChunkedUploader.cancelUpload(currentUploadId);
                if (success) {
                    console.log('🚫 上傳已取消');
                }
            }
        }
    });
}

// ==================== 導出函數（如果需要） ====================

if (typeof window !== 'undefined') {
    window.UploadIntegrationExample = {
        uploadSingleFile,
        uploadMultipleFiles,
        uploadLearningRecord,
        updateProgressUI
    };
}

console.log('✅ 上傳整合範例已載入（僅供參考）');




