/**
 * 照片处理模块
 * 功能：
 * 1. 生成缩图（用于列表快速加载）
 * 2. 图片优化/压缩
 * 3. 元数据管理
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * 缩图尺寸配置
 */
const THUMBNAIL_SIZES = {
    small: { width: 200, height: 200, suffix: 'thumb' },      // 列表缩图
    medium: { width: 800, height: 800, suffix: 'preview' },   // 预览图
    // large: 原图保留
};

/**
 * 为照片生成缩图
 * @param {string} inputPath - 原始照片路径
 * @param {string} outputDir - 输出目录
 * @param {string} baseFilename - 基础文件名（不含扩展名）
 * @returns {Promise<Object>} 生成的缩图信息
 */
async function generateThumbnails(inputPath, outputDir, baseFilename) {
    console.log('📸 开始生成照片缩图:', inputPath);
    
    const results = {
        small: null,
        medium: null,
        error: null
    };
    
    try {
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        
        console.log('📊 原始图片信息:', {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: fs.statSync(inputPath).size
        });
        
        // 生成小缩图（列表用）
        const smallPath = path.join(outputDir, `${baseFilename}.${THUMBNAIL_SIZES.small.suffix}.jpg`);
        await image
            .clone()
            .resize(THUMBNAIL_SIZES.small.width, THUMBNAIL_SIZES.small.height, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(smallPath);
        
        results.small = {
            path: smallPath,
            filename: path.basename(smallPath),
            width: THUMBNAIL_SIZES.small.width,
            height: THUMBNAIL_SIZES.small.height,
            size: fs.statSync(smallPath).size
        };
        
        console.log('✅ 小缩图生成完成:', results.small.filename);
        
        // 生成中等预览图（只有大图才需要）
        if (metadata.width > THUMBNAIL_SIZES.medium.width || metadata.height > THUMBNAIL_SIZES.medium.height) {
            const mediumPath = path.join(outputDir, `${baseFilename}.${THUMBNAIL_SIZES.medium.suffix}.jpg`);
            await image
                .clone()
                .resize(THUMBNAIL_SIZES.medium.width, THUMBNAIL_SIZES.medium.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85 })
                .toFile(mediumPath);
            
            results.medium = {
                path: mediumPath,
                filename: path.basename(mediumPath),
                width: THUMBNAIL_SIZES.medium.width,
                height: THUMBNAIL_SIZES.medium.height,
                size: fs.statSync(mediumPath).size
            };
            
            console.log('✅ 预览图生成完成:', results.medium.filename);
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ 缩图生成失败:', error);
        results.error = error.message;
        return results;
    }
}

/**
 * 优化照片（可选压缩）
 * @param {string} inputPath - 原始照片路径
 * @param {string} outputPath - 输出路径
 * @param {Object} options - 优化选项
 * @returns {Promise<Object>} 优化结果
 */
async function optimizePhoto(inputPath, outputPath, options = {}) {
    const {
        quality = 90,
        maxWidth = 1920,
        maxHeight = 1920,
        format = 'jpeg'
    } = options;
    
    try {
        console.log('🔧 优化照片:', inputPath);
        
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        
        // 如果图片已经很小，直接复制
        if (metadata.width <= maxWidth && metadata.height <= maxHeight) {
            fs.copyFileSync(inputPath, outputPath);
            return {
                success: true,
                optimized: false,
                originalSize: fs.statSync(inputPath).size,
                outputSize: fs.statSync(outputPath).size
            };
        }
        
        // 需要调整大小
        await image
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality })
            .toFile(outputPath);
        
        const originalSize = fs.statSync(inputPath).size;
        const outputSize = fs.statSync(outputPath).size;
        const savings = ((1 - outputSize / originalSize) * 100).toFixed(2);
        
        console.log('✅ 照片优化完成:', {
            originalSize: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
            outputSize: `${(outputSize / 1024 / 1024).toFixed(2)} MB`,
            savings: `${savings}%`
        });
        
        return {
            success: true,
            optimized: true,
            originalSize,
            outputSize,
            savings: parseFloat(savings)
        };
        
    } catch (error) {
        console.error('❌ 照片优化失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 处理单张照片（生成缩图 + 可选优化）
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputDir - 输出目录
 * @param {string} photoId - 照片 ID (UUID)
 * @param {Object} options - 处理选项
 * @returns {Promise<Object>} 处理结果
 */
async function processPhoto(inputPath, outputDir, photoId, options = {}) {
    const {
        originalName,
        optimize = true,
        generateThumbs = true
    } = options;
    
    try {
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const ext = path.extname(inputPath);
        
        const result = {
            id: photoId,
            originalName: originalName || path.basename(inputPath),
            filename: null,
            thumbnails: {},
            optimized: null,
            status: 'processing'
        };
        
        // 1. 优化原图（可选）
        if (optimize) {
            const optimizedPath = path.join(outputDir, `${baseName}-${photoId}${ext}`);
            const optimizeResult = await optimizePhoto(inputPath, optimizedPath);
            
            if (optimizeResult.success) {
                result.filename = path.basename(optimizedPath);
                result.optimized = optimizeResult;
            } else {
                // 优化失败，使用原图
                const directPath = path.join(outputDir, `${baseName}-${photoId}${ext}`);
                fs.copyFileSync(inputPath, directPath);
                result.filename = path.basename(directPath);
            }
        } else {
            // 不优化，直接使用原图
            const directPath = path.join(outputDir, `${baseName}-${photoId}${ext}`);
            fs.copyFileSync(inputPath, directPath);
            result.filename = path.basename(directPath);
        }
        
        // 🔥 删除原始合并文件（避免重复）
        try {
            if (fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
                console.log('✅ 已删除原始合并文件:', path.basename(inputPath));
            }
        } catch (e) {
            console.warn('⚠️ 删除原始文件失败:', e.message);
        }
        
        // 2. 生成缩图
        if (generateThumbs) {
            const finalPath = path.join(outputDir, result.filename);
            const thumbs = await generateThumbnails(finalPath, outputDir, `${baseName}-${photoId}`);
            
            if (thumbs.small) {
                result.thumbnails.small = thumbs.small.filename;
            }
            if (thumbs.medium) {
                result.thumbnails.medium = thumbs.medium.filename;
            }
            if (thumbs.error) {
                console.warn('⚠️ 缩图生成部分失败:', thumbs.error);
            }
        }
        
        result.status = 'ready';
        result.fileSize = fs.statSync(path.join(outputDir, result.filename)).size;
        result.processedAt = Date.now();
        
        console.log('✅ 照片处理完成:', result);
        return result;
        
    } catch (error) {
        console.error('❌ 照片处理失败:', error);
        return {
            id: photoId,
            status: 'error',
            error: error.message
        };
    }
}

module.exports = {
    generateThumbnails,
    optimizePhoto,
    processPhoto,
    THUMBNAIL_SIZES
};

