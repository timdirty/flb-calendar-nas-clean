// ============================================
// Skeleton 骨架屏（低動畫版）
// 版本：2025-11-01
// ============================================
(function () {
    'use strict';

    function html(strings, ...args) {
        return strings.reduce((s, v, i) => s + v + (args[i] || ''), '');
    }

    function showTodaySkeleton() {
        const grid = document.getElementById('todayEventsGrid');
        if (!grid) return;
        const items = Array.from({ length: 3 }).map(() => html`
            <div class="today-event-card skeleton-card">
                <div class="skeleton-line time"></div>
                <div class="skeleton-block title"></div>
                <div class="skeleton-line meta"></div>
            </div>
        `).join('');
        grid.innerHTML = items;
    }

    function showCalendarSkeleton(columns) {
        const container = document.getElementById('calendarView');
        if (!container) return;
        const cols = columns || 8;
        const headers = ['日','一','二','三','四','五','六'].concat(cols === 8 ? ['日'] : []).map(d => `<div class="calendar-day-header skeleton-block">${d}</div>`).join('');
        const cells = Array.from({ length: cols }).map(() => html`
            <div class="calendar-day skeleton-day">
                <div class="skeleton-line day"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>
        `).join('');
        container.innerHTML = `<div class="calendar-grid ${cols===8?'calendar-grid-8':''}">${headers}${cells}</div>`;
    }

    window.SkeletonUI = {
        showTodaySkeleton,
        showCalendarSkeleton
    };

    console.log('✅ Skeleton 模組已載入');
})();

