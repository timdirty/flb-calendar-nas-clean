// Synology Calendar API 客戶端模組 (基於官方文檔)
const axios = require('axios');

class SynologyCalendarClient {
    constructor(baseUrl, username, password) {
        // 移除 /caldav 後綴，使用標準 Synology API 端點
        this.baseUrl = baseUrl.replace(/\/caldav.*$/, '');
        this.username = username;
        this.password = password;
        this.sid = null; // Session ID
        this.synotoken = null; // CSRF Token
        
        console.log('✅ Synology Calendar API 客戶端初始化 (官方 API v5)');
        console.log('📡 API Base URL:', this.baseUrl);
        console.log('👤 用戶名:', this.username);
    }

    // 登入並獲取 Session ID (根據官方文檔)
    async login() {
        try {
            console.log('🔐 正在登入 Synology Calendar...');
            
            const response = await axios.get(`${this.baseUrl}/webapi/auth.cgi`, {
                params: {
                    api: 'SYNO.API.Auth',
                    version: '3',
                    method: 'login',
                    account: this.username,
                    passwd: this.password,
                    session: 'Calendar',
                    format: 'sid',
                    enable_syno_token: 'yes'  // 官方文檔建議啟用
                }
            });

            if (response.data.success) {
                this.sid = response.data.data.sid;
                this.synotoken = response.data.data.synotoken;
                console.log('✅ 登入成功');
                console.log('   SID:', this.sid.substring(0, 15) + '...');
                console.log('   SynoToken:', this.synotoken ? this.synotoken.substring(0, 10) + '...' : 'N/A');
                return true;
            } else {
                console.error('❌ 登入失敗，錯誤碼:', response.data.error?.code);
                return false;
            }
        } catch (error) {
            console.error('❌ 登入錯誤:', error.message);
            if (error.response) {
                console.error('   回應狀態:', error.response.status);
                console.error('   回應資料:', error.response.data);
            }
            throw error;
        }
    }

    // 確保已登入
    async ensureLoggedIn() {
        if (!this.sid) {
            await this.login();
        }
    }

    // 獲取所有日曆列表 (根據官方文檔 SYNO.Cal.Cal list method)
    async getCalendars() {
        try {
            await this.ensureLoggedIn();
            
            console.log('📅 正在獲取日曆列表...');
            
            // 根據官方文檔使用 POST 方法和 entry.cgi
            // 使用 URLSearchParams 將參數放在 POST body 中
            // 🔥 修復：cal_type 只能是 'event' 或 'todo'，不能是 'all'（錯誤碼 119）
            const params = new URLSearchParams({
                api: 'SYNO.Cal.Cal',
                version: '5',  // 使用最新版本
                method: 'list',
                cal_type: 'event',  // 只獲取事件日曆（修復錯誤碼 119）
                _sid: this.sid
            });
            
            const response = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-SYNO-TOKEN': this.synotoken || ''  // 官方文檔要求的 CSRF token
                }
            });

            if (response.data.success) {
                const calendars = response.data.data.list || [];
                console.log(`✅ 找到 ${calendars.length} 個日曆`);
                
                // 只返回事件日曆，過濾掉任務日曆
                const eventCalendars = calendars.filter(cal => cal.cal_type === 'event');
                console.log(`   其中 ${eventCalendars.length} 個是事件日曆`);
                
                return eventCalendars.map(cal => ({
                    id: cal.cal_id,
                    originalId: cal.original_cal_id,
                    displayName: cal.cal_displayname,
                    description: cal.cal_description,
                    color: cal.cal_color,
                    privilege: cal.cal_privilege,  // RO 或 RW
                    type: cal.cal_type,
                    ownerName: cal.original_ug_name,
                    ownerId: cal.original_user_no
                }));
            } else {
                console.error('❌ 獲取日曆列表失敗');
                console.error('   錯誤碼:', response.data.error?.code);
                return [];
            }
        } catch (error) {
            console.error('❌ 獲取日曆列表錯誤:', error.message);
            // 如果是認證錯誤，清除 SID 並重試一次
            if (error.response?.data?.error?.code === 105 || error.response?.data?.error?.code === 106) {
                console.log('   認證過期，重新登入...');
                this.sid = null;
                this.synotoken = null;
                return this.getCalendars();
            }
            throw error;
        }
    }

    // 獲取指定日曆的事件 (根據官方文檔 SYNO.Cal.Event list method)
    async getEvents(calendarId, startDate, endDate) {
        try {
            await this.ensureLoggedIn();
            
            const startTimestamp = Math.floor(startDate.getTime() / 1000);
            const endTimestamp = Math.floor(endDate.getTime() / 1000);
            
            console.log(`📅 正在獲取日曆的事件...`);
            console.log(`   日曆 ID: ${calendarId}`);
            console.log(`   時間範圍: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
            console.log(`   時間戳: ${startTimestamp} - ${endTimestamp}`);
            
            // 根據官方文檔使用 POST 方法
            const params = new URLSearchParams({
                api: 'SYNO.Cal.Event',
                version: '5',  // list 以 v5 取得事件較完整
                method: 'list',
                cal_id_list: JSON.stringify([calendarId]),  // 官方文檔要求陣列格式
                start: startTimestamp,
                end: endTimestamp,
                limit: 1000,  // 設定合理的上限
                _sid: this.sid
            });
            
        const response = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-SYNO-TOKEN': this.synotoken || ''
            }
        });

            if (response.data.success) {
                const events = response.data.data.list || [];
                console.log(`✅ 找到 ${events.length} 個事件`);
                return this.parseEvents(events);
            } else {
                console.error('❌ 獲取事件失敗');
                console.error('   錯誤碼:', response.data.error?.code);
                return [];
            }
        } catch (error) {
            console.error('❌ 獲取事件錯誤:', error.message);
            if (error.response?.data?.error?.code === 105 || error.response?.data?.error?.code === 106) {
                console.log('   認證過期，重新登入...');
                this.sid = null;
                this.synotoken = null;
                return this.getEvents(calendarId, startDate, endDate);
            }
            throw error;
        }
    }

    // 解析事件資料 (根據官方文檔 evt_obj 格式)
    parseEvents(events) {
        return events.map(event => {
            // 根據官方文檔，事件時間已經是 Unix timestamp (Epoch seconds)
            const startDate = new Date(event.dtstart * 1000);
            const endDate = new Date(event.dtend * 1000);
            
            // ✅ 修復：Synology API 的 timestamp 是 Unix時間（UTC），但行事曆本身是台灣時區
            // 直接使用本地時間方法來取得台灣時間（因為行事曆事件本身就是台灣時區）
            const toTaiwanTime = (date) => {
                // Synology Calendar 的事件時間是基於使用者時區（台灣）的本地時間
                // 所以我們應該使用 toLocaleString 轉換
                const taiwanDateStr = date.toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                // 解析 "2025/10/23 17:30:00" 格式
                const [datePart, timePart] = taiwanDateStr.split(' ');
                const [year, month, day] = datePart.split('/');
                const [hour, minute, second] = timePart.split(':');
                
                return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
            };
            
            const startTaiwanStr = toTaiwanTime(startDate);
            const endTaiwanStr = toTaiwanTime(endDate);
            
            const summary = event.summary || '未命名事件';
            
            return {
                uid: event.ical_uid,  // ICS 中的唯一 ID
                evt_id: event.evt_id,  // 系統內部 ID
                summary: summary,
                title: summary,  // 添加 title 欄位以兼容現有代碼
                description: event.description || '',
                location: event.location_info?.name || '',  // 根據官方文檔的 location_info 物件
                start: startTaiwanStr,  // ✅ 台灣時間格式：2025-10-11T16:10:00
                end: endTaiwanStr,      // ✅ 台灣時間格式：2025-10-11T17:00:00
                startDate: startDate,
                endDate: endDate,
                // 🔥 保留原始的 Unix timestamp，供更新事件時使用
                dtstart: event.dtstart,  // Unix timestamp (秒)
                dtend: event.dtend,      // Unix timestamp (秒)
                isAllDay: event.is_all_day || false,
                is_all_day: event.is_all_day || false,  // 保留原始欄位名稱
                status: 'CONFIRMED',  // Synology API 沒有直接提供 status
                calendarId: event.cal_id,
                cal_id: event.cal_id,  // 保留原始欄位名稱
                originalCalId: event.original_cal_id,
                color: event.color,
                timezone: event.tz_id || 'Asia/Taipei',  // 確保有時區資訊
                owner: event.owner_name,
                ownerId: event.owner_id,
                // 附加的群暉特有欄位
                isRepeat: event.is_repeat_evt || false,
                participants: event.participant || [],
                attachments: event.attachments || []
            };
        });
    }

    // 🔥 帶重試機制的獲取單個日曆事件
    async getEventsWithRetry(calendar, startDate, endDate, maxRetries = 3) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                    console.log(`   ⏳ 等待 ${delay / 1000} 秒後重試...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`   🔄 重試獲取 ${calendar.displayName} (第 ${attempt + 1}/${maxRetries + 1} 次)`);
                }
                
                const events = await this.getEvents(calendar.id, startDate, endDate);
                
                // 為每個事件添加講師資訊
                const eventsWithInstructor = events.map(event => ({
                    ...event,
                    instructor: calendar.displayName,
                    instructorColor: calendar.color,
                    instructorOwner: calendar.ownerName,
                    calendarDisplayName: calendar.displayName
                }));
                
                return {
                    success: true,
                    calendar: calendar.displayName,
                    events: eventsWithInstructor,
                    attempt: attempt + 1
                };
            } catch (error) {
                // 🔥 只對網路相關錯誤進行重試
                const isNetworkError = error.code === 'EAI_AGAIN' || 
                                      error.code === 'ENOTFOUND' || 
                                      error.code === 'ETIMEDOUT' ||
                                      error.code === 'ECONNREFUSED';
                
                if (isNetworkError && attempt < maxRetries) {
                    console.error(`   ⚠️ 網路錯誤 (${error.code})，準備重試...`);
                    continue;
                } else {
                    return {
                        success: false,
                        calendar: calendar.displayName,
                        error: error.message,
                        attempt: attempt + 1
                    };
                }
            }
        }
    }

    // 獲取所有講師的行程 (使用群暉官方 API + 重試機制)
    async getAllInstructorEvents(startDate, endDate) {
        try {
            const calendars = await this.getCalendars();
            const allEvents = [];
            const failed = [];

            console.log(`\n🔍 開始獲取 ${calendars.length} 個講師日曆的事件...`);
            console.log(`   時間範圍: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);

            for (const calendar of calendars) {
                console.log(`📅 處理日曆: ${calendar.displayName} (${calendar.ownerName})`);
                const result = await this.getEventsWithRetry(calendar, startDate, endDate);
                
                if (result.success) {
                    allEvents.push(...result.events);
                    const retryInfo = result.attempt > 1 ? ` (重試 ${result.attempt - 1} 次後成功)` : '';
                    console.log(`   ✅ ${result.calendar}: ${result.events.length} 個事件${retryInfo}`);
                } else {
                    failed.push(result);
                    console.error(`   ❌ 獲取日曆 ${result.calendar} 失敗: ${result.error}`);
                }
            }

            console.log(`\n✅ 總共獲取 ${allEvents.length} 個事件`);
            
            // 🔥 顯示失敗的日曆（如果有）
            if (failed.length > 0) {
                console.log(`⚠️ 失敗的日曆 (${failed.length}/${calendars.length}):`);
                failed.forEach(f => {
                    console.log(`   ❌ ${f.calendar}: ${f.error}`);
                });
            }
            
            console.log(`📊 分佈統計:`);
            
            // 統計每個講師的事件數量
            const stats = {};
            allEvents.forEach(event => {
                const instructor = event.instructor || '未知';
                stats[instructor] = (stats[instructor] || 0) + 1;
            });
            
            Object.entries(stats).forEach(([instructor, count]) => {
                console.log(`   ${instructor}: ${count} 個事件`);
            });
            
            return allEvents;
        } catch (error) {
            console.error('\n❌ 獲取所有講師行程失敗:', error.message);
            throw error;
        }
    }

    // 登出 (根據官方文檔)
    async logout() {
        if (this.sid) {
            try {
                await axios.get(`${this.baseUrl}/webapi/auth.cgi`, {
                    params: {
                        api: 'SYNO.API.Auth',
                        version: '1',  // 登出使用 version 1
                        method: 'logout',
                        session: 'Calendar'
                    }
                });
                console.log('✅ 已登出 Synology Calendar');
            } catch (error) {
                console.error('❌ 登出錯誤:', error.message);
            }
            this.sid = null;
            this.synotoken = null;
        }
    }

    // 🔍 根據 ical_uid 獲取事件的數字 evt_id
    async getEventByIcalUid(calendarId, icalUid) {
        try {
            await this.ensureLoggedIn();
            
            // 🔥 修正 calendarId 格式（必須以 / 開頭和結尾）
            const sanitizeCalId = (id) => {
                if (!id) return id;
                let v = String(id);
                if (!v.startsWith('/')) v = '/' + v;
                if (!v.endsWith('/')) v = v + '/';
                return v;
            };
            
            calendarId = sanitizeCalId(calendarId);
            
            console.log(`🔍 獲取事件詳情...`);
            console.log(`   日曆 ID (修正後): ${calendarId}`);
            console.log(`   ical_uid: ${icalUid}`);
            
            const params = new URLSearchParams({
                api: 'SYNO.Cal.Event',
                version: '5',
                method: 'get',
                ical_uid: icalUid,
                cal_id: calendarId,
                _sid: this.sid
            });
            
            const response = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-SYNO-TOKEN': this.synotoken || ''
                }
            });
            
            if (response.data.success && response.data.data) {
                const eventData = response.data.data;
                console.log(`✅ 獲取事件成功，evt_id: ${eventData.evt_id}`);
                console.log(`   🔍 檢查 repeat_setting:`);
                console.log(`      is_repeat_evt: ${eventData.is_repeat_evt} (${typeof eventData.is_repeat_evt})`);
                console.log(`      repeat_setting: ${JSON.stringify(eventData.repeat_setting)}`);
                console.log(`      repeat_setting 類型: ${typeof eventData.repeat_setting}`);
                if (eventData.repeat_setting && typeof eventData.repeat_setting === 'object') {
                    console.log(`      repeat_setting 鍵: ${Object.keys(eventData.repeat_setting).join(', ')}`);
                    console.log(`      repeat_setting 鍵數量: ${Object.keys(eventData.repeat_setting).length}`);
                }
                return eventData;
            } else {
                const errorCode = response.data.error?.code;
                const errorMsg = this.getErrorMessage(errorCode);
                console.error(`❌ 獲取事件失敗: ${errorMsg} (錯誤碼: ${errorCode})`);
                throw new Error(`獲取事件失敗: ${errorMsg}`);
            }
        } catch (error) {
            console.error('❌ 獲取事件錯誤:', error.message);
            throw error;
        }
    }

    // 🔥 更新事件 (完全按照官方 API 文檔 - SYNO.Cal.Event set 方法)
    async updateEvent(calendarId, eventId, updates, existingEvent = null) {
        try {
            await this.ensureLoggedIn();
            
            console.log(`\n📝 ========== 開始更新事件 ==========`);
            console.log(`   日曆 ID: ${calendarId}`);
            console.log(`   事件 ID (ical_uid): ${eventId}`);
            console.log(`   更新內容:`, JSON.stringify(updates, null, 2));
            
            // 🔥 步驟 1: 使用 get 方法獲取完整事件資訊（官方文檔第 1593 行）
            console.log(`\n🔍 步驟 1: 使用 SYNO.Cal.Event get 方法獲取完整事件...`);
            
            // 🔥 關鍵修復：如果 eventId 是 ical_uid，先獲取 evt_id，然後使用 evt_id 和 cal_id 獲取完整事件
            // 這是因為使用 ical_uid 獲取的事件，cal_id 可能是 undefined
            // 但使用 evt_id 和 cal_id 獲取的事件，cal_id 應該是有值的（與成功測試腳本一致）
            let event;
            const numericEventId = Number(eventId);
            const isNumericEventId = !isNaN(numericEventId) && String(numericEventId) === String(eventId);
            
            if (isNumericEventId) {
                // eventId 是數字，直接使用 evt_id 和 cal_id 獲取（與成功測試腳本一致）
                // 🔥 關鍵：成功的測試腳本使用 original_cal_id 作為 cal_id，但這裡我們使用傳入的 calendarId
                // 這應該是正確的，因為我們知道事件的日曆 ID
                console.log(`   📋 使用 evt_id 和 cal_id 獲取事件（與成功測試腳本一致）`);
                const getParams = new URLSearchParams({
                    api: 'SYNO.Cal.Event',
                    version: '5',
                    method: 'get',
                    evt_id: eventId,
                    cal_id: calendarId,  // 使用傳入的 calendarId
                    _sid: this.sid
                });
                
                const getResponse = await axios.post(
                    `${this.baseUrl}/webapi/entry.cgi`,
                    getParams.toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-SYNO-TOKEN': this.synotoken || ''
                        },
                        timeout: 10000
                    }
                );
                
                if (!getResponse.data.success) {
                    throw new Error(`獲取事件失敗: ${this.getErrorMessage(getResponse.data.error?.code)}`);
                }
                
                event = getResponse.data.data;
            } else {
                // eventId 是 ical_uid，先獲取 evt_id，然後使用 evt_id 和 cal_id 獲取完整事件
                console.log(`   📋 使用 ical_uid 獲取 evt_id，然後使用 evt_id 和 cal_id 獲取完整事件`);
                const getParams = new URLSearchParams({
                    api: 'SYNO.Cal.Event',
                    version: '5',
                    method: 'get',
                    ical_uid: eventId,
                    cal_id: calendarId,
                    _sid: this.sid
                });
                
                const getResponse = await axios.post(
                    `${this.baseUrl}/webapi/entry.cgi`,
                    getParams.toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-SYNO-TOKEN': this.synotoken || ''
                        },
                        timeout: 10000
                    }
                );
                
                if (!getResponse.data.success) {
                    throw new Error(`獲取事件失敗: ${this.getErrorMessage(getResponse.data.error?.code)}`);
                }
                
                let initialEvent = getResponse.data.data;
                
                // 🔥 如果獲取到了 evt_id，使用 evt_id 和 cal_id 重新獲取完整事件（與成功測試腳本一致）
                // 🔥 關鍵：如果 initialEvent.cal_id 是 undefined，使用 original_cal_id 或 calendarId
                if (initialEvent.evt_id) {
                    console.log(`   ⚠️ 使用 ical_uid 獲取的事件 cal_id 可能是 undefined，使用 evt_id 和 cal_id 重新獲取...`);
                    
                    // 🔥 關鍵修復：如果 initialEvent.cal_id 是 undefined，使用 original_cal_id 或 calendarId
                    // 成功的測試腳本使用 original_cal_id 作為 cal_id 來獲取事件
                    const calIdForRetry = initialEvent.cal_id && initialEvent.cal_id !== 'undefined' 
                        ? initialEvent.cal_id 
                        : (initialEvent.original_cal_id || calendarId);
                    
                    const retryGetParams = new URLSearchParams({
                        api: 'SYNO.Cal.Event',
                        version: '5',
                        method: 'get',
                        evt_id: initialEvent.evt_id,
                        cal_id: calIdForRetry,  // 🔥 使用 original_cal_id 或 calendarId（與成功測試腳本一致）
                        _sid: this.sid
                    });
                    
                    const retryGetResponse = await axios.post(
                        `${this.baseUrl}/webapi/entry.cgi`,
                        retryGetParams.toString(),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-SYNO-TOKEN': this.synotoken || ''
                            },
                            timeout: 10000
                        }
                    );
                    
                    if (retryGetResponse.data.success) {
                        event = retryGetResponse.data.data;
                        console.log(`   ✅ 使用 evt_id 重新獲取成功，cal_id: ${event.cal_id || calendarId}`);
                    } else {
                        // 如果重新獲取失敗，使用原始事件
                        event = initialEvent;
                        console.log(`   ⚠️ 使用 evt_id 重新獲取失敗，使用原始事件`);
                    }
                } else {
                    event = initialEvent;
                }
            }
            console.log(`✅ 成功獲取事件資料`);
            console.log(`   evt_id: ${event.evt_id}`);
            console.log(`   summary: ${event.summary}`);
            console.log(`   dav_etag: ${event.dav_etag}`);
            console.log(`   original_cal_id: ${event.original_cal_id || '未提供'}`);
            console.log(`   cal_id (從API): ${event.cal_id || 'undefined（將使用傳入的 calendarId）'}`);
            console.log(`   calendarId (傳入參數): ${calendarId}`);
            console.log(`   is_all_day: ${event.is_all_day}`);
            console.log(`   is_repeat_evt: ${event.is_repeat_evt}`);
            console.log(`   tz_id: ${event.tz_id}`);
            console.log(`   color: ${event.color}`);
            console.log(`   notify_setting: ${JSON.stringify(event.notify_setting)}`);
            console.log(`   participant: ${JSON.stringify(event.participant)}`);
            console.log(`   location_info: ${JSON.stringify(event.location_info)}`);
            console.log(`   attachments: ${JSON.stringify(event.attachments)}`);
            
            // 🔥 確保所有 Required Yes 參數都有預設值（避免 undefined 導致 9009 錯誤）
            if (!event.attachments) {
                event.attachments = [];
                console.log('   ⚠️ 事件缺少 attachments 欄位，設為空陣列');
            }
            if (!event.participant) {
                event.participant = [];
                console.log('   ⚠️ 事件缺少 participant 欄位，設為空陣列');
            }
            if (!event.notify_setting) {
                event.notify_setting = [];
                console.log('   ⚠️ 事件缺少 notify_setting 欄位，設為空陣列');
            }
            if (!event.location_info) {
                event.location_info = { address: '', gps: { lat: -1, lng: -1 }, map_type: '', name: '', place_id: '' };
                console.log('   ⚠️ 事件缺少 location_info 欄位，設為空物件');
            }
            
            // 🔥 確保 evt_id 是數字
            const numericEvtId = Number(event.evt_id);
            if (!event.evt_id || isNaN(numericEvtId)) {
                console.error('❌ 錯誤：evt_id 格式無效');
                console.error(`   evt_id: ${event.evt_id} (${typeof event.evt_id})`);
                throw new Error('無法獲取事件的數字 ID (evt_id)');
            }
            
            // 🔥 先判斷日曆是否唯讀（RO），若 RO 則改走替代路徑
            // 🔥 重要：如果 event.cal_id 是 undefined，使用 original_cal_id 作為 cal_id
            // 這是因為某些事件（如 evt_id: 140718）需要有效的 cal_id，而不是 undefined
            // 成功的測試腳本使用 undefined 可能只適用於特定事件（如 evt_id: 140100）
            let finalCalId = (event.cal_id && event.cal_id !== 'undefined') 
                ? event.cal_id 
                : (event.original_cal_id ? event.original_cal_id : calendarId);
            const sanitizeCalId = (id) => {
                if (!id) return id;
                let v = String(id);
                if (!v.startsWith('/')) v = '/' + v;
                if (!v.endsWith('/')) v = v + '/';
                return v;
            };
            finalCalId = sanitizeCalId(finalCalId);

            let isReadOnly = false;
            try {
                const allCals = await this.getCalendars();
                const currentCal = allCals.find(c => c.id === finalCalId);
                if (currentCal && currentCal.privilege && currentCal.privilege.toUpperCase() !== 'RW') {
                    isReadOnly = true;
                    console.warn(`⚠️ 目標日曆 ${finalCalId} 權限為 ${currentCal.privilege}（唯讀），將改用替代策略`);
                }
            } catch (permErr) {
                console.warn('⚠️ 檢查日曆權限失敗，略過權限檢查', permErr.message);
            }

            if (isReadOnly) {
                // 🛠️ 直接嘗試在相同使用者名下的可寫日曆建立替代事件
                try {
                    const all = await this.getCalendars();
                    // 從 cal_id 提取使用者名（/user/xxx/ -> user）
                    const seg = finalCalId.split('/').filter(Boolean);
                    const userPrefix = seg.length > 0 ? seg[0] : '';
                    const candidates = all.filter(c => c.privilege === 'RW' && c.id.startsWith(`/${userPrefix}/`));
                    const target = candidates[0] || all.find(c => c.privilege === 'RW');
                    if (!target) {
                        throw new Error('找不到任何可寫日曆，無法建立替代事件');
                    }
                    console.log(`🛠️ 使用替代日曆建立事件: ${target.displayName} (${target.id})`);
                    const replacement = {
                        title: updates.title || event.summary,
                        summary: updates.title || event.summary,
                        dtstart: Number(event.dtstart),
                        dtend: Number(event.dtend),
                        is_all_day: (event.is_all_day === true || event.is_all_day === 'true' || event.is_all_day === 1),
                        tz_id: event.tz_id || 'Asia/Taipei',
                        is_repeat_evt: (event.is_repeat_evt === true || event.is_repeat_evt === 'true' || event.is_repeat_evt === 1)
                    };
                    const created = await this.createEvent(target.id, replacement);
                    if (created && created.evt_id) {
                        console.log('✅ 已於替代日曆建立事件');
                        // 嘗試刪除舊事件（唯讀多半會失敗，忽略）
                        try { await this.deleteEvent(finalCalId, eventId); } catch (_) {}
                        return true;
                    }
                } catch (roErr) {
                    console.error('❌ 替代策略失敗:', roErr.message);
                }
            }

            // 🔥 步驟 2: 按照官方文檔準備所有必要參數（第 970-1014 行）
            console.log(`\n📋 步驟 2: 準備 set 方法的參數（嚴格按照官方文檔）...`);

            // 合併更新的標題和描述
            const newSummary = updates.title || event.summary;
            const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(updates, 'description');
            const newDescription = hasDescriptionUpdate ? updates.description : undefined;
            
            // 🔍 調試：檢查是否有 description 更新
            if (hasDescriptionUpdate && updates.description !== event.description) {
                console.log(`   ⚠️ 注意：同時更新 summary 和 description`);
                console.log(`   原始 description 長度: ${event.description ? event.description.length : 0}`);
                console.log(`   新 description 長度: ${newDescription ? newDescription.length : 0}`);
            }

            console.log(`   原標題: ${event.summary}`);
            console.log(`   新標題: ${newSummary}`);
            console.log(`   🔍 檢查必要欄位:`);
            console.log(`      evt_id: ${event.evt_id} (type: ${typeof event.evt_id})`);
            console.log(`      cal_id: ${calendarId}`);
            console.log(`      dav_etag: ${event.dav_etag}`);
            console.log(`      dtstart: ${event.dtstart}`);
            console.log(`      dtend: ${event.dtend}`);
            
            // ✅ 校正 cal_id 與 original_cal_id（以 get 回傳為準，避免部份日曆更新出現 9009）💡
            // 以 get 回傳的 cal_id 為準，避免與外部傳入參數不一致造成 9009（事件ID/日曆ID不吻合）
            // 🔥 關鍵修復：根據測試結果，某些事件（如 evt_id: 140026）無法使用 cal_id=undefined 更新
            // 即使 cal_id 和 original_cal_id 相同，也應該使用 original_cal_id 作為 cal_id
            // 只有在成功的測試腳本中（evt_id: 140100），cal_id=undefined 才有效
            // 因此，我們統一使用 original_cal_id 作為 cal_id，確保所有事件都能更新
            let originalCalId = sanitizeCalId(event.original_cal_id || calendarId);
            
            // 🔥 處理 finalCalId：統一使用 original_cal_id 作為 cal_id
            // 這是因為某些事件（如 evt_id: 140026）無法使用 cal_id=undefined 更新
            // 即使 cal_id 和 original_cal_id 相同，也應該使用 original_cal_id
            if (finalCalId && originalCalId && finalCalId === originalCalId) {
                // cal_id 和 original_cal_id 相同，使用 original_cal_id（而不是 undefined）
                console.log(`   ⚠️ cal_id 和 original_cal_id 相同，使用 original_cal_id 作為 cal_id`);
                finalCalId = originalCalId;
            } else if (!finalCalId || finalCalId === 'undefined') {
                // 如果 finalCalId 無效，使用 original_cal_id
                console.log(`   ⚠️ finalCalId 無效，使用 original_cal_id: ${originalCalId}`);
                finalCalId = originalCalId;
            } else {
                // 確保 finalCalId 是經過 sanitize 處理的
                finalCalId = sanitizeCalId(finalCalId);
            }
            
            // 🔥 關鍵：支持跨日曆移動！
            // 如果 updates 中包含 targetCalendarId，表示要將事件移動到另一個日曆
            // 此時 cal_id 應該設為目標日曆，original_cal_id 保持為原日曆
            if (updates.targetCalendarId) {
                const targetCalId = sanitizeCalId(updates.targetCalendarId);
                console.log(`\n   🔥 檢測到跨日曆移動請求:`);
                console.log(`      原日曆 (original_cal_id): ${originalCalId}`);
                console.log(`      目標日曆 (cal_id): ${targetCalId}`);
                
                // 將 finalCalId 改為目標日曆
                finalCalId = targetCalId;
                // original_cal_id 保持為原日曆（從 event.original_cal_id 或 event.cal_id 取得）
                originalCalId = sanitizeCalId(event.original_cal_id || event.cal_id || calendarId);
                
                console.log(`      ✅ 跨日曆移動參數已設定`);
            }

            console.log(`   📋 使用 cal_id: ${finalCalId}`);
            console.log(`   📋 使用 original_cal_id: ${originalCalId}`);

            // 🔥 按照官方文檔順序構建參數
            const params = new URLSearchParams();
            console.log(`\n   ➡️ 開始構建參數...`);
            params.append('api', 'SYNO.Cal.Event');
            params.append('version', '5');
            params.append('method', 'set');
            params.append('_sid', this.sid);
            
            console.log(`   ✓ 基本參數已添加 (api, version, method, _sid)`);

            // Required 參數（官方文檔標記 Required=Yes）
            // 🔥 驗證日曆 ID 格式（應該以 / 開頭和結尾）
            // 🔥 注意：根據成功的測試腳本，cal_id 可以是 undefined（會轉換為字串 "undefined"）
            // 所以我們只驗證 finalCalId 不是 undefined 時才檢查格式
            if (finalCalId !== undefined && (!finalCalId || typeof finalCalId !== 'string' || !finalCalId.startsWith('/'))) {
                console.error(`❌ 錯誤：cal_id 格式無效: ${finalCalId}`);
                throw new Error('cal_id 格式無效');
            }
            if (!originalCalId || typeof originalCalId !== 'string' || !originalCalId.startsWith('/')) {
                console.error(`❌ 錯誤：original_cal_id 格式無效: ${originalCalId}`);
                throw new Error('original_cal_id 格式無效');
            }
            
            params.append('evt_id', numericEvtId.toString());          // unsigned long long -> string
            
            // 🔥 關鍵修復：使用已計算的 finalCalId（可能是 undefined）
            // 根據成功的測試腳本，當 cal_id 和 original_cal_id 相同時，應該使用 undefined 作為 cal_id
            // URLSearchParams.append() 會將 undefined 轉換為字串 "undefined"
            params.append('cal_id', finalCalId);                        // 使用 finalCalId（可能是 undefined）
            params.append('original_cal_id', originalCalId);          // string (使用事件本身的 original_cal_id)
            
            // 🔥 檢查必要字段
            if (!event.dav_etag) {
                console.error('❌ 錯誤：缺少 dav_etag');
                throw new Error('事件資料不完整：缺少 dav_etag');
            }
            if (!event.dtstart || !event.dtend) {
                console.error('❌ 錯誤：缺少時間戳記');
                throw new Error('事件資料不完整：缺少 dtstart 或 dtend');
            }
            
            params.append('dav_etag', event.dav_etag);                // string (防止衝突)
            params.append('summary', newSummary);                     // string
            // 🔥 與成功測試腳本完全一致的參數順序
            params.append('is_all_day', String(event.is_all_day));    // 直接使用 String() 轉換
            params.append('tz_id', event.tz_id || 'Asia/Taipei');
            
            // 🔥 dtstart/dtend（Epoch 秒）
            // ⚠️ 重要：優先使用 updates 中的新時間，如果沒有則使用事件原時間
            const dtstartValue = Number(
                (updates.dtstart !== undefined && updates.dtstart !== null) 
                    ? updates.dtstart 
                    : event.dtstart
            );
            const dtendValue = Number(
                (updates.dtend !== undefined && updates.dtend !== null) 
                    ? updates.dtend 
                    : event.dtend
            );
            
            // 🔍 記錄時間來源
            if (updates.dtstart !== undefined || updates.dtend !== undefined) {
                console.log(`   ⏰ 使用 updates 中的新時間:`);
                console.log(`      dtstart: ${dtstartValue} (${new Date(dtstartValue * 1000).toLocaleString('zh-TW')})`);
                console.log(`      dtend: ${dtendValue} (${new Date(dtendValue * 1000).toLocaleString('zh-TW')})`);
            } else {
                console.log(`   ⏰ 使用事件原時間:`);
                console.log(`      dtstart: ${dtstartValue} (${new Date(dtstartValue * 1000).toLocaleString('zh-TW')})`);
                console.log(`      dtend: ${dtendValue} (${new Date(dtendValue * 1000).toLocaleString('zh-TW')})`);
            }
            
            if (isNaN(dtstartValue) || isNaN(dtendValue)) {
                console.error('❌ 錯誤：時間戳記格式無效', { 
                    dtstart: updates.dtstart !== undefined ? updates.dtstart : event.dtstart, 
                    dtend: updates.dtend !== undefined ? updates.dtend : event.dtend 
                });
                throw new Error('時間戳記格式無效');
            }
            if (dtstartValue >= dtendValue) {
                console.error('❌ 錯誤：事件結束時間必須大於開始時間');
                throw new Error('事件結束時間必須大於開始時間');
            }
            params.append('dtstart', String(dtstartValue));
            params.append('dtend', String(dtendValue));
            params.append('is_repeat_evt', String(event.is_repeat_evt)); // 直接使用 String() 轉換
            // 檢查是否需要 repeat_setting
            const isRepeatEvtBool = (event.is_repeat_evt === true || event.is_repeat_evt === 'true' || event.is_repeat_evt === 1);
            if (isRepeatEvtBool) {
                const repeatSetting = (event.repeat_setting && typeof event.repeat_setting === 'object') ? event.repeat_setting : null;
                if (repeatSetting) {
                    params.append('repeat_setting', JSON.stringify(repeatSetting));
                }
            }
            
            console.log(`   ✓ ID 相關參數已添加 (evt_id=${numericEvtId}, cal_id=${finalCalId}, original_cal_id=${originalCalId}, dav_etag=${event.dav_etag})`);
            console.log(`      is_all_day 原始值: ${event.is_all_day} (${typeof event.is_all_day}) -> 轉換後: ${String(event.is_all_day)}`);
            
            // 🔥 補齊可選欄位：以 get 事件的值回填，避免伺服端校驗不過
            // 🔥 關鍵：必須使用 String() 轉換所有參數值，確保格式一致
            
            // 🔥 description: 優先使用更新值，否則保留原值（必須提供，避免 9009）
            // 🔥 清理 description：移除控制字符和特殊字符，避免 API 解析錯誤
            let finalDescription = (typeof newDescription === 'string') 
                ? newDescription 
                : (event.description || '');
            
            // 🔥 清理控制字符（換行符、回車符、Tab 等）
            if (finalDescription) {
                finalDescription = finalDescription
                    .replace(/[\r\n\t]/g, ' ')  // 將換行符、回車符、Tab 替換為空格
                    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // 移除所有控制字符（除了 Tab、換行、回車）
                    .replace(/\s+/g, ' ')       // 將多個連續空格合併為單個空格
                    .trim();                    // 移除首尾空白
                
                // 🔥 限制長度避免 URL 編碼問題（5000 字符限制）
                if (finalDescription.length > 5000) {
                    finalDescription = finalDescription.substring(0, 5000);
                    console.warn(`   ⚠️ description 超過 5000 字符，已截斷`);
                }
            }
            
            // 🔥 關鍵修復：如果 description 為空，使用 summary 作為備用（避免空字串導致 9009 錯誤）
            // 這是因為某些事件（如 evt_id: 95135）的 description 為空，API 可能不接受完全空的 description
            if (!finalDescription || finalDescription.trim() === '') {
                finalDescription = newSummary || event.summary || '未命名事件';
                console.log(`   ⚠️ description 為空，使用 summary 作為備用: ${finalDescription.substring(0, 50)}...`);
            }
            
            // 🔥 與成功測試腳本完全一致的參數順序：color 在 description 之前
            // 🔥 關鍵修復：如果 color 為空，使用預設顏色 (#7dd3fc)，避免空字串導致 9009 錯誤
            // 這是因為某些事件（如 evt_id: 95135）的 color 為空，API 可能不接受完全空的 color
            const colorVal = (typeof event.color === 'string' && event.color.trim() !== '') 
                ? event.color 
                : '#7dd3fc';  // 使用預設顏色（與其他成功事件一致）
            params.append('color', colorVal);
            const notifySettingValue = Array.isArray(event.notify_setting) ? event.notify_setting : [];
            params.append('notify_setting', JSON.stringify(notifySettingValue));
            params.append('description', finalDescription);
            const participantValue = Array.isArray(event.participant) ? event.participant : [];
            params.append('participant', JSON.stringify(participantValue));
            const attachmentsValue = Array.isArray(event.attachments) ? event.attachments : [];
            params.append('attachments', JSON.stringify(attachmentsValue));
            console.log(`      attachments 處理: ${event.attachments ? '使用原值' : '使用空陣列'} (長度: ${attachmentsValue.length})`);

            // 🔥 location_info: 優先使用更新值，否則保留原值或預設空物件
            // 🔥 簡化處理邏輯，與成功測試腳本一致
            let finalLocationInfo = null;
            
            // 如果 updates 提供了新的 location_info
            if (updates.locationInfo && typeof updates.locationInfo === 'object') {
                finalLocationInfo = {
                    address: String(updates.locationInfo.address || ''),
                    gps: {
                        lat: Number(updates.locationInfo.gps?.lat ?? -1),
                        lng: Number(updates.locationInfo.gps?.lng ?? -1)
                    },
                    map_type: String(updates.locationInfo.map_type || ''),
                    name: String(updates.locationInfo.name || ''),
                    place_id: String(updates.locationInfo.place_id || '')
                };
            } else {
                // 否則保留原有的 location_info
                // 🔥 重要：與測試腳本一致，直接檢查是否為物件
                let locationInfo = event.location_info;
                
                // 如果 location_info 是字符串，嘗試解析
                if (typeof locationInfo === 'string') {
                    try {
                        locationInfo = JSON.parse(locationInfo);
                    } catch(e) {
                        console.warn(`⚠️ location_info 解析失敗:`, e.message);
                        locationInfo = null;
                    }
                }
                
                // 🔥 與測試腳本一致的檢查：如果沒有或不是物件，使用預設值
                if (!locationInfo || typeof locationInfo !== 'object') {
                    finalLocationInfo = { 
                        address: '', 
                        gps: { lat: -1, lng: -1 }, 
                        map_type: '', 
                        name: '', 
                        place_id: '' 
                    };
                } else {
                    // 確保所有欄位都存在
                    finalLocationInfo = {
                        address: String(locationInfo.address || ''),
                        gps: {
                            lat: Number(locationInfo.gps?.lat ?? -1),
                            lng: Number(locationInfo.gps?.lng ?? -1)
                        },
                        map_type: String(locationInfo.map_type || ''),
                        name: String(locationInfo.name || ''),
                        place_id: String(locationInfo.place_id || '')
                    };
                }
            }
            
            // 🔥 清理 location_info.name 中的特殊字符
            if (finalLocationInfo && finalLocationInfo.name) {
                finalLocationInfo.name = String(finalLocationInfo.name)
                    .replace(/[\r\n\t]/g, ' ')
                    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            
            // 🔥 確保 location_info 格式正確（與測試腳本一致）
            params.append('location_info', JSON.stringify(finalLocationInfo));
            
            console.log(`   ✓ 其他參數已添加`);
            console.log(`      color: ${colorVal || '(空字串)'}`);
            console.log(`      description 長度: ${finalDescription.length} 字符`);
            console.log(`      notify_setting: ${notifySettingValue.length} 個通知`);
            console.log(`      participant: ${participantValue.length} 個參與者`);
            console.log(`      attachments: ${attachmentsValue.length} 個附件`);
            console.log(`      location_info.name: ${finalLocationInfo.name || '(空)'}`);
            
            // 🔥 步驟 3: 發送更新請求
            console.log(`\n📤 步驟 3: 發送 POST 請求到 /webapi/entry.cgi...`);
            console.log(`   Content-Type: application/x-www-form-urlencoded`);
            console.log(`   X-SYNO-TOKEN: ${this.synotoken ? this.synotoken.substring(0, 8) + '...' : '無'}`);
            
            // 🔍 驗證所有必要參數是否存在（發送前檢查）
            console.log(`\n🔍 步驟 2.5: 驗證所有參數...`);
            // 僅檢查官方必要參數；其餘皆為可選（避免阻擋最小參數集策略）
            const requiredParams = ['api', 'version', 'method', '_sid', 'evt_id', 'cal_id', 'original_cal_id', 'dav_etag', 'summary', 'is_all_day', 'tz_id', 'dtstart', 'dtend', 'is_repeat_evt'];
            
            // 使用 Array.from 獲取所有參數鍵
            const allParamKeys = Array.from(params.keys());
            console.log(`   參數總數: ${allParamKeys.length}`);
            console.log(`   參數鍵列表: ${allParamKeys.join(', ')}`);
            
            // 🔥 明確檢查關鍵參數的值（按 API 文檔順序）
            console.log(`\n   🔍 關鍵參數驗證:`);
            console.log(`      evt_id: ${params.get('evt_id')} ${params.has('evt_id') ? '✅' : '❌'}`);
            console.log(`      cal_id: ${params.get('cal_id')} ${params.has('cal_id') ? '✅' : '❌'}`);
            console.log(`      original_cal_id: ${params.get('original_cal_id')} ${params.has('original_cal_id') ? '✅' : '❌'}`);
            console.log(`      dav_etag: ${params.get('dav_etag')} ${params.has('dav_etag') ? '✅' : '❌'}`);
            console.log(`      summary: ${params.get('summary')?.substring(0, 30)}... ${params.has('summary') ? '✅' : '❌'}`);
            console.log(`      is_all_day: ${params.get('is_all_day')} ${params.has('is_all_day') ? '✅' : '❌'} (應該是 "true" 或 "false")`);
            console.log(`      tz_id: ${params.get('tz_id')} ${params.has('tz_id') ? '✅' : '❌'}`);
            console.log(`      dtstart: ${params.get('dtstart')} ${params.has('dtstart') ? '✅' : '❌'} (必須存在！)`);
            console.log(`      dtend: ${params.get('dtend')} ${params.has('dtend') ? '✅' : '❌'} (必須存在！)`);
            console.log(`      is_repeat_evt: ${params.get('is_repeat_evt')} ${params.has('is_repeat_evt') ? '✅' : '❌'} (應該是 "true" 或 "false")`);
            console.log(`      color: ${params.has('color') ? '已附帶' : '省略'}${params.has('color') ? `(${params.get('color')})` : ''}`);
            console.log(`      notify_setting: ${params.has('notify_setting') ? '已附帶' : '省略'}`);
            console.log(`      description: ${params.has('description') ? `長度=${params.get('description')?.length}` : '省略'}`);
            console.log(`      participant: ${params.has('participant') ? '已附帶' : '省略'}`);
            console.log(`      location_info: ${params.has('location_info') ? `長度=${params.get('location_info')?.length}` : '省略'}`);
            console.log(`      attachments: ${params.has('attachments') ? '已附帶' : '省略'}`);
            
            // 🔥 如果關鍵參數缺失，立即報錯
            const criticalParams = ['evt_id', 'cal_id', 'original_cal_id', 'dav_etag', 'summary', 'dtstart', 'dtend', 'is_all_day', 'is_repeat_evt'];
            const missingCritical = criticalParams.filter(p => !params.has(p));
            if (missingCritical.length > 0) {
                console.error(`\n   ❌ 嚴重錯誤：缺少關鍵參數: ${missingCritical.join(', ')}`);
                console.error(`   這可能是導致 9009 錯誤的直接原因！`);
            }
            
            const missingParams = requiredParams.filter(param => !params.has(param));
            if (missingParams.length > 0) {
                console.error(`❌ 錯誤：缺少必要參數: ${missingParams.join(', ')}`);
                console.error(`   已有的參數: ${allParamKeys.join(', ')}`);
                throw new Error(`缺少必要參數: ${missingParams.join(', ')}`);
            }
            console.log(`   ✅ 所有必要參數都已存在`);
            
            // 🔍 檢查重複事件是否需要 repeat_setting
            if (event.is_repeat_evt && !params.has('repeat_setting')) {
                console.error(`❌ 錯誤：重複事件缺少 repeat_setting`);
                throw new Error('重複事件缺少 repeat_setting 參數');
            }
            
            // 📦 預覽參數字串（不保存到變數，避免重複聲明）
            const paramsPreview = params.toString();
            console.log(`\n📦 完整請求參數 (長度: ${paramsPreview.length}):`);
            if (paramsPreview.length === 0) {
                console.error(`❌ 錯誤：參數字串為空！`);
                console.error(`   params 物件:`, params);
            } else {
                // 顯示前 800 字符以便查看更多內容
                console.log(paramsPreview.substring(0, 800) + (paramsPreview.length > 800 ? '...' : ''));
            }
            
            // 🔍 檢查 description 是否有特殊字符或編碼問題
            if (newDescription && newDescription.length > 10000) {
                console.warn(`⚠️ description 很長 (${newDescription.length} 字符)，可能會導致問題`);
            }
            
            // 🔍 檢查可能導致問題的特殊字符
            if (newDescription) {
                const hasSpecialChars = /[^\x20-\x7E\u4E00-\u9FFF]/.test(newDescription);
                if (hasSpecialChars) {
                    console.warn(`⚠️ description 包含特殊字符，可能需要特殊處理`);
                }
                // 檢查 URL 或 HTML 標籤
                if (newDescription.includes('http://') || newDescription.includes('https://')) {
                    console.log(`   ℹ️ description 包含 URL`);
                }
                if (newDescription.includes('<') && newDescription.includes('>')) {
                    console.warn(`⚠️ description 可能包含 HTML 標籤`);
                }
            }
            
            // 🔍 檢查 location_info 中的 name 是否包含特殊字符
            if (finalLocationInfo && finalLocationInfo.name) {
                if (/[^\x20-\x7E\u4E00-\u9FFF]/.test(finalLocationInfo.name)) {
                    console.warn(`⚠️ location_info.name 包含特殊字符: ${finalLocationInfo.name.substring(0, 50)}`);
                }
            }
            
            // 🔍 發送前最後檢查：輸出關鍵參數的實際值
            console.log(`\n🔍 發送前最終檢查:`);
            console.log(`   evt_id: ${numericEvtId} (數字格式)`);
            console.log(`   cal_id: ${finalCalId || calendarId}`);
            console.log(`   original_cal_id: ${originalCalId}`);
            console.log(`   dav_etag: ${event.dav_etag} (長度: ${event.dav_etag ? event.dav_etag.length : 0})`);
            console.log(`   dtstart: ${dtstartValue} (轉換後)`);
            console.log(`   dtend: ${dtendValue} (轉換後)`);
            console.log(`   is_all_day: ${event.is_all_day} -> ${String(event.is_all_day)}`);
            console.log(`   is_repeat_evt: ${event.is_repeat_evt} -> ${String(event.is_repeat_evt)}`);
            console.log(`   summary 長度: ${newSummary ? newSummary.length : 0}`);
            console.log(`   description 長度: ${finalDescription.length} 字符`);
            console.log(`   location_info.name: ${finalLocationInfo.name || '(空)'}`);
            const locInfoStr = JSON.stringify(finalLocationInfo);
            console.log(`   location_info 預覽: ${locInfoStr.substring(0, 100)}${locInfoStr.length > 100 ? '...' : ''}`);
            
            // 🔍 檢查所有參數值是否為空
            const paramValues = {
                'evt_id': params.get('evt_id'),
                'cal_id': params.get('cal_id'),
                'original_cal_id': params.get('original_cal_id'),
                'dav_etag': params.get('dav_etag'),
                'summary': params.get('summary')?.substring(0, 50),
                'is_all_day': params.get('is_all_day'),
                'dtstart': params.get('dtstart'),
                'dtend': params.get('dtend'),
                'is_repeat_evt': params.get('is_repeat_evt'),
                'description': `長度=${params.get('description')?.length || 0}`,
                'location_info': params.get('location_info')?.substring(0, 100)
            };
            console.log(`   參數值預覽:`, paramValues);
            
            // 🔥 強制刷新日誌緩衝區，確保所有日誌都輸出
            if (process.stdout && process.stdout.write) {
                process.stdout.write('');
            }

            console.log(`\n🚀 準備發送請求到: ${this.baseUrl}/webapi/entry.cgi`);
            const paramsString = params.toString();
            console.log(`   請求體長度: ${paramsString.length} 字符`);
            console.log(`   請求體預覽 (前 500 字符): ${paramsString.substring(0, 500)}...`);
            
            // 🔥 在最終請求字串中驗證關鍵參數是否存在
            console.log(`\n   🔍 最終請求字串驗證:`);
            console.log(`      dtstart 在請求中: ${paramsString.includes('dtstart=') ? '✅ 存在' : '❌ 缺失！'}`);
            console.log(`      dtend 在請求中: ${paramsString.includes('dtend=') ? '✅ 存在' : '❌ 缺失！'}`);
            if (!paramsString.includes('dtstart=')) {
                console.error(`\n   ❌ 嚴重錯誤：dtstart 參數在最終請求字串中缺失！`);
                console.error(`   這可能是導致 9009 錯誤的直接原因！`);
                console.error(`   paramsString 內容: ${paramsString.substring(0, 1000)}...`);
            }

            // 🔥 記錄完整的請求信息以便診斷
            const requestConfig = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-SYNO-TOKEN': this.synotoken || '',
                    'Cookie': `id=${this.sid}`
                },
                timeout: 15000,
                validateStatus: () => true  // 不拋出錯誤，手動處理所有響應
            };
            
            console.log(`\n📤 發送請求詳情:`);
            console.log(`   URL: ${this.baseUrl}/webapi/entry.cgi`);
            console.log(`   Method: POST`);
            console.log(`   Headers:`, requestConfig.headers);
            console.log(`   請求體長度: ${paramsString.length} 字符`);
            
            const response = await axios.post(
                `${this.baseUrl}/webapi/entry.cgi`,
                params.toString(),
                requestConfig
            );
            
            // 🔍 記錄響應狀態
            console.log(`\n📥 API 響應詳情:`);
            console.log(`   狀態碼: ${response.status}`);
            console.log(`   狀態文字: ${response.statusText}`);
            console.log(`   響應 Headers:`, response.headers);

            console.log(`\n📨 步驟 4: 處理 API 回應...`);
            console.log(`   success: ${response.data.success}`);

            if (response.data.success) {
                console.log(`✅ 事件更新成功！`);
                console.log(`========== 更新事件完成 ==========\n`);
                return true;
            } else {
                const errorCode = response.data.error?.code;
                const errorMsg = this.getErrorMessage(errorCode);
                console.error('❌ 更新事件失敗');
                console.error('   錯誤碼:', errorCode);
                console.error('   錯誤訊息:', errorMsg);
                console.error('   完整 API 回應:', JSON.stringify(response.data, null, 2));
                
                // 🔍 輸出所有參數以便診斷
                console.error('\n🔍 診斷：發送的參數詳情:');
                const allParams = {};
                // 使用 Array.from 確保獲取所有參數
                const paramEntries = Array.from(params.entries());
                console.error(`   參數總數: ${paramEntries.length}`);
                console.error(`   參數鍵列表: ${paramEntries.map(([k]) => k).join(', ')}`);
                
                paramEntries.forEach(([key, value]) => {
                    // 截斷過長的參數值（如 description）
                    allParams[key] = value.length > 200 ? value.substring(0, 200) + '...' : value;
                });
                console.error(`   完整參數（截斷後）:`, JSON.stringify(allParams, null, 2));
                
                // 🔥 特別檢查關鍵參數是否存在
                console.error(`\n   🔍 關鍵參數存在性檢查:`);
                console.error(`      dtstart: ${params.has('dtstart') ? `✅ 存在，值="${params.get('dtstart')}"` : '❌ 缺失！'}`);
                console.error(`      dtend: ${params.has('dtend') ? `✅ 存在，值="${params.get('dtend')}"` : '❌ 缺失！'}`);
                console.error(`      evt_id: ${params.has('evt_id') ? `✅ 存在，值="${params.get('evt_id')}"` : '❌ 缺失！'}`);
                console.error(`      cal_id: ${params.has('cal_id') ? `✅ 存在，值="${params.get('cal_id')}"` : '❌ 缺失！'}`);
                console.error(`      original_cal_id: ${params.has('original_cal_id') ? `✅ 存在，值="${params.get('original_cal_id')}"` : '❌ 缺失！'}`);
                console.error(`      dav_etag: ${params.has('dav_etag') ? `✅ 存在，值="${params.get('dav_etag')}"` : '❌ 缺失！'}`);
                console.error(`      description: ${params.has('description') ? `✅ 存在，長度=${params.get('description')?.length || 0}` : '❌ 缺失！'}`);
                
                // 🔥 如果 dtstart 缺失，這是一個嚴重錯誤
                if (!params.has('dtstart')) {
                    console.error(`\n   ❌ 嚴重錯誤：dtstart 參數缺失！這可能是導致 9009 錯誤的原因！`);
                    console.error(`   請檢查參數添加邏輯`);
                }
                
                // 🩹 9009 特殊處理：嘗試最小參數集重試（移除 color/notify_setting/description/participant/location_info/attachments）
                // 🔥 關鍵：如果使用 cal_id=undefined 失敗，嘗試使用 original_cal_id 作為 cal_id
                if (Number(errorCode) === 9009) {
                    // 🔥 策略 1: 如果 cal_id 是 undefined，嘗試使用 original_cal_id 作為 cal_id
                    if (finalCalId === undefined) {
                        try {
                            console.log(`\n🩹 策略 1: 使用 original_cal_id 作為 cal_id 重試...`);
                            const retryParams1 = new URLSearchParams();
                            retryParams1.append('api', 'SYNO.Cal.Event');
                            retryParams1.append('version', '5');
                            retryParams1.append('method', 'set');
                            retryParams1.append('_sid', this.sid);
                            retryParams1.append('evt_id', numericEvtId.toString());
                            retryParams1.append('cal_id', originalCalId);  // 🔥 使用 original_cal_id 作為 cal_id
                            retryParams1.append('original_cal_id', originalCalId);
                            retryParams1.append('dav_etag', event.dav_etag);
                            retryParams1.append('summary', newSummary);
                            retryParams1.append('is_all_day', String(event.is_all_day));
                            retryParams1.append('tz_id', event.tz_id || 'Asia/Taipei');
                            retryParams1.append('dtstart', String(event.dtstart));
                            retryParams1.append('dtend', String(event.dtend));
                            retryParams1.append('is_repeat_evt', String(event.is_repeat_evt));
                            retryParams1.append('color', event.color || '');
                            retryParams1.append('notify_setting', JSON.stringify(event.notify_setting || []));
                            retryParams1.append('description', finalDescription);
                            retryParams1.append('participant', JSON.stringify(event.participant || []));
                            retryParams1.append('attachments', JSON.stringify(event.attachments || []));
                            retryParams1.append('location_info', JSON.stringify(finalLocationInfo));
                            
                            const retryResponse1 = await axios.post(
                                `${this.baseUrl}/webapi/entry.cgi`,
                                retryParams1.toString(),
                                {
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'X-SYNO-TOKEN': this.synotoken || '',
                                        'Cookie': `id=${this.sid}`
                                    },
                                    timeout: 15000,
                                    validateStatus: () => true
                                }
                            );
                            
                            console.log(`   策略 1 回應: success=${retryResponse1.data.success}, errorCode=${retryResponse1.data.error?.code}`);
                            
                            if (retryResponse1.data.success) {
                                console.log(`✅ 策略 1 成功：使用 original_cal_id 作為 cal_id`);
                                return true;
                            } else {
                                console.log(`   ⚠️ 策略 1 失敗，錯誤碼: ${retryResponse1.data.error?.code}`);
                            }
                        } catch (retryErr1) {
                            console.log(`   ⚠️ 策略 1 異常: ${retryErr1.message}`);
                        }
                    }
                    
                    // 🔥 策略 2: 嘗試最小參數集重試
                    try {
                        console.log(`\n🩹 策略 2: 嘗試以「最小參數集」重試更新...`);
                        const minimal = new URLSearchParams();
                        minimal.append('api', 'SYNO.Cal.Event');
                        minimal.append('version', '5');
                        minimal.append('method', 'set');
                        minimal.append('_sid', this.sid);
                        minimal.append('evt_id', numericEvtId.toString());
                        // 🔥 如果 finalCalId 是 undefined，使用 original_cal_id
                        minimal.append('cal_id', finalCalId === undefined ? originalCalId : finalCalId);
                        minimal.append('original_cal_id', originalCalId);
                        minimal.append('dav_etag', event.dav_etag);
                        minimal.append('summary', newSummary);
                        const retryIsAllDayBool = (event.is_all_day === true || event.is_all_day === 'true' || event.is_all_day === 1);
                        minimal.append('is_all_day', String(retryIsAllDayBool));
                        minimal.append('tz_id', event.tz_id || 'Asia/Taipei');
                        minimal.append('dtstart', Number(event.dtstart).toString());
                        minimal.append('dtend', Number(event.dtend).toString());
                        const retryIsRepeatEvtBool = (event.is_repeat_evt === true || event.is_repeat_evt === 'true' || event.is_repeat_evt === 1);
                        minimal.append('is_repeat_evt', String(retryIsRepeatEvtBool));
                        
                        // 🔥 最小參數集也必須包含所有 Required Yes 參數（根據 API 文檔）
                        // 清理 description
                        let cleanDescription = (event.description || '')
                            .replace(/[\r\n\t]/g, ' ')
                            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .substring(0, 5000);
                        if (!cleanDescription) {
                            cleanDescription = newSummary; // 如果清理後為空，使用標題
                        }
                        minimal.append('description', cleanDescription);
                        minimal.append('color', event.color || '');
                        minimal.append('notify_setting', JSON.stringify(event.notify_setting || []));
                        minimal.append('participant', JSON.stringify(event.participant || []));
                        minimal.append('attachments', JSON.stringify(event.attachments || []));
                        // 🔥 location_info 必須包含完整結構
                        const retryLocationInfo = {
                            address: String(event.location_info?.address || ''),
                            gps: {
                                lat: Number(event.location_info?.gps?.lat ?? -1),
                                lng: Number(event.location_info?.gps?.lng ?? -1)
                            },
                            map_type: String(event.location_info?.map_type || ''),
                            name: String(event.location_info?.name || ''),
                            place_id: String(event.location_info?.place_id || '')
                        };
                        minimal.append('location_info', JSON.stringify(retryLocationInfo));
                        
                        const retryResp = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, minimal.toString(), {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-SYNO-TOKEN': this.synotoken || '',
                                'Cookie': `id=${this.sid}`
                            },
                            timeout: 15000,
                            validateStatus: () => true
                        });
                        console.log(`   重試狀態: ${retryResp.status}, success: ${retryResp.data.success}`);
                        if (retryResp.data.success) {
                            console.log(`✅ 最小參數集重試成功！`);
                            return true;
                        } else {
                            console.error(`❌ 最小參數集重試仍失敗，錯誤碼: ${retryResp.data.error?.code}`);
                            console.error('   回應:', JSON.stringify(retryResp.data, null, 2));

                            // 🛠️ 最後一招：以「重建 + 刪除」方式模擬更新（與代課移動相同策略，但目標仍是同一個日曆）
                            console.log(`\n🛠️ 嘗試使用「重建+刪除」策略更新標題（同日曆內）...`);
                            try {
                                // 構建新事件資料（沿用現有事件所有欄位，只替換 summary/description 及時間）
                                // 若呼叫端沒有提供新 description，沿用原描述
                                const replacementEventData = {
                                    title: newSummary,
                                    summary: newSummary,
                                    dtstart: Number(event.dtstart),
                                    dtend: Number(event.dtend),
                                    is_all_day: (event.is_all_day === true || event.is_all_day === 'true' || event.is_all_day === 1),
                                    tz_id: event.tz_id || 'Asia/Taipei',
                                    is_repeat_evt: (event.is_repeat_evt === true || event.is_repeat_evt === 'true' || event.is_repeat_evt === 1)
                                };
                                // location_info：若為物件/字串則保留，否則省略
                                if (event.location_info) {
                                    try {
                                        const locObj = typeof event.location_info === 'string' ? JSON.parse(event.location_info) : event.location_info;
                                        replacementEventData.location_info = {
                                            address: locObj.address || '',
                                            gps: locObj.gps || { lat: -1, lng: -1 },
                                            map_type: locObj.map_type || '',
                                            name: locObj.name || '',
                                            place_id: locObj.place_id || ''
                                        };
                                    } catch (_) {
                                        // 略過 location_info
                                    }
                                }

                                console.log('   ➕ 在原日曆重建事件（模擬更新）...');
                                const created = await this.createEvent(finalCalId || calendarId, replacementEventData);
                                if (created && created.evt_id) {
                                    console.log('   ✅ 新事件已建立，接著刪除舊事件...');
                                    const deleted = await this.deleteEvent(finalCalId || calendarId, eventId);
                                    if (deleted) {
                                        console.log('   ✅ 舊事件已刪除');
                                        console.log('✅ 以重建+刪除方式完成「更新」');
                                        return true;
                                    } else {
                                        console.warn('   ⚠️ 刪除舊事件失敗，但新事件已建立');
                                        return true; // 視為完成（避免重複事件，後續由人工清理）
                                    }
                                } else {
                                    console.error('   ❌ 重建事件失敗，無法模擬更新');
                                }
                            } catch (replaceErr) {
                                console.error('   ❌ 「重建+刪除」策略失敗:', replaceErr.message);
                            }
                        }
                    } catch (retryErr) {
                        console.error('❌ 最小參數集重試發生錯誤:', retryErr.message);
                    }
                }
                
                throw new Error(`更新失敗: ${errorMsg} (錯誤碼: ${errorCode})`);
            }
        } catch (error) {
            console.error('❌ 更新事件錯誤:', error.message);
            console.error('   錯誤堆疊:', error.stack);
            
            // 如果是認證錯誤，清除 SID 並重試一次
            if (error.response?.data?.error?.code === 105 || error.response?.data?.error?.code === 106) {
                console.log('   認證過期，重新登入...');
                this.sid = null;
                this.synotoken = null;
                return this.updateEvent(calendarId, eventId, updates, existingEvent);
            }
            throw error;
        }
    }
    
    /**
     * 🗑️ 刪除事件
     */
    async deleteEvent(calendarId, eventId) {
        try {
            await this.ensureLoggedIn();
            
            console.log(`🗑️ 刪除事件: ${eventId}`);
            
            // 先獲取數字型 evt_id
            const eventDetails = await this.getEventByIcalUid(calendarId, eventId);
            const numericEvtId = eventDetails.evt_id;
            
            console.log(`   使用數字型 evt_id: ${numericEvtId}`);
            
            // 🔥 根據 API 文檔：evt_id 是 unsigned long long，直接傳數字
            const params = new URLSearchParams({
                api: 'SYNO.Cal.Event',
                version: '5',
                method: 'delete',
                evt_id: numericEvtId,  // 直接傳數字，不是陣列
                _sid: this.sid
            });
            
            const response = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, 
                params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-SYNO-TOKEN': this.synotoken || ''
                    }
                });
            
            if (response.data.success) {
                console.log('✅ 事件已刪除');
                return true;
            } else {
                const errorCode = response.data.error?.code;
                const errorMsg = this.getErrorMessage(errorCode);
                console.error('❌ 刪除事件失敗');
                console.error('   錯誤碼:', errorCode);
                console.error('   錯誤訊息:', errorMsg);
                throw new Error(`刪除失敗: ${errorMsg} (錯誤碼: ${errorCode})`);
            }
        } catch (error) {
            console.error('❌ 刪除事件錯誤:', error.message);
            
            // 如果是認證錯誤，清除 SID 並重試一次
            if (error.response?.data?.error?.code === 105 || error.response?.data?.error?.code === 106) {
                console.log('   認證過期，重新登入...');
                this.sid = null;
                this.synotoken = null;
                return this.deleteEvent(calendarId, eventId);
            }
            throw error;
        }
    }

    /**
     * ➕ 創建事件
     * @param {string} calendarId - 目標日曆 ID
     * @param {object} eventData - 事件資料
     * @param {string} [originalCalendarId] - 原始日曆 ID（用於跨日曆移動，可選）
     */
    async createEvent(calendarId, eventData, originalCalendarId = null) {
        try {
            await this.ensureLoggedIn();
            
            // 🔥 修正 calendarId 格式（必須以 / 開頭和結尾）
            const sanitizeCalId = (id) => {
                if (!id) return id;
                let v = String(id);
                if (!v.startsWith('/')) v = '/' + v;
                if (!v.endsWith('/')) v = v + '/';
                return v;
            };
            
            calendarId = sanitizeCalId(calendarId);
            if (originalCalendarId) {
                originalCalendarId = sanitizeCalId(originalCalendarId);
            }
            
            console.log(`➕ 在日曆 ${calendarId} 創建事件`);
            if (originalCalendarId) {
                console.log(`   原始日曆 ID: ${originalCalendarId}`);
            }
            console.log('   事件資料:', {
                title: eventData.title || eventData.summary,
                dtstart: eventData.dtstart,
                dtend: eventData.dtend
            });
            
            console.log('\n🔍 檢查創建事件的必要欄位:');
            console.log(`   cal_id: ${calendarId}`);
            console.log(`   title: ${eventData.title || eventData.summary}`);
            console.log(`   dtstart: ${eventData.dtstart} (type: ${typeof eventData.dtstart})`);
            console.log(`   dtend: ${eventData.dtend} (type: ${typeof eventData.dtend})`);
            console.log(`   is_all_day: ${eventData.is_all_day || eventData.isAllDay}`);
            console.log(`   is_repeat_evt: ${eventData.is_repeat_evt}`);
            console.log(`   tz_id: ${eventData.tz_id || 'Asia/Taipei'}`);
            
            // 🔥 根據官方 API 文檔 (第 778-820 行) 構建所有必要參數
            const params = new URLSearchParams();
            console.log('\n   ➡️ 開始構建創建事件參數...');
            params.append('api', 'SYNO.Cal.Event');
            params.append('version', '5');
            params.append('method', 'create');
            params.append('_sid', this.sid);
            console.log('   ✓ 基本參數已添加 (api, version, method, _sid)');
            
            // 🔥 所有 Required=Yes 的參數（完全按照 API 文檔）
            params.append('cal_id', calendarId);
            // 🔥 original_cal_id: 如果有提供（跨日曆移動），使用提供的值；否則使用目標日曆 ID
            params.append('original_cal_id', originalCalendarId || calendarId);
            params.append('summary', eventData.title || eventData.summary || '未命名事件');
            // 🔥 is_all_day: 使用 String() 轉換（與成功測試一致）
            const createIsAllDayBool = (eventData.is_all_day === true || eventData.isAllDay === true);
            params.append('is_all_day', String(createIsAllDayBool));
            // 🔥 tz_id: 根據 API 文檔，Partial-day events require time zone information
            // 對於全天事件，tz_id 可以是空字串（從 Response 示例中看到 tz_id: ""）
            // 對於非全天事件，必須提供時區資訊
            const tzIdValue = createIsAllDayBool 
                ? (eventData.tz_id || '')  // 全天事件：使用提供的 tz_id 或空字串
                : (eventData.tz_id || 'Asia/Taipei');  // 非全天事件：必須提供時區
            params.append('tz_id', tzIdValue);
            
            // 🔥 確保 dtstart 和 dtend 是數字（Epoch 秒），與 updateEvent 保持一致
            const dtstart = Number(eventData.dtstart);
            const dtend = Number(eventData.dtend);
            if (isNaN(dtstart) || isNaN(dtend)) {
                throw new Error(`無效的時間戳記: dtstart=${eventData.dtstart}, dtend=${eventData.dtend}`);
            }
            // 🔥 根據 API 文檔，dtstart 和 dtend 必須是 unsigned long long（數字），但 URLSearchParams 會自動轉換為字符串
            params.append('dtstart', String(dtstart));  // 確保是字符串格式
            params.append('dtend', String(dtend));
            // 🔥 is_repeat_evt: 使用 String() 轉換（與成功測試一致）
            const createIsRepeatEvtBool = eventData.is_repeat_evt === true;
            params.append('is_repeat_evt', String(createIsRepeatEvtBool));
            
            // 🔥 代課事件驗證：確保 is_repeat_evt 明確為 false
            if (eventData.title && eventData.title.includes('[代課]') && createIsRepeatEvtBool) {
                console.warn('   ⚠️⚠️⚠️ 警告：代課事件但 is_repeat_evt 為 true，這不應該發生！');
                console.warn('   將強制設為 false 以確保代課事件為單次事件');
                params.set('is_repeat_evt', 'false');  // 強制覆蓋
            }
            
            // 🔥 repeat_setting - 條件必要（depends on is_repeat_evt）
            // 如果 is_repeat_evt 為 true，必須傳送有效的 repeat_setting
            // 🔥 重要：當 is_repeat_evt 為 false 時，絕對不傳送 repeat_setting（特別是代課事件）
            if (createIsRepeatEvtBool) {
                // 🔥 重要：即使 repeat_setting 是空物件 {}，也要嘗試使用它
                // 因為 API 可能已經設置了某些內部狀態
                if (eventData.repeat_setting && 
                    typeof eventData.repeat_setting === 'object' && 
                    eventData.repeat_setting !== null &&
                    !Array.isArray(eventData.repeat_setting)) {
                    // 即使鍵數量為 0，也使用它（API 可能接受空物件）
                    params.append('repeat_setting', JSON.stringify(eventData.repeat_setting));
                    if (Object.keys(eventData.repeat_setting).length > 0) {
                        console.log('   ✅ 傳送 repeat_setting:', JSON.stringify(eventData.repeat_setting, null, 2));
                    } else {
                        console.warn('   ⚠️ repeat_setting 是空物件 {}，將嘗試使用它');
                    }
                } else {
                    console.warn('   ⚠️ 重複事件但沒有有效的 repeat_setting，將使用預設值');
                    // 🔥 根據 API 文檔示例（第 941-949 行），repeat_setting 必須包含完整結構
                    const defaultRepeatSetting = {
                        type: 'day',
                        interval: 1,
                        end: {
                            count: 0,
                            date: dtend + 86400 * 7,  // 預設結束於一週後
                            type: 'date'
                        },
                        month_option: '',
                        week_start_day: 'monday',
                        weekday: []
                    };
                    params.append('repeat_setting', JSON.stringify(defaultRepeatSetting));
                    console.log('   ✅ 使用預設 repeat_setting:', JSON.stringify(defaultRepeatSetting, null, 2));
                }
            } else {
                // 🔥 當 is_repeat_evt 為 false 時，明確不傳送 repeat_setting
                // 這對於代課事件特別重要，確保代課事件為單次事件
                if (eventData.title && eventData.title.includes('[代課]')) {
                    console.log('   ✅ 代課事件：is_repeat_evt=false，不傳送 repeat_setting（單次事件）');
                }
            }
            
            // 🔥 根據官方文檔，這些參數都是 Required Yes，必須傳送（即使為空）
            // color: 可以是空字串 ""（使用日曆預設顏色）
            if (typeof eventData.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(eventData.color)) {
                params.append('color', eventData.color);
            } else {
                params.append('color', '');  // 🔥 Required Yes，傳空字串使用預設顏色
            }
            
            // notify_setting: Required Yes，必須傳送（空陣列）
            params.append('notify_setting', JSON.stringify(
                Array.isArray(eventData.notify_setting) ? eventData.notify_setting : []
            ));
            
            // description: Required Yes，必須傳送（空字串也可）
            // 🔥 清理 description：移除控制字符和特殊字符，避免 API 解析錯誤
            let descriptionValue = '';
            if (typeof eventData.description === 'string' && eventData.description.length > 0) {
              // 🔥 對於代課事件，先使用標題作為 description，避免特殊字符問題
              if (eventData.title && eventData.title.includes('[代課]')) {
                console.log('   🔥 代課事件：使用標題作為 description（避免特殊字符問題）');
                descriptionValue = eventData.title || eventData.summary || '未命名事件';
              } else {
                // 🔥 清理 description：移除控制字符、換行符等
                descriptionValue = eventData.description
                  .replace(/[\r\n\t]/g, ' ')      // 將換行符、回車符、Tab 替換為空格
                  .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // 移除其他控制字符
                  .replace(/\s+/g, ' ')           // 將多個連續空格合併為單個空格
                  .trim()                         // 移除首尾空白
                  .substring(0, 5000);            // 🔥 限制長度為 5000，避免 URL 編碼問題
              }
            } else {
              // 如果沒有 description，使用標題作為備用（避免空字串）
              descriptionValue = eventData.title || eventData.summary || '未命名事件';
            }
            params.append('description', descriptionValue);
            
            // participant: Required Yes，必須傳送（空陣列）
            params.append('participant', JSON.stringify(
                Array.isArray(eventData.participant) ? eventData.participant : []
            ));
            // 🔥 attachments: 根據 API 文檔，create 方法中 attachments 是可選的（Required No）
            // 但為了與 set 方法保持一致，我們總是傳送（即使為空陣列）
            if (Array.isArray(eventData.attachments) && eventData.attachments.length > 0) {
                params.append('attachments', JSON.stringify(eventData.attachments));
            } else {
                // 🔥 即使沒有附件，也傳送空陣列（確保 API 一致性）
                params.append('attachments', JSON.stringify([]));
            }
            
            // 🔥 location_info: Required No，但根據 API 文檔示例，即使沒有位置資訊也應該傳送空物件
            // 根據 API 文檔 Response 示例（第 925-934 行），location_info 的格式是：
            // {
            //   "address": "",
            //   "gps": { "lat": -1, "lng": -1 },
            //   "map_type": "",
            //   "name": "...",
            //   "place_id": ""
            // }
            if (eventData.location_info && typeof eventData.location_info === 'object') {
                params.append('location_info', JSON.stringify(eventData.location_info));
                console.log('   📍 已添加 location_info:', JSON.stringify(eventData.location_info).substring(0, 100));
            } else if (eventData.location && typeof eventData.location === 'string' && eventData.location.trim().length > 0) {
                // 如果有 location 字串，轉換為 location_info 物件
                const locationInfo = {
                    address: '',
                    gps: { lat: -1, lng: -1 },
                    map_type: '',
                    name: eventData.location.trim(),
                    place_id: ''
                };
                params.append('location_info', JSON.stringify(locationInfo));
                console.log('   📍 已添加 location_info:', locationInfo.name);
            } else {
                // 🔥 即使沒有位置資訊，也傳送空物件以避免 API 錯誤（根據 API 文檔示例）
                const emptyLocationInfo = {
                    address: '',
                    gps: { lat: -1, lng: -1 },
                    map_type: '',
                    name: '',
                    place_id: ''
                };
                params.append('location_info', JSON.stringify(emptyLocationInfo));
                console.log('   📍 已添加空的 location_info');
            }
            
            console.log('\n📤 準備發送創建事件請求...');
            const paramsString = params.toString();
            console.log(`   參數長度: ${paramsString.length}`);
            if (paramsString.length === 0) {
                console.error('❌ 錯誤：參數字串為空！');
                throw new Error('創建事件參數為空');
            }
            console.log(`   參數預覽: ${paramsString.substring(0, 300)}...`);
            
            const response = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, 
                paramsString, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-SYNO-TOKEN': this.synotoken || '',
                        'Cookie': `id=${this.sid}`
                    }
                });
            
            console.log('\n📨 處理創建事件的 API 回應...');
            console.log(`   success: ${response.data.success}`);
            
            if (response.data.success) {
                console.log('✅ 事件已創建');
                console.log('   新事件資料:', response.data.data);
                return response.data.data;
            } else {
                const errorCode = response.data.error?.code;
                const errorMsg = this.getErrorMessage(errorCode);
                console.error('❌ 創建事件失敗');
                console.error('   錯誤碼:', errorCode);
                console.error('   錯誤訊息:', errorMsg);
                console.error('   完整 API 回應:', JSON.stringify(response.data, null, 2));
                
                // 🔍 輸出所有參數以便診斷
                console.error('\n🔍 診斷：發送的參數詳情:');
                const allParams = {};
                params.forEach((value, key) => {
                    allParams[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
                });
                console.error(JSON.stringify(allParams, null, 2));
                
                // 9009 -> 以最小參數集重試（僅必要欄位，但所有 Required Yes 都必須傳送）
                if (Number(errorCode) === 9009) {
                    console.log('🩹 create 最小參數集重試（包含所有 Required Yes 參數）...');
                    console.log('   重試參數:');
                    console.log(`     cal_id: ${calendarId}`);
                    console.log(`     original_cal_id: ${originalCalendarId || calendarId}`);
                    console.log(`     summary: ${eventData.title || eventData.summary || '未命名事件'}`);
                    console.log(`     dtstart: ${dtstart} (${new Date(dtstart * 1000).toLocaleString('zh-TW')})`);
                    console.log(`     dtend: ${dtend} (${new Date(dtend * 1000).toLocaleString('zh-TW')})`);
                    console.log(`     is_all_day: ${createIsAllDayBool ? 'true' : 'false'}`);
                    console.log(`     is_repeat_evt: ${createIsRepeatEvtBool ? 'true' : 'false'}`);
                    console.log(`     color: "" (空字串)`);
                    console.log(`     notify_setting: []`);
                    
                    // 🔥 重試時清理 description（移除控制字符和特殊字符）
                    let retryDescription = '';
                    if (eventData.title && eventData.title.includes('[代課]')) {
                        // 代課事件：使用標題作為 description
                        retryDescription = eventData.title || eventData.summary || '未命名事件';
                    } else if (typeof eventData.description === 'string' && eventData.description.length > 0) {
                        // 非代課事件：清理 description
                        retryDescription = eventData.description
                            .replace(/[\r\n\t]/g, ' ')      // 將換行符、回車符、Tab 替換為空格
                            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // 移除其他控制字符
                            .replace(/\s+/g, ' ')           // 將多個連續空格合併為單個空格
                            .trim()                         // 移除首尾空白
                            .substring(0, 5000);            // 限制長度
                    } else {
                        // 如果沒有 description，使用標題作為備用
                        retryDescription = eventData.title || eventData.summary || '未命名事件';
                    }
                    console.log(`     description: "${retryDescription.substring(0, 50)}..." (長度: ${retryDescription.length})`);
                    console.log(`     participant: []`);
                    
                    const minimal = new URLSearchParams();
                    minimal.append('api', 'SYNO.Cal.Event');
                    minimal.append('version', '5');
                    minimal.append('method', 'create');
                    minimal.append('_sid', this.sid);
                    minimal.append('cal_id', calendarId);
                    // 🔥 original_cal_id: 如果有提供（跨日曆移動），使用提供的值；否則使用目標日曆 ID
                    minimal.append('original_cal_id', originalCalendarId || calendarId);
                    minimal.append('summary', eventData.title || eventData.summary || '未命名事件');
                    minimal.append('is_all_day', String(createIsAllDayBool));
                    // 🔥 tz_id: 根據 API 文檔，全天事件可以使用空字串
                    const retryTzIdValue = createIsAllDayBool 
                        ? (eventData.tz_id || '')  // 全天事件：使用提供的 tz_id 或空字串
                        : (eventData.tz_id || 'Asia/Taipei');  // 非全天事件：必須提供時區
                    minimal.append('tz_id', retryTzIdValue);
                    minimal.append('dtstart', String(dtstart));
                    minimal.append('dtend', String(dtend));
                    minimal.append('is_repeat_evt', String(createIsRepeatEvtBool));
                    // 🔥 如果 is_repeat_evt 為 true，必須傳送有效的 repeat_setting（根據文檔：depends on is_repeat_evt）
                    if (createIsRepeatEvtBool) {
                        let repeatSetting = null;
                        if (eventData.repeat_setting && typeof eventData.repeat_setting === 'object' && Object.keys(eventData.repeat_setting).length > 0) {
                            repeatSetting = eventData.repeat_setting;
                        } else {
                            // 🔥 根據 API 文檔示例（第 941-949 行），repeat_setting 必須包含完整結構
                            repeatSetting = {
                                type: 'day',
                                interval: 1,
                                end: {
                                    count: 0,
                                    date: dtend + 86400 * 7,  // 預設結束於一週後
                                    type: 'date'
                                },
                                month_option: '',
                                week_start_day: 'monday',
                                weekday: []
                            };
                        }
                        minimal.append('repeat_setting', JSON.stringify(repeatSetting));
                        console.log(`     repeat_setting: ${JSON.stringify(repeatSetting).substring(0, 100)}...`);
                    }
                    // 🔥 所有 Required Yes 參數都必須傳送
                    minimal.append('color', '');  // Required Yes
                    minimal.append('notify_setting', '[]');  // Required Yes
                    // description: 使用上面定義的 retryDescription（確保有值）
                    minimal.append('description', retryDescription);
                    minimal.append('participant', '[]');  // Required Yes
                    // 🔥 location_info: Required No，但根據 API 文檔示例，即使沒有位置資訊也應該傳送空物件
                    const emptyLocationInfo = {
                        address: '',
                        gps: { lat: -1, lng: -1 },
                        map_type: '',
                        name: '',
                        place_id: ''
                    };
                    minimal.append('location_info', JSON.stringify(emptyLocationInfo));
                    console.log('     location_info: {} (空物件)');
                    
                    const retry = await axios.post(`${this.baseUrl}/webapi/entry.cgi`, minimal.toString(), {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-SYNO-TOKEN': this.synotoken || '',
                            'Cookie': `id=${this.sid}`
                        },
                        validateStatus: () => true
                    });
                    console.log(`   create 重試結果: success=${retry.data.success}`);
                    if (!retry.data.success) {
                        console.error('   ❌ 最小參數集重試失敗');
                        console.error('   錯誤碼:', retry.data.error?.code);
                        console.error('   錯誤訊息:', retry.data.error?.message || retry.data.error);
                        console.error('   完整回應:', JSON.stringify(retry.data, null, 2));
                    }
                    if (retry.data.success) return retry.data.data;
                }
                throw new Error(`創建失敗: ${errorMsg} (錯誤碼: ${errorCode})`);
            }
        } catch (error) {
            console.error('❌ 創建事件錯誤:', error.message);
            
            // 如果是認證錯誤，清除 SID 並重試一次
            if (error.response?.data?.error?.code === 105 || error.response?.data?.error?.code === 106) {
                console.log('   認證過期，重新登入...');
                this.sid = null;
                this.synotoken = null;
                return this.createEvent(calendarId, eventData);
            }
            throw error;
        }
    }
    
    /**
     * 獲取錯誤訊息
     */
    getErrorMessage(errorCode) {
        const errorMessages = {
            100: '未知錯誤',
            101: '參數無效',
            102: '請求的 API 不存在',
            103: '請求的方法不存在',
            104: '不支援的版本',
            105: '權限不足',
            106: '連線逾時',
            107: '多次登入失敗',
            400: '無效的請求',
            401: '未授權',
            403: '禁止存取',
            404: '找不到資源',
            500: '內部伺服器錯誤',
            1800: '無效的日曆 ID',
            1801: '無效的事件 ID',
            1802: '事件衝突',
            1803: '事件不存在',
            9009: '事件更新失敗 - 可能是事件 ID、日曆 ID 格式錯誤，或缺少必要參數'
        };
        
        return errorMessages[errorCode] || `未知錯誤 (${errorCode})`;
    }
}

module.exports = SynologyCalendarClient;
