/**
 * 🌐 瀏覽器 Console 測試腳本 - Grid 佈局驗證（完整版）
 * 
 * 使用方法：
 * 1. 打開課程總覽頁面
 * 2. 按 F12 打開開發者工具
 * 3. 複製以下代碼到 Console 中執行
 */

(function() {
    console.log('📋 Grid 佈局即時驗證（完整版）');
    console.log('─'.repeat(60));
    
    // 1. 檢查修復函數是否存在
    console.log('\n🔍 檢查修復函數:');
    if (typeof ensureOverviewGridStyle === 'function') {
        console.log('  ✅ ensureOverviewGridStyle 函數存在');
        // 手動觸發一次
        try {
            ensureOverviewGridStyle();
            console.log('  ✅ 手動觸發修復成功');
        } catch (e) {
            console.log('  ❌ 手動觸發失敗:', e.message);
        }
    } else {
        console.log('  ❌ ensureOverviewGridStyle 函數不存在（可能 JS 未載入）');
    }
    
    // 2. 檢查容器狀態
    const containers = [
        { id: 'overviewPhotosPreviews', name: '待上傳預覽' },
        { id: 'overviewExistingPreviews', name: '已上傳預覽' }
    ];
    
    console.log('\n📦 檢查容器狀態:');
    containers.forEach(container => {
        const el = document.getElementById(container.id);
        if (!el) {
            console.log(`  ❌ ${container.name}: 元素不存在`);
            return;
        }
        
        console.log(`\n  📦 ${container.name}:`);
        
        // 檢查內聯樣式
        const inlineStyle = el.style.cssText;
        console.log(`    內聯樣式: ${inlineStyle.substring(0, 100)}...`);
        
        // 檢查計算後的樣式
        const computed = window.getComputedStyle(el);
        const display = computed.display;
        const gridTemplateColumns = computed.gridTemplateColumns;
        const gap = computed.gap;
        
        console.log(`    display: ${display} ${display === 'grid' ? '✅' : '❌'}`);
        console.log(`    grid-template-columns: ${gridTemplateColumns}`);
        console.log(`    gap: ${gap}`);
        
        if (display !== 'grid') {
            console.log(`    ⚠️ 警告: display 不是 grid，嘗試手動修復...`);
            if (typeof ensureOverviewGridStyle === 'function') {
                ensureOverviewGridStyle();
                console.log(`    ✅ 已重新設置 Grid 樣式`);
            }
        }
        
        // 檢查子元素數量
        const previewCount = el.querySelectorAll('.file-preview').length;
        console.log(`    子元素數量: ${previewCount}`);
    });
    
    console.log('\n─'.repeat(60));
    console.log('✅ 驗證完成');
    console.log('\n💡 提示:');
    console.log('  - 如果 display 不是 grid，請檢查 Console 是否有錯誤訊息');
    console.log('  - 確認 JS 版本號: learning-record-upload.js?v=20251119-grid-fix-final');
    console.log('  - 如需強制修復，執行: ensureOverviewGridStyle()');
})();
