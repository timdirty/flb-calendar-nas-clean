/**
 * 測試講師提取邏輯
 * 使用用戶提供的課程名稱進行測試
 */

const path = require('path');
const fs = require('fs');

// 模擬的課程路徑（基於實際檔案系統結構）
const testPaths = [
  {
    course: '龍華 製程專題製作',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/TIM/龍華 製程專題製作/2025-11-06/overview',
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/TIM/龍華 製程專題製作/2025-11-06/學生1'
    ],
    expectedTeacher: 'TIM'
  },
  {
    course: '資訊課501 四 13:20-14:00 外 第10週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/HANSEN/資訊課501 四 13:20-14:00 外 第10週/2025-11-06/overview'
    ],
    expectedTeacher: 'HANSEN'
  },
  {
    course: '資訊課402 四 14:10-14:50 外 第10週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/HANSEN/資訊課402 四 14:10-14:50 外 第10週/2025-11-06/overview'
    ],
    expectedTeacher: 'HANSEN'
  },
  {
    course: '表定要面試',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/YOKI/表定要面試/2025-11-06/overview'
    ],
    expectedTeacher: 'YOKI'
  },
  {
    course: 'SPM 四 17:30-18:30 到府 第1週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/JAMES/SPM 四 17:30-18:30 到府 第1週/2025-11-06/overview',
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/JAMES/SPM 四 17:30-18:30 到府 第1週/2025-11-06/Audrey'
    ],
    expectedTeacher: 'JAMES'
  },
  {
    course: 'SPM 四 16:30-18:00 外 第10週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/JAMES/SPM 四 16:30-18:00 外 第10週/2025-11-06/overview'
    ],
    expectedTeacher: 'JAMES'
  },
  {
    course: 'SPM 三1630-1730 到府 第9週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/AGNES/SPM 三1630-1730 到府 第9週/2025-11-06/overview'
    ],
    expectedTeacher: 'AGNES'
  },
  {
    course: 'SPIKE 三 18:30-20:30 第8週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/TED/SPIKE 三 18:30-20:30 第8週/2025-11-06/overview'
    ],
    expectedTeacher: 'TED'
  },
  {
    course: 'SPIKE 一 1930-2100 客製化 第9週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/IVAN/SPIKE 一 1930-2100 客製化 第9週/2025-11-06/overview'
    ],
    expectedTeacher: 'IVAN'
  },
  {
    course: 'ESM 四 17:30-18:30 到府 第10週',
    paths: [
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/AGNES/ESM 四 17:30-18:30 到府 第10週/2025-11-06/overview',
      '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/AGNES/ESM 四 17:30-18:30 到府 第10週/2025-11-06/Audrey'
    ],
    expectedTeacher: 'AGNES'
  }
];

// 模擬講師資料
const teacherData = [
  { name: 'YOKI', color: '#FF6B6B' },
  { name: 'TED', color: '#4ECDC4' },
  { name: 'AGNES', color: '#95E1D3' },
  { name: 'HANSEN', color: '#FFD93D' },
  { name: 'JAMES', color: '#6BCF7F' },
  { name: 'IVAN', color: '#A8E6CF' },
  { name: 'XIAN', color: '#FFB6C1' },
  { name: 'EASON', color: '#87CEEB' },
  { name: 'BELLA', color: '#DDA0DD' },
  { name: 'GILLIAN', color: '#F0E68C' },
  { name: 'DANIEL', color: '#FFA07A' },
  { name: 'Dirty', color: '#20B2AA' },
  { name: 'TIM', color: '#778899' },
  { name: 'Melody', color: '#FFB6D9' }
];

// 講師提取函數（與後端邏輯相同）
function extractTeacherFromPath(recordPath, teacherData) {
  const pathParts = recordPath.split(path.sep);
  
  console.log('\n🔍 測試路徑:', recordPath);
  console.log('📂 路徑分段:', pathParts);
  
  let teacher = null;
  
  // 方法1: 從路徑中找學期後面的資料夾（通常是講師名稱）
  const semesterPattern = /\d{3}-\d/; // 例如: 113-1
  for (let i = 0; i < pathParts.length; i++) {
    if (semesterPattern.test(pathParts[i])) {
      console.log('✅ 找到學期:', pathParts[i], '在索引', i);
      // 找到學期，檢查下一個資料夾是否為講師名稱
      if (i + 1 < pathParts.length) {
        const potentialTeacher = pathParts[i + 1];
        console.log('🔍 檢查可能的講師:', potentialTeacher);
        const matchedTeacher = teacherData.find(t => 
          t.name && t.name.toUpperCase() === potentialTeacher.toUpperCase()
        );
        if (matchedTeacher) {
          teacher = matchedTeacher.name;
          console.log('✅ 方法1成功 - 找到講師:', teacher);
          break;
        } else {
          console.log('❌ 不是有效的講師名稱');
        }
      }
    }
  }
  
  // 方法2: 如果方法1失敗，從課程資料夾名稱匹配
  if (!teacher) {
    const courseFolder = pathParts[pathParts.length - 3];
    console.log('🔍 方法2：從課程資料夾匹配:', courseFolder);
    for (const t of teacherData) {
      if (t.name && courseFolder.toUpperCase().includes(t.name.toUpperCase())) {
        teacher = t.name;
        console.log('✅ 方法2成功 - 找到講師:', teacher);
        break;
      }
    }
  }
  
  // 方法3: 如果方法2失敗，從整個路徑匹配
  if (!teacher) {
    console.log('🔍 方法3：從整個路徑匹配');
    for (const t of teacherData) {
      if (t.name && recordPath.toUpperCase().includes(t.name.toUpperCase())) {
        teacher = t.name;
        console.log('✅ 方法3成功 - 找到講師:', teacher);
        break;
      }
    }
  }
  
  return teacher;
}

// 執行測試
console.log('🚀 開始測試講師提取邏輯');
console.log('=' .repeat(80));

let successCount = 0;
let failCount = 0;

testPaths.forEach((test, index) => {
  console.log('\n' + '='.repeat(80));
  console.log(`📝 測試 ${index + 1}/${testPaths.length}: ${test.course}`);
  console.log('🎯 預期講師:', test.expectedTeacher);
  console.log('=' .repeat(80));
  
  test.paths.forEach((testPath, pathIndex) => {
    console.log(`\n📍 路徑 ${pathIndex + 1}/${test.paths.length}:`);
    const extractedTeacher = extractTeacherFromPath(testPath, teacherData);
    
    if (extractedTeacher === test.expectedTeacher) {
      console.log('✅ 成功! 提取的講師:', extractedTeacher);
      successCount++;
    } else {
      console.log('❌ 失敗! 提取的講師:', extractedTeacher, '預期:', test.expectedTeacher);
      failCount++;
    }
  });
});

console.log('\n' + '='.repeat(80));
console.log('📊 測試結果總結');
console.log('=' .repeat(80));
console.log('✅ 成功:', successCount);
console.log('❌ 失敗:', failCount);
console.log('📈 成功率:', ((successCount / (successCount + failCount)) * 100).toFixed(2) + '%');
console.log('=' .repeat(80));

// 測試邊緣案例
console.log('\n' + '='.repeat(80));
console.log('🧪 測試邊緣案例');
console.log('=' .repeat(80));

const edgeCases = [
  {
    name: '無學期資料夾',
    path: '/volume1/Fun Learn Bar/學習歷程 automatic/AGNES/ESM 四 17:30-18:30 到府 第10週/2025-11-06/overview',
    expectedTeacher: 'AGNES'
  },
  {
    name: '講師名稱大小寫不同',
    path: '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/agnes/ESM 四 17:30-18:30 到府 第10週/2025-11-06/overview',
    expectedTeacher: 'AGNES'
  },
  {
    name: '不存在的講師',
    path: '/volume1/Fun Learn Bar/學習歷程 automatic/113-1/UNKNOWN/ESM 四 17:30-18:30 到府 第10週/2025-11-06/overview',
    expectedTeacher: null
  }
];

edgeCases.forEach((test, index) => {
  console.log(`\n🧪 邊緣案例 ${index + 1}: ${test.name}`);
  const extractedTeacher = extractTeacherFromPath(test.path, teacherData);
  
  if (extractedTeacher === test.expectedTeacher) {
    console.log('✅ 通過! 提取的講師:', extractedTeacher || '(null)');
  } else {
    console.log('❌ 失敗! 提取的講師:', extractedTeacher || '(null)', '預期:', test.expectedTeacher || '(null)');
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ 測試完成!');
console.log('=' .repeat(80));

