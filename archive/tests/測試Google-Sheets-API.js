// =========================================
// Google Sheets API 測試腳本
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
    console.log('  📊 Google Sheets API 完整測試');
    console.log('═══════════════════════════════════════════\n');

    const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev';

    // 測試 1: 測試後端代理連接
    console.log('📌 測試 1/3: 測試後端代理連接');
    console.log('─────────────────────────────────────────\n');

    try {
        // 準備測試數據（使用正確的格式）
        const testPayload = {
            action: "update",
            name: "測試學生_Cooper",
            date: new Date().toISOString().split('T')[0],  // 今天的日期
            present: true
        };

        console.log('📤 發送測試數據:');
        console.log('   API URL:', GOOGLE_SHEETS_URL);
        console.log('   Payload:', JSON.stringify(testPayload, null, 2));

        const proxyResponse = await fetch('/api/proxy/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateAttendance',
                googleSheetsUrl: GOOGLE_SHEETS_URL,
                payload: testPayload
            })
        });

        console.log('📥 後端代理回應狀態:', proxyResponse.status, proxyResponse.statusText);

        if (!proxyResponse.ok) {
            throw new Error(`後端代理請求失敗: ${proxyResponse.status} ${proxyResponse.statusText}`);
        }

        const proxyData = await proxyResponse.text();
        console.log('📥 後端代理回應內容:', proxyData);

        let parsedData;
        try {
            parsedData = JSON.parse(proxyData);
            console.log('📥 解析後的數據:', parsedData);
        } catch (e) {
            console.log('⚠️ 回應不是 JSON 格式，使用原始文字');
            parsedData = { raw: proxyData };
        }

        if (parsedData.success !== false) {
            console.log('✅ 測試 1 通過: 後端代理連接正常\n');
        } else {
            console.log('❌ 測試 1 失敗:', parsedData.error || parsedData.message);
            console.log('');
        }
    } catch (error) {
        console.error('❌ 測試 1 失敗:', error.message);
        console.error('錯誤詳情:', error);
        console.log('');
    }

    // 測試 2: 測試出席記錄
    console.log('📌 測試 2/3: 測試出席記錄（Present）');
    console.log('─────────────────────────────────────────\n');

    try {
        const presentPayload = {
            action: "update",
            name: "測試學生_Andy",
            date: new Date().toISOString().split('T')[0],
            present: true
        };

        console.log('📤 發送出席記錄:', JSON.stringify(presentPayload, null, 2));

        const presentResponse = await fetch('/api/proxy/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateAttendance',
                googleSheetsUrl: GOOGLE_SHEETS_URL,
                payload: presentPayload
            })
        });

        const presentData = await presentResponse.text();
        console.log('📥 回應:', presentData);

        if (presentResponse.ok) {
            console.log('✅ 測試 2 通過: 出席記錄發送成功\n');
        } else {
            console.log('❌ 測試 2 失敗\n');
        }
    } catch (error) {
        console.error('❌ 測試 2 失敗:', error.message);
        console.log('');
    }

    // 測試 3: 測試缺席記錄
    console.log('📌 測試 3/3: 測試缺席記錄（Absent）');
    console.log('─────────────────────────────────────────\n');

    try {
        const absentPayload = {
            action: "update",
            name: "測試學生_Byron",
            date: new Date().toISOString().split('T')[0],
            present: false
        };

        console.log('📤 發送缺席記錄:', JSON.stringify(absentPayload, null, 2));

        const absentResponse = await fetch('/api/proxy/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateAttendance',
                googleSheetsUrl: GOOGLE_SHEETS_URL,
                payload: absentPayload
            })
        });

        const absentData = await absentResponse.text();
        console.log('📥 回應:', absentData);

        if (absentResponse.ok) {
            console.log('✅ 測試 3 通過: 缺席記錄發送成功\n');
        } else {
            console.log('❌ 測試 3 失敗\n');
        }
    } catch (error) {
        console.error('❌ 測試 3 失敗:', error.message);
        console.log('');
    }

    console.log('═══════════════════════════════════════════');
    console.log('  📊 測試結果總結');
    console.log('═══════════════════════════════════════════\n');

    console.log('✅ Google Sheets API 測試完成！');
    console.log('\n請檢查 Google Sheets 中是否出現以下測試記錄：');
    console.log('  • 測試學生_Cooper (出席)');
    console.log('  • 測試學生_Andy (出席)');
    console.log('  • 測試學生_Byron (缺席)');
    console.log('\n⚠️ 這些是測試記錄，可以手動刪除。\n');

    console.log('═══════════════════════════════════════════\n');

})();

// =========================================
// 手動測試單個學生簽到
// =========================================
// 
// 如果需要測試特定學生的簽到，可以使用以下函數：
//

window.testStudentAttendance = async function(studentName, isPresent = true) {
    console.log(`\n🧪 測試學生簽到: ${studentName} (${isPresent ? '出席' : '缺席'})`);
    console.log('─────────────────────────────────────────\n');

    const payload = {
        action: "update",
        name: studentName,
        date: new Date().toISOString().split('T')[0],
        present: isPresent
    };

    console.log('📤 發送數據:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('/api/proxy/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateAttendance',
                googleSheetsUrl: 'https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev',
                payload: payload
            })
        });

        const data = await response.text();
        console.log('📥 回應:', data);

        if (response.ok) {
            console.log(`✅ ${studentName} 的${isPresent ? '出席' : '缺席'}記錄已發送\n`);
            return { success: true, data };
        } else {
            console.log(`❌ ${studentName} 的簽到記錄發送失敗\n`);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ 錯誤:', error);
        return { success: false, error: error.message };
    }
};

console.log('\n💡 提示: 您現在可以使用以下命令測試單個學生:');
console.log('   testStudentAttendance("Cooper", true)   // 測試 Cooper 出席');
console.log('   testStudentAttendance("Andy", false)    // 測試 Andy 缺席\n');

