// ============================================
// 圖片懶載入（IntersectionObserver 版）
// 版本：2025-11-01
// ============================================
(function () {
    'use strict';

    function initLazyImages() {
        if (!('IntersectionObserver' in window)) return; // 瀏覽器不支援則跳過

        const imgs = document.querySelectorAll('img[data-src]');
        if (!imgs.length) return;

        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                const src = img.getAttribute('data-src');
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                }
                obs.unobserve(img);
            });
        }, { rootMargin: '200px 0px' });

        imgs.forEach(img => io.observe(img));
        console.log(`✅ 懶載入圖片已啟用 (${imgs.length} 張)`);
    }

    window.initLazyImages = initLazyImages;
})();

