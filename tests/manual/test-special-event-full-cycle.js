#!/usr/bin/env node
const axios = require('axios');

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3002';

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await axios.get(`${baseUrl}/api/health`);
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('伺服器健康檢查逾時');
}

async function fetchEvents() {
  const resp = await axios.get(`${baseUrl}/api/events`, {
    headers: { 'x-force-refresh': 'true' }
  });
  return resp.data.events || resp.data.data || [];
}

function assertCondition(condition, context) {
  if (!condition) {
    throw new Error(`驗證失敗: ${context}`);
  }
}

async function markSpecial(payload) {
  const resp = await axios.post(`${baseUrl}/api/events/mark-special`, payload);
  if (!resp.data.success) {
    throw new Error(`標記失敗: ${resp.data.error || resp.data.message}`);
  }
  return resp.data;
}

async function removeSpecial(eventId) {
  const resp = await axios.post(`${baseUrl}/api/events/remove-special`, { eventId });
  if (!resp.data.success) {
    throw new Error(`移除標記失敗: ${resp.data.error || resp.data.message}`);
  }
  return resp.data;
}

async function main() {
  console.log('🧪 特殊事件全流程測試開始', { baseUrl });
  await waitForHealth();
  console.log('✅ 健康檢查通過');

  const events = await fetchEvents();
  const baseEvent = events.find(evt => (evt.title || '').includes('Mock 課程'));
  if (!baseEvent) {
    throw new Error('找不到 Mock 課程事件供測試');
  }
  console.log('🎯 基準事件:', {
    id: baseEvent.id,
    calendarId: baseEvent.calendarId,
    dtstart: baseEvent.dtstart,
    dtend: baseEvent.dtend,
    description: baseEvent.description
  });

  const originalDescription = (baseEvent.description || '').trim();
  const duration = baseEvent.dtend - baseEvent.dtstart;
  const newStart = baseEvent.dtstart + 3600; // 延後 1 小時
  const newEnd = newStart + duration;

  // Step 1: 代課 + 改時間
  await markSpecial({
    eventId: baseEvent.id,
    specialTypes: ['代課', '改時間'],
    specialType: '代課',
    note: '第一階段-代課改時間',
    preserveDescription: true,
    notificationOptions: { notifyInstructor: false, notifyStaffGroup: false },
    newStartTime: newStart,
    newEndTime: newEnd,
    substituteTeacher: 'MockSub'
  });
  let updatedEvents = await fetchEvents();
  let current = updatedEvents.find(evt => (evt.title || '').includes('[代課][改時間]'));
  assertCondition(current, '找不到代課+改時間事件');
  console.log('✅ Step1 完成:', { id: current.id, title: current.title });
  assertCondition(current.description.includes(originalDescription), 'Step1 原描述未保留');
  assertCondition(current.description.includes('[特殊事件備註]'), 'Step1 未附加備註');

  // Step 2: 加上公告 (保持已改時間)
  await markSpecial({
    eventId: current.id,
    specialTypes: ['代課', '改時間', '公告'],
    specialType: '代課',
    note: '第二階段-加公告',
    preserveDescription: true,
    notificationOptions: { notifyInstructor: false, notifyStaffGroup: false },
    newStartTime: current.dtstart,
    newEndTime: current.dtend,
    substituteTeacher: 'MockSub',
    announcementContent: '公告：教室改為 B1'
  });
  updatedEvents = await fetchEvents();
  current = updatedEvents.find(evt =>
    (evt.title || '').includes('[代課][改時間]') &&
    (evt.description || '').includes('公告：教室改為 B1')
  );
  assertCondition(current, '找不到加入公告後的事件');
  console.log('✅ Step2 完成:', { id: current.id, title: current.title });
  assertCondition(current.description.includes(originalDescription), 'Step2 原描述未保留');

  // Step 3: 僅保留代課 (移除公告+改時間標記)
  await markSpecial({
    eventId: current.id,
    specialTypes: ['代課'],
    specialType: '代課',
    note: '',
    preserveDescription: true,
    notificationOptions: { notifyInstructor: false, notifyStaffGroup: false },
    substituteTeacher: 'MockSub'
  });
  updatedEvents = await fetchEvents();
  current = updatedEvents.find(evt => (evt.title || '').startsWith('[代課]'));
  assertCondition(current, '找不到僅代課的事件');
  console.log('✅ Step3 完成:', { id: current.id, title: current.title });
  assertCondition(!current.description.includes('公告'), '公告內容未被清除');
  assertCondition(current.description.includes('[代課講師] MockSub'), '代課講師資訊遺失');

  // Step 4: 完全移除特殊事件標記
  await removeSpecial(current.id);
  updatedEvents = await fetchEvents();
  const resetEvent = updatedEvents.find(evt => evt.id === current.id || (evt.title || '').startsWith('Mock 課程 10:00-12:00'));
  assertCondition(resetEvent, '移除後找不到事件');
  console.log('✅ Step4 完成 (移除後):', { id: resetEvent.id, title: resetEvent.title });
  assertCondition(!resetEvent.title.includes('['), '移除後標題仍含標記');
  assertCondition((resetEvent.description || '').trim() === originalDescription, '移除後描述未還原');

  console.log('🎉 特殊事件全流程測試完成');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  });
}
