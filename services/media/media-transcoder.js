/**
 * 影片轉碼與縮圖處理（統一存儲版）
 * - 所有輸出檔案都存放在同一個目錄（bucket.baseDir）
 * - 支援自定義輸出檔名
 */

const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { spawn } = require('child_process');
const {default: PQueue} = require('p-queue');

const mediaStorage = require('./media-storage');

// 🔥 根據伺服器 CPU 核心數動態調整並發數（2025-11-03 優化）
const os = require('os');
const cpuCount = os.cpus().length;

// 轉碼：使用一半核心（較耗 CPU）
const TRANSCODE_CONCURRENCY = Number(process.env.MEDIA_TRANSCODE_CONCURRENCY) || Math.max(1, Math.floor(cpuCount / 2));
// 縮圖：較輕量，可多並發
const POSTER_CONCURRENCY = Number(process.env.MEDIA_POSTER_CONCURRENCY) || Math.max(2, cpuCount - 2);

console.log(`🎬 [媒體轉碼] CPU 核心數: ${cpuCount}`);
console.log(`   轉碼並發數: ${TRANSCODE_CONCURRENCY}`);
console.log(`   縮圖並發數: ${POSTER_CONCURRENCY}`);

const videoQueue = new PQueue({ concurrency: Math.max(1, TRANSCODE_CONCURRENCY) });
const posterQueue = new PQueue({ concurrency: Math.max(1, POSTER_CONCURRENCY) });

function resolveFfmpegBinary() {
    const candidates = [
        process.env.FFMPEG_PATH,
        process.env.MEDIA_FFMPEG_PATH,
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/opt/bin/ffmpeg',
        '/var/packages/CodecPack/target/usr/bin/ffmpeg',
        '/volume1/@appstore/CodecPack/usr/bin/ffmpeg',
        'ffmpeg'
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            if (!fs.existsSync(candidate)) continue;
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
        } catch (err) {
            continue;
        }
    }

    return 'ffmpeg';
}

const FFMPEG_BIN = resolveFfmpegBinary();

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const job = spawn(FFMPEG_BIN, args, { stdio: 'pipe' });
        let stderr = '';
        job.stderr.on('data', chunk => { stderr += chunk.toString(); });
        job.on('error', reject);
        job.on('close', code => {
            if (code === 0) {
                resolve({ code, stderr });
            } else {
                const error = new Error(`FFmpeg 執行失敗 (code=${code})`);
                error.code = code;
                error.stderr = stderr;
                reject(error);
            }
        });
    });
}

/**
 * 轉碼為 WebM 格式（統一使用 WebM，相容性佳且壓縮率高）
 * @param {string} inputPath - 輸入影片路徑
 * @param {string} outputDir - 輸出目錄
 * @param {string} outputName - 輸出檔名（含副檔名）
 */
async function transcodeToWebm(inputPath, outputDir, outputName) {
    await fsPromises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, outputName);

    const exists = fs.existsSync(outputPath);
    if (exists) {
        console.log('✅ 轉碼檔案已存在，跳過:', outputPath);
        return {
            outputPath,
            outputName,
            reused: true
        };
    }

    console.log('🎬 開始轉碼:', inputPath, '→', outputPath);

    // 🔥 優化後的轉碼參數（2025-11-03 效能提升）
    const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libvpx-vp9',
        '-crf', process.env.MEDIA_TRANSCODE_CRF || '28',  // 降低 CRF（30→28），提升品質
        '-b:v', '0',
        '-deadline', 'good',
        '-cpu-used', '1',                                  // 降低 CPU 預設（2→1），提升品質
        '-row-mt', '1',                                    // 🔥 新增：多執行緒加速（行級多執行緒）
        '-threads', '4',                                   // 🔥 新增：指定執行緒數
        '-tile-columns', '2',                              // 🔥 新增：VP9 平行化（2^2 = 4 tiles）
        '-vf', 'scale=1280:-2',                            // 🔥 新增：限制輸出解析度，減少檔案大小
        '-c:a', 'libopus',
        '-b:a', '128k',
        outputPath
    ];

    await runFfmpeg(args);
    console.log('✅ 轉碼完成:', outputPath);
    
    return {
        outputPath,
        outputName,
        reused: false
    };
}

/**
 * 提取影片縮圖
 * @param {string} inputPath - 輸入影片路徑
 * @param {string} outputDir - 輸出目錄
 * @param {string} outputName - 輸出檔名（含副檔名）
 * @param {number} seekSecond - 提取第幾秒的畫面
 */
async function extractPoster(inputPath, outputDir, outputName, seekSecond = 2) {
    await fsPromises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, outputName);

    const exists = fs.existsSync(outputPath);
    if (exists) {
        console.log('✅ 縮圖已存在，跳過:', outputPath);
        return {
            outputPath,
            outputName,
            reused: true
        };
    }

    console.log('📸 開始提取縮圖:', inputPath, '→', outputPath);

    // 🔥 優化後的縮圖參數（2025-11-03 效能提升）
    const args = [
        '-y',
        '-i', inputPath,
        '-ss', String(seekSecond),                         // 提取第 2 秒（避免黑屏）
        '-vframes', '1',
        '-vf', 'scale=1280:-2',                            // 保持比例（-2 確保偶數）
        '-q:v', '2',                                       // 🔥 新增：JPEG 品質（1-31，越小越好）
        outputPath
    ];

    await runFfmpeg(args);
    console.log('✅ 縮圖完成:', outputPath);
    
    return {
        outputPath,
        outputName,
        reused: false
    };
}

/**
 * 建立轉碼與縮圖輸出
 * @param {object} bucket - 儲存桶資訊
 * @param {string} originFilePath - 原始影片路徑
 * @param {object} options - 選項 { outputName, posterName }
 */
async function createOutputs(bucket, originFilePath, options = {}) {
    const baseName = path.basename(originFilePath, path.extname(originFilePath));
    
    // 決定輸出檔名
    const transcodedName = options.outputName || `${baseName}.webm`;
    const posterName = options.posterName || `${baseName}.thumb.jpg`;
    
    // 所有檔案都輸出到同一個目錄（bucket.baseDir）
    const outputDir = bucket.baseDir;
    
    // 轉碼
    const transcodeResult = await transcodeToWebm(originFilePath, outputDir, transcodedName);
    
    // 提取縮圖（從轉碼後的檔案提取，確保品質）
    const posterResult = await extractPoster(
        transcodeResult.outputPath,
        outputDir,
        posterName
    );

    console.log('🎉 影片處理完成:', {
        origin: originFilePath,
        transcoded: transcodeResult.outputPath,
        poster: posterResult.outputPath
    });

    return {
        transcoded: transcodeResult,
        poster: posterResult
    };
}

/**
 * 加入轉碼佇列
 */
function enqueueTranscode(bucket, originFilePath, options = {}) {
    return videoQueue.add(() => createOutputs(bucket, originFilePath, options)
        .catch((err) => {
            console.error('❌ 影片轉碼失敗:', err.stderr || err.message);
            throw err;
        }));
}

/**
 * 僅提取縮圖（加入佇列）
 */
function enqueuePosterOnly(bucket, originFilePath, seekSecond, outputName) {
    const baseName = path.basename(originFilePath, path.extname(originFilePath));
    const posterName = outputName || `${baseName}.thumb.jpg`;
    
    return posterQueue.add(() => extractPoster(
        originFilePath,
        bucket.baseDir,
        posterName,
        seekSecond
    ).catch((err) => {
        console.error('❌ 影片縮圖失敗:', err.stderr || err.message);
        throw err;
    }));
}

module.exports = {
    enqueueTranscode,
    enqueuePosterOnly,
    queues: {
        videoQueue,
        posterQueue
    },
    FFMPEG_BIN
};
