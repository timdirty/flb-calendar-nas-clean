// ============================================
// 📝 智能日誌管理器
// ============================================
// 版本：2025-11-01 - 效能優化
// 功能：日誌等級控制、節流、統計

class Logger {
    constructor(options = {}) {
        this.level = options.level || process.env.LOG_LEVEL || 'INFO';
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile || false;
        this.filePath = options.filePath || null;
        
        // 日誌等級優先級
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            NONE: 4
        };
        
        // 節流快取（避免重複日誌）
        this.throttleCache = new Map();
        this.throttleWindow = 5000; // 5秒內相同訊息只輸出一次
        
        // 統計
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            throttled: 0
        };
        
        console.log(`✅ Logger 已啟動（等級: ${this.level}）`);
    }

    // ==================== 核心方法 ====================

    /**
     * 檢查是否應該輸出日誌
     */
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }

    /**
     * 格式化日誌訊息
     */
    format(level, emoji, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] ${emoji} [${level}]`;
        return [prefix, ...args];
    }

    /**
     * 輸出日誌
     */
    output(level, ...args) {
        if (!this.shouldLog(level)) {
            return;
        }

        if (this.enableConsole) {
            if (level === 'ERROR') {
                console.error(...args);
            } else if (level === 'WARN') {
                console.warn(...args);
            } else {
                console.log(...args);
            }
        }

        // 更新統計
        const statKey = level.toLowerCase();
        if (this.stats[statKey] !== undefined) {
            this.stats[statKey]++;
        }
    }

    // ==================== 基本日誌方法 ====================

    debug(...args) {
        this.output('DEBUG', ...this.format('DEBUG', '🔍', ...args));
    }

    info(...args) {
        this.output('INFO', ...this.format('INFO', '📝', ...args));
    }

    warn(...args) {
        this.output('WARN', ...this.format('WARN', '⚠️', ...args));
    }

    error(...args) {
        this.output('ERROR', ...this.format('ERROR', '❌', ...args));
    }

    success(...args) {
        this.output('INFO', ...this.format('INFO', '✅', ...args));
    }

    // ==================== 節流日誌（避免洗版）====================

    /**
     * 節流日誌輸出（相同訊息在時間窗口內只輸出一次）
     * @param {string} key - 唯一識別鍵
     * @param {string} level - 日誌等級
     * @param  {...any} args - 日誌內容
     */
    throttle(key, level = 'INFO', ...args) {
        const now = Date.now();
        const cached = this.throttleCache.get(key);

        // 如果在節流窗口內，跳過
        if (cached && now - cached.timestamp < this.throttleWindow) {
            cached.count++;
            this.stats.throttled++;
            return;
        }

        // 如果之前有被節流的訊息，顯示統計
        if (cached && cached.count > 0) {
            this[level.toLowerCase()](
                `${args[0]} (已節流 ${cached.count} 次)`
            );
            this.throttleCache.delete(key);
        } else {
            // 正常輸出
            this[level.toLowerCase()](...args);
        }

        // 更新快取
        this.throttleCache.set(key, {
            timestamp: now,
            count: 0
        });
    }

    // ==================== 特定場景的日誌方法 ====================

    /**
     * API 請求日誌
     */
    api(method, path, statusCode = null, duration = null) {
        if (!this.shouldLog('DEBUG')) return;

        const parts = [`${method} ${path}`];
        if (statusCode) parts.push(`[${statusCode}]`);
        if (duration) parts.push(`(${duration}ms)`);

        this.debug(...parts);
    }

    /**
     * 資料庫操作日誌
     */
    db(operation, collection, details = {}) {
        if (!this.shouldLog('DEBUG')) return;

        this.debug(`DB: ${operation} ${collection}`, details);
    }

    /**
     * 排程任務日誌
     */
    schedule(taskName, status = 'start') {
        const emoji = status === 'start' ? '⏰' : 
                     status === 'done' ? '✅' : 
                     status === 'error' ? '❌' : '📋';
        
        this.info(`${emoji} [排程] ${taskName} - ${status}`);
    }

    /**
     * 效能日誌
     */
    perf(label, startTime) {
        if (!this.shouldLog('DEBUG')) return;

        const duration = Date.now() - startTime;
        const emoji = duration < 100 ? '🚀' : duration < 1000 ? '✅' : '⚠️';
        
        this.debug(`${emoji} [效能] ${label}: ${duration}ms`);
    }

    // ==================== 群組日誌 ====================

    /**
     * 開始日誌群組
     */
    group(label) {
        if (this.enableConsole && this.shouldLog('DEBUG')) {
            console.group(label);
        }
    }

    /**
     * 結束日誌群組
     */
    groupEnd() {
        if (this.enableConsole && this.shouldLog('DEBUG')) {
            console.groupEnd();
        }
    }

    // ==================== 統計與維護 ====================

    /**
     * 獲取日誌統計
     */
    getStats() {
        return {
            ...this.stats,
            currentLevel: this.level,
            throttleCacheSize: this.throttleCache.size
        };
    }

    /**
     * 重置統計
     */
    resetStats() {
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            throttled: 0
        };
    }

    /**
     * 清理節流快取
     */
    cleanupThrottleCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, data] of this.throttleCache.entries()) {
            if (now - data.timestamp > this.throttleWindow * 2) {
                this.throttleCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.debug(`🧹 清理 ${cleaned} 個過期的節流快取`);
        }
    }

    /**
     * 設定日誌等級
     */
    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.level = level;
            this.info(`📝 日誌等級已更新: ${level}`);
        } else {
            this.warn(`⚠️ 無效的日誌等級: ${level}`);
        }
    }

    /**
     * 列印統計摘要
     */
    printStats() {
        const stats = this.getStats();
        console.log('\n📊 日誌統計摘要:');
        console.log(`   - DEBUG: ${stats.debug}`);
        console.log(`   - INFO: ${stats.info}`);
        console.log(`   - WARN: ${stats.warn}`);
        console.log(`   - ERROR: ${stats.error}`);
        console.log(`   - 已節流: ${stats.throttled}`);
        console.log(`   - 當前等級: ${stats.currentLevel}`);
        console.log(`   - 節流快取: ${stats.throttleCacheSize}\n`);
    }
}

// 創建全域實例
const logger = new Logger({
    level: process.env.LOG_LEVEL || 'INFO',
    enableConsole: true
});

// 定期清理節流快取（每10分鐘）
setInterval(() => {
    logger.cleanupThrottleCache();
}, 10 * 60 * 1000);

// 導出全域實例
module.exports = logger;

// 也導出類別（允許創建多個實例）
module.exports.Logger = Logger;











































