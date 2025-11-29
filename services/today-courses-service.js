"use strict";

const path = require('path');
const CourseTitleParser = require(path.join(__dirname, '../public/js/modules/course-title-parser.js'));
const semesterHelper = require('../utils/semester-helper');

function getEventStatus(startDate, endDate) {
  const now = new Date();
  if (now < startDate) return 'pending';
  if (now >= startDate && now <= endDate) return 'in-progress';
  return 'completed';
}

function eventToCourse(event) {
  const startDate = new Date(event.dtstart * 1000);
  const endDate = new Date(event.dtend * 1000);

  const dateStr = startDate.toISOString().split('T')[0];
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);

  const title = event.title || event.summary || '';
  const parsed = CourseTitleParser.parse(title);

  const weekMatch = title.match(/第(\d+)週/);
  const weekNumber = weekMatch ? parseInt(weekMatch[1]) : undefined;

  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  let semester = `${year}上學期`;
  if (month >= 2 && month <= 7) {
    semester = `${year}下學期`;
  }

  return {
    id: event.evt_id || event.id || `event-${event.dtstart}`,
    name: title,
    courseName: parsed.courseName,
    date: dateStr,
    time: `${startTime}-${endTime}`,
    weekday: parsed.weekday,
    location: parsed.location || event.location || '',
    weekNumber,
    semester,
    teacherId: event.calendarId || event.cal_id,
    teacherName: event.instructor || event.cal_displayname || '',
    studentCount: 0,
    status: getEventStatus(startDate, endDate),
    metadata: {
      parsed,
      originalEvent: event,
    },
  };
}

function getEventsListFromApp(app) {
  const eventsCache = app.get('eventsCache');
  if (!eventsCache || !eventsCache.data) {
    const error = new Error('事件快取未就緒');
    error.code = 'EVENTS_CACHE_NOT_READY';
    throw error;
  }
  const eventsList = eventsCache.data.events || eventsCache.data.data || [];
  if (!Array.isArray(eventsList)) {
    const error = new Error('事件資料格式錯誤');
    error.code = 'EVENTS_CACHE_INVALID';
    throw error;
  }
  return eventsList;
}

async function getTodayCourses(app, options = {}) {
  const { dateOverride } = options;
  const eventsList = getEventsListFromApp(app);
  const courses = eventsList.map(eventToCourse);

  const targetDate = dateOverride || new Date().toISOString().split('T')[0];
  const filtered = courses.filter((course) => course.date === targetDate);

  return {
    date: targetDate,
    courses: filtered,
  };
}

async function refreshTodayCourses(app, options = {}) {
  // 目前事件快取由其他排程維護，這裡僅重新讀取快取。
  return getTodayCourses(app, options);
}

module.exports = {
  getTodayCourses,
  refreshTodayCourses,
  eventToCourse,
};
