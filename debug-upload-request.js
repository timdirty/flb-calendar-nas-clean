/**
 * 調試腳本：監控前端上傳請求的參數
 * 
 * 在伺服器端添加中間件來記錄所有上傳請求的詳細參數
 */

// 將以下代碼添加到 server.js 中的適當位置（在 upload-drive API 之前）

app.use('/api/learning-records/upload-drive', (req, res, next) => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              🔍 調試：前端上傳請求參數                               ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📅 時間:', new Date().toLocaleString('zh-TW'));
    console.log('🌐 來源 IP:', req.ip);
    console.log('');
    console.log('📝 Body 參數:');
    console.log('  semester:', req.body.semester);
    console.log('  courseName:', req.body.courseName);
    console.log('  date:', req.body.date);
    console.log('  topic:', req.body.topic);
    console.log('  studentName:', req.body.studentName);
    console.log('');
    console.log('🔄 相容參數（舊版）:');
    console.log('  course:', req.body.course);
    console.log('  period:', req.body.period);
    console.log('  coursePeriod:', req.body.coursePeriod);
    console.log('  relativePath:', req.body.relativePath);
    console.log('');
    console.log('📸 檔案:');
    if (req.files) {
        console.log('  photos:', req.files.photos?.length || 0);
        console.log('  videos:', req.files.videos?.length || 0);
        console.log('  overviewPhotos:', req.files.overviewPhotos?.length || 0);
        console.log('  overviewVideos:', req.files.overviewVideos?.length || 0);
    }
    console.log('');
    console.log('🔍 其他參數:');
    console.log('  isOverview:', req.body.isOverview);
    console.log('  comment 長度:', req.body.comment?.length || 0);
    console.log('');
    
    // 記錄完整的 body（排除大型字段）
    const cleanBody = { ...req.body };
    if (cleanBody.comment && cleanBody.comment.length > 100) {
        cleanBody.comment = cleanBody.comment.substring(0, 100) + '...';
    }
    console.log('📦 完整 Body（簡化版）:', JSON.stringify(cleanBody, null, 2));
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                        調試結束                                       ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    next();
});

console.log('✅ 調試中間件已添加');
console.log('👉 請將以上代碼添加到 server.js 的第 18350 行附近（在 app.post 之前）');
console.log('👉 重新啟動伺服器後，每次上傳都會顯示詳細參數');
