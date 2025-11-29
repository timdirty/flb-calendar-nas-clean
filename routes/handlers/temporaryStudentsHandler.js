/**
 * 📝 Temporary Students Handler - 臨時學生管理業務邏輯
 * 
 * 處理臨時學生的 CRUD 操作、封存、備份與還原
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const path = require('path');
const fs = require('fs');
const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class TemporaryStudentsHandler {
    constructor(services = {}) {
        this.safeFile = services.safeFile;
        this.backupTemporaryStudents = services.backupTemporaryStudents;
        this.TEMP_STUDENTS_PATH = path.join(process.cwd(), 'public', 'temporary_students.json');
        this.TEMP_STUDENTS_ARCHIVE_PATH = path.join(process.cwd(), 'data', 'temporary-students-archive.json');
        this.TEMP_STUDENTS_BACKUP_DIR = path.join(process.cwd(), 'backups', 'temporary-students');
    }

    /**
     * 取得臨時學生列表
     */
    async getTemporaryStudents(req, res, next) {
        try {
            const tempData = fs.existsSync(this.TEMP_STUDENTS_PATH)
                ? JSON.parse(fs.readFileSync(this.TEMP_STUDENTS_PATH, 'utf8'))
                : [];

            const students = Array.isArray(tempData) ? tempData : [];

            res.json({
                success: true,
                data: students,
                count: students.length
            });
        } catch (error) {
            console.error('❌ 取得臨時學生列表失敗:', error);
            next(createInternalError('取得臨時學生列表失敗', { originalError: error.message }));
        }
    }

    /**
     * 新增臨時學生
     */
    async addTemporaryStudent(req, res, next) {
        try {
            const { 
                name, type, course, scheduledDate, scheduledTime, 
                location, detailedAddress, notificationNote, originalStudent, 
                originalPeriod, originalCourse, userId, skipNotification 
            } = req.body;

            // 驗證必要欄位
            if (!name || !course || !scheduledDate) {
                return next(createBusinessError('缺少必要參數：name, course, scheduledDate'));
            }

            // 讀取現有資料
            let tempStudents = [];
            if (fs.existsSync(this.TEMP_STUDENTS_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.TEMP_STUDENTS_PATH, 'utf8'));
                tempStudents = Array.isArray(data) ? data : [];
            }

            // 生成新的 ID
            const newId = Date.now().toString();

            // 建立新學生記錄
            const newStudent = {
                id: newId,
                name: name.trim(),
                type: type || 'makeup',
                course: course.trim(),
                scheduledDate,
                scheduledTime: scheduledTime || '',
                location: location || '',
                detailedAddress: detailedAddress || '',  // 🔥 新增具體地址欄位
                notificationNote: notificationNote || '',
                originalStudent: originalStudent || '',
                originalPeriod: originalPeriod || '',
                originalCourse: originalCourse || '',
                userId: userId || '',
                skipNotification: skipNotification || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            tempStudents.push(newStudent);

            // 儲存
            fs.writeFileSync(this.TEMP_STUDENTS_PATH, JSON.stringify(tempStudents, null, 2));

            console.log('✅ 臨時學生新增成功:', newStudent.name);

            res.json({
                success: true,
                message: '臨時學生新增成功',
                data: newStudent
            });
        } catch (error) {
            console.error('❌ 新增臨時學生失敗:', error);
            next(createInternalError('新增臨時學生失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新臨時學生
     */
    async updateTemporaryStudent(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!id) {
                return next(createBusinessError('缺少學生 ID'));
            }

            // 讀取現有資料
            if (!fs.existsSync(this.TEMP_STUDENTS_PATH)) {
                return next(createBusinessError('臨時學生資料檔案不存在'));
            }

            let tempStudents = JSON.parse(fs.readFileSync(this.TEMP_STUDENTS_PATH, 'utf8'));
            const index = tempStudents.findIndex(s => s.id === id);

            if (index === -1) {
                return next(createBusinessError('找不到指定的臨時學生'));
            }

            // 更新資料
            tempStudents[index] = {
                ...tempStudents[index],
                ...updateData,
                id, // 保持原 ID
                updatedAt: new Date().toISOString()
            };

            // 儲存
            fs.writeFileSync(this.TEMP_STUDENTS_PATH, JSON.stringify(tempStudents, null, 2));

            console.log('✅ 臨時學生更新成功:', id);

            res.json({
                success: true,
                message: '臨時學生更新成功',
                data: tempStudents[index]
            });
        } catch (error) {
            console.error('❌ 更新臨時學生失敗:', error);
            next(createInternalError('更新臨時學生失敗', { originalError: error.message }));
        }
    }

    /**
     * 刪除臨時學生
     */
    async deleteTemporaryStudent(req, res, next) {
        try {
            const { id } = req.params;

            if (!id) {
                return next(createBusinessError('缺少學生 ID'));
            }

            // 讀取現有資料
            if (!fs.existsSync(this.TEMP_STUDENTS_PATH)) {
                return next(createBusinessError('臨時學生資料檔案不存在'));
            }

            let tempStudents = JSON.parse(fs.readFileSync(this.TEMP_STUDENTS_PATH, 'utf8'));
            const index = tempStudents.findIndex(s => s.id === id);

            if (index === -1) {
                return next(createBusinessError('找不到指定的臨時學生'));
            }

            const deletedStudent = tempStudents[index];
            tempStudents.splice(index, 1);

            // 儲存
            fs.writeFileSync(this.TEMP_STUDENTS_PATH, JSON.stringify(tempStudents, null, 2));

            console.log('✅ 臨時學生刪除成功:', id);

            res.json({
                success: true,
                message: '臨時學生刪除成功',
                data: deletedStudent
            });
        } catch (error) {
            console.error('❌ 刪除臨時學生失敗:', error);
            next(createInternalError('刪除臨時學生失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得封存記錄
     */
    async getArchive(req, res, next) {
        try {
            const { type, course, dateFrom, dateTo, name, search, limit } = req.query;

            let archiveData = { students: [] };
            if (fs.existsSync(this.TEMP_STUDENTS_ARCHIVE_PATH)) {
                archiveData = JSON.parse(fs.readFileSync(this.TEMP_STUDENTS_ARCHIVE_PATH, 'utf8'));
            }

            let students = archiveData.students || [];

            // 篩選
            if (type) students = students.filter(s => s.type === type);
            if (course) students = students.filter(s => s.course.includes(course));
            if (name) students = students.filter(s => s.name.includes(name));
            if (search) {
                const searchLower = search.toLowerCase();
                students = students.filter(s => 
                    s.name.toLowerCase().includes(searchLower) ||
                    s.course.toLowerCase().includes(searchLower)
                );
            }

            // 限制數量
            if (limit) {
                students = students.slice(0, parseInt(limit));
            }

            res.json({
                success: true,
                data: students,
                count: students.length,
                total: (archiveData.students || []).length
            });
        } catch (error) {
            console.error('❌ 取得封存記錄失敗:', error);
            next(createInternalError('取得封存記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * 建立備份
     */
    async createBackup(req, res, next) {
        try {
            if (!this.backupTemporaryStudents) {
                throw new Error('備份函數未初始化');
            }

            const result = await this.backupTemporaryStudents('manual-api');

            if (!result) {
                return next(createBusinessError('備份建立失敗'));
            }

            res.json({
                success: true,
                message: '備份建立成功',
                data: result
            });
        } catch (error) {
            console.error('❌ 建立備份失敗:', error);
            next(createInternalError('建立備份失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得備份清單
     */
    async getBackups(req, res, next) {
        try {
            if (!fs.existsSync(this.TEMP_STUDENTS_BACKUP_DIR)) {
                return res.json({
                    success: true,
                    data: [],
                    count: 0
                });
            }

            const files = fs.readdirSync(this.TEMP_STUDENTS_BACKUP_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(this.TEMP_STUDENTS_BACKUP_DIR, f);
                    const stats = fs.statSync(filePath);
                    return {
                        fileName: f,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime
                    };
                })
                .sort((a, b) => b.createdAt - a.createdAt);

            res.json({
                success: true,
                data: files,
                count: files.length
            });
        } catch (error) {
            console.error('❌ 取得備份清單失敗:', error);
            next(createInternalError('取得備份清單失敗', { originalError: error.message }));
        }
    }

    /**
     * 還原備份
     */
    async restoreBackup(req, res, next) {
        try {
            const { fileName } = req.body;

            if (!fileName) {
                return next(createBusinessError('缺少檔案名稱'));
            }

            const backupPath = path.join(this.TEMP_STUDENTS_BACKUP_DIR, fileName);

            if (!fs.existsSync(backupPath)) {
                return next(createBusinessError('備份檔案不存在'));
            }

            // 讀取備份
            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

            // 先備份當前資料
            if (this.backupTemporaryStudents) {
                await this.backupTemporaryStudents('before-restore');
            }

            // 還原
            fs.writeFileSync(this.TEMP_STUDENTS_PATH, JSON.stringify(backupData, null, 2));

            console.log('✅ 備份還原成功:', fileName);

            res.json({
                success: true,
                message: '備份還原成功',
                data: {
                    fileName,
                    count: Array.isArray(backupData) ? backupData.length : 0
                }
            });
        } catch (error) {
            console.error('❌ 還原備份失敗:', error);
            next(createInternalError('還原備份失敗', { originalError: error.message }));
        }
    }
}

module.exports = TemporaryStudentsHandler;
