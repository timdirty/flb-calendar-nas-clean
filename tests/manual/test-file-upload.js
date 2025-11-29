/**
 * 使用實際檔案測試上傳
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testFileUpload() {
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
    
    // 創建臨時測試檔案
    const testFilePath = path.join(__dirname, 'temp-test-file.txt');
    fs.writeFileSync(testFilePath, 'Hello World from File');
    console.log('📝 創建臨時測試檔案:', testFilePath);
    
    // 嘗試上傳到 /home
    console.log('\n📤 上傳到 /home...');
    
    const formData = new FormData();
    formData.append('api', 'SYNO.FileStation.Upload');
    formData.append('version', '2');
    formData.append('method', 'upload');
    formData.append('path', '/home');  // 目標目錄
    formData.append('create_parents', 'false');
    formData.append('overwrite', 'true');
    formData.append('_sid', sid);
    
    // 使用檔案串流
    const fileStream = fs.createReadStream(testFilePath);
    formData.append('file', fileStream, {
        filename: 'uploaded-test-file.txt',
        contentType: 'text/plain'
    });
    
    try {
        console.log('📦 發送請求...');
        
        const uploadResponse = await axiosInstance.post(apiUrl, formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        console.log('📦 API 回應:', JSON.stringify(uploadResponse.data, null, 2));
        
        if (uploadResponse.data && uploadResponse.data.success) {
            console.log('\n✅ 上傳成功！');
        } else {
            const errorCode = uploadResponse.data?.error?.code || 'unknown';
            console.log(`\n❌ 上傳失敗: error code ${errorCode}`);
        }
    } catch (error) {
        console.error('\n❌ 請求失敗:', error.message);
        if (error.response) {
            console.log('📦 錯誤回應:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        // 清理臨時檔案
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
            console.log('\n🗑️  已清理臨時檔案');
        }
    }
}

testFileUpload();

