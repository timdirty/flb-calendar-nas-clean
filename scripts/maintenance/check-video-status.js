#!/usr/bin/env node

/**
 * 检查学习记录中的视频状态
 * 用于诊断手机端缩图显示问题
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = '/volume1/Fun Learn Bar/學習歷程 automatic';
const TARGET = '114-1/SPIKE PRO 日 10:00-12:00 第6週/2025-11-02/陳杰睿';

function checkDirectory(dirPath) {
    console.log('\n📂 检查目录:', dirPath);
    console.log('=' .repeat(80));
    
    if (!fs.existsSync(dirPath)) {
        console.log('❌ 目录不存在');
        return;
    }
    
    const files = fs.readdirSync(dirPath);
    console.log('\n📄 文件列表:');
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        const size = (stat.size / 1024 / 1024).toFixed(2);
        console.log(`  - ${file} (${size} MB)`);
    });
    
    // 检查 videos-meta.json
    const videosMetaPath = path.join(dirPath, 'videos-meta.json');
    if (fs.existsSync(videosMetaPath)) {
        console.log('\n✅ videos-meta.json 存在');
        try {
            const content = fs.readFileSync(videosMetaPath, 'utf8');
            const videosMeta = JSON.parse(content);
            console.log('\n📹 视频元数据:');
            console.log(JSON.stringify(videosMeta, null, 2));
            
            // 检查每个视频的文件是否存在
            videosMeta.forEach((video, index) => {
                console.log(`\n视频 ${index + 1}: ${video.originalName}`);
                console.log(`  - ID: ${video.id}`);
                console.log(`  - 状态: ${video.status}`);
                console.log(`  - 原始文件: ${video.filename}`);
                console.log(`  - 转码文件: ${video.transcodedFilename || '❌ 未生成'}`);
                console.log(`  - 缩图文件: ${video.thumbnailFilename || '❌ 未生成'}`);
                
                // 检查文件是否真的存在
                if (video.filename) {
                    const originalPath = path.join(dirPath, video.filename);
                    console.log(`  - 原始文件存在: ${fs.existsSync(originalPath) ? '✅' : '❌'}`);
                }
                
                if (video.transcodedFilename) {
                    const transcodedPath = path.join(dirPath, video.transcodedFilename);
                    console.log(`  - 转码文件存在: ${fs.existsSync(transcodedPath) ? '✅' : '❌'}`);
                }
                
                if (video.thumbnailFilename) {
                    const thumbnailPath = path.join(dirPath, video.thumbnailFilename);
                    console.log(`  - 缩图文件存在: ${fs.existsSync(thumbnailPath) ? '✅' : '❌'}`);
                }
            });
        } catch (e) {
            console.error('❌ 解析 videos-meta.json 失败:', e.message);
        }
    } else {
        console.log('\n❌ videos-meta.json 不存在');
    }
    
    // 检查 media-meta.json
    const mediaMetaPath = path.join(dirPath, 'media-meta.json');
    if (fs.existsSync(mediaMetaPath)) {
        console.log('\n✅ media-meta.json 存在');
        try {
            const content = fs.readFileSync(mediaMetaPath, 'utf8');
            const mediaMeta = JSON.parse(content);
            console.log('\n📊 媒体元数据:');
            console.log(JSON.stringify(mediaMeta, null, 2));
        } catch (e) {
            console.error('❌ 解析 media-meta.json 失败:', e.message);
        }
    } else {
        console.log('\n⚠️ media-meta.json 不存在');
    }
    
    // 检查旧系统视频
    const videos = files.filter(f => /\.(mov|mp4|webm)$/i.test(f));
    if (videos.length > 0) {
        console.log('\n🎬 视频文件:');
        videos.forEach(v => {
            const fullPath = path.join(dirPath, v);
            const stat = fs.statSync(fullPath);
            const size = (stat.size / 1024 / 1024).toFixed(2);
            console.log(`  - ${v} (${size} MB)`);
        });
    }
    
    // 检查缩图文件
    const thumbnails = files.filter(f => /\.thumb\.jpg$/i.test(f) || /\.jpg$/i.test(f));
    if (thumbnails.length > 0) {
        console.log('\n🖼️ 缩图文件:');
        thumbnails.forEach(t => {
            const fullPath = path.join(dirPath, t);
            const stat = fs.statSync(fullPath);
            const size = (stat.size / 1024).toFixed(2);
            console.log(`  - ${t} (${size} KB)`);
        });
    }
}

// 主函数
console.log('🔍 视频状态检查工具');
console.log('=' .repeat(80));

const targetPath = path.join(BASE_PATH, TARGET);
checkDirectory(targetPath);

// 也检查 115-1（错误学期）
const wrongPath = path.join(BASE_PATH, '115-1/SPIKE PRO 日 10:00-12:00 第6週/2025-11-02/陳杰睿');
if (fs.existsSync(wrongPath)) {
    console.log('\n\n⚠️ 发现错误学期目录 (115-1):');
    checkDirectory(wrongPath);
}

console.log('\n\n✅ 检查完成');


