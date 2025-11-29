// ============================================
// 🔒 安全的檔案操作模組（異步 + 鎖機制）
// ============================================
// 版本：2025-11-01 - 效能優化
// 功能：防止檔案寫入衝突、提升非阻塞效能

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

class SafeFileOperations {
    constructor() {
        this.locks = new Map(); // 追蹤鎖狀態
        this.retryOptions = {
            retries: {
                retries: 5,
                minTimeout: 100,
                maxTimeout: 1000
            }
        };
    }

    // ==================== 讀取檔案 ====================

    /**
     * 安全讀取 JSON 檔案（異步）
     * @param {string} filePath - 檔案路徑
     * @param {object} defaultValue - 預設值（檔案不存在時返回）
     * @returns {Promise<object>} JSON 資料
     */
    async readJSON(filePath, defaultValue = null) {
        try {
            // 檢查檔案是否存在
            await fs.access(filePath);
            
            // 讀取檔案
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 檔案不存在，返回預設值
                console.log(`📂 檔案不存在，使用預設值: ${filePath}`);
                return defaultValue;
            }
            console.error(`❌ 讀取檔案失敗: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * 同步讀取 JSON 檔案（向後兼容）
     * @param {string} filePath - 檔案路徑
     * @param {object} defaultValue - 預設值
     * @returns {object} JSON 資料
     */
    readJSONSync(filePath, defaultValue = null) {
        try {
            if (fsSync.existsSync(filePath)) {
                const data = fsSync.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return defaultValue;
        } catch (error) {
            console.error(`❌ 同步讀取檔案失敗: ${filePath}`, error);
            return defaultValue;
        }
    }

    // ==================== 寫入檔案（帶鎖機制）====================

    /**
     * 安全寫入 JSON 檔案（異步 + 鎖）
     * @param {string} filePath - 檔案路徑
     * @param {object} data - 要寫入的資料
     * @param {boolean} pretty - 是否格式化（預設 true）
     * @returns {Promise<boolean>} 是否成功
     */
    async writeJSON(filePath, data, pretty = true) {
        let release = null;
        
        try {
            // 確保目錄存在
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            
            // 如果檔案不存在，先創建空檔案
            try {
                await fs.access(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(filePath, '{}', 'utf8');
                }
            }
            
            // 🔒 取得檔案鎖
            release = await lockfile.lock(filePath, this.retryOptions);
            
            // 寫入資料
            const jsonString = pretty 
                ? JSON.stringify(data, null, 2) 
                : JSON.stringify(data);
            
            await fs.writeFile(filePath, jsonString, 'utf8');
            
            console.log(`✅ 檔案寫入成功（帶鎖）: ${path.basename(filePath)}`);
            return true;
            
        } catch (error) {
            console.error(`❌ 檔案寫入失敗: ${filePath}`, error);
            throw error;
        } finally {
            // 🔓 釋放鎖
            if (release) {
                try {
                    await release();
                } catch (error) {
                    console.error(`⚠️ 釋放鎖失敗: ${filePath}`, error);
                }
            }
        }
    }

    /**
     * 批次寫入多個檔案（提升效能）
     * @param {Array<{path: string, data: object}>} files - 檔案陣列
     * @returns {Promise<Array<boolean>>} 結果陣列
     */
    async batchWriteJSON(files) {
        console.log(`📦 批次寫入 ${files.length} 個檔案...`);
        
        const results = await Promise.allSettled(
            files.map(file => this.writeJSON(file.path, file.data, file.pretty !== false))
        );
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ 批次寫入完成: ${successCount}/${files.length} 成功`);
        
        return results.map(r => r.status === 'fulfilled');
    }

    // ==================== 原子性更新（讀取 → 修改 → 寫入）====================

    /**
     * 原子性更新 JSON 檔案
     * @param {string} filePath - 檔案路徑
     * @param {Function} updateFn - 更新函數 (data) => newData
     * @param {object} defaultValue - 預設值
     * @returns {Promise<object>} 更新後的資料
     */
    async atomicUpdate(filePath, updateFn, defaultValue = {}) {
        let release = null;
        
        try {
            // 確保目錄存在
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            
            // 如果檔案不存在，先創建
            try {
                await fs.access(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
                }
            }
            
            // 🔒 取得檔案鎖
            release = await lockfile.lock(filePath, this.retryOptions);
            
            // 讀取現有資料
            const currentData = await this.readJSON(filePath, defaultValue);
            
            // 執行更新函數
            const updatedData = await updateFn(currentData);
            
            // 寫回檔案
            await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
            
            console.log(`✅ 原子性更新成功: ${path.basename(filePath)}`);
            return updatedData;
            
        } catch (error) {
            console.error(`❌ 原子性更新失敗: ${filePath}`, error);
            throw error;
        } finally {
            // 🔓 釋放鎖
            if (release) {
                try {
                    await release();
                } catch (error) {
                    console.error(`⚠️ 釋放鎖失敗: ${filePath}`, error);
                }
            }
        }
    }

    // ==================== 檔案備份 ====================

    /**
     * 備份檔案
     * @param {string} filePath - 原始檔案路徑
     * @param {string} backupSuffix - 備份後綴（預設時間戳）
     * @returns {Promise<string>} 備份檔案路徑
     */
    async backup(filePath, backupSuffix = null) {
        try {
            await fs.access(filePath);
            
            const suffix = backupSuffix || new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}.backup-${suffix}`;
            
            await fs.copyFile(filePath, backupPath);
            console.log(`✅ 檔案已備份: ${path.basename(backupPath)}`);
            
            return backupPath;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`⚠️ 檔案不存在，無需備份: ${filePath}`);
                return null;
            }
            console.error(`❌ 備份失敗: ${filePath}`, error);
            throw error;
        }
    }

    // ==================== 清理鎖（緊急用）====================

    /**
     * 檢查檔案是否被鎖定
     * @param {string} filePath - 檔案路徑
     * @returns {Promise<boolean>} 是否被鎖定
     */
    async isLocked(filePath) {
        try {
            return await lockfile.check(filePath);
        } catch (error) {
            return false;
        }
    }

    /**
     * 強制解鎖檔案（謹慎使用）
     * @param {string} filePath - 檔案路徑
     * @returns {Promise<boolean>} 是否成功
     */
    async forceUnlock(filePath) {
        try {
            await lockfile.unlock(filePath);
            console.log(`🔓 強制解鎖成功: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            console.error(`❌ 強制解鎖失敗: ${filePath}`, error);
            return false;
        }
    }
}

// 導出單例
module.exports = new SafeFileOperations();


























