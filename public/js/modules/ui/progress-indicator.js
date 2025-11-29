(function (global) {
    'use strict';

    function mount(container, options) {
        if (!container) return { update: function () {} };
        const opts = Object.assign({ onOpenItem: null }, options || {});
        container.className = (container.className || '') + ' lr-progress-indicator';
        container.innerHTML = [
            '<div class="lr-progress-bar"><div class="lr-progress-fill" style="width:0%"></div></div>',
            '<div class="lr-progress-text"><span class="percent">0%</span> <span class="summary"></span><button class="toggle">詳情</button></div>',
            '<div class="lr-progress-detail" style="display:none"></div>'
        ].join('');

        const fill = container.querySelector('.lr-progress-fill');
        const percentEl = container.querySelector('.percent');
        const summaryEl = container.querySelector('.summary');
        const detailEl = container.querySelector('.lr-progress-detail');
        const toggleBtn = container.querySelector('.toggle');

        toggleBtn.addEventListener('click', function () {
            const visible = detailEl.style.display !== 'none';
            detailEl.style.display = visible ? 'none' : 'block';
        });

        function update(data) {
            try {
                const p = Math.max(0, Math.min(100, Math.round(data.percent || 0)));
                fill.style.width = p + '%';
                percentEl.textContent = String(p) + '%';
                summaryEl.textContent = (data.completed || 0) + '/' + (data.total || 0);
                const lines = [];
                (data.unfinished || []).forEach(function (item) {
                    const t = item.type === 'overview' ? '課程總覽' : (item.name || '未知學生');
                    lines.push('<div class="detail-row" data-kind="' + (item.type || 'student') + '" data-index="' + (item.index || 0) + '">' + t + '：' + (item.reason || '未完成') + '</div>');
                });
                detailEl.innerHTML = lines.join('') || '<div class="detail-empty">目前沒有未完成項目</div>';
                Array.prototype.forEach.call(detailEl.querySelectorAll('.detail-row'), function (row) {
                    row.addEventListener('click', function () {
                        if (typeof opts.onOpenItem === 'function') {
                            const idx = parseInt(row.getAttribute('data-index') || '0', 10);
                            const kind = row.getAttribute('data-kind') || 'student';
                            opts.onOpenItem({ kind: kind, index: idx });
                        }
                    });
                });
            } catch (e) { console.error('❌ 更新進度失敗:', e); }
        }

        return { update: update };
    }

    global.FLB = global.FLB || {};
    global.FLB.UI = global.FLB.UI || {};
    global.FLB.UI.ProgressIndicator = { mount: mount };
})(window);


