#!/usr/bin/env node

/**
 * 📝 清理元数据工具
 * 
 * 用途：删除 videos-meta.json 和 photos-meta.json 中引用的已删除文件
 * 
 * 使用方法：
 *   node scripts/clean-metadata.js [目录路径]
 * 
 * 示例：
 *   node scripts/clean-metadata.js "/volume1/Fun Learn Bar/學習歷程 automatic/114-1/SPIKE PRO 日 10:00-12:00 第6週/2025-11-02/陳杰睿"
 */

const fs = require('fs');
const path = require('path');

function cleanMetadata(dirPath) {
    console.log('🔍 检查目录:', dirPath);
    
    if (!fs.existsSync(dirPath)) {
        console.error('❌ 目录不存在:', dirPath);
        return;
    }
    
    let totalCleaned = 0;
    
    // 清理 videos-meta.json
    const videosMetaPath = path.join(dirPath, 'videos-meta.json');
    if (fs.existsSync(videosMetaPath)) {
        try {
            const content = fs.readFileSync(videosMetaPath, 'utf8');
            const allVideos = JSON.parse(content);
            
            if (Array.isArray(allVideos)) {
                const existingVideos = allVideos.filter(v => {
                    const videoPath = path.join(dirPath, v.filename || '');
                    const exists = fs.existsSync(videoPath);
                    
                    if (!exists) {
                        console.log('🗑️  删除引用:', v.filename);
                        totalCleaned++;
                    }
                    
                    return exists;
                });
                
                if (existingVideos.length !== allVideos.length) {
                    // 写回清理后的数据
                    fs.writeFileSync(
                        videosMetaPath,
                        JSON.stringify(existingVideos, null, 2),
                        'utf8'
                    );
                    console.log(`✅ videos-meta.json: ${allVideos.length} → ${existingVideos.length}`);
                } else {
                    console.log('✅ videos-meta.json: 无需清理');
                }
            }
        } catch (e) {
            console.error('❌ 清理 videos-meta.json 失败:', e.message);
        }
    }
    
    // 清理 photos-meta.json
    const photosMetaPath = path.join(dirPath, 'photos-meta.json');
    if (fs.existsSync(photosMetaPath)) {
        try {
            const content = fs.readFileSync(photosMetaPath, 'utf8');
            const allPhotos = JSON.parse(content);
            
            if (Array.isArray(allPhotos)) {
                const existingPhotos = allPhotos.filter(p => {
                    const photoPath = path.join(dirPath, p.filename || '');
                    const exists = fs.existsSync(photoPath);
                    
                    if (!exists) {
                        console.log('🗑️  删除引用:', p.filename);
                        totalCleaned++;
                    }
                    
                    return exists;
                });
                
                if (existingPhotos.length !== allPhotos.length) {
                    // 写回清理后的数据
                    fs.writeFileSync(
                        photosMetaPath,
                        JSON.stringify(existingPhotos, null, 2),
                        'utf8'
                    );
                    console.log(`✅ photos-meta.json: ${allPhotos.length} → ${existingPhotos.length}`);
                } else {
                    console.log('✅ photos-meta.json: 无需清理');
                }
            }
        } catch (e) {
            console.error('❌ 清理 photos-meta.json 失败:', e.message);
        }
    }
    
    console.log(`\n🎉 清理完成！共删除 ${totalCleaned} 个无效引用`);
}

// 递归清理目录
function cleanRecursive(basePath) {
    console.log('🔍 递归清理:', basePath);
    
    if (!fs.existsSync(basePath)) {
        console.error('❌ 目录不存在:', basePath);
        return;
    }
    
    const items = fs.readdirSync(basePath);
    
    for (const item of items) {
        const fullPath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // 检查是否是学生目录（包含 comment.txt）
            if (fs.existsSync(path.join(fullPath, 'comment.txt'))) {
                console.log('\n📂 学生目录:', fullPath);
                cleanMetadata(fullPath);
            } else {
                // 继续递归
                cleanRecursive(fullPath);
            }
        }
    }
}

// 主程序
const targetPath = process.argv[2];

if (!targetPath) {
    console.log('用法: node scripts/clean-metadata.js <目录路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/clean-metadata.js "/volume1/Fun Learn Bar/學習歷程 automatic/114-1"');
    console.log('');
    process.exit(1);
}

const stat = fs.statSync(targetPath);

if (stat.isDirectory()) {
    if (fs.existsSync(path.join(targetPath, 'comment.txt'))) {
        // 单个学生目录
        cleanMetadata(targetPath);
    } else {
        // 递归清理
        cleanRecursive(targetPath);
    }
} else {
    console.error('❌ 不是目录:', targetPath);
    process.exit(1);
}


