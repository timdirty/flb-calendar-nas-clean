(function (global) {
    'use strict';

    function attachSwipe(el, opts) {
        if (!el) return function () { };
        const options = Object.assign({ thresholdRatio: 0.3, onNext: null, onPrev: null }, opts || {});
        let startX = 0;
        let startY = 0;
        let deltaX = 0;
        let deltaY = 0;
        let active = false;
        let isHorizontal = false; // 🔥 標記是否為水平滑動

        function onStart(e) {
            const t = e.touches ? e.touches[0] : e;
            startX = t.clientX;
            startY = t.clientY;
            deltaX = 0;
            deltaY = 0;
            active = true;
            isHorizontal = false; // 重置
        }
        function onMove(e) {
            if (!active) return;
            const t = e.touches ? e.touches[0] : e;
            deltaX = t.clientX - startX;
            deltaY = t.clientY - startY;

            // 🔥 判斷滑動方向：只有當水平位移明顯大於垂直位移時才視為水平滑動
            if (!isHorizontal && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
            }

            // 🔥 只有在確定是水平滑動時才處理，否則讓瀏覽器處理垂直滾動
            if (isHorizontal) {
                const width = el.clientWidth || 1;
                if (typeof options.onMove === 'function') {
                    options.onMove(deltaX, width, deltaX / width);
                }
            }
        }
        function onEnd() {
            if (!active) return;

            // 🔥 只有在確定是水平滑動時才觸發 swipe 回調
            if (isHorizontal) {
                const width = el.clientWidth || 1;
                const ratio = Math.abs(deltaX) / width;
                if (ratio >= options.thresholdRatio) {
                    if (deltaX < 0 && typeof options.onNext === 'function') options.onNext();
                    if (deltaX > 0 && typeof options.onPrev === 'function') options.onPrev();
                } else if (typeof options.onCancel === 'function') {
                    options.onCancel();
                }
                if (typeof options.onMoveEnd === 'function') {
                    options.onMoveEnd();
                }
            }

            startX = 0; startY = 0; deltaX = 0; deltaY = 0; active = false; isHorizontal = false;
        }

        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: true });
        el.addEventListener('touchend', onEnd, { passive: true });
        el.addEventListener('pointerdown', onStart);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onEnd);

        return function detach() {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
            el.removeEventListener('pointerdown', onStart);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onEnd);
        };
    }

    global.FLB = global.FLB || {};
    global.FLB.UI = global.FLB.UI || {};
    global.FLB.UI.Swipe = { attach: attachSwipe };
})(window);


