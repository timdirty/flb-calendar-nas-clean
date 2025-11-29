// =========================================
// 設定管理員 - 超級兼容版本
// =========================================
// 
// 如果 fetch 方法不行，使用這個版本
// 直接複製整個內容到控制台執行
//
// =========================================

(function() {
    console.log('開始設定管理員...');
    
    var adminUserId = 'Udb51363eb6fdc605a6a9816379a38103';
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/set', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    console.log('✅ 管理員設定成功！');
                    console.log('管理員 ID:', adminUserId);
                    console.log('詳細資料:', data);
                    alert('✅ 管理員設定成功！\n\n管理員 ID: ' + adminUserId);
                } else {
                    console.error('❌ 設定失敗:', data.message || '未知錯誤');
                    alert('❌ 設定失敗\n\n錯誤: ' + (data.message || '未知錯誤'));
                }
            } catch (e) {
                console.error('❌ 解析回應失敗:', e);
                console.log('原始回應:', xhr.responseText);
                alert('❌ 解析回應失敗\n\n請查看控制台');
            }
        } else {
            console.error('❌ 請求失敗:', xhr.status, xhr.statusText);
            alert('❌ 請求失敗\n\n狀態碼: ' + xhr.status);
        }
    };
    
    xhr.onerror = function() {
        console.error('❌ 網路錯誤');
        alert('❌ 網路錯誤\n\n請檢查連接');
    };
    
    var payload = JSON.stringify({
        adminUserId: adminUserId
    });
    
    console.log('發送請求:', payload);
    xhr.send(payload);
})();

