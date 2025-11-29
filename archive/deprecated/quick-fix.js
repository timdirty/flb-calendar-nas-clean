// 🚑 快速修復腳本 - 移除載入動畫

console.log('🚑 快速修復：移除載入動畫');

// 1. 移除 HTML 中的載入遮罩
const loadingOverlay = document.getElementById('loadingOverlay');
if (loadingOverlay) {
    loadingOverlay.remove();
    console.log('✅ 移除 #loadingOverlay');
}

// 2. 移除動態創建的載入遮罩
document.querySelectorAll('#optimized-loading-overlay, .loading-overlay, .student-loading-overlay').forEach(el => {
    el.remove();
    console.log('✅ 移除動態載入遮罩');
});

// 3. 確保頁面可互動
document.body.style.pointerEvents = 'auto';
document.body.style.overflow = 'auto';

// 4. 檢查並手動載入資料（如果需要）
setTimeout(() => {
    const eventsContainer = document.getElementById('eventsContainer');
    if (eventsContainer && eventsContainer.children.length === 0) {
        console.log('⚠️ 沒有課程資料，嘗試手動載入...');
        
        // 嘗試調用載入函數
        if (typeof window.EventManager !== 'undefined' && typeof window.EventManager.loadEvents === 'function') {
            console.log('📋 執行 EventManager.loadEvents()...');
            window.EventManager.loadEvents()
                .then(() => console.log('✅ 課程載入成功'))
                .catch(err => console.error('❌ 課程載入失敗:', err));
        } else if (typeof window.initApp === 'function') {
            console.log('📋 執行 initApp()...');
            window.initApp()
                .then(() => console.log('✅ 初始化成功'))
                .catch(err => console.error('❌ 初始化失敗:', err));
        } else {
            console.error('❌ 找不到載入函數');
        }
    } else {
        console.log('✅ 頁面已有內容');
    }
}, 1000);

console.log('✅ 快速修復完成！');
