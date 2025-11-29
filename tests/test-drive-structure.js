#!/usr/bin/env node
/**
 * Drive 目錄結構診斷工具
 * 用於診斷課程總覽無法回填的問題
 */

const axios = require('axios');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TEST_CONFIG = {
  semester: '114-1',
  courseName: 'SPIKE 一 1930-2100 客製化', // 移除週次
  date: '2025-11-17'
};

console.log('📋 Drive 目錄結構診斷工具');
console.log('='.repeat(60));
console.log('🔍 測試配置:', TEST_CONFIG);
console.log('🌐 伺服器:', SERVER_URL);
console.log('='.repeat(60));

async function testDriveStructure() {
  try {
    // 測試 1: 檢查伺服器健康狀態
    console.log('\n📌 測試 1: 檢查伺服器健康狀態');
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log('✅ 伺服器正常:', healthResponse.data);
    
    // 測試 2: 使用完整課程名稱查詢（包含週次）
    console.log('\n📌 測試 2: 使用完整課程名稱查詢（包含週次）');
    const fullCourseName = 'SPIKE 一 1930-2100 客製化 第11週';
    console.log('🔍 查詢參數:', { 
      semester: TEST_CONFIG.semester, 
      courseName: fullCourseName, 
      date: TEST_CONFIG.date 
    });
    
    try {
      const response1 = await axios.get(
        `${SERVER_URL}/api/learning-records/history-drive`,
        {
          params: {
            semester: TEST_CONFIG.semester,
            courseName: fullCourseName,
            date: TEST_CONFIG.date
          }
        }
      );
      
      console.log('📊 API 回應:', {
        success: response1.data.success,
        records數量: response1.data.count,
        searchParams: response1.data.searchParams
      });
      
      if (response1.data.records && response1.data.records.length > 0) {
        console.log('✅ 找到記錄！');
        response1.data.records.forEach((record, idx) => {
          console.log(`   📄 記錄 ${idx + 1}:`, {
            studentName: record.studentName,
            isOverview: record.isOverview,
            recordPath: record.recordPath,
            photos: record.photos.length,
            videos: record.videos.length
          });
        });
      } else {
        console.log('❌ 未找到記錄');
      }
    } catch (error) {
      console.log('❌ 查詢失敗:', error.response?.data || error.message);
    }
    
    // 測試 3: 使用清理後的課程名稱查詢（不含週次）
    console.log('\n📌 測試 3: 使用清理後的課程名稱查詢（不含週次）');
    console.log('🔍 查詢參數:', { 
      semester: TEST_CONFIG.semester, 
      courseName: TEST_CONFIG.courseName, 
      date: TEST_CONFIG.date 
    });
    
    try {
      const response2 = await axios.get(
        `${SERVER_URL}/api/learning-records/history-drive`,
        {
          params: {
            semester: TEST_CONFIG.semester,
            courseName: TEST_CONFIG.courseName,
            date: TEST_CONFIG.date
          }
        }
      );
      
      console.log('📊 API 回應:', {
        success: response2.data.success,
        records數量: response2.data.count,
        searchParams: response2.data.searchParams
      });
      
      if (response2.data.records && response2.data.records.length > 0) {
        console.log('✅ 找到記錄！');
        response2.data.records.forEach((record, idx) => {
          console.log(`   📄 記錄 ${idx + 1}:`, {
            studentName: record.studentName,
            isOverview: record.isOverview,
            recordPath: record.recordPath,
            photos: record.photos.length,
            videos: record.videos.length
          });
        });
      } else {
        console.log('❌ 未找到記錄');
      }
    } catch (error) {
      console.log('❌ 查詢失敗:', error.response?.data || error.message);
    }
    
    // 測試 4: 只使用學期查詢（列出所有課程）
    console.log('\n📌 測試 4: 只使用學期查詢（列出所有課程）');
    console.log('🔍 查詢參數:', { semester: TEST_CONFIG.semester });
    
    try {
      const response3 = await axios.get(
        `${SERVER_URL}/api/learning-records/history-drive`,
        {
          params: {
            semester: TEST_CONFIG.semester
          }
        }
      );
      
      console.log('📊 API 回應:', {
        success: response3.data.success,
        records數量: response3.data.count
      });
      
      if (response3.data.records && response3.data.records.length > 0) {
        console.log(`✅ 找到 ${response3.data.records.length} 筆記錄`);
        
        // 列出前10筆記錄
        const displayRecords = response3.data.records.slice(0, 10);
        displayRecords.forEach((record, idx) => {
          console.log(`   📄 記錄 ${idx + 1}:`, {
            studentName: record.studentName,
            isOverview: record.isOverview,
            recordPath: record.recordPath
          });
        });
        
        if (response3.data.records.length > 10) {
          console.log(`   ... 還有 ${response3.data.records.length - 10} 筆記錄未顯示`);
        }
        
        // 尋找課程總覽記錄
        const overviewRecords = response3.data.records.filter(r => r.isOverview || r.studentName === '課程總覽');
        if (overviewRecords.length > 0) {
          console.log(`\n📋 找到 ${overviewRecords.length} 筆課程總覽記錄:`);
          overviewRecords.forEach((record, idx) => {
            console.log(`   📄 課程總覽 ${idx + 1}:`, {
              recordPath: record.recordPath,
              photos: record.photos.length,
              videos: record.videos.length
            });
          });
        }
      } else {
        console.log('❌ 未找到任何記錄');
      }
    } catch (error) {
      console.log('❌ 查詢失敗:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 診斷完成');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 診斷過程出錯:', error.message);
    process.exit(1);
  }
}

// 執行診斷
testDriveStructure().catch(err => {
  console.error('❌ 未預期的錯誤:', err);
  process.exit(1);
});
