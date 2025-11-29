/**
 * 測試在 URL 中傳遞 SID
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadSidInUrl() {
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
    fs.writeFileSync(testFilePath, 'Hello World from URL SID');
    
    console.log('📤 方法 1: SID 在 URL 參數中...');
    
    // 方法 1：SID 在 URL 參數中
    const formData1 = new FormData();
    formData1.append('api', 'SYNO.FileStation.Upload');
    formData1.append('version', '2');
    formData1.append('method', 'upload');
    formData1.append('path', '/home');
    formData1.append('overwrite', 'true');
    // 不在 form data 中添加 _sid
    
    const fileStream1 = fs.createReadStream(testFilePath);
    formData1.append('file', fileStream1, {
        filename: 'test-upload.txt',
        contentType: 'text/plain'
    });
    
    try {
        // 在 URL 中添加 SID
        const uploadUrl1 = `${apiUrl}?_sid=${sid}`;
        const uploadResponse1 = await axiosInstance.post(uploadUrl1, formData1, {
            headers: formData1.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        if (uploadResponse1.data && uploadResponse1.data.success) {
            console.log('✅ 成功！（SID 在 URL 中）\n');
            fs.unlinkSync(testFilePath);
            return true;
        } else {
            const errorCode = uploadResponse1.data?.error?.code || 'unknown';
            console.log(`❌ 失敗 (error ${errorCode})\n`);
        }
    } catch (error) {
        console.log(`❌ 請求失敗: ${error.message}\n`);
    }
    
    // 重新創建檔案（前一個可能已經被消耗）
    fs.writeFileSync(testFilePath, 'Hello World from URL SID');
    
    console.log('📤 方法 2: 完整 URL 參數（不用 form 中的 api/version/method）...');
    
    // 方法 2：所有參數都在 URL 中
    const formData2 = new FormData();
    const fileStream2 = fs.createReadStream(testFilePath);
    formData2.append('file', fileStream2, {
        filename: 'test-upload.txt',
        contentType: 'text/plain'
    });
    
    try {
        const uploadUrl2 = `${apiUrl}?` + new URLSearchParams({
            api: 'SYNO.FileStation.Upload',
            version: '2',
            method: 'upload',
            path: '/home',
            overwrite: 'true',
            _sid: sid
        }).toString();
        
        const uploadResponse2 = await axiosInstance.post(uploadUrl2, formData2, {
            headers: formData2.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        if (uploadResponse2.data && uploadResponse2.data.success) {
            console.log('✅ 成功！（所有參數在 URL 中）\n');
            fs.unlinkSync(testFilePath);
            return true;
        } else {
            const errorCode = uploadResponse2.data?.error?.code || 'unknown';
            console.log(`❌ 失敗 (error ${errorCode})\n`);
        }
    } catch (error) {
        console.log(`❌ 請求失敗: ${error.message}\n`);
    }
    
    // 清理
    if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
    }
    
    console.log('❌ 兩種方法都失敗');
}

testUploadSidInUrl();

