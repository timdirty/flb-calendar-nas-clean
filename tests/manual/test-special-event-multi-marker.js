#!/usr/bin/env node
const axios = require('axios');

async function waitForHealth(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await axios.get(`${baseUrl}/api/health`);
      if (resp.status === 200) {
        return;
      }
    } catch (error) {
      // ignore until timeout
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('健康檢查超時，伺服器未就緒');
}

function toIso(ts) {
  return new Date(ts * 1000).toISOString();
}

async function main() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3002';
  console.log('🧪 開始特殊事件多標記測試，伺服器位址:', baseUrl);

  await waitForHealth(baseUrl);
  console.log('✅ 健康檢查通過');

  try {
    await axios.post(`${baseUrl}/api/events/refresh-cache`);
  } catch (error) {
    console.warn('⚠️ 手動刷新事件快取失敗，略過（可能因為 mock 模式已就緒）');
  }

  const eventsResp = await axios.get(`${baseUrl}/api/events`, {
    headers: { 'x-force-refresh': 'true' }
  });
  const events = eventsResp.data.events || eventsResp.data.data || [];
  if (events.length === 0) {
    throw new Error('沒有取得任何事件，無法進行測試');
  }

  const target = events.find(evt => (evt.title || '').includes('Mock 課程')) || events[0];
  if (!target) {
    throw new Error('找不到 Mock 課程事件');
  }

  console.log('🎯 測試目標事件:', {
    id: target.id,
    title: target.title,
    instructor: target.instructor,
    start: target.start,
    end: target.end
  });

  const newStartTime = target.dtstart + 3600; // 延後 1 小時
  const newEndTime = target.dtend + 3600; // 維持 2 小時長度

  const requestPayload = {
    eventId: target.id,
    specialTypes: ['代課', '改時間'],
    specialType: '代課',
    note: '自動測試：代課 + 改時間',
    preserveDescription: true,
    notificationOptions: {
      notifyInstructor: false,
      notifyStaffGroup: false
    },
    newStartTime,
    newEndTime,
    substituteTeacher: 'MockSub'
  };

  console.log('📤 送出特殊事件標記請求...');
  const markResp = await axios.post(`${baseUrl}/api/events/mark-special`, requestPayload);
  if (!markResp.data.success) {
    throw new Error('標記失敗: ' + (markResp.data.error || '未知錯誤'));
  }
  console.log('✅ 標記成功:', markResp.data.message);

  // 確保快取刷新
  try {
    await axios.post(`${baseUrl}/api/events/refresh-cache`);
  } catch (error) {
    console.warn('⚠️ 快取刷新失敗，等待背景更新');
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  const refreshedResp = await axios.get(`${baseUrl}/api/events`, {
    headers: { 'x-force-refresh': 'true' }
  });
  const refreshedEvents = refreshedResp.data.events || refreshedResp.data.data || [];
  const updated = refreshedEvents.find(evt =>
    (evt.title || '').includes('[代課]') &&
    (evt.title || '').includes('[改時間]') &&
    (evt.description || '').includes('MockSub')
  );

  if (!updated) {
    throw new Error('找不到更新後的多標記事件');
  }

  const validations = [];
  validations.push({
    key: 'titleMarkers',
    passed: updated.title.includes('[代課]') && updated.title.includes('[改時間]'),
    expected: '[代課][改時間] prefix',
    actual: updated.title
  });
  validations.push({
    key: 'timeUpdated',
    passed: updated.dtstart === newStartTime && updated.dtend === newEndTime,
    expected: `${toIso(newStartTime)} ~ ${toIso(newEndTime)}`,
    actual: `${updated.start} ~ ${updated.end}`
  });
  validations.push({
    key: 'descriptionNote',
    passed: (updated.description || '').includes('自動測試：代課 + 改時間'),
    expected: '含特殊事件備註',
    actual: updated.description
  });
  validations.push({
    key: 'substituteTag',
    passed: (updated.description || '').includes('MockSub'),
    expected: '[代課講師] MockSub',
    actual: updated.description
  });

  const failed = validations.filter(v => !v.passed);
  if (failed.length > 0) {
    console.error('❌ 驗證失敗:', failed);
    throw new Error('部分驗證未通過');
  }

  console.log('✅ 驗證通過，更新後事件：');
  console.log({
    id: updated.id,
    title: updated.title,
    start: updated.start,
    end: updated.end,
    description: updated.description
  });

  return {
    targetEvent: target,
    updatedEvent: updated,
    requestPayload
  };
}

if (require.main === module) {
  main().then(result => {
    console.log('🎉 測試完成');
    if (process.env.PRINT_RESULT_JSON === '1') {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  }).catch(error => {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  });
}
