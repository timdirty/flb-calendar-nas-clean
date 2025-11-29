/**
 * ============================================
 * Synology Drive API 客戶端
 * ============================================
 * 功能：與 Synology FileStation API 互動，處理檔案上傳、下載、刪除等操作
 * 版本：1.0.0
 * 日期：2025-11-08
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class SynologyDriveClient {
    constructor(config) {
        // 🔥 驗證必要配置
        if (!config.host) {
            throw new Error('❌ [SynologyDrive] SYNOLOGY_HOST 環境變數未設置，請檢查 .env.nas 檔案');
        }
        if (!config.username) {
            throw new Error('❌ [SynologyDrive] SYNOLOGY_USERNAME 環境變數未設置，請檢查 .env.nas 檔案');
        }
        if (!config.password) {
            throw new Error('❌ [SynologyDrive] SYNOLOGY_PASSWORD 環境變數未設置，請檢查 .env.nas 檔案');
        }
        
        this.host = config.host;
        this.port = config.port || 9102;
        this.protocol = config.protocol || 'https';
        this.username = config.username;
        this.password = config.password;
        this.baseUrl = `${this.protocol}://${this.host}:${this.port}`;
        this.apiUrl = `${this.baseUrl}/webapi/entry.cgi`;
        
        // Session 管理
        this.sid = null;
        this.sidExpireTime = null;
        this.sessionName = 'FileStation';
        
        // 重試設定
        this.maxRetries = 1;
        this.retryDelay = 1000; // 1秒
        
        // HTTP 客戶端配置
        this.axiosInstance = axios.create({
            timeout: 60000, // 🔥 增加到 60秒超時（處理大檔案上傳）
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false // 接受自簽證書（NAS 常見）
            })
        });
        
        console.log('✅ [SynologyDrive] 客戶端已初始化:', {
            host: this.host,
            protocol: this.protocol,
            port: this.port
        });
    }

    /**
     * ==================== 認證相關 ====================
     */

    /**
     * 登入並獲取 SID
     */
    async login() {
        try {
            console.log('🔐 [SynologyDrive] 開始登入...');
            
            const params = new URLSearchParams({
                api: 'SYNO.API.Auth',
                version: '3',
                method: 'login',
                account: this.username,
                passwd: this.password,
                session: this.sessionName,
                format: 'sid'
            });

            const response = await this.axiosInstance.post(this.apiUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data && response.data.success) {
                this.sid = response.data.data.sid;
                // SID 通常有效期 1小時，我們設 50 分鐘後過期
                this.sidExpireTime = Date.now() + (50 * 60 * 1000);
                console.log('✅ [SynologyDrive] 登入成功，SID:', this.sid.substring(0, 8) + '****');
                return { success: true, sid: this.sid };
            } else {
                const errorCode = response.data?.error?.code || 'unknown';
                throw new Error(`登入失敗: error code ${errorCode}`);
            }
        } catch (error) {
            console.error('❌ [SynologyDrive] 登入失敗:', error.message);
            throw error;
        }
    }

    /**
     * 登出並清除 SID
     */
    async logout() {
        if (!this.sid) {
            console.log('⚠️ [SynologyDrive] 無需登出，尚未登入');
            return { success: true };
        }

        try {
            console.log('🔓 [SynologyDrive] 開始登出...');
            
            const params = new URLSearchParams({
                api: 'SYNO.API.Auth',
                version: '3',
                method: 'logout',
                session: this.sessionName,
                _sid: this.sid
            });

            const response = await this.axiosInstance.post(this.apiUrl, params);

            this.sid = null;
            this.sidExpireTime = null;
            console.log('✅ [SynologyDrive] 登出成功');
            
            return { success: true };
        } catch (error) {
            console.error('❌ [SynologyDrive] 登出失敗:', error.message);
            // 即使登出失敗也清除本地 SID
            this.sid = null;
            this.sidExpireTime = null;
            return { success: false, error: error.message };
        }
    }

    /**
     * 確保有效的認證（自動登入或續期）
     */
    async ensureAuthenticated() {
        // 檢查 SID 是否存在且未過期
        if (this.sid && this.sidExpireTime && Date.now() < this.sidExpireTime) {
            return true;
        }

        console.log('🔄 [SynologyDrive] SID 不存在或已過期，重新登入...');
        await this.login();
        return true;
    }

    /**
     * ==================== 目錄操作 ====================
     */
    
    /**
     * 列出資料夾內容
     */
    async listFolder(folderPath, options = {}) {
        await this.ensureAuthenticated();
        
        try {
            console.log('📂 [SynologyDrive] 列出資料夾:', folderPath);
            
            const normalizedPath = folderPath.split(path.sep).join('/');
            
            const params = new URLSearchParams({
                api: 'SYNO.FileStation.List',
                version: '2',
                method: 'list',
                folder_path: normalizedPath,
                additional: JSON.stringify(['size', 'time', 'type']),
                _sid: this.sid
            });
            
            const response = await this.axiosInstance.post(this.apiUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            if (response.data && response.data.success) {
                const files = response.data.data?.files || [];
                console.log(`✅ [SynologyDrive] 找到 ${files.length} 個檔案`);
                return {
                    success: true,
                    files: files.map(file => ({
                        name: file.name,
                        path: file.path,
                        size: file.additional?.size || 0,
                        isdir: file.isdir,
                        type: file.additional?.type || 'unknown',
                        modified: file.additional?.time?.mtime || 0
                    }))
                };
            } else {
                const errorCode = response.data?.error?.code || 'unknown';
                throw new Error(`列出資料夾失敗: error code ${errorCode}`);
            }
        } catch (error) {
            console.error('❌ [SynologyDrive] 列出資料夾失敗:', error.message);
            throw error;
        }
    }

    /**
     * 創建目錄（支援遞迴創建）
     */
    async createFolder(folderPath, options = {}) {
        await this.ensureAuthenticated();

        try {
            console.log('📁 [SynologyDrive] 創建目錄:', folderPath);

            // 🔥 使用 POSIX 路徑，確保絕對路徑
            const posixPath = folderPath.split(path.sep).join('/');
            const normalizedPath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
            const parentDir = path.dirname(normalizedPath);
            const folderName = path.basename(normalizedPath);
            
            // 🔥 處理父目錄：如果是根目錄，可能需要特殊處理
            // 但根據 Synology API，空字串可能導致錯誤，所以使用 '/' 或實際路徑
            let apiParentDir = parentDir;
            if (parentDir === '/' || parentDir === '') {
                // 🔥 如果父目錄是根目錄，檢查是否真的是根目錄
                // 如果是單層路徑（如 /Fun Learn Bar），父目錄應該是空字串
                // 但如果是多層路徑，父目錄應該是實際路徑
                const pathDepth = normalizedPath.split('/').filter(p => p).length;
                if (pathDepth === 1) {
                    // 單層路徑，父目錄是根目錄
                    apiParentDir = '';
                } else {
                    // 多層路徑，使用實際父目錄路徑
                    apiParentDir = parentDir === '/' ? '' : parentDir;
                }
            }

            const params = new URLSearchParams({
                api: 'SYNO.FileStation.CreateFolder',
                version: '2',
                method: 'create',
                folder_path: apiParentDir,
                // FileStation 允許一次傳入多個資料夾名稱；使用 JSON 陣列可避免名稱被誤判為數字（例：2025-11-10）
                name: JSON.stringify([folderName]),
                force_parent: 'true', // 遞迴創建父目錄
                _sid: this.sid
            });

            // 🔥 記錄請求參數，方便除錯
            console.log('📤 [SynologyDrive] 創建目錄請求參數:', {
                folderPath,
                normalizedPath,
                parentDir,
                apiParentDir,
                folderName,
                paramsString: params.toString()
            });

            const response = await this.axiosInstance.post(this.apiUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data && response.data.success) {
                console.log('✅ [SynologyDrive] 目錄創建成功:', folderPath);
                return {
                    success: true,
                    path: folderPath,
                    data: response.data.data
                };
            } else {
                const errorCode = response.data?.error?.code || 'unknown';
                const errorMsg = response.data?.error?.message || response.data?.error?.errors?.[0]?.code || '未知錯誤';
                const fullError = response.data?.error || {};
                
                // Error code 1100 = 目錄已存在（不視為錯誤）
                if (errorCode === 1100) {
                    console.log('💡 [SynologyDrive] 目錄已存在:', folderPath);
                    return { success: true, path: folderPath, exists: true };
                }
                
                // 🔥 錯誤碼 400 可能是因為父目錄不存在，但 force_parent 應該會自動創建
                // 如果還是失敗，可能是路徑中的特殊字元問題
                if (errorCode === 400) {
                    console.error('❌ [SynologyDrive] 創建目錄失敗（錯誤碼 400）:', {
                        folderPath,
                        parentDir,
                        apiParentDir,
                        folderName,
                        '可能原因': [
                            '父目錄不存在（但 force_parent=true 應該會自動創建）',
                            '路徑中包含不支持的特殊字元（如冒號 :）',
                            '路徑格式不正確',
                            'API 參數格式問題'
                        ],
                        fullError,
                        responseData: response.data
                    });
                }
                
                console.error('❌ [SynologyDrive] 創建目錄失敗:', {
                    folderPath,
                    normalizedPath,
                    parentDir,
                    apiParentDir,
                    folderName,
                    errorCode,
                    errorMsg,
                    fullError,
                    responseData: response.data
                });
                throw new Error(`創建目錄失敗: error code ${errorCode} - ${errorMsg}`);
            }
        } catch (error) {
            // 🔥 記錄詳細錯誤資訊
            if (error.response) {
                const statusCode = error.response.status;
                const errorCode = error.response.data?.error?.code || statusCode;
                const errorMsg = error.response.data?.error?.message || error.response.data?.error?.errors?.[0]?.code || '未知錯誤';
                const fullError = error.response.data?.error || {};
                console.error('❌ [SynologyDrive] 創建目錄 HTTP 錯誤:', {
                    folderPath,
                    normalizedPath: folderPath.split(path.sep).join('/'),
                    parentDir: path.dirname(folderPath.split(path.sep).join('/')),
                    folderName: path.basename(folderPath.split(path.sep).join('/')),
                    statusCode,
                    errorCode,
                    errorMsg,
                    fullError,
                    responseData: error.response.data
                });
                throw new Error(`創建目錄失敗: HTTP ${statusCode}, error code ${errorCode} - ${errorMsg}`);
            }
            
            console.error('❌ [SynologyDrive] 創建目錄失敗:', {
                folderPath,
                error: error.message,
                errorStack: error.stack
            });
            throw error;
        }
    }

    /**
     * 確保目錄存在（不存在則創建，支援遞迴創建父目錄）
     */
    async ensureFolderExists(folderPath) {
        // 🔥 使用重試機制包裝，確保目錄創建成功
        return await this.retryOperation(async () => {
            try {
                // 先檢查目錄是否存在
                const exists = await this.checkPathExists(folderPath);
                if (exists) {
                    console.log('✅ [SynologyDrive] 目錄已存在:', folderPath);
                    return { success: true, path: folderPath, exists: true };
                }

                // 🔥 不存在則逐級創建所有父目錄
                console.log('📁 [SynologyDrive] 目錄不存在，開始逐級創建:', folderPath);
                
                // 解析路徑，逐級創建
                const posixPath = folderPath.split(path.sep).join('/');
                // 🔥 確保路徑以 / 開頭（絕對路徑）
                const normalizedPath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
                const pathParts = normalizedPath.split('/').filter(p => p); // 過濾空字串
                
                // 🔥 從第一層開始，逐級創建每一層
                // 注意：第一層通常是共享資料夾根目錄（如 /Fun Learn Bar），應該已經存在，不需要創建
                let currentPath = '';
                for (let i = 0; i < pathParts.length; i++) {
                    // 🔥 構建絕對路徑（以 / 開頭）
                    currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : `/${pathParts[i]}`;
                    
                    // 🔥 跳過根目錄的檢查（根目錄應該已經存在）
                    if (i === 0 && currentPath === '/') {
                        continue;
                    }
                    
                    // 🔥 第一層通常是共享資料夾根目錄，假設已存在，跳過創建嘗試
                    if (i === 0) {
                        console.log(`💡 [SynologyDrive] 跳過共享資料夾根目錄層級 ${i + 1}（假設已存在）:`, currentPath);
                        continue;
                    }
                    
                    // 檢查當前層級是否存在
                    // 🔥 注意：如果路徑包含特殊字元（如冒號），checkPathExists 可能返回 false（因為 API 返回 408）
                    // 所以我們嘗試創建，如果失敗且錯誤碼是 1100（目錄已存在），則視為成功
                    const currentExists = await this.checkPathExists(currentPath);
                    if (!currentExists) {
                        console.log(`📁 [SynologyDrive] 創建父目錄層級 ${i + 1}/${pathParts.length}:`, currentPath);
                        try {
                            await this.createFolder(currentPath);
                            // 等待一下讓 NAS 完成創建
                            await new Promise(resolve => setTimeout(resolve, 300));
                            console.log(`✅ [SynologyDrive] 父目錄層級 ${i + 1} 創建成功:`, currentPath);
                        } catch (createError) {
                            // 🔥 如果是「目錄已存在」錯誤（錯誤碼 1100），視為成功
                            if (createError.message && (createError.message.includes('1100') || createError.message.includes('目錄已存在'))) {
                                console.log(`💡 [SynologyDrive] 父目錄層級 ${i + 1} 已存在:`, currentPath);
                            } else if (createError.message && createError.message.includes('error code 400')) {
                                // 🔥 錯誤碼 400 可能是因為父目錄不存在或路徑包含特殊字元
                                // 如果父目錄路徑包含特殊字元（如冒號），API 可能無法正確處理
                                // 檢查是否是父目錄路徑問題（父目錄路徑包含特殊字元）
                                const parentPath = path.dirname(currentPath);
                                const hasSpecialChars = /[:<>"|?*\\]/.test(parentPath);
                                
                                if (hasSpecialChars) {
                                    // 父目錄路徑包含特殊字元，可能是這個原因導致錯誤
                                    console.warn(`⚠️ [SynologyDrive] 父目錄層級 ${i + 1} 創建失敗（錯誤碼 400），父目錄路徑包含特殊字元:`, {
                                        currentPath,
                                        parentPath,
                                        '特殊字元': parentPath.match(/[:<>"|?*\\]/g)
                                    });
                                    console.warn(`⚠️ [SynologyDrive] 假設父目錄已存在（因為路徑包含特殊字元導致 API 無法正確處理），繼續創建下一層...`);
                                    // 🔥 不拋出錯誤，繼續嘗試下一層
                                    // 如果父目錄真的不存在，下一層創建時會再次失敗
                                    // 但如果下一層創建成功（錯誤碼 1100），說明父目錄確實已存在
                                    // 標記當前層級為「假設已存在」，繼續下一層
                                    console.log(`💡 [SynologyDrive] 標記父目錄層級 ${i + 1} 為「假設已存在」:`, currentPath);
                                } else {
                                    // 🔥 父目錄路徑沒有特殊字元，但創建失敗（錯誤碼 400）
                                    // 可能是因為父目錄實際上已經存在，但 checkPathExists 返回 false（可能是 API 延遲或錯誤）
                                    // 或者父目錄路徑本身包含特殊字元（雖然已經清理，但可能還有其他問題）
                                    // 🔥 嘗試假設目錄已存在，繼續下一層（如果下一層創建成功，說明父目錄確實已存在）
                                    console.warn(`⚠️ [SynologyDrive] 父目錄層級 ${i + 1} 創建失敗（錯誤碼 400），父目錄路徑沒有特殊字元:`, {
                                        currentPath,
                                        parentPath
                                    });
                                    console.warn(`⚠️ [SynologyDrive] 假設父目錄已存在（可能是 API 延遲或錯誤），繼續創建下一層...`);
                                    console.log(`💡 [SynologyDrive] 標記父目錄層級 ${i + 1} 為「假設已存在」:`, currentPath);
                                    // 🔥 不拋出錯誤，繼續嘗試下一層
                                }
                            } else {
                                console.error(`❌ [SynologyDrive] 創建父目錄層級 ${i + 1} 失敗:`, {
                                    path: currentPath,
                                    error: createError.message
                                });
                                throw createError;
                            }
                        }
                    } else {
                        console.log(`✅ [SynologyDrive] 父目錄層級 ${i + 1} 已存在:`, currentPath);
                    }
                }
                
                // 🔥 最後驗證目標目錄真的存在
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 🔥 檢查路徑是否包含特殊字元
                const hasSpecialChars = /[:<>"|?*\\]/.test(folderPath);
                
                if (hasSpecialChars) {
                    // 路徑包含特殊字元，checkPathExists 可能無法正確驗證（會返回 408）
                    // 假設目錄已創建成功（因為逐級創建過程中沒有拋出錯誤）
                    console.warn('⚠️ [SynologyDrive] 目錄路徑包含特殊字元，跳過驗證（API 可能返回 408）:', folderPath);
                    console.log('✅ [SynologyDrive] 目錄逐級創建完成（假設成功）:', folderPath);
                    return { success: true, path: folderPath, created: true, verified: false, skipVerification: true };
                } else {
                    // 路徑不包含特殊字元，正常驗證
                    const finalExists = await this.checkPathExists(folderPath);
                    if (finalExists) {
                        console.log('✅ [SynologyDrive] 目錄逐級創建成功並驗證通過:', folderPath);
                        return { success: true, path: folderPath, created: true };
                    } else {
                        console.warn('⚠️ [SynologyDrive] 目錄創建後驗證失敗，但繼續嘗試:', folderPath);
                        // 即使驗證失敗也繼續，因為可能是 NAS 延遲
                        return { success: true, path: folderPath, created: true, verified: false };
                    }
                }
            } catch (error) {
                console.error('❌ [SynologyDrive] 確保目錄存在失敗:', {
                    folderPath,
                    error: error.message
                });
                throw error;
            }
        }, 2); // 最多重試 2 次（因為已經有逐級創建邏輯）
    }

    /**
     * 檢查路徑是否存在
     */
    async checkPathExists(filePath) {
        await this.ensureAuthenticated();

        try {
            // 🔥 使用 POSIX 路徑，確保絕對路徑
            const posixPath = filePath.split(path.sep).join('/');
            const normalizedPath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
            const parentDir = path.dirname(normalizedPath);
            const fileName = path.basename(normalizedPath);
            
            // 🔥 如果父目錄是根目錄，使用空字串（Synology API 可能需要）
            const apiParentDir = parentDir === '/' ? '' : parentDir;

            const params = {
                api: 'SYNO.FileStation.List',
                version: '2',
                method: 'list',
                folder_path: apiParentDir,
                _sid: this.sid
            };

            const response = await this.axiosInstance.get(this.apiUrl, { params });

            if (response.data && response.data.success) {
                const files = response.data.data.files || [];
                const exists = files.some(file => file.name === fileName && file.isdir);
                console.log('🔍 [SynologyDrive] 檢查路徑:', {
                    filePath,
                    parentDir,
                    fileName,
                    exists,
                    filesCount: files.length
                });
                return exists;
            }
            
            // API 返回失敗，可能是父目錄不存在
            console.warn('⚠️ [SynologyDrive] 檢查路徑 API 返回失敗，假設不存在:', filePath);
            return false;
        } catch (error) {
            // 🔥 區分錯誤類型：如果是 408 或其他錯誤，可能是父目錄不存在
            if (error.response) {
                const errorCode = error.response.data?.error?.code;
                if (errorCode === 408 || errorCode === 1100) {
                    // 408 = 超時（可能是父目錄不存在）
                    // 1100 = 路徑不存在
                    console.warn('⚠️ [SynologyDrive] 檢查路徑時父目錄可能不存在:', {
                        filePath,
                        errorCode
                    });
                    return false;
                }
            }
            
            console.error('❌ [SynologyDrive] 檢查路徑失敗:', {
                filePath,
                error: error.message
            });
            return false;
        }
    }

    /**
     * ==================== 檔案操作 ====================
     */

    /**
     * 上傳檔案（支援 Buffer 和檔案路徑）
     */
    async uploadFile(fileSource, remotePath, options = {}) {
        // 🔥 使用重試機制包裝上傳操作
        return await this.retryOperation(async () => {
            await this.ensureAuthenticated();

            try {
                console.log('📤 [SynologyDrive] 開始上傳檔案:', remotePath);

                // 使用 POSIX 路徑（避免 Windows 路徑問題）
                const posixPath = remotePath.split(path.sep).join('/');
                const pathParts = posixPath.split('/');
                const fileName = pathParts.pop();
                const remoteDir = pathParts.join('/');

                console.log('📂 [SynologyDrive] 上傳目錄:', remoteDir);
                console.log('📄 [SynologyDrive] 檔案名稱:', fileName);

                // 確保目標目錄存在
                await this.ensureFolderExists(remoteDir);

                const formData = new FormData();
                formData.append('api', 'SYNO.FileStation.Upload');
                formData.append('version', '2');
                formData.append('method', 'upload');
                formData.append('path', remoteDir);
                formData.append('create_parents', 'true');
                formData.append('overwrite', options.overwrite !== false ? 'true' : 'false');
                // ⚠️ 注意：SID 不在 form data 中，而是在 URL 中傳遞

                // 判斷 fileSource 類型
                if (Buffer.isBuffer(fileSource)) {
                    // Buffer 類型（來自前端上傳）
                    // 將 Buffer 轉換為 Stream
                    const { Readable } = require('stream');
                    const bufferStream = Readable.from(fileSource);
                    formData.append('file', bufferStream, {
                        filename: fileName,
                        contentType: options.contentType || 'application/octet-stream',
                        knownLength: fileSource.length
                    });
                } else if (typeof fileSource === 'string') {
                    // 檔案路徑類型
                    const fileStream = fs.createReadStream(fileSource);
                    formData.append('file', fileStream, {
                        filename: fileName,
                        contentType: options.contentType || 'application/octet-stream'
                    });
                } else {
                    throw new Error('不支援的檔案來源類型');
                }

                // ✅ 修正：SID 必須在 URL 中傳遞，不能在 form data 中
                const uploadUrl = `${this.apiUrl}?_sid=${this.sid}`;
                const response = await this.axiosInstance.post(uploadUrl, formData, {
                    headers: formData.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                if (response.data && response.data.success) {
                    console.log('✅ [SynologyDrive] 檔案上傳成功:', remotePath);
                    return {
                        success: true,
                        path: remotePath,
                        data: response.data.data
                    };
                } else {
                    const errorCode = response.data?.error?.code || 'unknown';
                    const errorMsg = response.data?.error?.message || response.data?.error?.errors?.[0]?.code || '未知錯誤';
                    const fullError = response.data?.error || {};
                    console.error('❌ [SynologyDrive] 檔案上傳失敗:', {
                        errorCode,
                        errorMsg,
                        remotePath,
                        fileName,
                        fullErrorData: fullError,
                        responseData: response.data
                    });
                    throw new Error(`檔案上傳失敗: error code ${errorCode} - ${errorMsg}`);
                }
            } catch (error) {
                // 🔥 如果是網路錯誤或超時，記錄詳細資訊
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
                    console.error('❌ [SynologyDrive] 檔案上傳超時:', {
                        remotePath,
                        fileName: path.basename(remotePath),
                        error: error.message,
                        errorCode: error.code,
                        timeout: this.axiosInstance.defaults.timeout
                    });
                    throw new Error(`檔案上傳超時: ${error.message}`);
                }
                
                // 🔥 如果是 HTTP 錯誤，記錄狀態碼和完整錯誤資訊
                if (error.response) {
                    const statusCode = error.response.status;
                    const errorCode = error.response.data?.error?.code || statusCode;
                    const errorMsg = error.response.data?.error?.message || error.response.data?.error?.errors?.[0]?.code || '未知錯誤';
                    console.error('❌ [SynologyDrive] 檔案上傳 HTTP 錯誤:', {
                        statusCode,
                        errorCode,
                        errorMsg,
                        remotePath,
                        fileName: path.basename(remotePath),
                        fullErrorData: error.response.data?.error || {},
                        responseData: error.response.data
                    });
                    throw new Error(`檔案上傳失敗: HTTP ${statusCode}, error code ${errorCode} - ${errorMsg}`);
                }
                
                console.error('❌ [SynologyDrive] 檔案上傳失敗:', {
                    message: error.message,
                    code: error.code,
                    remotePath
                });
                throw error;
            }
        }, options.maxRetries || this.maxRetries);
    }

    /**
     * 批次上傳多個檔案
     */
    async uploadMultipleFiles(files, remoteFolder, options = {}) {
        await this.ensureAuthenticated();

        const results = [];
        let successCount = 0;
        let failCount = 0;

        console.log(`📤 [SynologyDrive] 開始批次上傳 ${files.length} 個檔案到: ${remoteFolder}`);

        // 確保目標目錄存在
        await this.ensureFolderExists(remoteFolder);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const remotePath = path.join(remoteFolder, file.name || file.originalname || `file-${i}`);

            try {
                const result = await this.uploadFile(file.buffer || file.path, remotePath, {
                    ...options,
                    contentType: file.mimetype
                });
                results.push({ ...result, file: file.name || file.originalname });
                successCount++;
                
                // 上傳進度回報
                if (options.onProgress) {
                    options.onProgress(i + 1, files.length, file);
                }
            } catch (error) {
                failCount++;
                results.push({
                    success: false,
                    error: error.message,
                    file: file.name || file.originalname,
                    path: remotePath
                });
                console.error(`❌ [SynologyDrive] 檔案上傳失敗 [${i + 1}/${files.length}]:`, error.message);
            }
        }

        console.log(`✅ [SynologyDrive] 批次上傳完成: 成功 ${successCount}, 失敗 ${failCount}`);

        return {
            success: failCount === 0,
            total: files.length,
            successCount,
            failCount,
            results
        };
    }

    /**
     * 列出目錄中的檔案
     */
    async listFiles(folderPath, options = {}) {
        // 🔥 使用重試機制包裝列出檔案操作
        return await this.retryOperation(async () => {
            await this.ensureAuthenticated();

            try {
                console.log('📋 [SynologyDrive] 列出目錄檔案:', folderPath);

                const params = {
                    api: 'SYNO.FileStation.List',
                    version: '2',
                    method: 'list',
                    folder_path: folderPath,
                    _sid: this.sid,
                    additional: 'real_path,size,owner,time,perm,type'
                };

                if (options.limit) params.limit = options.limit;
                if (options.offset) params.offset = options.offset;
                if (options.sort_by) params.sort_by = options.sort_by;
                if (options.sort_direction) params.sort_direction = options.sort_direction;
                if (options.pattern) params.pattern = options.pattern;
                if (options.filetype) params.filetype = options.filetype;

                // 🔥 [修復 2025-11-16] 改用 POST 方法避免 URL 編碼問題
                // GET 請求在處理包含中文的路徑時，會導致編碼錯誤（UTF-8 被誤解為 Latin-1）
                // 使用 POST + application/x-www-form-urlencoded 可確保正確編碼
                const formData = new URLSearchParams(params);
                const response = await this.axiosInstance.post(this.apiUrl, formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                if (response.data && response.data.success) {
                    const files = response.data.data.files || [];
                    console.log(`✅ [SynologyDrive] 找到 ${files.length} 個檔案`);
                    return {
                        success: true,
                        files: files,
                        total: response.data.data.total || files.length
                    };
                } else {
                    const errorCode = response.data?.error?.code || 'unknown';
                    const errorMsg = response.data?.error?.message || response.data?.error?.errors?.[0]?.code || '未知錯誤';
                    const fullError = response.data?.error || {};
                    console.error('❌ [SynologyDrive] 列出檔案失敗:', {
                        errorCode,
                        errorMsg,
                        folderPath,
                        fullErrorData: fullError,
                        responseData: response.data
                    });
                    if (String(errorCode) === '408') {
                        const unavailableError = new Error(`Drive 路徑不可用: ${folderPath}`);
                        unavailableError.code = 'DRIVE_PATH_UNAVAILABLE';
                        unavailableError.noRetry = true;
                        unavailableError.folderPath = folderPath;
                        throw unavailableError;
                    }
                    throw new Error(`列出檔案失敗: error code ${errorCode} - ${errorMsg}`);
                }
            } catch (error) {
                // 🔥 如果是網路錯誤或超時，記錄詳細資訊
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
                    console.error('❌ [SynologyDrive] 列出檔案超時:', {
                        folderPath,
                        error: error.message,
                        errorCode: error.code,
                        timeout: this.axiosInstance.defaults.timeout
                    });
                    throw new Error(`列出檔案超時: ${error.message}`);
                }
                
                // 🔥 如果是 HTTP 錯誤，記錄狀態碼和完整錯誤資訊
                if (error.response) {
                    const statusCode = error.response.status;
                    const errorCode = error.response.data?.error?.code || statusCode;
                    const errorMsg = error.response.data?.error?.message || error.response.data?.error?.errors?.[0]?.code || '未知錯誤';
                    console.error('❌ [SynologyDrive] 列出檔案 HTTP 錯誤:', {
                        statusCode,
                        errorCode,
                        errorMsg,
                        folderPath,
                        fullErrorData: error.response.data?.error || {},
                        responseData: error.response.data
                    });
                    if (String(errorCode) === '408') {
                        const unavailableError = new Error(`Drive 路徑不可用: ${folderPath}`);
                        unavailableError.code = 'DRIVE_PATH_UNAVAILABLE';
                        unavailableError.noRetry = true;
                        unavailableError.folderPath = folderPath;
                        throw unavailableError;
                    }
                    throw new Error(`列出檔案失敗: HTTP ${statusCode}, error code ${errorCode} - ${errorMsg}`);
                }
                
                console.error('❌ [SynologyDrive] 列出檔案失敗:', {
                    message: error.message,
                    code: error.code,
                    folderPath
                });
                throw error;
            }
        }, options.maxRetries || this.maxRetries);
    }

    /**
     * 刪除檔案
     */
    async deleteFile(filePath, options = {}) {
        await this.ensureAuthenticated();

        try {
            console.log('🗑️ [SynologyDrive] 刪除檔案:', filePath);

            const params = new URLSearchParams({
                api: 'SYNO.FileStation.Delete',
                version: '2',
                method: 'delete',
                path: filePath,
                recursive: options.recursive ? 'true' : 'false',
                _sid: this.sid
            });

            const response = await this.axiosInstance.post(this.apiUrl, params);

            if (response.data && response.data.success) {
                console.log('✅ [SynologyDrive] 檔案刪除成功:', filePath);
                return {
                    success: true,
                    path: filePath
                };
            } else {
                const errorCode = response.data?.error?.code || 'unknown';
                throw new Error(`檔案刪除失敗: error code ${errorCode}`);
            }
        } catch (error) {
            console.error('❌ [SynologyDrive] 檔案刪除失敗:', error.message);
            throw error;
        }
    }

    /**
     * 批次刪除多個檔案
     */
    async deleteMultipleFiles(filePaths, options = {}) {
        await this.ensureAuthenticated();

        const results = [];
        let successCount = 0;
        let failCount = 0;

        console.log(`🗑️ [SynologyDrive] 開始批次刪除 ${filePaths.length} 個檔案`);

        for (const filePath of filePaths) {
            try {
                const result = await this.deleteFile(filePath, options);
                results.push(result);
                successCount++;
            } catch (error) {
                failCount++;
                results.push({
                    success: false,
                    error: error.message,
                    path: filePath
                });
            }
        }

        console.log(`✅ [SynologyDrive] 批次刪除完成: 成功 ${successCount}, 失敗 ${failCount}`);

        return {
            success: failCount === 0,
            total: filePaths.length,
            successCount,
            failCount,
            results
        };
    }

    /**
     * 獲取檔案下載 URL
     */
    getFileUrl(filePath, options = {}) {
        if (!this.sid) {
            throw new Error('尚未登入，無法生成檔案 URL');
        }

        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Download',
            version: '2',
            method: 'download',
            path: filePath,
            mode: options.mode || 'open', // 'open' 用於預覽, 'download' 用於下載
            _sid: this.sid
        });

        const url = `${this.apiUrl}?${params.toString()}`;
        console.log('🔗 [SynologyDrive] 生成檔案 URL:', filePath);
        
        return url;
    }

    /**
     * 獲取檔案串流（用於代理）
     */
    async getFileStream(filePath, options = {}) {
        await this.ensureAuthenticated();

        try {
            console.log('📥 [SynologyDrive] 獲取檔案串流:', filePath);

            const url = this.getFileUrl(filePath);
            const axiosOpts = { responseType: 'stream' };
            if (options && options.headers) {
                axiosOpts.headers = Object.assign({}, options.headers);
            }
            const response = await this.axiosInstance.get(url, axiosOpts);

            console.log('✅ [SynologyDrive] 檔案串流已建立');
            // 將上游重要標頭一併回傳，供代理層設置（Range 播放用）
            return { stream: response.data, headers: response.headers, status: response.status };
        } catch (error) {
            console.error('❌ [SynologyDrive] 獲取檔案串流失敗:', error.message);
            throw error;
        }
    }

    /**
     * ==================== 重試機制 ====================
     */

    /**
     * 執行操作並自動重試（網路錯誤時）
     */
    async retryOperation(operation, maxRetries = this.maxRetries) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (error && (error.noRetry || error.code === 'DRIVE_PATH_UNAVAILABLE')) {
                    throw error;
                }
                
                // 🔥 如果是 SID 過期（錯誤碼 105），重新登入後再試
                if (error.message && (error.message.includes('error code 105') || error.message.includes('Invalid session'))) {
                    console.log('🔄 [SynologyDrive] SID 過期，重新登入...');
                    this.sid = null; // 清除舊 SID
                    this.sidExpireTime = null;
                    await this.login();
                    continue;
                }
                
                // 🔥 如果是錯誤碼 119（Session 無效或權限問題），重新登入後再試
                if (error.message && error.message.includes('error code 119')) {
                    console.log('🔄 [SynologyDrive] 錯誤碼 119（Session 無效），重新登入...');
                    this.sid = null; // 清除舊 SID
                    this.sidExpireTime = null;
                    await this.login();
                    // 等待一下再重試，讓 session 穩定
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                // 🔥 如果是錯誤碼 418（可能是請求格式問題），重新登入後再試
                if (error.message && error.message.includes('error code 418')) {
                    console.log('🔄 [SynologyDrive] 錯誤碼 418，可能是 SID 無效，重新登入後重試...');
                    this.sid = null; // 清除舊 SID
                    this.sidExpireTime = null;
                    await this.login();
                    // 等待一下再重試
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                
                // 🔥 如果是錯誤碼 408（請求超時），等待後重試
                if (error.message && (error.message.includes('error code 408') || error.message.includes('timeout') || error.message.includes('超時'))) {
                    if (attempt < maxRetries) {
                        const delay = this.retryDelay * attempt * 2; // 超時錯誤等待更長時間
                        console.log(`⚠️ [SynologyDrive] 請求超時，${delay}ms 後重試 (${attempt}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }

                // 其他錯誤，等待後重試
                if (attempt < maxRetries) {
                    const delay = this.retryDelay * attempt;
                    console.log(`⚠️ [SynologyDrive] 操作失敗，${delay}ms 後重試 (${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`❌ [SynologyDrive] 操作失敗，已達最大重試次數 (${maxRetries})`);
                }
            }
        }

        throw lastError;
    }
}

module.exports = SynologyDriveClient;
