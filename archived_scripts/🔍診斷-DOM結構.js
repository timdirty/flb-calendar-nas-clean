// 🔍 DOM 結構診斷工具
// 請在瀏覽器 Console 中複製並執行此代碼

console.log('🔍 ===== DOM 結構完整診斷 =====');
console.log('');

// 1. 檢查日曆方塊的實際結構
console.log('📦 1. 檢查日曆方塊結構:');
const calendarDays = document.querySelectorAll('.calendar-day');
console.log('   找到', calendarDays.length, '個 calendar-day');

if (calendarDays.length > 0) {
    const firstDay = calendarDays[0];
    console.log('   ');
    console.log('   第一個 calendar-day 的詳細資訊:');
    console.log('   - className:', firstDay.className);
    console.log('   - data-date:', firstDay.dataset.date);
    console.log('   - title:', firstDay.getAttribute('title')?.substring(0, 80));
    console.log('   - style:', firstDay.getAttribute('style'));
    console.log('   - 子元素數量:', firstDay.children.length);
    console.log('   ');
    
    // 顯示子元素
    console.log('   子元素列表:');
    Array.from(firstDay.children).forEach((child, index) => {
        console.log(`     ${index + 1}. <${child.tagName.toLowerCase()} class="${child.className}">`);
    });
}
console.log('');

// 2. 檢查事件方塊的結構
console.log('🎯 2. 檢查事件方塊結構:');
const eventChips = document.querySelectorAll('.event-chip');
console.log('   找到', eventChips.length, '個 event-chip');

if (eventChips.length > 0) {
    const firstChip = eventChips[0];
    console.log('   ');
    console.log('   第一個 event-chip 的詳細資訊:');
    console.log('   - className:', firstChip.className);
    console.log('   - data-event-id:', firstChip.dataset.eventId);
    console.log('   - title:', firstChip.getAttribute('title')?.substring(0, 80));
    console.log('   - style:', firstChip.getAttribute('style')?.substring(0, 100));
    console.log('   - parentElement:', firstChip.parentElement?.className);
    console.log('   - 子元素數量:', firstChip.children.length);
    console.log('   ');
    
    // 顯示子元素
    console.log('   子元素列表:');
    Array.from(firstChip.children).forEach((child, index) => {
        console.log(`     ${index + 1}. <${child.tagName.toLowerCase()} class="${child.className}">`);
    });
}
console.log('');

// 3. 測試 closest() 功能
console.log('🧪 3. 測試 closest() 功能:');
if (eventChips.length > 0) {
    const testChip = eventChips[0];
    const time = testChip.querySelector('.time');
    if (time) {
        console.log('   測試從 .time 元素查找:');
        console.log('   - time.closest(".event-chip"):', time.closest('.event-chip') ? '✅ 找到' : '❌ 找不到');
        console.log('   - time.closest(".calendar-day"):', time.closest('.calendar-day') ? '✅ 找到' : '❌ 找不到');
    }
}
console.log('');

// 4. 檢查 CSS pointer-events
console.log('🖱️ 4. 檢查 pointer-events:');
if (calendarDays.length > 0) {
    const day = calendarDays[0];
    const dayStyle = window.getComputedStyle(day);
    console.log('   calendar-day:');
    console.log('   - pointer-events:', dayStyle.pointerEvents);
    console.log('   - cursor:', dayStyle.cursor);
    console.log('   - z-index:', dayStyle.zIndex);
}

if (eventChips.length > 0) {
    const chip = eventChips[0];
    const chipStyle = window.getComputedStyle(chip);
    console.log('   ');
    console.log('   event-chip:');
    console.log('   - pointer-events:', chipStyle.pointerEvents);
    console.log('   - cursor:', chipStyle.cursor);
    console.log('   - z-index:', chipStyle.zIndex);
    
    const time = chip.querySelector('.time');
    if (time) {
        const timeStyle = window.getComputedStyle(time);
        console.log('   ');
        console.log('   .time (事件方塊內的時間):');
        console.log('   - pointer-events:', timeStyle.pointerEvents);
        console.log('   - cursor:', timeStyle.cursor);
    }
}
console.log('');

// 5. 檢查是否有覆蓋層
console.log('🔍 5. 檢查可能的覆蓋層:');
const calendarSection = document.getElementById('calendarSection');
if (calendarSection) {
    const rect = calendarSection.getBoundingClientRect();
    console.log('   calendarSection 位置:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    });
    
    // 檢查中心點的元素
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtCenter = document.elementFromPoint(centerX, centerY);
    console.log('   ');
    console.log('   日曆中心點的元素:');
    console.log('   - tagName:', elementAtCenter?.tagName);
    console.log('   - className:', elementAtCenter?.className);
    console.log('   - id:', elementAtCenter?.id);
}
console.log('');

// 6. 手動測試點擊
console.log('🧪 6. 設置點擊測試:');
console.log('   執行以下代碼來測試點擊捕獲:');
console.log('   ');
console.log('   // 複製以下代碼執行:');
console.log('   document.addEventListener("click", function testClick(e) {');
console.log('       console.log("===== 點擊測試 =====");');
console.log('       console.log("target:", e.target.tagName, e.target.className);');
console.log('       console.log("closest(.event-chip):", e.target.closest(".event-chip"));');
console.log('       console.log("closest(.calendar-day):", e.target.closest(".calendar-day"));');
console.log('       console.log("==================");');
console.log('   }, true);');
console.log('');

// 7. 檢查事件委派是否已設置
console.log('⚙️ 7. 檢查事件監聽器:');
console.log('   （瀏覽器無法直接檢查監聽器數量）');
console.log('   請查看是否有「✅ 日曆視圖事件委派已設置完成」的日誌');
console.log('');

console.log('🔍 ===== 診斷完成 =====');
console.log('');
console.log('💡 下一步:');
console.log('   1. 如果 pointer-events 是 "none"，這就是問題所在');
console.log('   2. 如果 closest() 測試失敗，DOM 結構可能有問題');
console.log('   3. 執行上面的點擊測試代碼，然後點擊日曆方塊');
console.log('   4. 將所有輸出截圖回報');

