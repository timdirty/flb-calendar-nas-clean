#!/usr/bin/env node
/**
 * 簡單的照片元數據診斷工具
 * 直接檢查本地檔案系統中的照片處理狀況
 */

const fs = require('fs');
const path = require('path');

function diagnoseLocalPhotos() {
    console.log('🔍 本地照片元數據診斷工具');
    console.log('---');

    // 檢查最近的媒體會話
    const sessionDir = path.join(__dirname, '..', 'data', 'media-sessions');
    
    if (!fs.existsSync(sessionDir)) {
        console.log('❌ 媒體會話目錄不存在');
        return;
    }

    console.log('📂 檢查媒體會話目錄...');
    const sessions = fs.readdirSync(sessionDir);
    console.log(`✅ 找到 ${sessions.length} 個會話`);

    // 檢查最近的會話
    const recentSessions = sessions
        .map(sessionId => {
            const sessionPath = path.join(sessionDir, sessionId);
            const stat = fs.statSync(sessionPath);
            return { id: sessionId, path: sessionPath, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5);

    console.log('\n📋 最近的 5 個會話:');
    recentSessions.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session.id} (${session.mtime.toLocaleString()})`);
        
        // 檢查會話內容
        try {
            const files = fs.readdirSync(session.path);
            console.log(`     檔案: ${files.join(', ')}`);
            
            // 檢查是否有處理日誌
            const logFile = files.find(f => f.endsWith('.log'));
            if (logFile) {
                const logPath = path.join(session.path, logFile);
                const logContent = fs.readFileSync(logPath, 'utf8');
                console.log(`     日誌最後幾行:`);
                const lastLines = logContent.split('\n').slice(-3);
                lastLines.forEach(line => console.log(`       ${line}`));
            }
        } catch (e) {
            console.log(`     ❌ 無法讀取會話內容: ${e.message}`);
        }
    });

    // 檢查照片處理隊列狀態
    console.log('\n📸 檢查照片處理隊列狀態...');
    const queueLogPath = path.join(__dirname, '..', 'logs', 'photo-queue.log');
    
    if (fs.existsSync(queueLogPath)) {
        const queueLog = fs.readFileSync(queueLogPath, 'utf8');
        const lines = queueLog.split('\n').filter(line => line.trim());
        console.log(`✅ 照片隊列日誌有 ${lines.length} 行`);
        
        // 顯示最後的處理記錄
        const processingLines = lines.filter(line => 
            line.includes('照片處理') || line.includes('照片元數據')
        ).slice(-10);
        
        if (processingLines.length > 0) {
            console.log('\n📊 最近的處理記錄:');
            processingLines.forEach((line, index) => {
                console.log(`  ${index + 1}. ${line}`);
            });
        }
    } else {
        console.log('⚠️ 照片隊列日誌不存在');
    }

    // 檢查錯誤日誌
    console.log('\n❌ 檢查錯誤日誌...');
    const errorLogPath = path.join(__dirname, '..', 'logs', 'app.log');
    
    if (fs.existsSync(errorLogPath)) {
        const errorLog = fs.readFileSync(errorLogPath, 'utf8');
        const errorLines = errorLog.split('\n').filter(line => 
            line.includes('❌') && (line.includes('照片') || line.includes('photo'))
        ).slice(-5);
        
        if (errorLines.length > 0) {
            console.log('🚨 最近的錯誤記錄:');
            errorLines.forEach((line, index) => {
                console.log(`  ${index + 1}. ${line}`);
            });
        } else {
            console.log('✅ 沒有找到照片相關的錯誤');
        }
    }

    console.log('\n💡 建議檢查項目:');
    console.log('  1. 檢查上傳的檔案格式是否支援（HEIC 需要特殊編碼器）');
    console.log('  2. 檢查伺服器記憶體使用情況');
    console.log('  3. 檢查 Sharp 函式庫是否正確安裝');
    console.log('  4. 檢查並行處理數量設定');
}

// 執行診斷
diagnoseLocalPhotos();
