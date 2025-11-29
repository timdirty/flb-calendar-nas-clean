#!/bin/bash
# 檢查事件的原始數據

cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "🔍 檢查事件原始數據..."
echo ""

docker exec flb-calendar-nas node << 'NODESCRIPT'
const SynologyCalendarClient = require('./synology-calendar-client.js');
const fs = require('fs');

async function debug() {
    const settings = JSON.parse(fs.readFileSync('./system-settings.json', 'utf8'));
    
    const client = new SynologyCalendarClient({
        baseUrl: settings.synologyCalendar.baseUrl,
        username: settings.synologyCalendar.username,
        password: settings.synologyCalendar.password
    });
    
    try {
        await client.login();
        console.log('✅ 登入成功\n');
        
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0));
        const end = new Date(today.setDate(today.getDate() + 2));
        
        const events = await client.getEvents(settings.synologyCalendar.calendarId, start, end);
        
        console.log('📅 找到', events.length, '個事件\n');
        console.log('='.repeat(80));
        
        events.slice(0, 3).forEach((event, i) => {
            console.log(`\n事件 ${i + 1}: ${event.title}`);
            console.log('─'.repeat(80));
            
            // 原始時間字串
            console.log('event.start:', event.start);
            
            // 分解時間
            if (event.start) {
                const [datePart, timePart] = event.start.split('T');
                console.log('  日期部分:', datePart);
                console.log('  時間部分:', timePart);
                
                // 從標題提取時間對比
                const titleMatch = event.title.match(/(\d{1,2}):(\d{2})/);
                if (titleMatch) {
                    console.log('  標題中的時間:', titleMatch[0]);
                    console.log('  時間是否匹配:', timePart.substring(0, 5) === titleMatch[0] ? '✅' : '❌');
                }
            }
            
            // 原始 Date 對象
            if (event.startDate) {
                console.log('\nevent.startDate (Date 對象):');
                console.log('  toString():', event.startDate.toString());
                console.log('  toISOString():', event.startDate.toISOString());
                console.log('  getHours():', event.startDate.getHours());
                console.log('  getUTCHours():', event.startDate.getUTCHours());
                
                // 台灣時區
                const taiwanTime = event.startDate.toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                console.log('  台灣時區時間:', taiwanTime);
            }
        });
        
        console.log('\n' + '='.repeat(80));
        
        await client.logout();
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
    }
}

debug();
NODESCRIPT


