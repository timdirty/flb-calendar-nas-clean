#!/usr/bin/env node

/**
 * 診斷上傳統計 API 為什麼返回 studentCount = 0
 * 🎯 檢查：事件快取、事件 ID 格式、學生匹配邏輯
 */

const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

/**
 * 執行 HTTP GET 請求
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    console.log(`\n🔍 請求: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (error) {
          reject(new Error(`JSON 解析失敗: ${error.message}\n原始資料: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 診斷主流程
 */
async function diagnose() {
  console.log('🔬 開始診斷上傳統計 API 問題');
  console.log('='.repeat(60));
  
  try {
    // 1️⃣ 檢查伺服器健康狀態
    console.log('\n📋 步驟 1: 檢查伺服器健康狀態');
    const healthResult = await makeRequest('/health');
    if (healthResult.statusCode === 200) {
      console.log('✅ 伺服器正常運行');
    } else {
      console.log('❌ 伺服器異常:', healthResult);
      return;
    }
    
    // 2️⃣ 取得今日課程列表
    console.log('\n📋 步驟 2: 取得今日課程列表');
    const coursesResult = await makeRequest('/api/v2/courses');
    
    if (!coursesResult.data.success || !Array.isArray(coursesResult.data.data)) {
      console.log('❌ 課程列表格式錯誤:', coursesResult.data);
      return;
    }
    
    const courses = coursesResult.data.data;
    console.log(`✅ 取得 ${courses.length} 個課程`);
    
    if (courses.length === 0) {
      console.log('⚠️  沒有課程資料，無法繼續診斷');
      return;
    }
    
    // 顯示前 3 個課程的基本資訊
    console.log('\n📊 課程列表（前 3 個）:');
    courses.slice(0, 3).forEach((course, idx) => {
      console.log(`  ${idx + 1}. ID: ${course.id}`);
      console.log(`     名稱: ${course.name}`);
      console.log(`     日期: ${course.date}`);
      console.log(`     學生數: ${course.studentCount || 0}`);
      console.log(`     已上傳: ${course.uploadedStudentCount || 0}/${course.studentCount || 0}`);
      console.log('');
    });
    
    // 3️⃣ 選擇一個課程測試上傳統計 API
    const testCourse = courses[0];
    console.log('\n📋 步驟 3: 測試上傳統計 API');
    console.log(`   測試課程: ${testCourse.name}`);
    console.log(`   課程 ID: ${testCourse.id}`);
    console.log(`   日期: ${testCourse.date}`);
    
    const params = new URLSearchParams({
      eventId: testCourse.id || '',
      date: testCourse.date || '',
      courseName: testCourse.name || ''
    });
    
    const statsResult = await makeRequest(`/api/v2/courses/upload-stats?${params}`);
    
    if (!statsResult.data.success) {
      console.log('❌ 上傳統計 API 返回失敗:', statsResult.data);
      return;
    }
    
    const stats = statsResult.data.data;
    console.log('\n📊 上傳統計結果:');
    console.log(`   課程名稱: ${stats.courseName}`);
    console.log(`   日期: ${stats.date}`);
    console.log(`   學生總數: ${stats.studentCount} ${stats.studentCount === 0 ? '❌' : '✅'}`);
    console.log(`   已上傳學生: ${stats.uploadedStudentCount}`);
    console.log(`   上傳檔案數: ${stats.totalUploadedFiles}`);
    console.log(`   總覽已上傳: ${stats.overviewUploaded}`);
    console.log(`   上傳百分比: ${stats.uploadPercentage}%`);
    
    // 4️⃣ 問題診斷
    console.log('\n📋 步驟 4: 問題診斷');
    if (stats.studentCount === 0) {
      console.log('❌ 發現問題：studentCount = 0');
      console.log('\n可能原因：');
      console.log('  1. 事件 ID 格式不匹配（前端傳入 vs 後端快取）');
      console.log('  2. Google Sheets Students 服務未初始化');
      console.log('  3. transformStudentsToV2Format 匹配邏輯問題');
      console.log('  4. 課程名稱格式不一致（時間冒號 vs 無冒號）');
      
      console.log('\n🔍 建議檢查：');
      console.log('  - 檢查伺服器日誌中的 [V2 Courses] 診斷訊息');
      console.log('  - 確認 googleSheetsStudents 已註冊到 app');
      console.log('  - 確認事件快取中的 ID 格式');
      console.log('  - 確認 Google Sheets 中的學生資料格式');
    } else {
      console.log('✅ studentCount 正常，統計功能運作正常');
    }
    
    // 5️⃣ 測試多個課程（如果有）
    if (courses.length > 1) {
      console.log('\n📋 步驟 5: 批次測試多個課程');
      let zeroCountCourses = 0;
      
      for (let i = 0; i < Math.min(5, courses.length); i++) {
        const course = courses[i];
        const params = new URLSearchParams({
          eventId: course.id || '',
          date: course.date || '',
          courseName: course.name || ''
        });
        
        const result = await makeRequest(`/api/v2/courses/upload-stats?${params}`);
        if (result.data.success && result.data.data.studentCount === 0) {
          zeroCountCourses++;
        }
        
        console.log(`  ${i + 1}. ${course.name.substring(0, 30)} - 學生數: ${result.data.data?.studentCount || 0}`);
      }
      
      console.log(`\n📊 統計: ${zeroCountCourses}/${Math.min(5, courses.length)} 個課程的 studentCount = 0`);
      if (zeroCountCourses === Math.min(5, courses.length)) {
        console.log('❌ 所有測試課程都沒有學生資料，問題是系統性的');
      } else if (zeroCountCourses > 0) {
        console.log('⚠️  部分課程沒有學生資料，可能是資料問題');
      } else {
        console.log('✅ 所有測試課程都有學生資料');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 診斷完成');
    
  } catch (error) {
    console.error('\n❌ 診斷過程發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行診斷
diagnose().catch((error) => {
  console.error('診斷執行失敗:', error);
  process.exit(1);
});
