// CalDAV 客戶端模組
const axios = require('axios');
const ICAL = require('ical.js');

class CalDAVClient {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'; // 確保有結尾斜線
        this.username = username;
        this.password = password;
        this.auth = Buffer.from(`${username}:${password}`).toString('base64');
    }

    // 獲取所有行事曆列表
    async getCalendars() {
        try {
            console.log('CalDAV 請求 URL:', this.baseUrl);
            console.log('CalDAV 認證:', this.auth);
            
            // 直接訪問用戶的行事曆目錄
            // 如果 baseUrl 已經包含完整路徑（例如包含用戶名），直接使用
            // 否則才加上用戶名
            const userUrl = this.baseUrl.includes(this.username) 
                ? this.baseUrl 
                : `${this.baseUrl}${this.username}/`;
            console.log('用戶行事曆 URL:', userUrl);
            
            const response = await axios.request({
                method: 'PROPFIND',
                url: userUrl,
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:resourcetype/></D:prop></D:propfind>`
            });

            console.log('CalDAV 回應狀態:', response.status);
            console.log('CalDAV 回應資料長度:', response.data?.length || 0);
            
            return this.parseCalendarList(response.data);
        } catch (error) {
            console.error('獲取行事曆列表失敗:', error.message);
            console.error('錯誤狀態碼:', error.response?.status);
            console.error('錯誤回應:', error.response?.data);
            throw error; // 直接拋出錯誤，不使用備用資料
        }
    }


    // 獲取指定行事曆的事件
    async getEvents(calendarPath, startDate, endDate) {
        try {
            const start = startDate.toISOString().split('T')[0].replace(/-/g, '');
            const end = endDate.toISOString().split('T')[0].replace(/-/g, '');
            
            const response = await axios.request({
                method: 'REPORT',
                url: `https://funlearnbar.synology.me:9102${calendarPath}`,
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?>
                <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                    <C:filter>
                        <C:comp-filter name="VCALENDAR">
                            <C:comp-filter name="VEVENT">
                                <C:time-range start="${start}T000000Z" end="${end}T235959Z"/>
                            </C:comp-filter>
                        </C:comp-filter>
                    </C:filter>
                </C:calendar-query>`
            });

            return this.parseEvents(response.data);
        } catch (error) {
            console.error('獲取事件失敗:', error.message);
            throw error; // 直接拋出錯誤，不使用備用資料
        }
    }



    // 獲取所有講師的行程
    async getAllInstructorEvents(startDate, endDate) {
        try {
            const calendars = await this.getCalendars();
            const allEvents = [];

            for (const calendar of calendars) {
                try {
                    const events = await this.getEvents(calendar.path, startDate, endDate);
                    // 為每個事件添加講師資訊
                    const eventsWithInstructor = events.map(event => ({
                        ...event,
                        instructor: calendar.displayName || '未知講師',
                        calendarPath: calendar.path
                    }));
                    allEvents.push(...eventsWithInstructor);
                } catch (error) {
                    console.warn(`無法獲取行事曆 ${calendar.displayName} 的事件:`, error.message);
                    // 跳過失敗的行事曆，不使用模擬數據
                    continue;
                }
            }

            return allEvents;
        } catch (error) {
            console.error('獲取所有講師事件失敗:', error.message);
            // 直接拋出錯誤，不使用模擬數據
            throw error;
        }
    }


    // 解析行事曆列表
    parseCalendarList(xmlData) {
        const calendars = [];
        try {
            console.log('XML 回應內容:', xmlData.substring(0, 500) + '...');
            
            // 解析 XML 回應，尋找所有行事曆路徑和顯示名稱
            const responseRegex = /<response>([\s\S]*?)<\/response>/g;
            let responseMatch;
            
            while ((responseMatch = responseRegex.exec(xmlData)) !== null) {
                const responseContent = responseMatch[1];
                
                // 提取路徑
                const hrefMatch = responseContent.match(/<href>([^<]+)<\/href>/);
                if (!hrefMatch) continue;
                
                const path = hrefMatch[1];
                console.log('找到路徑:', path);
                
                // 過濾出用戶的行事曆（不包含根目錄和特殊目錄）
                if (path.startsWith(`/caldav.php/${this.username}/`) && 
                    path !== `/caldav.php/${this.username}/` && 
                    !path.includes('/.in/') &&
                    !path.includes('/home_todo/') &&
                    !path.includes('/home/')) {
                    
                    // 提取顯示名稱
                    const displayNameMatch = responseContent.match(/<displayname>([^<]+)<\/displayname>/);
                    const displayName = displayNameMatch ? displayNameMatch[1] : path.split('/').slice(-2, -1)[0];
                    
                    calendars.push({
                        path: path,
                        displayName: displayName
                    });
                    console.log('添加行事曆:', displayName, path);
                }
            }
            
            console.log(`解析到 ${calendars.length} 個行事曆:`, calendars.map(c => c.displayName));
        } catch (error) {
            console.error('解析行事曆列表失敗:', error.message);
        }
        return calendars;
    }

    // 解析事件資料
    parseEvents(xmlData) {
        const events = [];
        try {
            // 提取 iCal 資料
            const icalRegex = /<C:calendar-data>([\s\S]*?)<\/C:calendar-data>/g;
            let match;
            while ((match = icalRegex.exec(xmlData)) !== null) {
                const icalData = match[1];
                const parsedEvents = this.parseICalData(icalData);
                events.push(...parsedEvents);
            }
        } catch (error) {
            console.error('解析事件資料失敗:', error.message);
        }
        return events;
    }

    // 解析 iCal 資料
    parseICalData(icalData) {
        const events = [];
        try {
            const jcalData = ICAL.parse(icalData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            vevents.forEach(vevent => {
                const event = new ICAL.Event(vevent);
                
                // 獲取原始日期時間資訊
                const startDate = event.startDate;
                const endDate = event.endDate;
                
                // 檢查是否為全天事件
                const isAllDay = startDate.isDate;
                
                let start, end;
                
                if (isAllDay) {
                    // 全天事件：使用本地日期，不考慮時區
                    start = new Date(startDate.year, startDate.month - 1, startDate.day);
                    end = new Date(endDate.year, endDate.month - 1, endDate.day);
                } else {
                    // 非全天事件：檢查是否有時區資訊
                    if (startDate.zone && startDate.zone.tzid) {
                        // 有時區資訊，直接轉換
                        start = startDate.toJSDate();
                        end = endDate.toJSDate();
                    } else {
                        // 無時區資訊，假設為台灣時間 (UTC+8)，轉換為 UTC
                        // 台灣時間 = UTC + 8小時，所以 UTC = 台灣時間 - 8小時
                        const taiwanOffset = 8 * 60; // 8小時的分鐘數
                        start = new Date(Date.UTC(startDate.year, startDate.month - 1, startDate.day, startDate.hour, startDate.minute, startDate.second) - (taiwanOffset * 60 * 1000));
                        end = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day, endDate.hour, endDate.minute, endDate.second) - (taiwanOffset * 60 * 1000));
                    }
                }
                
                // 處理站前教室地址
                let location = event.location || '';
                if (location === '站前教室') {
                    location = '台北市中正區開封街1段2號9樓';
                }
                
                // 創建本地時間的 ISO 格式（不加 Z 後綴，避免被當作 UTC 時間）
                const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}T${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:${String(start.getSeconds()).padStart(2, '0')}.000`;
                const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:${String(end.getSeconds()).padStart(2, '0')}.000`;
                
                events.push({
                    id: event.uid || Math.random().toString(36).substr(2, 9),
                    title: event.summary || '無標題',
                    description: event.description || '',
                    location: location,
                    start: startISO,
                    end: endISO,
                    time: this.formatTimeRange(start, end),
                    date: startISO,
                    type: this.determineEventType(event.summary),
                    allDay: isAllDay
                });
            });
        } catch (error) {
            console.error('解析 iCal 資料失敗:', error.message);
        }
        return events;
    }

    // 格式化時間範圍
    formatTimeRange(start, end) {
        if (this.isAllDay(start, end)) {
            return '全天';
        }
        
        const startTime = start.toTimeString().slice(0, 5);
        const endTime = end.toTimeString().slice(0, 5);
        return `${startTime}-${endTime}`;
    }

    // 判斷是否為全天事件
    isAllDay(start, end) {
        const diff = end.getTime() - start.getTime();
        return diff >= 24 * 60 * 60 * 1000; // 24小時
    }

    // 判斷事件類型
    determineEventType(summary) {
        if (!summary) return 'other';
        
        const summaryLower = summary.toLowerCase();
        if (summaryLower.includes('課程') || summaryLower.includes('教學')) return 'course';
        if (summaryLower.includes('會議')) return 'meeting';
        if (summaryLower.includes('輔導') || summaryLower.includes('諮詢')) return 'consultation';
        if (summaryLower.includes('考試') || summaryLower.includes('測驗')) return 'exam';
        return 'other';
    }
}

module.exports = CalDAVClient;

