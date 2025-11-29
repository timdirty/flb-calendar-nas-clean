/**
 * 🚀 Routes Index - 路由匯總模組
 * 
 * 負責統一管理所有路由模組的掛載和配置
 * 支援 Feature Flag 控制的漸進式遷移
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const router = express.Router();

// 🎯 Feature Flag 控制機制
const USE_ROUTES_PHASE1 = process.env.USE_ROUTES_PHASE1 === 'true';
const USE_ROUTES_PHASE2 = process.env.USE_ROUTES_PHASE2 === 'true';
const USE_ROUTES_PHASE3 = process.env.USE_ROUTES_PHASE3 === 'true';
const USE_ROUTES_PHASE4 = process.env.USE_ROUTES_PHASE4 === 'true';
const USE_ROUTES_PHASE5 = process.env.USE_ROUTES_PHASE5 === 'true';
const USE_ROUTES_PHASE6 = process.env.USE_ROUTES_PHASE6 === 'true';

// Feature Flags - 控制各模組的啟用狀態
const FEATURE_FLAGS = {
    // 基礎設施模組
    ENABLE_HOLIDAYS_V2: process.env.ENABLE_HOLIDAYS_V2 === 'true',
    ENABLE_TEMPLATES_V2: process.env.ENABLE_TEMPLATES_V2 === 'true',
    ENABLE_SYSTEM_V2: process.env.ENABLE_SYSTEM_V2 === 'true',
    
    // 業務模組
    ENABLE_STUDENTS_V2: process.env.ENABLE_STUDENTS_V2 === 'true',
    ENABLE_ATTENDANCE_V2: process.env.ENABLE_ATTENDANCE_V2 === 'true',
    ENABLE_NOTIFICATIONS_V2: process.env.ENABLE_NOTIFICATIONS_V2 === 'true',
    
    // 媒體模組
    ENABLE_MEDIA_V2: process.env.ENABLE_MEDIA_V2 === 'true',
    ENABLE_UPLOAD_V2: process.env.ENABLE_UPLOAD_V2 === 'true',
    
    // 核心模組
    ENABLE_EVENTS_V2: process.env.ENABLE_EVENTS_V2 === 'true',
    ENABLE_CALENDAR_V2: process.env.ENABLE_CALENDAR_V2 === 'true',
    ENABLE_ADMIN_V2: process.env.ENABLE_ADMIN_V2 === 'true',
    
    // 開發模式
    ENABLE_ROLLBACK_MODE: process.env.ENABLE_ROLLBACK_MODE === 'true',
    ENABLE_PARALLEL_TESTING: process.env.ENABLE_PARALLEL_TESTING === 'true'
};

/**
 * 初始化路由模組
 * @param {Express} app - Express 應用實例
 * @param {Object} services - 服務實例
 */
function initializeRoutes(app, services = {}) {
    console.log('🚀 [Routes] 初始化路由模組');
    
    // 掛載 Feature Flag 狀態
    console.log('🔧 [Routes] Feature Flags 狀態:');
    console.log(`  - Phase 1 (基礎設施): ${USE_ROUTES_PHASE1}`);
    console.log(`  - Phase 2 (獨立模組): ${USE_ROUTES_PHASE2}`);
    console.log(`  - Phase 3 (學生管理): ${USE_ROUTES_PHASE3}`);
    console.log(`  - Phase 4 (通知系統): ${USE_ROUTES_PHASE4}`);
    console.log(`  - Phase 5 (媒體系統): ${USE_ROUTES_PHASE5}`);
    console.log(`  - Phase 6 (日曆核心): ${USE_ROUTES_PHASE6}`);
    console.log(`  - Holidays V2: ${FEATURE_FLAGS.ENABLE_HOLIDAYS_V2}`);
    
    // 🏥 健康檢查端點
    router.get('/health', (req, res) => {
        res.json({
            success: true,
            message: 'Routes module is healthy',
            timestamp: new Date().toISOString(),
            featureFlags: FEATURE_FLAGS,
            phases: {
                phase1: USE_ROUTES_PHASE1,
                phase2: USE_ROUTES_PHASE2,
                phase3: USE_ROUTES_PHASE3,
                phase4: USE_ROUTES_PHASE4,
                phase5: USE_ROUTES_PHASE5,
                phase6: USE_ROUTES_PHASE6
            }
        });
    });
    
    // 📊 路由統計端點
    router.get('/routes/stats', (req, res) => {
        res.json({
            success: true,
            data: {
                totalRoutes: router.stack.length,
                featureFlags: FEATURE_FLAGS,
                enabledModules: Object.keys(FEATURE_FLAGS).filter(key => FEATURE_FLAGS[key])
            }
        });
    });
    
    // 🏗️ 階段二：獨立模組遷移
    if (USE_ROUTES_PHASE2) {
        try {
            console.log('📅 [Routes] 載入 Holidays 模組');
            if (FEATURE_FLAGS.ENABLE_HOLIDAYS_V2) {
                console.log('✅ [Routes] 載入 holidays 模組 (v2)');
                const initHolidayRoutes = require('./holidays');
                const HolidaySyncManager = require('../holiday-sync-manager');
                const holidaySyncManager = services.holidaySyncManager || new HolidaySyncManager();
                const holidayRouter = initHolidayRoutes(holidaySyncManager);
                router.use('/holidays', holidayRouter);
            } else {
                console.log('⏸️ [Routes] holidays 模組已停用 (使用 v1 路由)');
            }
            
            // 🧪 並行測試端點（僅在開發模式啟用）
            if (FEATURE_FLAGS.ENABLE_PARALLEL_TESTING) {
                console.log('🧪 [Routes] 啟用並行測試模式');
                
                router.get('/test/parallel/holidays', async (req, res) => {
                    const axios = require('axios');
                    const baseURL = req.protocol + '://' + req.get('host');
                    
                    try {
                        // 同時調用 v1 和 v2 端點
                        const [v1Response, v2Response] = await Promise.all([
                            axios.get(`${baseURL}/api/holidays`),
                            axios.get(`${baseURL}/api/v2/holidays`)
                        ]);
                        
                        // 比較結果
                        const comparison = {
                            v1: {
                                status: v1Response.status,
                                dataKeys: Object.keys(v1Response.data),
                                dataLength: JSON.stringify(v1Response.data).length
                            },
                            v2: {
                                status: v2Response.status,
                                dataKeys: Object.keys(v2Response.data),
                                dataLength: JSON.stringify(v2Response.data).length
                            },
                            identical: JSON.stringify(v1Response.data) === JSON.stringify(v2Response.data)
                        };
                        
                        res.json({
                            success: true,
                            message: '並行測試完成',
                            comparison: comparison
                        });
                        
                    } catch (error) {
                        res.status(500).json({
                            success: false,
                            error: '並行測試失敗',
                            message: error.message
                        });
                    }
                });
            }
            
            // 📋 Templates 模組
            console.log('📋 [Routes] 載入 Templates 模組');
            if (FEATURE_FLAGS.ENABLE_TEMPLATES_V2) {
                console.log('✅ [Routes] 載入 templates 模組 (v2)');
                const initTemplatesRoutes = require('./templates');
                const templatesRouter = initTemplatesRoutes(services.notificationManager);
                router.use('/templates', templatesRouter);
            } else {
                console.log('⏸️ [Routes] templates 模組已停用 (使用 v1 路由)');
            }
            
            // ⚙️ System 模組
            console.log('⚙️ [Routes] 載入 System 模組');
            if (FEATURE_FLAGS.ENABLE_SYSTEM_V2) {
                console.log('✅ [Routes] 載入 system 模組 (v2)');
                const initSystemRoutes = require('./system');
                const systemServices = {
                    reminderScheduler: services.reminderScheduler,
                    eventsCache: services.eventsCache,
                    notionCourseSyncManager: services.notionCourseSyncManager
                };
                const systemRouter = initSystemRoutes(systemServices);
                router.use('/system', systemRouter);
            } else {
                console.log('⏸️ [Routes] system 模組已停用 (使用 v1 路由)');
            }
            
        } catch (error) {
            console.error('❌ [Routes] 階段二模組載入失敗:', error.message);
        }
    }
    
    // 👥 階段三：學生管理模組
    if (USE_ROUTES_PHASE3) {
        try {
            // 👥 Students 模組
            console.log('👥 [Routes] 載入 Students 模組');
            if (FEATURE_FLAGS.ENABLE_STUDENTS_V2) {
                console.log('✅ [Routes] 載入 students 模組 (v2)');
                const initStudentsRoutes = require('./students');
                const studentsServices = {
                    googleSheetsStudents: services.googleSheetsStudents,
                    studentDataSyncSchedule: services.studentDataSyncSchedule,
                    updateStudentDataFromGoogleSheets: services.updateStudentDataFromGoogleSheets,
                    startStudentDataAutoSync: services.startStudentDataAutoSync,
                    loadSystemSettings: services.loadSystemSettings,
                    saveSystemSettings: services.saveSystemSettings
                };
                const studentsRouter = initStudentsRoutes(studentsServices);
                router.use('/students', studentsRouter);
            } else {
                console.log('⏸️ [Routes] students 模組已停用 (使用 v1 路由)');
            }
            
            // 📝 Temporary Students 模組
            console.log('📝 [Routes] 載入 Temporary Students 模組');
            if (FEATURE_FLAGS.ENABLE_STUDENTS_V2) {
                console.log('✅ [Routes] 載入 temporary-students 模組 (v2)');
                const initTemporaryStudentsRoutes = require('./temporary-students');
                const tempStudentsServices = {
                    safeFile: services.safeFile,
                    backupTemporaryStudents: services.backupTemporaryStudents
                };
                const tempStudentsRouter = initTemporaryStudentsRoutes(tempStudentsServices);
                router.use('/temporary-students', tempStudentsRouter);
            } else {
                console.log('⏸️ [Routes] temporary-students 模組已停用 (使用 v1 路由)');
            }
            
            // ✅ Attendance 模組
            console.log('✅ [Routes] 載入 Attendance 模組');
            if (FEATURE_FLAGS.ENABLE_ATTENDANCE_V2) {
                console.log('✅ [Routes] 載入 attendance 模組 (v2)');
                const initAttendanceRoutes = require('./attendance');
                const attendanceServices = {
                    fastAttendance: services.fastAttendance,
                    attendanceQueueManager: services.attendanceQueueManager
                };
                const attendanceRouter = initAttendanceRoutes(attendanceServices);
                router.use('/attendance', attendanceRouter);
            } else {
                console.log('⏸️ [Routes] attendance 模組已停用 (使用 v1 路由)');
            }
            
        } catch (error) {
            console.error('❌ [Routes] 階段三模組載入失敗:', error.message);
        }
    }
    
    // 📢 階段四：通知系統模組
    if (USE_ROUTES_PHASE4) {
        try {
            // 📢 Reminders 模組
            console.log('📢 [Routes] 載入 Reminders 模組');
            if (FEATURE_FLAGS.ENABLE_NOTIFICATIONS_V2) {
                console.log('✅ [Routes] 載入 reminders 模組 (v2)');
                const initRemindersRoutes = require('./reminders');
                const remindersServices = {
                    reminderScheduler: services.reminderScheduler,
                    notificationManager: services.notificationManager
                };
                const remindersRouter = initRemindersRoutes(remindersServices);
                router.use('/reminders', remindersRouter);
            } else {
                console.log('⏸️ [Routes] reminders 模組已停用 (使用 v1 路由)');
            }
            
            // 🔔 Notifications 模組
            console.log('🔔 [Routes] 載入 Notifications 模組');
            if (FEATURE_FLAGS.ENABLE_NOTIFICATIONS_V2) {
                console.log('✅ [Routes] 載入 notifications 模組 (v2)');
                const initNotificationsRoutes = require('./notifications');
                const notificationsServices = {
                    notificationManager: services.notificationManager
                };
                const notificationsRouter = initNotificationsRoutes(notificationsServices);
                router.use('/notifications', notificationsRouter);
            } else {
                console.log('⏸️ [Routes] notifications 模組已停用 (使用 v1 路由)');
            }
            
            // 👤 Student Reminders 模組
            console.log('👤 [Routes] 載入 Student Reminders 模組');
            if (FEATURE_FLAGS.ENABLE_NOTIFICATIONS_V2) {
                console.log('✅ [Routes] 載入 student-reminders 模組 (v2)');
                const initStudentRemindersRoutes = require('./student-reminders');
                const studentRemindersServices = {
                    notificationManager: services.notificationManager
                };
                const studentRemindersRouter = initStudentRemindersRoutes(studentRemindersServices);
                router.use('/student-reminders', studentRemindersRouter);
            } else {
                console.log('⏸️ [Routes] student-reminders 模組已停用 (使用 v1 路由)');
            }
            
            // 🌐 Webhook 模組
            console.log('🌐 [Routes] 載入 Webhook 模組');
            if (FEATURE_FLAGS.ENABLE_NOTIFICATIONS_V2) {
                console.log('✅ [Routes] 載入 webhook 模組 (v2)');
                const initWebhookRoutes = require('./webhook');
                const webhookServices = {
                    notificationManager: services.notificationManager
                };
                const webhookRouter = initWebhookRoutes(webhookServices);
                router.use('/webhook', webhookRouter);
            } else {
                console.log('⏸️ [Routes] webhook 模組已停用 (使用 v1 路由)');
            }
            
        } catch (error) {
            console.error('❌ [Routes] 階段四模組載入失敗:', error.message);
        }
    }
    
    // 📁 階段五：媒體系統模組
    if (USE_ROUTES_PHASE5) {
        try {
            console.log('📁 [Routes] 載入階段五模組（媒體系統）');
            
            // 📁 Media Upload 模組 (Legacy, 410 Gone)
            console.log('📁 [Routes] 載入 Media Upload 模組 (Legacy)');
            const initMediaUploadRoutes = require('./media-upload');
            const mediaUploadRouter = initMediaUploadRoutes();
            router.use('/media', mediaUploadRouter);
            
            // ☁️ Drive Upload 模組
            console.log('☁️ [Routes] 載入 Drive Upload 模組');
            const initDriveUploadRoutes = require('./drive-upload');
            const driveUploadServices = {
                driveClient: services.driveClient,
                driveChunkRegistry: services.driveChunkRegistry,
                driveUploadQueue: services.driveUploadQueue,
                drivePathManager: services.drivePathManager
            };
            const driveUploadRouter = initDriveUploadRoutes(driveUploadServices);
            router.use('/drive-upload', driveUploadRouter);
            
            // 💾 Drive Media 模組
            console.log('💾 [Routes] 載入 Drive Media 模組');
            const initDriveMediaRoutes = require('./drive-media');
            const driveMediaServices = {
                driveClient: services.driveClient,
                driveMediaIndex: services.driveMediaIndex
            };
            const driveMediaRouter = initDriveMediaRoutes(driveMediaServices);
            router.use('/drive-media', driveMediaRouter);
            
            // 📚 Learning Records 模組
            console.log('📚 [Routes] 載入 Learning Records 模組');
            const initLearningRecordsRoutes = require('./learning-records');
            const learningRecordsServices = {
                driveClient: services.driveClient,
                learningUploadHelper: services.learningUploadHelper,
                learningRecordsIndex: services.learningRecordsIndex,
                driveMediaIndex: services.driveMediaIndex
            };
            const learningRecordsRouter = initLearningRecordsRoutes(learningRecordsServices);
            router.use('/learning-records', learningRecordsRouter);
            
        } catch (error) {
            console.error('❌ [Routes] 階段五模組載入失敗:', error.message);
        }
    }
    
    // 📅 階段六：日曆核心模組
    if (USE_ROUTES_PHASE6) {
        try {
            // 📅 Events 模組
            console.log('📅 [Routes] 載入 Events 模組');
            if (FEATURE_FLAGS.ENABLE_EVENTS_V2) {
                console.log('✅ [Routes] 載入 events 模組 (v2)');
                const { initEventsRoutes } = require('./events');
                const eventsServices = {
                    calendarClient: services.calendarClient,
                    eventsCache: services.eventsCache || { events: [], lastUpdate: null }
                };
                const eventsRouter = initEventsRoutes(eventsServices);
                router.use('/events', eventsRouter);
                console.log('✅ [Events] Events 路由已初始化並掛載');
            } else {
                console.log('⏸️ [Routes] events 模組已停用 (使用 v1 路由)');
            }
            
        } catch (error) {
            console.error('❌ [Routes] 階段六模組載入失敗:', error.message);
        }
    }
    
    // 掛載路由到 Express 應用
    // 🔥 [修復 2025-11-27] 改為 /api/v3 避免與舊系統 v2-*.js 衝突
    app.use('/api/v3', router);
    
    console.log('✅ [Routes] 路由模組初始化完成');
    console.log('📍 [Routes] V3 路由已掛載到: /api/v3/');
    console.log('⚠️ [Routes] 注意：舊系統 V2 API 仍在 /api/v2/ (v2-*.js 檔案)');
    
    return router;
}

module.exports = {
    router,
    initializeRoutes,
    FEATURE_FLAGS
};
