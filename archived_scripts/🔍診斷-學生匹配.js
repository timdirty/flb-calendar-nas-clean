#!/usr/bin/env node

/**
 * 診斷腳本：檢查特定課程的學生匹配情況
 */

const fs = require('fs');
const path = require('path');

// 讀取學生資料
const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));

// 課程名稱提取函數（與 server.js 一致）
function extractCourseName(courseTitle) {
    if (!courseTitle) return '';
    
    if (courseTitle.includes('—')) {
        return courseTitle.split('—')[0].trim();
    } else {
        const match = courseTitle.match(/^([A-Z]+)/i);
        if (match) {
            return match[1].toUpperCase();
        } else {
            return courseTitle.split(' ')[0].trim();
        }
    }
}

// 測試課程標題
const testCourseTitles = [
    'SPIKE — 1930-2100 客製化 第6週',
    'SPM — 1930-2030 到府 第6週',
    'BOOST 0930-1100',
    'ESM 1600-1700',
    'Minecraft 0840-0920',
    'Scratch 1100-1300',
    '龍華 製程專題製作'
];

console.log('='.repeat(80));
console.log('📚 診斷學生匹配情況');
console.log('='.repeat(80));
console.log();

console.log(`📊 student_data.json 中共有 ${studentData.students.length} 位學生`);
console.log();

// 統計每個課程的學生數量
const courseStats = {};
studentData.students.forEach(student => {
    const course = student.course;
    if (!courseStats[course]) {
        courseStats[course] = 0;
    }
    courseStats[course]++;
});

console.log('📋 student_data.json 中的課程統計：');
Object.entries(courseStats).sort((a, b) => b[1] - a[1]).forEach(([course, count]) => {
    console.log(`   ${course}: ${count} 位學生`);
});
console.log();

console.log('='.repeat(80));
console.log('測試課程學生匹配：');
console.log('='.repeat(80));
console.log();

testCourseTitles.forEach(courseTitle => {
    const courseName = extractCourseName(courseTitle);
    const matchedStudents = studentData.students.filter(student => student.course === courseName);
    
    console.log(`📚 課程標題: "${courseTitle}"`);
    console.log(`   提取的課程名稱: "${courseName}"`);
    console.log(`   匹配到的學生數: ${matchedStudents.length}`);
    
    if (matchedStudents.length > 0) {
        console.log(`   ✅ 學生名單:`);
        matchedStudents.forEach(student => {
            console.log(`      - ${student.name} (剩餘: ${student.remaining} 堂)`);
        });
    } else {
        console.log(`   ⚠️  未找到學生`);
        // 查找相似的課程名稱
        const similarCourses = Object.keys(courseStats).filter(course => 
            course.toLowerCase().includes(courseName.toLowerCase()) || 
            courseName.toLowerCase().includes(course.toLowerCase())
        );
        if (similarCourses.length > 0) {
            console.log(`   💡 可能的相似課程: ${similarCourses.join(', ')}`);
        }
    }
    console.log();
});

console.log('='.repeat(80));
console.log('診斷完成');
console.log('='.repeat(80));

