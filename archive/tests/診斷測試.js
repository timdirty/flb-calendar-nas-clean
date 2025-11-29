// 🔍 完整診斷測試腳本
// 在瀏覽器控制台中執行此腳本

console.log('🚀 開始完整診斷...\n');

// 1. 測試 API 響應
fetch('/api/events')
  .then(res => res.json())
  .then(data => {
    console.log('📡 API 完整響應:');
    console.log('  - success:', data.success);
    console.log('  - source:', data.source);
    console.log('  - type:', data.type);
    console.log('  - 有 events 字段:', !!data.events);
    console.log('  - 有 data 字段:', !!data.data);
    console.log('  - events 長度:', data.events?.length || 0);
    console.log('  - data 長度:', data.data?.length || 0);
    
    const eventsArray = data.events || data.data || [];
    
    if (eventsArray.length > 0) {
      console.log('\n✅ 成功獲取', eventsArray.length, '個事件');
      console.log('\n📋 前 3 個事件範例:');
      eventsArray.slice(0, 3).forEach((event, i) => {
        console.log(`\n事件 ${i + 1}:`);
        console.log('  - id:', event.id);
        console.log('  - title:', event.title);
        console.log('  - instructor:', event.instructor);
        console.log('  - start:', event.start);
        console.log('  - end:', event.end);
      });
      
      // 檢查是否所有事件都有必要字段
      const missingFields = eventsArray.filter(e => 
        !e.id || !e.title || !e.instructor || !e.start || !e.end
      );
      
      if (missingFields.length > 0) {
        console.warn('\n⚠️ 發現', missingFields.length, '個事件缺少必要字段:');
        console.log(missingFields.slice(0, 5));
      } else {
        console.log('\n✅ 所有事件都有完整的必要字段');
      }
      
      // 檢查講師分布
      const instructors = [...new Set(eventsArray.map(e => e.instructor).filter(Boolean))];
      console.log('\n👥 講師分布:', instructors.length, '位講師');
      console.log(instructors);
      
    } else {
      console.error('\n❌ 沒有獲取到任何事件！');
      console.log('完整響應:', data);
    }
  })
  .catch(error => {
    console.error('❌ API 請求失敗:', error);
  });

// 2. 檢查當前緩存狀態
console.log('\n\n📦 檢查當前緩存:');
const caches = [
  'synology_events_cache_v2',
  'caldav_events_cache',
  'calendar_events_cache'
];

caches.forEach(key => {
  const data = localStorage.getItem(key);
  const time = localStorage.getItem(key + '_time');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      const eventsCount = (parsed.events || parsed.data || []).length;
      console.log(`  ✓ ${key}: ${eventsCount} 個事件`);
      if (time) {
        const cacheAge = Math.floor((Date.now() - parseInt(time)) / 1000 / 60);
        console.log(`    (緩存時間: ${cacheAge} 分鐘前)`);
      }
    } catch (e) {
      console.log(`  ✗ ${key}: 解析失敗`);
    }
  }
});

// 3. 檢查全局變量
console.log('\n\n🌐 檢查全局變量:');
console.log('  - allEvents 長度:', window.allEvents?.length || 0);
console.log('  - allInstructors 長度:', window.allInstructors?.length || 0);
if (window.allInstructors && window.allInstructors.length > 0) {
  console.log('  - 講師列表:', window.allInstructors);
}

console.log('\n✅ 診斷完成！');

