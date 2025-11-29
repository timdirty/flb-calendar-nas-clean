(function (global) {
    'use strict';

    // ⚡ 超簡化虛擬清單：僅渲染視窗附近的 N 個
    function mount(container, options) {
        const opts = Object.assign({ itemHeight: 96, overscan: 4, count: 0, renderItem: null }, options || {});
        if (!container) return { setData: function () {} };
        container.style.position = 'relative';
        const spacer = document.createElement('div');
        spacer.style.height = String(opts.itemHeight * opts.count) + 'px';
        container.innerHTML = '';
        container.appendChild(spacer);

        const pool = document.createElement('div');
        pool.style.position = 'absolute';
        pool.style.left = '0';
        pool.style.right = '0';
        pool.style.top = '0';
        container.appendChild(pool);

        function render() {
            const scrollTop = container.scrollTop;
            const height = container.clientHeight;
            const start = Math.max(0, Math.floor(scrollTop / opts.itemHeight) - opts.overscan);
            const end = Math.min(opts.count - 1, Math.ceil((scrollTop + height) / opts.itemHeight) + opts.overscan);
            const items = [];
            for (var i = start; i <= end; i++) {
                const y = i * opts.itemHeight;
                const html = (opts.renderItem && opts.renderItem(i)) || '';
                items.push('<div class="vl-row" style="position:absolute;left:0;right:0;top:' + y + 'px;height:' + opts.itemHeight + 'px">' + html + '</div>');
            }
            pool.innerHTML = items.join('');
        }

        container.addEventListener('scroll', function () { requestAnimationFrame(render); });
        requestAnimationFrame(render);

        return { rerender: render };
    }

    global.FLB = global.FLB || {};
    global.FLB.VirtualList = { mount: mount };
})(window);


