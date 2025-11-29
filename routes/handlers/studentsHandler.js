/**
 * 👥 Students Handler - 學生管理業務邏輯
 * 
 * 處理學生資料的 CRUD 操作、同步管理、快取控制
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const path = require('path');
const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class StudentsHandler {
    constructor(services = {}) {
        this.googleSheetsStudents = services.googleSheetsStudents;
        this.studentDataSyncSchedule = services.studentDataSyncSchedule;
        this.updateStudentDataFromGoogleSheets = services.updateStudentDataFromGoogleSheets;
        this.startStudentDataAutoSync = services.startStudentDataAutoSync;
        this.loadSystemSettings = services.loadSystemSettings;
        this.saveSystemSettings = services.saveSystemSettings;
    }

    /**
     * 取得所有學生（合併正常和臨時學生）
     */
    async getAllStudents(req, res, next) {
        try {
            console.log('👨‍🎓 取得所有學生資料...');
            
            const fs = require('fs');
            const studentDataPath = path.join(process.cwd(), 'public', 'student_data.json');
            const tempStudentsPath = path.join(process.cwd(), 'public', 'temporary_students.json');
            
            let normalStudents = {};
            let tempStudents = [];
            
            // 讀取正常學生
            if (fs.existsSync(studentDataPath)) {
                const data = fs.readFileSync(studentDataPath, 'utf8');
                normalStudents = JSON.parse(data);
            }
            
            // 讀取臨時學生
            if (fs.existsSync(tempStudentsPath)) {
                const data = fs.readFileSync(tempStudentsPath, 'utf8');
                const parsed = JSON.parse(data);
                tempStudents = Array.isArray(parsed) ? parsed : [];
            }
            
            res.json({
                success: true,
                data: {
                    normalStudents,
                    temporaryStudents: tempStudents,
                    counts: {
                        normal: Object.keys(normalStudents).length,
                        temporary: tempStudents.length,
                        total: Object.keys(normalStudents).length + tempStudents.length
                    }
                }
            });
        } catch (error) {
            console.error('❌ 取得學生資料失敗:', error);
            next(createInternalError('取得學生資料失敗', { originalError: error.message }));
        }
    }

    /**
     * 從 Google Sheets 取得學生資料
     */
    async getStudentsFromSheets(req, res, next) {
        try {
            console.log('📚 請求學生資料（從 Google Sheets）');
            const startTime = Date.now();
            
            if (!this.googleSheetsStudents) {
                throw new Error('Google Sheets 學生服務未初始化');
            }
            
            const result = await this.googleSheetsStudents.getAllStudents();
            const duration = Date.now() - startTime;
            
            // getAllStudents 返回 { success, count, students }
            const students = result.students || [];
            
            console.log(`✅ 成功取得 ${students.length} 位學生資料 (耗時: ${duration}ms)`);
            
            res.json({
                success: true,
                data: students,
                meta: {
                    count: students.length,
                    duration: duration,
                    source: 'google_sheets',
                    cached: this.googleSheetsStudents.isCached()
                }
            });
        } catch (error) {
            console.error('❌ 從 Google Sheets 取得學生資料失敗:', error);
            next(createInternalError('從 Google Sheets 取得學生資料失敗', { originalError: error.message }));
        }
    }

    /**
     * 按課程取得學生
     */
    async getStudentsByCourse(req, res, next) {
        try {
            const { course } = req.query;
            
            if (!course) {
                return next(createBusinessError('缺少必要參數：course'));
            }
            
            if (!this.googleSheetsStudents) {
                throw new Error('Google Sheets 學生服務未初始化');
            }
            
            const result = await this.googleSheetsStudents.getAllStudents();
            const allStudents = result.students || [];
            
            // 篩選該課程的學生
            const courseStudents = allStudents.filter(student => 
                student.course && student.course === course
            );
            
            res.json({
                success: true,
                data: courseStudents,
                meta: {
                    course,
                    count: courseStudents.length,
                    totalStudents: allStudents.length
                }
            });
        } catch (error) {
            console.error('❌ 按課程取得學生失敗:', error);
            next(createInternalError('按課程取得學生失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得學生資料檔案
     */
    async getStudentData(req, res, next) {
        try {
            const fs = require('fs');
            const studentDataPath = path.join(process.cwd(), 'public', 'student_data.json');
            
            if (!fs.existsSync(studentDataPath)) {
                return next(createBusinessError('學生資料檔案不存在'));
            }
            
            const data = fs.readFileSync(studentDataPath, 'utf8');
            const studentData = JSON.parse(data);
            
            res.json({
                success: true,
                data: studentData,
                meta: {
                    count: Object.keys(studentData).length,
                    source: 'local_file'
                }
            });
        } catch (error) {
            console.error('❌ 取得學生資料檔案失敗:', error);
            next(createInternalError('取得學生資料檔案失敗', { originalError: error.message }));
        }
    }

    /**
     * 清除學生快取
     */
    async clearCache(req, res, next) {
        try {
            if (this.googleSheetsStudents && typeof this.googleSheetsStudents.clearCache === 'function') {
                this.googleSheetsStudents.clearCache();
            }
            
            res.json({
                success: true,
                message: '學生資料快取已清除'
            });
        } catch (error) {
            console.error('❌ 清除快取失敗:', error);
            next(createInternalError('清除快取失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得同步設定
     */
    async getSyncSettings(req, res, next) {
        try {
            const settings = this.loadSystemSettings ? this.loadSystemSettings() : {};
            const syncSettings = settings.studentDataSync || {};
            
            res.json({
                success: true,
                data: {
                    enabled: syncSettings.enabled || false,
                    interval: syncSettings.interval || 3600000,
                    lastSync: syncSettings.lastSync || null,
                    autoStart: syncSettings.autoStart || false
                }
            });
        } catch (error) {
            console.error('❌ 取得同步設定失敗:', error);
            next(createInternalError('取得同步設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新同步設定
     */
    async updateSyncSettings(req, res, next) {
        try {
            const newSettings = req.body;
            
            if (!this.loadSystemSettings || !this.saveSystemSettings) {
                throw new Error('系統設定服務未初始化');
            }
            
            const settings = this.loadSystemSettings();
            settings.studentDataSync = {
                ...(settings.studentDataSync || {}),
                ...newSettings,
                lastUpdate: new Date().toISOString()
            };
            
            this.saveSystemSettings(settings);
            
            res.json({
                success: true,
                message: '同步設定已更新',
                data: settings.studentDataSync
            });
        } catch (error) {
            console.error('❌ 更新同步設定失敗:', error);
            next(createInternalError('更新同步設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 手動觸發同步
     */
    async triggerSync(req, res, next) {
        try {
            console.log('🔄 [手動觸發] 立即執行學生資料同步...');
            
            if (!this.updateStudentDataFromGoogleSheets) {
                throw new Error('學生資料同步函數未初始化');
            }
            
            const result = await this.updateStudentDataFromGoogleSheets();
            
            res.json({
                success: true,
                message: '學生資料同步完成',
                data: result
            });
        } catch (error) {
            console.error('❌ 同步失敗:', error);
            next(createInternalError('學生資料同步失敗', { originalError: error.message }));
        }
    }

    /**
     * 啟動自動同步
     */
    async startAutoSync(req, res, next) {
        try {
            console.log('▶️ 啟動學生資料自動同步...');
            
            if (!this.startStudentDataAutoSync) {
                throw new Error('自動同步函數未初始化');
            }
            
            this.startStudentDataAutoSync();
            
            res.json({
                success: true,
                message: '學生資料自動同步已啟動'
            });
        } catch (error) {
            console.error('❌ 啟動自動同步失敗:', error);
            next(createInternalError('啟動自動同步失敗', { originalError: error.message }));
        }
    }

    /**
     * 停止自動同步
     */
    async stopAutoSync(req, res, next) {
        try {
            if (this.studentDataSyncSchedule) {
                this.studentDataSyncSchedule.cancel();
                this.studentDataSyncSchedule = null;
            }
            
            res.json({
                success: true,
                message: '學生資料自動同步已停止'
            });
        } catch (error) {
            console.error('❌ 停止自動同步失敗:', error);
            next(createInternalError('停止自動同步失敗', { originalError: error.message }));
        }
    }

    /**
     * 搜尋學生
     * Query: ?keyword=關鍵字
     */
    async searchStudents(req, res, next) {
        try {
            const { keyword } = req.query;
            
            if (!keyword || keyword.trim() === '') {
                return next(createBusinessError('請提供搜尋關鍵字'));
            }
            
            console.log(`🔍 搜尋學生: "${keyword}"`);
            
            const fs = require('fs');
            const studentDataPath = path.join(process.cwd(), 'public', 'student_data.json');
            
            if (!fs.existsSync(studentDataPath)) {
                return next(createBusinessError('學生資料檔案不存在'));
            }
            
            const data = fs.readFileSync(studentDataPath, 'utf8');
            const allStudents = JSON.parse(data);
            
            // 搜尋邏輯：名稱包含關鍵字
            const results = {};
            const lowerKeyword = keyword.toLowerCase().trim();
            
            Object.entries(allStudents).forEach(([name, studentData]) => {
                if (name.toLowerCase().includes(lowerKeyword)) {
                    results[name] = studentData;
                }
            });
            
            console.log(`✅ 找到 ${Object.keys(results).length} 位學生`);
            
            res.json({
                success: true,
                data: results,
                meta: {
                    keyword,
                    count: Object.keys(results).length,
                    totalStudents: Object.keys(allStudents).length
                }
            });
        } catch (error) {
            console.error('❌ 搜尋學生失敗:', error);
            next(createInternalError('搜尋學生失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得學生統計資訊
     */
    async getStudentsStats(req, res, next) {
        try {
            console.log('📊 取得學生統計資訊...');
            
            const fs = require('fs');
            const studentDataPath = path.join(process.cwd(), 'public', 'student_data.json');
            const tempStudentsPath = path.join(process.cwd(), 'public', 'temporary_students.json');
            
            let normalStudents = {};
            let tempStudents = [];
            
            // 讀取正常學生
            if (fs.existsSync(studentDataPath)) {
                const data = fs.readFileSync(studentDataPath, 'utf8');
                normalStudents = JSON.parse(data);
            }
            
            // 讀取臨時學生
            if (fs.existsSync(tempStudentsPath)) {
                const data = fs.readFileSync(tempStudentsPath, 'utf8');
                const parsed = JSON.parse(data);
                tempStudents = Array.isArray(parsed) ? parsed : [];
            }
            
            // 計算統計資訊
            const courseCount = {};
            Object.values(normalStudents).forEach(student => {
                if (student.courses && Array.isArray(student.courses)) {
                    student.courses.forEach(course => {
                        courseCount[course] = (courseCount[course] || 0) + 1;
                    });
                }
            });
            
            const stats = {
                total: Object.keys(normalStudents).length + tempStudents.length,
                normal: Object.keys(normalStudents).length,
                temporary: tempStudents.length,
                byCourse: courseCount,
                courseTypes: Object.keys(courseCount).length
            };
            
            console.log(`✅ 統計完成：總共 ${stats.total} 位學生`);
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ 取得學生統計失敗:', error);
            next(createInternalError('取得學生統計失敗', { originalError: error.message }));
        }
    }
}

module.exports = StudentsHandler;
