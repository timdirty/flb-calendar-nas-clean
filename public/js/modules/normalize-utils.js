/**
 * 正規化工具函數
 * 統一處理課程名稱、學生姓名的比對邏輯
 * 
 * @version 1.0.0
 * @date 2025-02-01
 */

(function(global) {
    'use strict';

    /**
     * 正規化字串（用於比對）
     * - 移除所有空白
     * - 轉換為小寫（英文）
     * - 去除首尾空白
     * 
     * @param {string} str - 要正規化的字串
     * @returns {string} 正規化後的字串
     */
    function normalizeString(str) {
        if (!str) return '';
        return String(str)
            .trim()                    // 去除首尾空白
            .replace(/\s+/g, '')       // 移除所有空白
            .toLowerCase();            // 轉換為小寫
    }

    /**
     * 正規化課程名稱（用於比對）
     * @param {string} courseName - 課程名稱
     * @returns {string} 正規化後的課程名稱
     */
    function normalizeCourseName(courseName) {
        return normalizeString(courseName);
    }

    /**
     * 正規化學生姓名（用於比對）
     * @param {string} studentName - 學生姓名
     * @returns {string} 正規化後的學生姓名
     */
    function normalizeStudentName(studentName) {
        return normalizeString(studentName);
    }

    /**
     * 比對課程名稱（不區分大小寫、空白）
     * @param {string} course1 - 課程名稱 1
     * @param {string} course2 - 課程名稱 2
     * @returns {boolean} 是否相同
     */
    function isSameCourse(course1, course2) {
        return normalizeCourseName(course1) === normalizeCourseName(course2);
    }

    /**
     * 比對學生姓名（不區分大小寫、空白）
     * @param {string} name1 - 學生姓名 1
     * @param {string} name2 - 學生姓名 2
     * @returns {boolean} 是否相同
     */
    function isSameStudent(name1, name2) {
        return normalizeStudentName(name1) === normalizeStudentName(name2);
    }

    /**
     * 檢查字串是否以某個前綴開頭（不區分大小寫、空白）
     * @param {string} str - 要檢查的字串
     * @param {string} prefix - 前綴
     * @returns {boolean} 是否以該前綴開頭
     */
    function startsWithNormalized(str, prefix) {
        return normalizeString(str).startsWith(normalizeString(prefix));
    }

    /**
     * 檢查字串是否包含某個子字串（不區分大小寫、空白）
     * @param {string} str - 要檢查的字串
     * @param {string} substring - 子字串
     * @returns {boolean} 是否包含
     */
    function includesNormalized(str, substring) {
        return normalizeString(str).includes(normalizeString(substring));
    }

    // ============================================
    // 暴露函數到全域
    // ============================================
    
    const NormalizeUtils = {
        normalizeString,
        normalizeCourseName,
        normalizeStudentName,
        isSameCourse,
        isSameStudent,
        startsWithNormalized,
        includesNormalized
    };

    // UMD 模式：同時支援全域和模組
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js 環境
        module.exports = NormalizeUtils;
    } else {
        // 瀏覽器環境
        global.NormalizeUtils = NormalizeUtils;
        console.log('✅ NormalizeUtils 已載入到全域:', Object.keys(NormalizeUtils));
    }

})(typeof window !== 'undefined' ? window : global);

