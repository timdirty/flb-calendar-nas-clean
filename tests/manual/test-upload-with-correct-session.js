/**
 * 測試正確的 session 設定上傳
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadWithCorrectSession() {
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
    
    console.log('🔐 測試不同的 session 名稱...\n');
    
    // 測試不同的 session 名稱
    const sessions = [
        'FileStation',
        'DownloadStation',
        'SurveillanceStation',
        'webapi'
    ];
    
    for (const sessionName of sessions) {
        console.log(`📝 測試 session: ${sessionName}`);
        
        // 登入
        const loginParams = new URLSearchParams({
            api: 'SYNO.API.Auth',
            version: '3',
            method: 'login',
            account: username,
            passwd: password,
            session: sessionName,
            format: 'sid'
        });
        
        let sid;
        try {
            const loginResponse = await axiosInstance.post(apiUrl, loginParams);
            if (!loginResponse.data.success) {
                console.log(`  ❌ 登入失敗\n`);
                continue;
            }
            sid = loginResponse.data.data.sid;
            console.log(`  ✅ 登入成功`);
        } catch (error) {
            console.log(`  ❌ 登入失敗: ${error.message}\n`);
            continue;
        }
        
        // 創建臨時測試檔案
        const testFilePath = path.join(__dirname, 'temp-test-file.txt');
        fs.writeFileSync(testFilePath, `Test from ${sessionName}`);
        
        // 嘗試上傳
        const formData = new FormData();
        formData.append('api', 'SYNO.FileStation.Upload');
        formData.append('version', '2');
        formData.append('method', 'upload');
        formData.append('path', '/home');
        formData.append('overwrite', 'true');
        formData.append('_sid', sid);
        
        const fileStream = fs.createReadStream(testFilePath);
        formData.append('file', fileStream, {
            filename: 'test-upload.txt',
            contentType: 'text/plain'
        });
        
        try {
            const uploadResponse = await axiosInstance.post(apiUrl, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            
            if (uploadResponse.data && uploadResponse.data.success) {
                console.log(`  ✅ 上傳成功！\n`);
                console.log('🎉 找到可用的 session:', sessionName);
                
                // 清理
                fs.unlinkSync(testFilePath);
                return sessionName;
            } else {
                const errorCode = uploadResponse.data?.error?.code || 'unknown';
                console.log(`  ❌ 上傳失敗 (error ${errorCode})\n`);
            }
        } catch (error) {
            console.log(`  ❌ 請求失敗: ${error.message}\n`);
        }
        
        // 清理
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
    
    console.log('❌ 所有 session 都無法上傳檔案');
}

testUploadWithCorrectSession();

