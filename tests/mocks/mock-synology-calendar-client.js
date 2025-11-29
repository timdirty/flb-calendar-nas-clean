const { randomUUID } = require('crypto');

class MockSynologyCalendarClient {
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.loggedIn = false;
    this._evtSeq = 1000;
    this._calendars = [
      {
        id: '/mock/mockteacher/',
        originalId: '/mock/mockteacher/',
        displayName: 'MockTeacher',
        description: '原講師日曆',
        color: '#6B5FDB',
        privilege: 'RW',
        type: 'event',
        ownerName: 'MockTeacher',
        ownerId: 'mock-teacher'
      },
      {
        id: '/mock/substitute/',
        originalId: '/mock/substitute/',
        displayName: 'MockSub',
        description: '代課講師日曆',
        color: '#10b981',
        privilege: 'RW',
        type: 'event',
        ownerName: 'MockSub',
        ownerId: 'mock-sub'
      }
    ];
    this._events = [];
    this._seedInitialEvents();
  }

  _seedInitialEvents() {
    const baseStart = Math.floor(new Date('2025-11-20T10:00:00+08:00').getTime() / 1000);
    this._createInternalEvent({
      uid: 'mock-event-1',
      evtId: 1001,
      calendarId: '/mock/mockteacher/',
      instructor: 'MockTeacher',
      title: 'Mock 課程 10:00-12:00',
      dtstart: baseStart,
      dtend: baseStart + 7200,
      description: '原始課程描述'
    });
  }

  _createInternalEvent({ uid, evtId, calendarId, instructor, title, dtstart, dtend, description }) {
    const calendar = this._findCalendar(calendarId) || this._calendars[0];
    const event = {
      id: uid,
      uid,
      evt_id: evtId || this._evtSeq++,
      title,
      summary: title,
      instructor: instructor || calendar.displayName,
      instructorColor: calendar.color,
      instructorOwner: calendar.ownerName,
      calendarDisplayName: calendar.displayName,
      calendarId,
      cal_id: calendarId,
      originalCalendarId: calendarId,
      start: this._formatIso(dtstart),
      end: this._formatIso(dtend),
      dtstart,
      dtend,
      is_all_day: false,
      isAllDay: false,
      description: description || '',
      location: 'Mock 教室',
      type: 'event',
      tz_id: 'Asia/Taipei',
      _raw: {
        uid,
        evt_id: evtId || this._evtSeq,
        calendarId,
        cal_id: calendarId,
        title,
        description: description || ''
      }
    };
    this._events.push(event);
    return event;
  }

  _cloneEvent(event) {
    return JSON.parse(JSON.stringify(event));
  }

  _formatIso(ts) {
    return new Date(ts * 1000).toISOString();
  }

  _findCalendar(calendarId) {
    const sanitized = this._sanitizeCalId(calendarId);
    return this._calendars.find(cal => this._sanitizeCalId(cal.id) === sanitized);
  }

  _sanitizeCalId(id) {
    if (!id) return id;
    let v = String(id);
    if (!v.startsWith('/')) v = '/' + v;
    if (!v.endsWith('/')) v = v + '/';
    return v;
  }

  async login() {
    this.loggedIn = true;
    console.log('🧪 Mock CalDAV 已登入');
    return true;
  }

  async ensureLoggedIn() {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  async getCalendars() {
    await this.ensureLoggedIn();
    return this._calendars.map(cal => ({ ...cal }));
  }

  async getEvents(calendarId, startDate, endDate) {
    await this.ensureLoggedIn();
    const sanitized = this._sanitizeCalId(calendarId);
    const startTs = Math.floor(startDate.getTime() / 1000);
    const endTs = Math.floor(endDate.getTime() / 1000);
    return this._events
      .filter(evt => this._sanitizeCalId(evt.calendarId) === sanitized)
      .filter(evt => evt.dtstart >= startTs && evt.dtend <= endTs)
      .map(evt => this._cloneEvent(evt));
  }

  async getAllInstructorEvents(startDate, endDate) {
    await this.ensureLoggedIn();
    const startTs = Math.floor(startDate.getTime() / 1000);
    const endTs = Math.floor(endDate.getTime() / 1000);
    return this._events
      .filter(evt => evt.dtend >= startTs && evt.dtstart <= endTs)
      .map(evt => this._cloneEvent(evt));
  }

  async getEventByIcalUid(calendarId, icalUid) {
    await this.ensureLoggedIn();
    const sanitized = this._sanitizeCalId(calendarId);
    const event = this._events.find(evt => this._sanitizeCalId(evt.calendarId) === sanitized && evt.uid === icalUid);
    if (!event) {
      throw new Error('EVENT_NOT_FOUND');
    }
    return this._cloneEvent(event);
  }

  async createEvent(calendarId, eventData, originalCalendarId = null) {
    await this.ensureLoggedIn();
    const targetCal = this._sanitizeCalId(calendarId || originalCalendarId || '/mock/mockteacher/');
    const uid = randomUUID();
    const evtId = this._evtSeq++;
    const event = this._createInternalEvent({
      uid,
      evtId,
      calendarId: targetCal,
      instructor: (this._findCalendar(targetCal) || {}).displayName,
      title: eventData.title || eventData.summary || '未命名事件',
      dtstart: Number(eventData.dtstart),
      dtend: Number(eventData.dtend),
      description: eventData.description || ''
    });
    console.log('🧪 Mock createEvent', { calendarId: targetCal, uid: event.uid });
    return { evt_id: event.evt_id, cal_id: targetCal, uid: event.uid };
  }

  async deleteEvent(calendarId, eventId) {
    await this.ensureLoggedIn();
    const sanitized = this._sanitizeCalId(calendarId);
    const index = this._events.findIndex(evt => this._sanitizeCalId(evt.calendarId) === sanitized && (evt.uid === eventId || String(evt.evt_id) === String(eventId)));
    if (index >= 0) {
      this._events.splice(index, 1);
      console.log('🗑️ Mock deleteEvent', { calendarId: sanitized, eventId });
      return { success: true };
    }
    console.warn('⚠️ Mock deleteEvent 找不到事件', { calendarId: sanitized, eventId });
    return { success: false };
  }

  async updateEvent(calendarId, eventId, updates) {
    await this.ensureLoggedIn();
    const sanitized = this._sanitizeCalId(calendarId);
    const event = this._events.find(evt => evt.uid === String(eventId) || String(evt.evt_id) === String(eventId));
    if (!event) {
      throw new Error('EVENT_NOT_FOUND');
    }
    event.calendarId = sanitized || event.calendarId;
    event.cal_id = event.calendarId;
    event.originalCalendarId = event.calendarId;
    if (updates.title) {
      event.title = updates.title;
      event.summary = updates.title;
      event._raw.title = updates.title;
    }
    if (updates.description !== undefined) {
      event.description = updates.description;
      event._raw.description = updates.description;
    }
    if (updates.dtstart) {
      const startTs = Number(updates.dtstart);
      event.dtstart = startTs;
      event.start = this._formatIso(startTs);
    }
    if (updates.dtend) {
      const endTs = Number(updates.dtend);
      event.dtend = endTs;
      event.end = this._formatIso(endTs);
    }
    console.log('📝 Mock updateEvent', { calendarId: sanitized, eventId, updates });
    return { success: true };
  }
}

module.exports = MockSynologyCalendarClient;
