/**
 * 測試帳號權限
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');

async function testPermissions() {
    const host = process.env.SYNOLOGY_HOST;
    const port = process.env.SYNOLOGY_PORT;
    const protocol = process.env.SYNOLOGY_PROTOCOL;
    const username = process.env.SYNOLOGY_USERNAME;
    const password = process.env.SYNOLOGY_PASSWORD;
    
    const baseUrl = `${protocol}://${host}:${port}`;
    const apiUrl = `${baseUrl}/webapi/entry.cgi`;
    
    const axiosInstance = axios.create({
        httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
        })
    });
    
    console.log('🔐 登入...');
    
    // 登入
    const loginParams = new URLSearchParams({
        api: 'SYNO.API.Auth',
        version: '3',
        method: 'login',
        account: username,
        passwd: password,
        session: 'FileStation',
        format: 'sid'
    });
    
    const loginResponse = await axiosInstance.post(apiUrl, loginParams);
    const sid = loginResponse.data.data.sid;
    console.log('✅ 登入成功\n');
    
    // 測試 1：列出 /home 目錄
    console.log('📂 測試 1: 列出 /home 目錄...');
    try {
        const response = await axiosInstance.get(apiUrl, {
            params: {
                api: 'SYNO.FileStation.List',
                version: '2',
                method: 'list',
                folder_path: '/home',
                _sid: sid
            }
        });
        
        if (response.data.success) {
            console.log(`✅ 成功列出 /home，找到 ${response.data.data.files.length} 個檔案`);
        } else {
            console.log(`❌ 失敗 (error ${response.data.error.code})`);
        }
    } catch (error) {
        console.log(`❌ 請求失敗: ${error.message}`);
    }
    
    // 測試 2：嘗試創建資料夾
    console.log('\n📁 測試 2: 創建資料夾 /home/test-folder...');
    try {
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.CreateFolder',
            version: '2',
            method: 'create',
            folder_path: '/home',
            name: 'test-folder-' + Date.now(),
            force_parent: 'true',
            _sid: sid
        });
        
        const response = await axiosInstance.post(apiUrl, params);
        
        if (response.data.success) {
            console.log('✅ 成功創建資料夾');
        } else {
            const errorCode = response.data.error.code;
            console.log(`❌ 失敗 (error ${errorCode})`);
            
            const errorMessages = {
                402: 'Permission denied - 帳號沒有寫入權限',
                403: 'Permission denied',
                1100: '資料夾已存在（這是正常的）'
            };
            
            if (errorMessages[errorCode]) {
                console.log(`💡 錯誤說明: ${errorMessages[errorCode]}`);
            }
        }
    } catch (error) {
        console.log(`❌ 請求失敗: ${error.message}`);
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log('💡 診斷結果：');
    console.log('  如果測試 1 和 2 都成功，表示帳號有基本權限');
    console.log('  如果都失敗，可能是帳號權限不足');
    console.log('  建議檢查 NAS 上該帳號的 FileStation 權限設定');
}

testPermissions();

