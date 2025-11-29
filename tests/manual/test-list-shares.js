/**
 * 列出 Synology NAS 的共享資料夾
 */

require('dotenv').config({ path: '.env.nas' });
const SynologyDriveClient = require('../../synology-drive-client');

async function listShares() {
    console.log('🔍 檢查 NAS 共享資料夾...\n');
    
    const client = new SynologyDriveClient({
        host: process.env.SYNOLOGY_HOST,
        port: process.env.SYNOLOGY_PORT,
        protocol: process.env.SYNOLOGY_PROTOCOL,
        username: process.env.SYNOLOGY_USERNAME,
        password: process.env.SYNOLOGY_PASSWORD
    });
    
    try {
        await client.login();
        console.log('✅ 登入成功\n');
        
        console.log('📂 嘗試列出共享資料夾...\n');
        
        // 嘗試方法 1：使用 list_share 方法
        try {
            const axios = require('axios');
            const response = await axios.get(`${client.baseUrl}/webapi/entry.cgi`, {
                params: {
                    api: 'SYNO.FileStation.List',
                    version: '2',
                    method: 'list_share',
                    _sid: client.sid
                },
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false
                })
            });
            
            if (response.data && response.data.success) {
                const shares = response.data.data.shares || [];
                console.log(`✅ 找到 ${shares.length} 個共享資料夾：\n`);
                shares.forEach((share, index) => {
                    console.log(`${index + 1}. ${share.name} - 路徑: ${share.path}`);
                });
                
                // 檢查是否有 FLB-Learning-Portfolio
                const targetShare = shares.find(s => s.name.includes('FLB') || s.name.includes('Learning'));
                if (targetShare) {
                    console.log(`\n💡 建議使用路徑: ${targetShare.path}/FLB-Learning-Portfolio`);
                } else {
                    console.log(`\n💡 建議使用路徑: ${shares[0]?.path || '/home'}/FLB-Learning-Portfolio`);
                }
            } else {
                console.log('❌ 無法列出共享資料夾');
            }
        } catch (error) {
            console.error('❌ 列出共享資料夾失敗:', error.message);
            console.log('\n💡 嘗試使用預設路徑: /home/FLB-Learning-Portfolio');
        }
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
    }
}

listShares();

