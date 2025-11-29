const SynologyCalendarClient = require('./synology-calendar-client');
require('dotenv').config({ path: '.env.nas' });

async function quickTestMultipleEvents() {
    try {
        console.log('🔍 ========== 快速測試多個事件 ==========\n');
        
        const client = new SynologyCalendarClient(
            process.env.SYNOLOGY_HOST || 'https://funlearnbar.synology.me:9102',
            process.env.SYNOLOGY_USERNAME || 'testacount',
            process.env.SYNOLOGY_PASSWORD || 'testacount'
        );
        
        await client.login();
        console.log('✅ 登入成功\n');
        
        // 測試多個不同日曆的事件
        const testCases = [
            { calendarId: '/testacount/rptffmz/', eventId: '140100', description: 'HANSEN - 成功事件' },
            { calendarId: '/testacount/mcskmf/', eventId: '140026', description: 'TIM - 失敗事件' },
            { calendarId: '/testacount/xfgdzu/', eventId: '140718', description: 'IVAN - 另一個失敗事件' },
            { calendarId: '/testacount/jzeblk/', eventId: '20251101T121739-gawqoxga@cal.synology.com', description: 'JAMES - ical_uid 事件' },
        ];
        
        const results = [];
        
        for (const testCase of testCases) {
            console.log(`\n🧪 測試: ${testCase.description}`);
            console.log(`   日曆: ${testCase.calendarId}`);
            console.log(`   事件ID: ${testCase.eventId}`);
            
            try {
                // 先獲取事件
                const axios = require('axios');
                let event;
                
                if (isNaN(testCase.eventId)) {
                    // ical_uid
                    const getParams1 = new URLSearchParams({
                        api: 'SYNO.Cal.Event',
                        version: '5',
                        method: 'get',
                        ical_uid: testCase.eventId,
                        cal_id: testCase.calendarId,
                        _sid: client.sid
                    });
                    
                    const getRes1 = await axios.post(
                        `${client.baseUrl}/webapi/entry.cgi`,
                        getParams1.toString(),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-SYNO-TOKEN': client.synotoken || ''
                            },
                            timeout: 10000
                        }
                    );
                    
                    if (!getRes1.data.success) {
                        results.push({ ...testCase, status: 'failed', reason: '無法獲取事件' });
                        continue;
                    }
                    
                    event = getRes1.data.data;
                    
                    if (event.evt_id) {
                        const getParams2 = new URLSearchParams({
                            api: 'SYNO.Cal.Event',
                            version: '5',
                            method: 'get',
                            evt_id: event.evt_id,
                            cal_id: testCase.calendarId,
                            _sid: client.sid
                        });
                        
                        const getRes2 = await axios.post(
                            `${client.baseUrl}/webapi/entry.cgi`,
                            getParams2.toString(),
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'X-SYNO-TOKEN': client.synotoken || ''
                                },
                                timeout: 10000
                            }
                        );
                        
                        if (getRes2.data.success) {
                            event = getRes2.data.data;
                        }
                    }
                } else {
                    // evt_id
                    const getParams = new URLSearchParams({
                        api: 'SYNO.Cal.Event',
                        version: '5',
                        method: 'get',
                        evt_id: testCase.eventId,
                        cal_id: testCase.calendarId,
                        _sid: client.sid
                    });
                    
                    const getRes = await axios.post(
                        `${client.baseUrl}/webapi/entry.cgi`,
                        getParams.toString(),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-SYNO-TOKEN': client.synotoken || ''
                            },
                            timeout: 10000
                        }
                    );
                    
                    if (!getRes.data.success) {
                        results.push({ ...testCase, status: 'failed', reason: '無法獲取事件' });
                        continue;
                    }
                    
                    event = getRes.data.data;
                }
                
                console.log(`   事件資料:`);
                console.log(`      evt_id: ${event.evt_id}`);
                console.log(`      cal_id: ${event.cal_id || 'undefined'}`);
                console.log(`      original_cal_id: ${event.original_cal_id}`);
                console.log(`      summary: ${event.summary}`);
                
                // 測試更新
                const originalTitle = event.summary;
                const testTitle = '[測試] ' + originalTitle;
                
                const updateResult = await client.updateEvent(
                    testCase.calendarId,
                    testCase.eventId,
                    { title: testTitle }
                );
                
                if (updateResult) {
                    console.log(`   ✅ 更新成功！`);
                    results.push({ ...testCase, status: 'success', cal_id: event.cal_id, original_cal_id: event.original_cal_id });
                    
                    // 恢復標題
                    setTimeout(async () => {
                        try {
                            await client.updateEvent(
                                testCase.calendarId,
                                testCase.eventId,
                                { title: originalTitle }
                            );
                        } catch (e) {
                            // 忽略恢復錯誤
                        }
                    }, 1000);
                } else {
                    console.log(`   ❌ 更新失敗（返回 false）`);
                    results.push({ ...testCase, status: 'failed', reason: '更新返回 false', cal_id: event.cal_id, original_cal_id: event.original_cal_id });
                }
            } catch (error) {
                console.log(`   ❌ 錯誤: ${error.message}`);
                results.push({ ...testCase, status: 'error', reason: error.message });
            }
        }
        
        // 輸出結果摘要
        console.log('\n\n📊 ========== 測試結果摘要 ==========\n');
        results.forEach(result => {
            const statusIcon = result.status === 'success' ? '✅' : '❌';
            console.log(`${statusIcon} ${result.description}`);
            console.log(`   事件ID: ${result.eventId}`);
            if (result.cal_id !== undefined) {
                console.log(`   cal_id: ${result.cal_id || 'undefined'}`);
                console.log(`   original_cal_id: ${result.original_cal_id}`);
            }
            if (result.reason) {
                console.log(`   原因: ${result.reason}`);
            }
            console.log('');
        });
        
        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status !== 'success').length;
        
        console.log(`✅ 成功: ${successCount}/${results.length}`);
        console.log(`❌ 失敗: ${failedCount}/${results.length}`);
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        if (error.stack) {
            console.error('堆疊:', error.stack);
        }
    }
}

quickTestMultipleEvents();

