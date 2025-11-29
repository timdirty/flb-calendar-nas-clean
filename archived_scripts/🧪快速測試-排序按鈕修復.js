// 🧪 排序按鈕修復 - 快速測試腳本
// 在瀏覽器控制台執行此腳本來驗證修復效果

console.log('🧪 開始測試排序按鈕功能...\n');
console.log('='.repeat(60));

// 1. 檢查按鈕元素是否存在
console.log('\n📋 測試 1: 檢查按鈕元素');
const sortBtns = document.querySelectorAll('.sort-toggle-btn');
if (sortBtns.length === 2) {
    console.log('✅ 找到 2 個排序按鈕');
    sortBtns.forEach((btn, index) => {
        const sortType = btn.getAttribute('data-sort');
        const isActive = btn.classList.contains('active');
        console.log(`   按鈕 ${index + 1}: ${sortType} ${isActive ? '(已選中)' : ''}`);
    });
} else {
    console.error('❌ 排序按鈕數量不正確:', sortBtns.length);
}

// 2. 檢查全域變數
console.log('\n📋 測試 2: 檢查全域變數');
if (typeof sortDirection !== 'undefined') {
    console.log('✅ sortDirection 已定義:', sortDirection);
} else {
    console.error('❌ sortDirection 未定義');
}

if (typeof currentView !== 'undefined') {
    console.log('✅ currentView 已定義:', currentView);
} else {
    console.error('❌ currentView 未定義');
}

// 3. 檢查 localStorage
console.log('\n📋 測試 3: 檢查 localStorage');
const savedSort = localStorage.getItem('courseSortDirection');
if (savedSort) {
    console.log('✅ localStorage 中有排序設定:', savedSort);
} else {
    console.log('ℹ️  localStorage 中沒有排序設定（首次使用）');
}

// 4. 檢查 CSS 樣式
console.log('\n📋 測試 4: 檢查 CSS 樣式');
const container = document.querySelector('.sort-toggle-container');
if (container) {
    const styles = window.getComputedStyle(container);
    console.log('✅ 容器樣式:');
    console.log('   z-index:', styles.zIndex);
    console.log('   position:', styles.position);
    console.log('   display:', styles.display);
    
    const btn = document.querySelector('.sort-toggle-btn');
    if (btn) {
        const btnStyles = window.getComputedStyle(btn);
        console.log('✅ 按鈕樣式:');
        console.log('   cursor:', btnStyles.cursor);
        console.log('   pointer-events:', btnStyles.pointerEvents);
        console.log('   user-select:', btnStyles.userSelect);
    }
} else {
    console.error('❌ 找不到排序容器');
}

// 5. 檢查事件監聽器
console.log('\n📋 測試 5: 檢查事件監聽器');
if (sortBtns.length > 0) {
    console.log('ℹ️  請在 Chrome DevTools 中檢查按鈕的 Event Listeners');
    console.log('   1. 右鍵點擊排序按鈕');
    console.log('   2. 選擇「檢查」');
    console.log('   3. 在 Elements 面板查看 Event Listeners 標籤');
}

// 6. 模擬點擊測試
console.log('\n📋 測試 6: 模擬點擊測試');
console.log('ℹ️  將在 2 秒後自動模擬點擊...');

setTimeout(() => {
    console.log('\n🖱️ 開始模擬點擊排序按鈕...');
    
    const currentSortDirection = sortDirection;
    const targetBtn = Array.from(sortBtns).find(btn => 
        btn.getAttribute('data-sort') !== currentSortDirection
    );
    
    if (targetBtn) {
        const targetSort = targetBtn.getAttribute('data-sort');
        console.log(`📊 模擬點擊「${targetSort}」按鈕...`);
        
        // 記錄點擊前的狀態
        const beforeClick = {
            sortDirection: sortDirection,
            activeBtn: document.querySelector('.sort-toggle-btn.active')?.getAttribute('data-sort'),
            eventCount: document.querySelectorAll('.event-card').length
        };
        
        console.log('點擊前狀態:', beforeClick);
        
        // 觸發點擊
        targetBtn.click();
        
        // 等待渲染完成後檢查
        setTimeout(() => {
            const afterClick = {
                sortDirection: sortDirection,
                activeBtn: document.querySelector('.sort-toggle-btn.active')?.getAttribute('data-sort'),
                eventCount: document.querySelectorAll('.event-card').length
            };
            
            console.log('點擊後狀態:', afterClick);
            
            // 驗證結果
            if (afterClick.sortDirection === targetSort) {
                console.log('✅ 排序方向已更新');
            } else {
                console.error('❌ 排序方向未更新');
            }
            
            if (afterClick.activeBtn === targetSort) {
                console.log('✅ 按鈕狀態已更新');
            } else {
                console.error('❌ 按鈕狀態未更新');
            }
            
            if (afterClick.eventCount === beforeClick.eventCount) {
                console.log('✅ 課程卡片數量一致');
            } else {
                console.warn('⚠️  課程卡片數量改變:', beforeClick.eventCount, '→', afterClick.eventCount);
            }
            
            console.log('\n✅ 模擬點擊測試完成');
            
            // 顯示測試總結
            displayTestSummary();
        }, 500);
    } else {
        console.error('❌ 找不到目標按鈕');
    }
}, 2000);

// 7. 顯示測試總結
function displayTestSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 測試總結');
    console.log('='.repeat(60));
    
    const issues = [];
    
    // 檢查按鈕
    if (document.querySelectorAll('.sort-toggle-btn').length !== 2) {
        issues.push('排序按鈕數量不正確');
    }
    
    // 檢查全域變數
    if (typeof sortDirection === 'undefined') {
        issues.push('sortDirection 未定義');
    }
    
    if (typeof currentView === 'undefined') {
        issues.push('currentView 未定義');
    }
    
    // 檢查按鈕狀態
    const activeBtns = document.querySelectorAll('.sort-toggle-btn.active');
    if (activeBtns.length !== 1) {
        issues.push(`選中的按鈕數量異常: ${activeBtns.length}`);
    }
    
    // 顯示結果
    if (issues.length === 0) {
        console.log('✅ 所有測試通過！排序功能運作正常。');
    } else {
        console.error('❌ 發現以下問題:');
        issues.forEach((issue, index) => {
            console.error(`   ${index + 1}. ${issue}`);
        });
    }
    
    console.log('\n💡 提示:');
    console.log('   - 手動點擊排序按鈕測試實際體驗');
    console.log('   - 切換不同視圖測試排序是否保持');
    console.log('   - 重新整理頁面測試持久化');
    console.log('\n' + '='.repeat(60));
}

// 8. 提供手動測試函數
console.log('\n💡 可用的手動測試函數:');
console.log('   testSortToggle() - 測試排序切換');
console.log('   resetSort() - 重置排序設定');
console.log('   checkSort() - 檢查當前排序狀態');

window.testSortToggle = function() {
    console.log('\n🔄 手動觸發排序切換...');
    const btn = document.querySelector('.sort-toggle-btn:not(.active)');
    if (btn) {
        btn.click();
        console.log('✅ 已觸發排序切換');
    } else {
        console.error('❌ 找不到未選中的按鈕');
    }
};

window.resetSort = function() {
    console.log('\n🔄 重置排序設定...');
    localStorage.removeItem('courseSortDirection');
    sortDirection = 'near-to-far';
    document.querySelectorAll('.sort-toggle-btn').forEach(btn => {
        if (btn.getAttribute('data-sort') === 'near-to-far') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderEvents();
    console.log('✅ 已重置為「由近到遠」');
};

window.checkSort = function() {
    console.log('\n📊 當前排序狀態:');
    console.log('   全域變數:', sortDirection);
    console.log('   localStorage:', localStorage.getItem('courseSortDirection'));
    console.log('   選中按鈕:', document.querySelector('.sort-toggle-btn.active')?.getAttribute('data-sort'));
    
    const cards = document.querySelectorAll('.event-card');
    console.log('   課程卡片數量:', cards.length);
    
    if (cards.length > 0) {
        console.log('   前 3 個課程:');
        Array.from(cards).slice(0, 3).forEach((card, index) => {
            const time = card.querySelector('.event-time')?.textContent;
            const title = card.querySelector('.event-title')?.textContent;
            console.log(`      ${index + 1}. ${time} - ${title}`);
        });
    }
};

console.log('\n✨ 測試腳本載入完成！等待自動測試...');

