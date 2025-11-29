// 🔍 日曆渲染狀態診斷工具
// 請在瀏覽器 Console 中複製並執行此代碼

console.log('🔍 ===== 日曆渲染狀態診斷 =====');
console.log('');

// 1. 檢查日曆視圖容器
console.log('📦 1. 檢查日曆視圖容器:');
const calendarView = document.getElementById('calendarView');
if (calendarView) {
    console.log('✅ calendarView 容器存在');
    console.log('   display:', window.getComputedStyle(calendarView).display);
    console.log('   visibility:', window.getComputedStyle(calendarView).visibility);
    console.log('   innerHTML 長度:', calendarView.innerHTML.length);
} else {
    console.log('❌ calendarView 容器不存在');
}
console.log('');

// 2. 檢查日曆網格
console.log('📅 2. 檢查日曆網格:');
const calendarGrid = document.querySelector('.calendar-grid');
if (calendarGrid) {
    console.log('✅ calendar-grid 存在');
    console.log('   display:', window.getComputedStyle(calendarGrid).display);
} else {
    console.log('❌ calendar-grid 不存在');
}
console.log('');

// 3. 檢查日曆方塊
console.log('🗓️ 3. 檢查日曆方塊 (calendar-day):');
const calendarDays = document.querySelectorAll('.calendar-day');
console.log('   找到數量:', calendarDays.length);
if (calendarDays.length > 0) {
    console.log('✅ 有日曆方塊');
    const firstDay = calendarDays[0];
    console.log('   第一個方塊:');
    console.log('     - data-date:', firstDay.dataset.date);
    console.log('     - title:', firstDay.getAttribute('title')?.substring(0, 50) + '...');
    console.log('     - cursor:', window.getComputedStyle(firstDay).cursor);
    console.log('     - pointer-events:', window.getComputedStyle(firstDay).pointerEvents);
} else {
    console.log('❌ 沒有日曆方塊');
}
console.log('');

// 4. 檢查事件方塊
console.log('🎯 4. 檢查事件方塊 (event-chip):');
const eventChips = document.querySelectorAll('.event-chip');
console.log('   找到數量:', eventChips.length);
if (eventChips.length > 0) {
    console.log('✅ 有事件方塊');
    const firstChip = eventChips[0];
    console.log('   第一個事件方塊:');
    console.log('     - data-event-id:', firstChip.dataset.eventId);
    console.log('     - title:', firstChip.getAttribute('title')?.substring(0, 50) + '...');
    console.log('     - cursor:', window.getComputedStyle(firstChip).cursor);
    console.log('     - pointer-events:', window.getComputedStyle(firstChip).pointerEvents);
    console.log('     - background:', window.getComputedStyle(firstChip).background.substring(0, 50));
} else {
    console.log('❌ 沒有事件方塊');
}
console.log('');

// 5. 檢查當前視圖
console.log('👁️ 5. 檢查當前視圖:');
console.log('   specialEventsState.timeRange:', typeof specialEventsState !== 'undefined' ? specialEventsState.timeRange : 'undefined');
console.log('   currentView:', typeof currentView !== 'undefined' ? currentView : 'undefined');
console.log('');

// 6. 檢查全域函數
console.log('⚙️ 6. 檢查全域函數:');
console.log('   window.scrollToDateCourses:', typeof window.scrollToDateCourses);
console.log('   window.highlightEventCardFromCalendar:', typeof window.highlightEventCardFromCalendar);
console.log('   renderWeekCalendar:', typeof renderWeekCalendar);
console.log('   renderMonthCalendar:', typeof renderMonthCalendar);
console.log('');

// 7. 檢查 Section 顯示狀態
console.log('📦 7. 檢查 Section 顯示狀態:');
const calendarSection = document.getElementById('calendarSection');
if (calendarSection) {
    console.log('✅ calendarSection 存在');
    console.log('   display:', window.getComputedStyle(calendarSection).display);
} else {
    console.log('❌ calendarSection 不存在');
}
console.log('');

// 8. 測試點擊模擬
console.log('🧪 8. 模擬點擊測試:');
console.log('   請手動點擊日曆方塊並觀察 Console 輸出');
console.log('');

// 9. 視覺指引
console.log('👆 9. 如何正確點擊:');
console.log('   ❌ 不要點擊: 上一期/下一期/今天按鈕（這些是 controls）');
console.log('   ✅ 要點擊: 日曆網格中的方塊');
console.log('   ✅ 要點擊: 方塊中的課程（黃色/粉色/藍色小方塊）');
console.log('');

console.log('🔍 ===== 診斷完成 =====');
console.log('');
console.log('💡 下一步:');
console.log('   1. 如果 calendar-day 數量 = 0，請切換到「本週」或「本月」視圖');
console.log('   2. 如果有 calendar-day 但點擊無效，請截圖並回報');
console.log('   3. 如果懸浮提示不顯示，檢查 title 屬性是否存在');

