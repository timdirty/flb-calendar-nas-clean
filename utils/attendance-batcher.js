// ============================================
// 📦 簽到批次處理器
// ============================================
// 版本：2025-11-01 - 效能優化
// 功能：收集短時間內的多個簽到請求，批次處理以減少檔案 I/O

class AttendanceBatcher {
    constructor(options = {}) {
        this.queue = [];
        this.timer = null;
        this.batchDelay = options.batchDelay || 100; // 100ms 收集窗口
        this.maxBatchSize = options.maxBatchSize || 50; // 最大批次大小
        this.processor = options.processor || null; // 處理函數
        this.stats = {
            totalRecords: 0,
            totalBatches: 0,
            avgBatchSize: 0,
            errors: 0
        };
        
        console.log(`✅ 簽到批次處理器已啟動（延遲: ${this.batchDelay}ms, 最大批次: ${this.maxBatchSize}）`);
    }

    // ==================== 添加記錄 ====================

    /**
     * 添加簽到記錄到批次佇列
     * @param {object} record - 簽到記錄
     * @returns {Promise} 處理結果
     */
    add(record) {
        return new Promise((resolve, reject) => {
            // 添加到佇列
            this.queue.push({
                record,
                resolve,
                reject,
                timestamp: Date.now()
            });
            
            // 如果達到最大批次大小，立即處理
            if (this.queue.length >= this.maxBatchSize) {
                console.log(`⚡ 達到最大批次大小 (${this.maxBatchSize})，立即處理`);
                this.flush();
            } else {
                // 否則設定定時器
                this.scheduleFlush();
            }
        });
    }

    /**
     * 排程批次處理
     */
    scheduleFlush() {
        // 如果已有定時器，不重複設定
        if (this.timer) {
            return;
        }
        
        // 設定定時器
        this.timer = setTimeout(() => {
            this.flush();
        }, this.batchDelay);
    }

    // ==================== 批次處理 ====================

    /**
     * 執行批次處理
     */
    async flush() {
        // 清除定時器
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        // 如果佇列為空，直接返回
        if (this.queue.length === 0) {
            return;
        }
        
        // 取出所有待處理項目
        const batch = this.queue.splice(0);
        const batchSize = batch.length;
        
        console.log(`📦 開始批次處理 ${batchSize} 個簽到記錄...`);
        const startTime = Date.now();
        
        try {
            // 如果有自定義處理器，使用它
            if (this.processor) {
                const records = batch.map(item => item.record);
                const results = await this.processor(records);
                
                // 回傳結果給各個 Promise
                batch.forEach((item, index) => {
                    const result = results[index];
                    if (result && result.success) {
                        item.resolve(result);
                    } else {
                        item.reject(new Error(result?.error || '處理失敗'));
                    }
                });
            } else {
                // 沒有處理器，逐個處理（fallback）
                const results = await Promise.allSettled(
                    batch.map(item => this.processRecord(item.record))
                );
                
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        batch[index].resolve(result.value);
                    } else {
                        batch[index].reject(result.reason);
                    }
                });
            }
            
            // 更新統計
            this.stats.totalRecords += batchSize;
            this.stats.totalBatches++;
            this.stats.avgBatchSize = this.stats.totalRecords / this.stats.totalBatches;
            
            const elapsed = Date.now() - startTime;
            console.log(`✅ 批次處理完成: ${batchSize} 個記錄，耗時 ${elapsed}ms`);
            console.log(`   平均批次大小: ${this.stats.avgBatchSize.toFixed(2)}`);
            
        } catch (error) {
            console.error(`❌ 批次處理失敗:`, error);
            this.stats.errors++;
            
            // 全部標記為失敗
            batch.forEach(item => {
                item.reject(error);
            });
        }
    }

    /**
     * 處理單筆記錄（fallback）
     * @param {object} record - 簽到記錄
     * @returns {Promise<object>}
     */
    async processRecord(record) {
        // 這個方法應該被覆寫或通過 processor 選項提供
        console.warn('⚠️ 使用預設的 processRecord，建議提供自定義 processor');
        return {
            success: true,
            record: record
        };
    }

    // ==================== 分組批次處理 ====================

    /**
     * 按照某個鍵分組處理（例如按課程分組）
     * @param {Function} groupKeyFn - 分組鍵函數
     * @returns {Promise<void>}
     */
    async flushGrouped(groupKeyFn) {
        // 清除定時器
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        if (this.queue.length === 0) {
            return;
        }
        
        // 取出所有項目
        const batch = this.queue.splice(0);
        
        // 按分組鍵分組
        const groups = new Map();
        batch.forEach(item => {
            const key = groupKeyFn(item.record);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        });
        
        console.log(`📦 分組批次處理: ${groups.size} 個群組，共 ${batch.length} 筆記錄`);
        
        // 逐組處理
        for (const [groupKey, groupItems] of groups.entries()) {
            console.log(`   處理群組 "${groupKey}": ${groupItems.length} 筆記錄`);
            
            try {
                if (this.processor) {
                    const records = groupItems.map(item => item.record);
                    const results = await this.processor(records, groupKey);
                    
                    groupItems.forEach((item, index) => {
                        const result = results[index];
                        if (result && result.success) {
                            item.resolve(result);
                        } else {
                            item.reject(new Error(result?.error || '處理失敗'));
                        }
                    });
                }
            } catch (error) {
                console.error(`❌ 群組 "${groupKey}" 處理失敗:`, error);
                groupItems.forEach(item => item.reject(error));
            }
        }
        
        this.stats.totalRecords += batch.length;
        this.stats.totalBatches++;
    }

    // ==================== 統計與監控 ====================

    /**
     * 獲取統計資訊
     * @returns {object}
     */
    getStats() {
        return {
            queueSize: this.queue.length,
            totalRecords: this.stats.totalRecords,
            totalBatches: this.stats.totalBatches,
            avgBatchSize: this.stats.avgBatchSize.toFixed(2),
            errors: this.stats.errors,
            isProcessing: this.timer !== null
        };
    }

    /**
     * 重置統計
     */
    resetStats() {
        this.stats = {
            totalRecords: 0,
            totalBatches: 0,
            avgBatchSize: 0,
            errors: 0
        };
        console.log('📊 統計已重置');
    }

    /**
     * 列印統計摘要
     */
    printStats() {
        const stats = this.getStats();
        console.log('📊 批次處理器統計:');
        console.log(`   - 當前佇列: ${stats.queueSize}`);
        console.log(`   - 總記錄數: ${stats.totalRecords}`);
        console.log(`   - 總批次數: ${stats.totalBatches}`);
        console.log(`   - 平均批次大小: ${stats.avgBatchSize}`);
        console.log(`   - 錯誤次數: ${stats.errors}`);
        console.log(`   - 處理中: ${stats.isProcessing ? '是' : '否'}`);
    }

    // ==================== 清理 ====================

    /**
     * 立即處理所有待處理項目並關閉
     * @returns {Promise<void>}
     */
    async shutdown() {
        console.log('🛑 關閉批次處理器...');
        
        // 立即處理剩餘項目
        await this.flush();
        
        // 清除定時器
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        console.log('✅ 批次處理器已關閉');
    }
}

// 導出類別
module.exports = AttendanceBatcher;











































