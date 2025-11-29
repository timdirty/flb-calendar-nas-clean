(function (global) {
    'use strict';

    const ATTENDANCE_META = {
        present: { icon: '✔', label: '已出席' },
        leave: { icon: '🏥', label: '已請假' },
        absent: { icon: '✖', label: '缺席' },
        unknown: { icon: '•', label: '尚未紀錄' }
    };

    function escapeAttr(value) {
        return String(value == null ? '' : value).replace(/"/g, '&quot;');
    }

    function render(container, students, currentIndex, getStatus, onSelect) {
        if (!container) return;
        const html = (students || []).map(function (s, i) {
            const st = (getStatus && getStatus(i, s)) || { done: false };
            const active = i === currentIndex ? ' active' : '';
            const clsBase = st.done ? 'done' : 'todo';
            const clsNeedsVideo = st.needsVideo ? ' needs-video' : '';
            const attendance = (s && s.attendanceStatus) || 'unknown';
            const meta = ATTENDANCE_META[attendance] || ATTENDANCE_META.unknown;
            const name = (s && s.name) || String(s || '');
            const percent = typeof st.percent === 'number' ? Math.max(0, Math.min(100, Math.round(st.percent))) : null;
            const percentAttr = percent !== null ? ' data-percent="' + percent + '"' : '';
            const message = (s && s.attendanceMessage) || (st.attendanceMessage) || meta.label;
            const titleAttr = message ? ' title="' + escapeAttr(message) + '"' : '';
            const needsBadge = st.needsVideo ? '<span class="optional-pill">影片（選）</span>' : '';
            const attClass = ' att-' + attendance;
            return '<button class="tab-item ' + clsBase + clsNeedsVideo + attClass + active + '" data-idx="' + i + '" data-status="' + attendance + '"' + percentAttr + titleAttr + '>' +
                needsBadge +
                '<span class="tab-shell"><span class="att-icon">' + meta.icon + '</span><span class="name">' + name + '</span></span>' +
                '</button>';
        }).join('');
        container.innerHTML = html;
        Array.prototype.forEach.call(container.querySelectorAll('.tab-item'), function (btn) {
            btn.addEventListener('click', function () {
                const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
                if (typeof onSelect === 'function') onSelect(idx);
            });
        });
    }

    global.FLB = global.FLB || {};
    global.FLB.UI = global.FLB.UI || {};
    global.FLB.UI.BottomTabs = { render: render };
})(window);
