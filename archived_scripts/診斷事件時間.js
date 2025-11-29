#!/usr/bin/env node
/**
 * 診斷從 Synology Calendar 獲取的事件時間
 * 這個腳本會實際調用 API 並檢查返回的事件數據
 */

const SynologyCalendarClient = require('./synology-calendar-client.js');
const fs = require('fs');

async function diagnose() {
    console.log('🔍 開始診斷事件時間...\n');
    
    // 讀取系統設定
    const systemSettings = JSON.parse(fs.readFileSync('./system-settings.json', 'utf8'));
    
    console.log('📋 Synology Calendar 設定：');
    console.log(`   地址: ${systemSettings.synologyCalendar.baseUrl}`);
    console.log(`   日曆ID: ${systemSettings.synologyCalendar.calendarId}`);
    console.log('');
    
    // 創建客戶端
    const client = new SynologyCalendarClient({
        baseUrl: systemSettings.synologyCalendar.baseUrl,
        username: systemSettings.synologyCalendar.username,
        password: systemSettings.synologyCalendar.password
    });
    
    try {
        // 登入
        console.log('🔐 正在登入...');
        await client.login();
        console.log('✅ 登入成功\n');
        
        // 獲取今天和明天的事件
        const today = new Date();
        const startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 2);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`📅 獲取事件範圍：`);
        console.log(`   開始: ${startDate.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        console.log(`   結束: ${endDate.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        console.log('');
        
        // 獲取事件
        console.log('🔄 正在獲取事件...');
        const events = await client.getEvents(
            systemSettings.synologyCalendar.calendarId,
            startDate,
            endDate
        );
        
        console.log(`✅ 獲取到 ${events.length} 個事件\n`);
        
        if (events.length === 0) {
            console.log('⚠️  沒有找到事件');
            return;
        }
        
        // 詳細檢查每個事件
        console.log('='.repeat(80));
        console.log('事件詳細信息');
        console.log('='.repeat(80));
        console.log('');
        
        events.slice(0, 5).forEach((event, index) => {
            console.log(`事件 ${index + 1}: ${event.title}`);
            console.log(`  UID: ${event.uid}`);
            console.log(`  開始時間 (event.start): ${event.start}`);
            console.log(`  結束時間 (event.end): ${event.end}`);
            
            // 解析時間部分
            if (event.start) {
                const parts = event.start.split('T');
                const datePart = parts[0];
                const timePart = parts[1] ? parts[1].substring(0, 5) : 'N/A';
                
                console.log(`  解析結果:`);
                console.log(`    日期部分: ${datePart}`);
                console.log(`    時間部分: ${timePart}`);
                
                // 從標題提取時間（如果有）
                const titleTimeMatch = event.title.match(/(\d{1,2}):(\d{2})/);
                if (titleTimeMatch) {
                    const titleTime = titleTimeMatch[0];
                    console.log(`    標題中的時間: ${titleTime}`);
                    
                    if (titleTime === timePart) {
                        console.log(`    ✅ 時間匹配！`);
                    } else {
                        console.log(`    ❌ 時間不匹配！差異: ${calculateTimeDiff(titleTime, timePart)} 小時`);
                    }
                }
            }
            
            // 檢查原始的 startDate
            if (event.startDate) {
                console.log(`  原始 startDate 對象:`);
                console.log(`    toString(): ${event.startDate.toString()}`);
                console.log(`    toISOString(): ${event.startDate.toISOString()}`);
                console.log(`    toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'}): ${event.startDate.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
                
                // 使用不同方法獲取小時
                console.log(`  時間提取測試:`);
                console.log(`    getHours(): ${event.startDate.getHours()}`);
                console.log(`    getUTCHours(): ${event.startDate.getUTCHours()}`);
                
                // 測試轉換為台灣時間
                const taiwanHour = parseInt(event.startDate.toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit',
                    hour12: false
                }));
                console.log(`    台灣時區小時: ${taiwanHour}`);
            }
            
            console.log(`  描述: ${event.description ? event.description.substring(0, 50) + '...' : '無'}`);
            console.log(`  地點: ${event.location || '無'}`);
            console.log(`  講師: ${event.instructor || '未設定'}`);
            console.log('');
        });
        
        // 登出
        await client.logout();
        console.log('✅ 診斷完成');
        
    } catch (error) {
        console.error('❌ 診斷過程發生錯誤:', error);
        console.error('錯誤詳情:', error.stack);
    }
}

function calculateTimeDiff(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const diff = (h1 * 60 + m1) - (h2 * 60 + m2);
    return (diff / 60).toFixed(1);
}

// 執行診斷
diagnose().catch(error => {
    console.error('執行失敗:', error);
    process.exit(1);
});


