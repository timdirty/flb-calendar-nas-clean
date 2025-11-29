#!/usr/bin/env node
/**
 * 診斷 photos-meta.json 與實際檔案數量不符問題
 * 
 * 使用方法：
 * node scripts/diagnose-photo-meta.js --student="學生姓名" --date="2025-11-25" --course="MINECRAFT 二 1100-1200"
 */

const fs = require('fs');
const path = require('path');
const { driveClient } = require('../synology-drive-client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        params[key] = value;
    }
});

async function diagnosePhotoMeta() {
    const { student, date, course } = params;
    
    if (!student || !date || !course) {
        console.log('❌ 缺少必要參數');
        console.log('使用方法: node diagnose-photo-meta.js --student="學生姓名" --date="2025-11-25" --course="MINECRAFT 二 1100-1200"');
        return;
    }

    console.log(`🔍 診斷照片元數據問題`);
    console.log(`📋 學生: ${student}`);
    console.log(`📅 日期: ${date}`);
    console.log(`📚 課程: ${course}`);
    console.log('---');

    try {
        // 構建路徑
        const basePath = `/Fun Learn Bar/FLB-Learning-Portfolio/2025上學期/${course}/${date} 20251117T080256/${student}`;
        console.log(`📂 檢查路徑: ${basePath}`);

        // 1. 列出所有檔案
        console.log('\n📁 步驟 1: 列出 Drive 中的所有檔案');
        const allFiles = await driveClient.listFiles(basePath);
        console.log(`✅ 找到 ${allFiles.length} 個檔案`);
        
        const imageFiles = allFiles.filter(file => 
            file.name.match(/\.(jpg|jpeg|png|heic|webp)$/i)
        );
        console.log(`📸 其中圖片檔案: ${imageFiles.length} 個`);
        
        imageFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.file_size || 'unknown'} bytes)`);
        });

        // 2. 讀取 photos-meta.json
        console.log('\n📄 步驟 2: 讀取 photos-meta.json');
        try {
            const metaResponse = await driveClient.getFileStream(`${basePath}/photos-meta.json`);
            const metaContent = await streamToString(metaResponse);
            const photoMeta = JSON.parse(metaContent);
            
            console.log(`✅ photos-meta.json 包含 ${photoMeta.length} 筆記錄`);
            photoMeta.forEach((photo, index) => {
                console.log(`  ${index + 1}. ${photo.originalName || photo.filename} (ID: ${photo.id})`);
            });

            // 3. 比較差異
            console.log('\n🔍 步驟 3: 分析差異');
            const metaFilenames = photoMeta.map(p => p.filename).filter(Boolean);
            const actualFilenames = imageFiles.map(f => f.name);
            
            const missingInMeta = actualFilenames.filter(name => !metaFilenames.includes(name));
            const extraInMeta = metaFilenames.filter(name => !actualFilenames.includes(name));
            
            if (missingInMeta.length > 0) {
                console.log(`❌ 缺失在元數據中的檔案 (${missingInMeta.length} 個):`);
                missingInMeta.forEach(name => console.log(`  - ${name}`));
            }
            
            if (extraInMeta.length > 0) {
                console.log(`⚠️ 元數據中多餘的檔案 (${extraInMeta.length} 個):`);
                extraInMeta.forEach(name => console.log(`  - ${name}`));
            }
            
            if (missingInMeta.length === 0 && extraInMeta.length === 0) {
                console.log('✅ 元數據與實際檔案完全一致');
            }

            // 4. 分析模式
            console.log('\n📊 步驟 4: 分析檔案模式');
            if (missingInMeta.length > 0) {
                console.log('🔍 分析缺失檔案的特徵:');
                const missingFiles = imageFiles.filter(f => missingInMeta.includes(f.name));
                
                // 檢查檔案大小
                const sizes = missingFiles.map(f => parseInt(f.file_size) || 0);
                const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
                console.log(`  平均檔案大小: ${(avgSize / 1024 / 1024).toFixed(2)} MB`);
                
                // 檢查檔案類型
                const extensions = {};
                missingFiles.forEach(f => {
                    const ext = path.extname(f.name).toLowerCase();
                    extensions[ext] = (extensions[ext] || 0) + 1;
                });
                console.log('  檔案類型分佈:', extensions);
                
                // 檢查檔名模式
                const hasTimestamp = missingFiles.some(f => f.name.match(/\d{13}/));
                console.log(`  包含時間戳檔名: ${hasTimestamp ? '是' : '否'}`);
            }

        } catch (metaError) {
            console.log(`❌ 無法讀取 photos-meta.json: ${metaError.message}`);
        }

    } catch (error) {
        console.error(`❌ 診斷失敗: ${error.message}`);
    }
}

// 輔助函數：將 stream 轉為 string
function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}

// 執行診斷
diagnosePhotoMeta().catch(console.error);
