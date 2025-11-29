#!/usr/bin/env node

/**
 * 🧪 整合測試 - 檔案上傳流程
 * 測試實際的檔案上傳 metadata 處理
 */

const path = require('path');
const assert = require('assert');

// 載入相關模組
const metadataTransformer = require('../utils/metadata-transformer');
const DrivePathManager = require('../drive-path-manager');
const LearningUploadHelper = require('../learning-upload-helper');

// Mock Synology Drive Client
class MockDriveClient {
    constructor() {
        this.uploadedFiles = [];
        this.createdDirs = [];
    }
    
    async createFolder(folderPath) {
        this.createdDirs.push(folderPath);
        console.log(`   📁 建立資料夾: ${folderPath}`);
        return { success: true };
    }
    
    async uploadFile(buffer, filePath, options) {
        this.uploadedFiles.push({ 
            path: filePath, 
            size: buffer.length,
            contentType: options.contentType 
        });
        console.log(`   📤 上傳檔案: ${filePath} (${buffer.length} bytes)`);
        return { success: true };
    }
    
    async getFileStream(filePath) {
        throw new Error(`檔案不存在: ${filePath}`);
    }
    
    async listFiles(dirPath) {
        return { files: [] };
    }
}

// 測試案例
async function runTests() {
    console.log('🔧 整合測試：檔案上傳流程');
    console.log('='.repeat(50));
    
    // 初始化
    const mockDriveClient = new MockDriveClient();
    const pathManager = new DrivePathManager('/Fun Learn Bar/FLB-Learning-Portfolio');
    const uploadHelper = new LearningUploadHelper(mockDriveClient, pathManager);
    
    try {
        // ============================================
        // 測試 1：學生檔案上傳
        // ============================================
        console.log('\n📝 測試 1：學生檔案上傳');
        
        // 模擬前端參數
        const frontendParams = {
            courseName: 'SPIKE 五 1610-1740 松山 第8週',
            date: '2025-09-17',
            studentName: '王小明',
            topic: '機器人課程',
            comment: '今天表現很好',
            isOverview: false
        };
        
        // 1. 標準化 metadata
        const normalized1 = metadataTransformer.normalize(frontendParams);
        console.log('   ✅ Metadata 標準化完成');
        
        // 2. 解析上傳參數
        const uploadParams1 = uploadHelper.parseUploadParams(normalized1);
        console.log('   ✅ 參數解析完成:', {
            semester: uploadParams1.semester,
            courseName: uploadParams1.courseName,
            studentName: uploadParams1.studentName
        });
        
        // 驗證課程名稱已清理
        assert.ok(!uploadParams1.courseName.includes('第8週'), '課程名稱應該已清理週次');
        
        // 3. 建構路徑
        const uploadPath1 = pathManager.buildStudentRecordPath(
            uploadParams1.semester,
            uploadParams1.courseName,
            uploadParams1.date,
            uploadParams1.topic,
            uploadParams1.studentName
        );
        console.log('   ✅ 路徑建構完成:', uploadPath1);
        
        // 驗證路徑格式
        assert.ok(uploadPath1.includes('114-1'), '路徑應包含學期');
        assert.ok(uploadPath1.includes('SPIKE 五 1610-1740 松山'), '路徑應包含清理後的課程名稱');
        assert.ok(uploadPath1.includes('2025-09-17'), '路徑應包含日期');
        assert.ok(uploadPath1.includes('王小明'), '路徑應包含學生名稱');
        
        // ============================================
        // 測試 2：課程總覽上傳
        // ============================================
        console.log('\n📝 測試 2：課程總覽上傳');
        
        const overviewParams = {
            courseName: 'Python Programming Week 5',
            date: '2025-03-15',
            isOverview: true,
            topic: '函式與模組',
            instructorName: '李老師'
        };
        
        // 1. 標準化 metadata
        const normalized2 = metadataTransformer.normalize(overviewParams);
        console.log('   ✅ Metadata 標準化完成');
        
        // 驗證課程總覽設定
        assert.strictEqual(normalized2.isOverview, true, 'isOverview 應為 true');
        assert.strictEqual(normalized2.studentName, '課程總覽', '學生名稱應為「課程總覽」');
        
        // 2. 解析上傳參數
        const uploadParams2 = uploadHelper.parseUploadParams(normalized2);
        console.log('   ✅ 參數解析完成:', {
            semester: uploadParams2.semester,
            courseName: uploadParams2.courseName,
            isOverview: uploadParams2.isOverview
        });
        
        // 驗證課程名稱已清理
        assert.ok(!uploadParams2.courseName.includes('Week 5'), '課程名稱應該已清理週次');
        
        // 3. 建構路徑
        const uploadPath2 = pathManager.buildOverviewRecordPath(
            uploadParams2.semester,
            uploadParams2.courseName,
            uploadParams2.date,
            uploadParams2.topic
        );
        console.log('   ✅ 路徑建構完成:', uploadPath2);
        
        // 驗證路徑格式
        assert.ok(uploadPath2.includes('114-2'), '路徑應包含學期（3月是下學期）');
        assert.ok(uploadPath2.includes('Python Programming'), '路徑應包含清理後的課程名稱');
        assert.ok(uploadPath2.includes('課程總覽'), '路徑應包含「課程總覽」');
        
        // ============================================
        // 測試 3：Metadata 合併
        // ============================================
        console.log('\n📝 測試 3：Metadata 合併');
        
        // 模擬多個來源的 metadata
        const serverMeta = { 
            semester: '114-1',
            instructorName: '張老師'
        };
        
        const clientMeta = {
            courseName: 'SPIKE 課程',
            studentName: '李小華'
        };
        
        const sessionMeta = {
            date: '2025-09-20',
            topic: '感測器應用'
        };
        
        // 合併 metadata
        const merged = metadataTransformer.merge(serverMeta, clientMeta, sessionMeta);
        console.log('   ✅ Metadata 合併完成:', merged);
        
        // 驗證合併結果
        assert.strictEqual(merged.semester, '114-1', '學期應該被保留');
        assert.strictEqual(merged.courseName, 'SPIKE 課程', '課程名稱應該被保留');
        assert.strictEqual(merged.studentName, '李小華', '學生名稱應該被保留');
        assert.strictEqual(merged.date, '2025-09-20', '日期應該被保留');
        assert.strictEqual(merged.topic, '感測器應用', '主題應該被保留');
        assert.strictEqual(merged.instructorName, '張老師', '講師名稱應該被保留');
        
        // ============================================
        // 測試 4：格式轉換
        // ============================================
        console.log('\n📝 測試 4：格式轉換');
        
        const originalMeta = {
            semester: '114-1',
            courseName: 'SPIKE 課程',
            date: '2025-09-20',
            studentName: '王小明',
            instructorName: '張老師',
            topic: '機器人',
            isOverview: false
        };
        
        // 轉換為前端格式
        const frontendFormat = metadataTransformer.toFrontendFormat(originalMeta);
        console.log('   ✅ 轉換為前端格式');
        assert.strictEqual(frontendFormat.dateKey, '2025-09-20', 'dateKey 應該等於 date');
        assert.strictEqual(frontendFormat.mode, 'student', 'mode 應該是 student');
        assert.strictEqual(frontendFormat.coursePeriod, 'SPIKE 課程', 'coursePeriod 應該等於 courseName');
        
        // 轉換為後端格式
        const backendFormat = metadataTransformer.toBackendFormat(originalMeta);
        console.log('   ✅ 轉換為後端格式');
        assert.strictEqual(backendFormat.teacherName, '張老師', 'teacherName 應該等於 instructorName');
        assert.strictEqual(backendFormat.dateKey, '2025-09-20', 'dateKey 應該等於 date');
        assert.strictEqual(backendFormat.metadata._normalized, true, '應該有 _normalized 標記');
        
        // ============================================
        // 測試 5：邊界情況
        // ============================================
        console.log('\n📝 測試 5：邊界情況');
        
        // 空 metadata
        const emptyMeta = metadataTransformer.normalize({});
        console.log('   ✅ 處理空 metadata');
        assert.strictEqual(emptyMeta.studentName, '', '空 metadata 的學生名稱應為空字串');
        assert.strictEqual(emptyMeta.courseName, '', '空 metadata 的課程名稱應為空字串');
        
        // 驗證空 metadata
        const validation = metadataTransformer.validate(emptyMeta);
        console.log('   ✅ 驗證空 metadata');
        assert.strictEqual(validation.valid, false, '空 metadata 應該驗證失敗');
        assert.ok(validation.missing.length > 0, '應該有缺失的必要欄位');
        
        // 無效日期處理
        const invalidDateMeta = metadataTransformer.normalize({
            date: 'invalid-date',
            courseName: 'Test Course'
        });
        console.log('   ✅ 處理無效日期');
        assert.ok(invalidDateMeta.date, '應該保留原始日期字串');
        
        // ============================================
        // 總結
        // ============================================
        console.log('\n' + '='.repeat(50));
        console.log('✅ 所有整合測試通過！');
        console.log('系統優化後的 metadata 處理正常運作');
        
    } catch (error) {
        console.error('\n❌ 測試失敗:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 執行測試
runTests().catch(error => {
    console.error('執行錯誤:', error);
    process.exit(1);
});
