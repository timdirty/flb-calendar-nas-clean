<!-- 1f1233b6-9a17-47a3-964b-59fc1688aedc e884573f-8c09-4216-9e79-f9bc943cd7a0 -->
# 特殊事件管理功能深度整合計畫

## 1. 核心差異分析

### special-events-manager.html 優勢功能：

- 時間範圍快速切換 UI（今日/本週/本月按鈕）L766-783
- 今日課程精簡展示區塊 L785-797
- 週/月日曆網格樣式（calendar-grid, calendar-day, event-chip）L299-368
- 課程類型配色系統 PRESET_COLORS L988-997
- 完整課程名稱顯示在 event-chip L348-368

### perfect-calendar-optimized-complete2.html 現有結構：

- 複雜事件卡片 createEventCard() L13700+
- 講師顏色 instructorColors L8125, L11895-11923
- 多維度篩選（講師/時段/日期）L12606+
- 桌機版 FullCalendar 整合 L8265-8400

## 2. HTML 結構調整

### 2.1 新增時間範圍選擇器（插入主視圖按鈕前）

```html
<!-- 仿 special-events-manager L766-783 -->
<div class="time-range-selector">
  <div class="time-range-label">
    <span class="material-icons">date_range</span>
    視圖範圍
  </div>
  <div class="time-range-buttons">
    <button class="time-range-btn active" data-range="today">今日</button>
    <button class="time-range-btn" data-range="week">本週</button>
    <button class="time-range-btn" data-range="month">本月</button>
  </div>
</div>
```

### 2.2 新增今日課程精簡區塊

```html
<!-- 仿 special-events-manager L785-797 -->
<div class="today-events-compact" id="todayEventsSection">
  <div class="today-header">
    <div class="today-title">
      <span class="material-icons">today</span>
      今日課程
      <span class="today-count" id="todayCount">0</span>
    </div>
  </div>
  <div class="today-events-grid" id="todayEventsGrid"></div>
</div>
```

### 2.3 新增配色說明側邊面板

```html
<div class="color-legend-panel">
  <h4>課程類型配色</h4>
  <div class="color-legend-grid">
    <div class="legend-item"><span class="legend-dot esm"></span> ESM</div>
    <div class="legend-item"><span class="legend-dot spm"></span> SPM</div>
    ...
  </div>
  <h4>講師配色</h4>
  <div id="instructorLegend"></div>
</div>
```

## 3. CSS 樣式整合

### 3.1 匯入 special-events-manager 核心樣式

- 時間範圍選擇器 L117-165
- 今日課程區塊 L168-248
- 日曆網格與格子 L299-340
- 事件 chip 樣式 L348-368
- 配色面板樣式（新增）

### 3.2 課程卡片高亮樣式（新增）

```css
/* 高亮目標卡片 */
.event-card.highlight-target {
  transform: scale(1.05) translateY(-8px);
  box-shadow: 0 16px 48px rgba(79, 70, 229, 0.4);
  z-index: 100;
  border: 3px solid #4f46e5;
}

/* 其他卡片變暗 */
.event-card.dimmed {
  opacity: 0.3;
  filter: grayscale(0.6);
  transform: scale(0.98);
  transition: all 0.4s ease;
}

/* 日曆 chip 高亮同步 */
.event-chip.highlight-source {
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.5);
  transform: scale(1.1);
}
```

## 4. JavaScript 功能整合

### 4.1 時間範圍切換邏輯

```javascript
// 仿 special-events-manager L1110-1145
function changeTimeRange(range) {
  state.timeRange = range;
  document.querySelectorAll('.time-range-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === range);
  });
  applyTimeRangeFilter();
  renderCalendarView(); // 切換週/月視圖
  renderTodayEvents(); // 更新今日區塊
}

function applyTimeRangeFilter() {
  // 根據 today/week/month 篩選 allEvents
  // 與現有講師篩選邏輯協調
}
```

### 4.2 今日課程渲染

```javascript
// 仿 special-events-manager L1148-1178
function renderTodayEvents() {
  const todayEvents = allEvents.filter(e => isToday(e.start));
  document.getElementById('todayCount').textContent = todayEvents.length;
  
  const grid = document.getElementById('todayEventsGrid');
  grid.innerHTML = todayEvents.map(event => {
    const color = instructorColors[event.instructor] || getCourseColor(event.title);
    return `
      <div class="today-event-card" style="background: ${color};" 
           onclick="highlightEventCardFromCalendar('${event.id}')">
        <div class="today-event-time">${formatTime(event.start)}</div>
        <div class="today-event-info">
          <div class="today-event-title">${event.title}</div>
          <div class="today-event-meta">${event.instructor}</div>
        </div>
      </div>
    `;
  }).join('');
}
```

### 4.3 週/月日曆視圖渲染

```javascript
// 仿 special-events-manager L1224-1340
function renderCalendarView() {
  if (state.timeRange === 'week') {
    renderWeekCalendar();
  } else if (state.timeRange === 'month') {
    renderMonthCalendar();
  }
}

function renderWeekCalendar() {
  // 建立 7 天網格，每天顯示 event-chip
  // chip 點擊時觸發 highlightEventCardFromCalendar()
}

function renderMonthCalendar() {
  // 建立月曆網格，today 格子特殊標示
  // chip 點擊時觸發 highlightEventCardFromCalendar()
}
```

### 4.4 課程卡片高亮互動

```javascript
function highlightEventCardFromCalendar(eventId) {
  // 1. 移除所有既有高亮
  document.querySelectorAll('.event-card').forEach(card => {
    card.classList.remove('highlight-target', 'dimmed');
  });
  
  // 2. 找到目標卡片
  const targetCard = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
  if (!targetCard) return;
  
  // 3. 高亮目標，其他變暗
  targetCard.classList.add('highlight-target');
  document.querySelectorAll('.event-card').forEach(card => {
    if (card !== targetCard) {
      card.classList.add('dimmed');
    }
  });
  
  // 4. 平滑滾動到目標卡片
  targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // 5. 3 秒後恢復
  setTimeout(() => {
    document.querySelectorAll('.event-card').forEach(card => {
      card.classList.remove('highlight-target', 'dimmed');
    });
  }, 3000);
}
```

### 4.5 配色系統整合

```javascript
// 合併 PRESET_COLORS 與 instructorColors
const COURSE_TYPE_COLORS = {
  'ESM': '#FFB3D9',
  'SPM': '#FFA726',
  'SPIKE': '#FFD54F',
  'BOOST': '#4FC3F7',
  'EV3': '#66BB6A',
  'MINECRAFT': '#8BC34A'
};

function getCourseColor(title) {
  const type = title.match(/^([A-Z]+)/i)?.[1]?.toUpperCase();
  return COURSE_TYPE_COLORS[type] || instructorColors[event.instructor] || '#94a3b8';
}

function renderColorLegend() {
  // 動態生成配色說明面板
  // 課程類型 + 講師顏色
}
```

## 5. 整合檢查點

### 5.1 視覺一致性

- 時間範圍按鈕與現有 view-buttons 樣式協調
- 今日課程區塊不遮擋主行事曆
- 配色面板可摺疊/固定在側邊

### 5.2 功能協調

- 時間範圍切換與講師篩選互不衝突
- 日曆 chip 與卡片列表同步高亮
- FullCalendar 桌機版也要同步高亮效果

### 5.3 響應式處理

- 手機版隱藏週/月網格，只顯示今日區塊
- 配色面板在小螢幕變成折疊抽屜

## 6. 測試驗證項目

1. 時間範圍切換（今日/本週/本月）正確篩選課程
2. 今日課程區塊即時更新課程數量
3. 點擊日曆 chip 正確高亮對應卡片並滾動
4. 高亮動畫流暢，3 秒後自動恢復
5. 講師顏色與課程類型顏色正確顯示
6. 配色說明面板正確列出所有顏色
7. 手機/平板/桌機版響應式正常

### To-dos

- [ ] 匯入 special-events-manager 的時間範圍選擇器、今日區塊、日曆網格、chip 等核心樣式至 CSS 區段
- [ ] 在 perfect-calendar 插入時間範圍選擇器、今日課程區塊、配色說明面板的 HTML 結構
- [ ] 實作時間範圍切換與篩選邏輯，整合現有講師/時段篩選流程
- [ ] 實作今日課程精簡區塊渲染，包含課程數量統計與卡片展示
- [ ] 實作週/月日曆網格渲染，chip 顯示完整課程名稱與顏色
- [ ] 實作日曆 chip 點擊高亮對應卡片功能（目標浮出、其他變暗、平滑滾動）
- [ ] 整合課程類型配色與講師配色系統，實作配色說明面板動態渲染
- [ ] 調整響應式布局，確保手機/平板/桌機版正常顯示與互動
- [ ] 完整測試時間切換、課程高亮、顏色顯示、響應式表現，確認無功能
- [ ] 講師顏色參照 @admin-dashboard.html 設定定義在 @teacher_data.json 中的顏色
- [ ] 課程顏色參照@https://course-viewer.funlearnbar.synology.me/api/course-colors 設定的顏色做
- [ ] 完整驗證程式後端功能是否正確
- [ ] 完整驗證前端功能是否正確
- [ ]  前後端要對齊功能都要是真的
- [ ] 優化整個前端執行效率要在各種設備上都能流暢運行
- [ ] 前端自適應各種設備的長寬大小比例