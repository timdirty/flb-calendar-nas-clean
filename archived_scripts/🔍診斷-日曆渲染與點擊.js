// 🔍 診斷日曆渲染與點擊問題
// 請在瀏覽器控制台貼上此代碼並執行

console.log('🔍 ==================== 日曆診斷開始 ====================');

// 1. 檢查日曆容器
const calendarView = document.getElementById('calendarView');
console.log('📦 日曆容器:', calendarView);
console.log('   - 是否存在:', !!calendarView);
console.log('   - display 樣式:', calendarView ? getComputedStyle(calendarView).display : 'N/A');
console.log('   - visibility 樣式:', calendarView ? getComputedStyle(calendarView).visibility : 'N/A');
console.log('   - innerHTML 長度:', calendarView ? calendarView.innerHTML.length : 0);

// 2. 檢查日曆方塊
const calendarDays = document.querySelectorAll('.calendar-day');
console.log('\n📅 日曆方塊 (.calendar-day):');
console.log('   - 數量:', calendarDays.length);
if (calendarDays.length > 0) {
    const firstDay = calendarDays[0];
    console.log('   - 第一個方塊:', firstDay);
    console.log('   - data-date:', firstDay.dataset.date);
    console.log('   - onclick:', firstDay.onclick);
    console.log('   - onclick 屬性:', firstDay.getAttribute('onclick'));
    console.log('   - display:', getComputedStyle(firstDay).display);
    console.log('   - position:', getComputedStyle(firstDay).position);
    console.log('   - z-index:', getComputedStyle(firstDay).zIndex);
    console.log('   - pointer-events:', getComputedStyle(firstDay).pointerEvents);
    
    // 檢查第一個日曆方塊的位置
    const rect = firstDay.getBoundingClientRect();
    console.log('   - 位置:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    });
    
    // 高亮第一個日曆方塊
    firstDay.style.border = '3px solid red';
    firstDay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    console.log('   - ✅ 已將第一個日曆方塊標記為紅色邊框');
}

// 3. 檢查課程方塊
const eventChips = document.querySelectorAll('.event-chip');
console.log('\n🎯 課程方塊 (.event-chip):');
console.log('   - 數量:', eventChips.length);
if (eventChips.length > 0) {
    const firstChip = eventChips[0];
    console.log('   - 第一個方塊:', firstChip);
    console.log('   - data-event-id:', firstChip.dataset.eventId);
    console.log('   - onclick:', firstChip.onclick);
    console.log('   - onclick 屬性:', firstChip.getAttribute('onclick'));
    console.log('   - pointer-events:', getComputedStyle(firstChip).pointerEvents);
    
    // 高亮第一個課程方塊
    firstChip.style.border = '3px solid blue';
    console.log('   - ✅ 已將第一個課程方塊標記為藍色邊框');
}

// 4. 檢查 controls 元素
const controls = document.querySelector('.controls');
console.log('\n🎛️ 控制面板 (.controls):');
console.log('   - 元素:', controls);
if (controls) {
    const rect = controls.getBoundingClientRect();
    console.log('   - 位置:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom
    });
    console.log('   - z-index:', getComputedStyle(controls).zIndex);
}

// 5. 檢查 calendarViewContainer
const calendarViewContainer = document.getElementById('calendarViewContainer');
console.log('\n📦 日曆視圖容器 (#calendarViewContainer):');
console.log('   - 是否存在:', !!calendarViewContainer);
if (calendarViewContainer) {
    console.log('   - display:', getComputedStyle(calendarViewContainer).display);
    console.log('   - visibility:', getComputedStyle(calendarViewContainer).visibility);
    const rect = calendarViewContainer.getBoundingClientRect();
    console.log('   - 位置:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    });
}

// 6. 檢查全域函數
console.log('\n🔧 全域函數檢查:');
console.log('   - window.scrollToDateCourses:', typeof window.scrollToDateCourses);
console.log('   - window.highlightEventCardFromCalendar:', typeof window.highlightEventCardFromCalendar);

// 7. 測試點擊
console.log('\n🧪 ==================== 測試指引 ====================');
console.log('請嘗試以下測試：');
console.log('\n1️⃣  點擊紅色邊框的日曆方塊');
console.log('   - 應該看到：🗓️ 週日曆-點擊日期 或 🗓️ 月日曆-點擊日期');
console.log('   - 如果沒有看到，表示 onclick 沒有正確綁定');
console.log('\n2️⃣  點擊藍色邊框的課程方塊');
console.log('   - 應該看到：🎯 週日曆-點擊課程 或 🎯 月日曆-點擊課程');
console.log('   - 如果沒有看到，表示 onclick 沒有正確綁定');
console.log('\n3️⃣  如果點擊後仍然顯示 "target: DIV controls"：');
console.log('   - 表示您點擊的位置不是日曆，而是上方的控制面板');
console.log('   - 請向下滾動，確保點擊的是日曆網格區域');

// 8. 添加臨時點擊監聽器
console.log('\n🎯 ==================== 添加臨時診斷監聽器 ====================');
if (calendarDays.length > 0) {
    calendarDays.forEach((day, index) => {
        day.addEventListener('click', function(e) {
            console.log(`✅ 臨時監聽器捕獲：點擊日曆方塊 ${index + 1}`, {
                date: this.dataset.date,
                hasOnclick: !!this.onclick,
                onclickAttr: this.getAttribute('onclick')
            });
        }, true);
    });
    console.log(`✅ 已為 ${calendarDays.length} 個日曆方塊添加臨時診斷監聽器`);
}

if (eventChips.length > 0) {
    eventChips.forEach((chip, index) => {
        chip.addEventListener('click', function(e) {
            console.log(`✅ 臨時監聽器捕獲：點擊課程方塊 ${index + 1}`, {
                eventId: this.dataset.eventId,
                hasOnclick: !!this.onclick,
                onclickAttr: this.getAttribute('onclick')
            });
        }, true);
    });
    console.log(`✅ 已為 ${eventChips.length} 個課程方塊添加臨時診斷監聽器`);
}

console.log('\n🔍 ==================== 診斷完成 ====================');
console.log('請查看上方的診斷結果，然後嘗試點擊紅色/藍色邊框的元素');

