/**
 * 簡單的檔案上傳測試 - 診斷 error 119
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');

async function simpleUploadTest() {
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
    
    // 1. 登入
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
    console.log('✅ 登入成功，SID:', sid.substring(0, 8) + '****\n');
    
    // 2. 測試多個路徑
    const testPaths = ['/home', '/Fun Learn Bar', '/課程照片記錄'];
    
    for (const testPath of testPaths) {
        console.log(`📤 測試上傳到 "${testPath}"...`);
        
        const testContent = `Hello from ${testPath}`;
        const testBuffer = Buffer.from(testContent, 'utf8');
        
        const formData = new FormData();
        formData.append('api', 'SYNO.FileStation.Upload');
        formData.append('version', '2');
        formData.append('method', 'upload');
        formData.append('path', testPath);
        formData.append('create_parents', 'false');
        formData.append('overwrite', 'true');
        formData.append('_sid', sid);
        
        // 添加檔案（使用 Stream）
        const { Readable } = require('stream');
        const bufferStream = Readable.from(testBuffer);
        formData.append('file', bufferStream, {
            filename: 'test-simple.txt',
            contentType: 'text/plain',
            knownLength: testBuffer.length
        });
        
        try {
            const uploadResponse = await axiosInstance.post(apiUrl, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            
            if (uploadResponse.data && uploadResponse.data.success) {
                console.log(`✅ 成功上傳到 "${testPath}"`);
            } else {
                const errorCode = uploadResponse.data?.error?.code || 'unknown';
                console.log(`❌ 失敗 (error ${errorCode})`);
            }
        } catch (error) {
            console.error(`❌ 請求失敗: ${error.message}`);
        }
        
        console.log(''); // 空行分隔
    }
    
    console.log('─'.repeat(60));
    console.log('💡 建議：');
    console.log('  如果 /home 成功，請使用 /home/FLB-Learning-Portfolio');
    console.log('  如果 /Fun Learn Bar 成功，請保持原設定');
    console.log('  如果 /課程照片記錄 成功，可以直接使用該資料夾');
}

simpleUploadTest();
