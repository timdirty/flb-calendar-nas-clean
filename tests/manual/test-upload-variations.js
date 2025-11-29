/**
 * 測試不同的上傳 API 參數組合
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadVariations() {
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
    fs.writeFileSync(testFilePath, 'Hello World');
    
    // 測試配置
    const variations = [
        {
            name: '版本 1',
            version: '1',
            params: { path: '/home', overwrite: 'true' }
        },
        {
            name: '版本 2（無 create_parents）',
            version: '2',
            params: { path: '/home', overwrite: 'true' }
        },
        {
            name: '版本 2（dest_folder_path）',
            version: '2',
            params: { dest_folder_path: '/home', overwrite: 'true' }
        },
        {
            name: '版本 2（完整參數）',
            version: '2',
            params: { 
                path: '/home',
                create_parents: 'false',
                overwrite: 'true',
                mtime: Math.floor(Date.now() / 1000)
            }
        }
    ];
    
    for (const config of variations) {
        console.log(`📤 測試: ${config.name}...`);
        
        const formData = new FormData();
        formData.append('api', 'SYNO.FileStation.Upload');
        formData.append('version', config.version);
        formData.append('method', 'upload');
        formData.append('_sid', sid);
        
        // 添加參數
        for (const [key, value] of Object.entries(config.params)) {
            formData.append(key, value.toString());
        }
        
        // 添加檔案
        const fileStream = fs.createReadStream(testFilePath);
        formData.append('file', fileStream, {
            filename: 'test-file.txt',
            contentType: 'text/plain'
        });
        
        try {
            const uploadResponse = await axiosInstance.post(apiUrl, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            
            if (uploadResponse.data && uploadResponse.data.success) {
                console.log(`✅ 成功！\n`);
                break; // 找到成功的配置就停止
            } else {
                const errorCode = uploadResponse.data?.error?.code || 'unknown';
                console.log(`❌ 失敗 (error ${errorCode})\n`);
            }
        } catch (error) {
            console.log(`❌ 請求失敗: ${error.message}\n`);
        }
    }
    
    // 清理
    if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
    }
}

testUploadVariations();

