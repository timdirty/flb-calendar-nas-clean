/**
 * 媒體處理模組
 * 功能: 高效率縮圖生成、影片處理、隊列管理
 * 使用: Sharp (高效能影像處理) + p-queue (任務隊列)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
// 🔥 使用 p-queue v6.6.2 (CommonJS 兼容版本)
const {default: PQueue} = require('p-queue');

// 處理隊列：限制並發數，避免 CPU 過載
const imageQueue = new PQueue({ concurrency: 2 });
const videoQueue = new PQueue({ concurrency: 1 });

/**
 * 生成多尺寸縮圖（WebP 格式）
 * @param {string} originalPath - 原始圖片路徑
 * @param {string} outputDir - 輸出目錄
 * @returns {Promise<Object>} 包含各尺寸縮圖路徑
 */
async function generateThumbnails(originalPath, outputDir) {
    const sizes = [
        { name: 'thumb', width: 200, height: 200 },
        { name: 'medium', width: 800, height: 800 },
        { name: 'large', width: 1920, height: 1920 }
    ];

    const results = {};
    
    // 確保輸出目錄存在
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
        console.error('❌ 建立縮圖目錄失敗:', error);
    }

    // 檢查原始檔案是否存在
    if (!fsSync.existsSync(originalPath)) {
        throw new Error(`原始檔案不存在: ${originalPath}`);
    }

    try {
        // 讀取原始圖片
        const image = sharp(originalPath);
        const metadata = await image.metadata();

        console.log('📸 處理圖片:', {
            file: path.basename(originalPath),
            width: metadata.width,
            height: metadata.height,
            format: metadata.format
        });

        // 並行生成多種尺寸
        const generatePromises = sizes.map(async (size) => {
            const filename = `${path.basename(originalPath, path.extname(originalPath))}_${size.name}.webp`;
            const outputPath = path.join(outputDir, filename);

            try {
                await sharp(originalPath)
                    .resize(size.width, size.height, { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    })
                    .webp({ quality: 85 })
                    .toFile(outputPath);

                results[size.name] = outputPath;
                console.log(`✅ 生成 ${size.name} 縮圖:`, filename);
            } catch (error) {
                console.error(`❌ 生成 ${size.name} 縮圖失敗:`, error);
                // 不中斷整體流程，允許部分成功
            }
        });

        await Promise.all(generatePromises);
    } catch (error) {
        console.error('❌ 圖片處理失敗:', error);
        throw error;
    }

    return results;
}

/**
 * 檢查檔案是否為影像檔
 * @param {string} filePath - 檔案路徑
 * @returns {boolean}
 */
function isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'].includes(ext);
}

/**
 * 檢查檔案是否為影片檔
 * @param {string} filePath - 檔案路徑
 * @returns {boolean}
 */
function isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.mp4', '.mov', '.avi', '.m4v', '.mkv', '.webm'].includes(ext);
}

/**
 * 批次處理目錄中的所有圖片
 * @param {string} inputDir - 輸入目錄
 * @param {string} outputDir - 輸出目錄
 * @returns {Promise<Object>} 處理結果統計
 */
async function batchProcessImages(inputDir, outputDir) {
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        results: []
    };

    try {
        const files = await fs.readdir(inputDir);
        const imageFiles = files.filter(f => isImageFile(path.join(inputDir, f)));
        
        stats.total = imageFiles.length;
        console.log(`📦 開始批次處理 ${stats.total} 張圖片...`);

        for (const file of imageFiles) {
            const inputPath = path.join(inputDir, file);
            try {
                const result = await generateThumbnails(inputPath, outputDir);
                stats.success++;
                stats.results.push({
                    file,
                    success: true,
                    thumbnails: result
                });
            } catch (error) {
                stats.failed++;
                stats.results.push({
                    file,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`✅ 批次處理完成: 成功 ${stats.success}, 失敗 ${stats.failed}`);
    } catch (error) {
        console.error('❌ 批次處理失敗:', error);
        throw error;
    }

    return stats;
}

/**
 * 清理過期的臨時縮圖（可選功能）
 * @param {string} thumbnailDir - 縮圖目錄
 * @param {number} maxAgeMs - 最大保留時間（毫秒）
 */
async function cleanupOldThumbnails(thumbnailDir, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    try {
        const files = await fs.readdir(thumbnailDir);
        const now = Date.now();
        let cleaned = 0;

        for (const file of files) {
            const filePath = path.join(thumbnailDir, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > maxAgeMs) {
                await fs.unlink(filePath);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 清理了 ${cleaned} 個過期縮圖`);
        }
    } catch (error) {
        console.error('⚠️ 清理縮圖失敗:', error);
    }
}

// 導出隊列化版本
module.exports = {
    // 主要功能
    generateThumbnails: (original, output) => imageQueue.add(() => generateThumbnails(original, output)),
    batchProcessImages: (inputDir, outputDir) => imageQueue.add(() => batchProcessImages(inputDir, outputDir)),
    
    // 工具函數
    isImageFile,
    isVideoFile,
    cleanupOldThumbnails,
    
    // 佇列實例（供監控使用）
    imageQueue,
    videoQueue,
    
    // 佇列統計
    getQueueStats: () => ({
        image: {
            size: imageQueue.size,
            pending: imageQueue.pending,
            isPaused: imageQueue.isPaused
        },
        video: {
            size: videoQueue.size,
            pending: videoQueue.pending,
            isPaused: videoQueue.isPaused
        }
    })
};

