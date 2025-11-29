// =========================================
// 快速設定管理員腳本
// =========================================
// 
// 使用方法：
// 1. 在瀏覽器中打開 https://calendar.funlearnbar.synology.me
// 2. 打開開發者工具（F12）
// 3. 切換到 Console（控制台）
// 4. 複製並貼上這整個腳本
// 5. 按 Enter 執行
//
// =========================================

(async function() {
    console.log('═══════════════════════════════════════════');
    console.log('  🔐 FLB 行事曆系統 - 管理員快速設定');
    console.log('═══════════════════════════════════════════\n');

    const ADMIN_USER_ID = 'Udb51363eb6fdc605a6a9816379a38103';

    // 步驟 1: 檢查當前管理員設定
    console.log('📌 步驟 1/3: 檢查當前管理員設定...');
    try {
        const response = await fetch('/api/admin/info');
        const data = await response.json();
        
        if (data.success && data.data && data.data.userId) {
            console.log('✅ 管理員已設定');
            console.log('👤 User ID:', data.data.userId);
            console.log('📛 名稱:', data.data.name || '未知');
            
            if (data.data.userId === ADMIN_USER_ID) {
                console.log('\n🎉 管理員設定正確！無需重新設定。\n');
                console.log('═══════════════════════════════════════════\n');
                return;
            } else {
                console.log('⚠️ 當前管理員 ID 與預期不符，將重新設定...\n');
            }
        } else {
            console.log('⚠️ 尚未設定管理員，準備設定...\n');
        }
    } catch (error) {
        console.error('❌ 檢查管理員設定失敗:', error);
        console.log('⚠️ 繼續執行設定流程...\n');
    }

    // 步驟 2: 設定管理員
    console.log('📌 步驟 2/3: 設定管理員...');
    console.log('👤 管理員 User ID:', ADMIN_USER_ID);
    
    try {
        const response = await fetch('/api/admin/set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                adminUserId: ADMIN_USER_ID
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ 管理員設定成功！');
            if (data.data) {
                console.log('📋 管理員資訊:', data.data);
            }
        } else {
            console.error('❌ 設定失敗:', data.message || '未知錯誤');
            console.log('\n═══════════════════════════════════════════\n');
            return;
        }
    } catch (error) {
        console.error('❌ 設定管理員時發生錯誤:', error);
        console.log('\n═══════════════════════════════════════════\n');
        return;
    }

    // 步驟 3: 驗證設定
    console.log('\n📌 步驟 3/3: 驗證設定...');
    
    try {
        const response = await fetch('/api/admin/info');
        const data = await response.json();
        
        if (data.success && data.data && data.data.userId === ADMIN_USER_ID) {
            console.log('✅ 驗證成功！管理員設定正確。');
            console.log('👤 User ID:', data.data.userId);
            console.log('📛 名稱:', data.data.name || '未知');
            console.log('🔔 狀態:', data.data.isSet ? '已啟用' : '未啟用');
        } else {
            console.log('⚠️ 驗證失敗，請手動檢查設定');
        }
    } catch (error) {
        console.error('❌ 驗證失敗:', error);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  🎉 管理員設定完成！');
    console.log('═══════════════════════════════════════════');
    console.log('\n接下來您可以：');
    console.log('1. 使用學生簽到功能');
    console.log('2. 接收學生簽到通知');
    console.log('3. 接收課程提醒通知');
    console.log('\n如需查看設定頁面，請訪問：');
    console.log('https://calendar.funlearnbar.synology.me/設定管理員.html\n');

})();

