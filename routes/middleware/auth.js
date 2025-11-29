/**
 * 🔐 統一認證中間件
 * 
 * 提供標準化的認證和授權功能
 * 支援管理員、講師等多種角色認證
 * 保持與現有系統的向後相容性
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createAuthenticationError, createAuthorizationError } = require('./errorHandler');
const logger = require('../../utils/logger');

/**
 * 認證配置
 */
const AUTH_CONFIG = {
    // 管理員配置
    admin: {
        password: process.env.ADMIN_PASSWORD || 'admin123',
        tokenSecret: 'flb-admin-secret-key-' + Date.now(),
        tokenExpiry: 24 * 60 * 60 * 1000, // 24小時
        tokenPrefix: 'admin_'
    },
    // 講師配置（預留）
    teacher: {
        tokenExpiry: 12 * 60 * 60 * 1000, // 12小時
        tokenPrefix: 'teacher_'
    }
};

/**
 * Token 存儲（保持與現有系統相容）
 */
const adminTokens = new Set();
const teacherTokens = new Set();

/**
 * 生成管理員 token
 */
function generateAdminToken() {
    return AUTH_CONFIG.admin.tokenPrefix + Math.random().toString(36).substring(2) + Date.now();
}

/**
 * 生成講師 token（預留功能）
 */
function generateTeacherToken(teacherId) {
    return AUTH_CONFIG.teacher.tokenPrefix + teacherId + '_' + Math.random().toString(36).substring(2) + Date.now();
}

/**
 * 驗證 Bearer Token 格式
 */
function extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createAuthenticationError('未授權 - 缺少 Bearer Token');
    }
    return authHeader.substring(7);
}

/**
 * 驗證 Token 格式和類型
 */
function validateTokenType(token, expectedPrefix) {
    if (!token || !token.startsWith(expectedPrefix)) {
        throw createAuthenticationError('Token 無效 - 格式錯誤');
    }
}

/**
 * 管理員認證中間件（保持與現有 verifyAdminToken 相容）
 */
function verifyAdminToken(req, res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        validateTokenType(token, AUTH_CONFIG.admin.tokenPrefix);
        
        if (!adminTokens.has(token)) {
            throw createAuthenticationError('Token 無效 - 已過期或不存在');
        }

        // 設置使用者資訊到 request
        req.user = {
            role: 'admin',
            token: token,
            authenticated: true
        };

        logger.info('🔐 [Auth] 管理員認證成功:', { 
            token: token.substring(0, 20) + '...',
            ip: req.ip 
        });

        next();
    } catch (error) {
        logger.warn('🔐 [Auth] 管理員認證失敗:', { 
            error: error.message, 
            ip: req.ip 
        });
        
        if (error.type) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(401).json({ 
            success: false, 
            message: '未授權' 
        });
    }
}

/**
 * 講師認證中間件（預留功能）
 */
function verifyTeacherToken(req, res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        validateTokenType(token, AUTH_CONFIG.teacher.tokenPrefix);
        
        if (!teacherTokens.has(token)) {
            throw createAuthenticationError('講師 Token 無效 - 已過期或不存在');
        }

        // 解析講師 ID
        const tokenParts = token.split('_');
        const teacherId = tokenParts[1];

        // 設置使用者資訊到 request
        req.user = {
            role: 'teacher',
            teacherId: teacherId,
            token: token,
            authenticated: true
        };

        logger.info('🔐 [Auth] 講師認證成功:', { 
            teacherId,
            token: token.substring(0, 20) + '...',
            ip: req.ip 
        });

        next();
    } catch (error) {
        logger.warn('🔐 [Auth] 講師認證失敗:', { 
            error: error.message, 
            ip: req.ip 
        });
        
        if (error.type) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(401).json({ 
            success: false, 
            message: '講師未授權' 
        });
    }
}

/**
 * 通用認證中間件（支援多角色）
 */
function authenticateToken(roles = ['admin', 'teacher']) {
    return (req, res, next) => {
        try {
            const token = extractBearerToken(req.headers.authorization);
            
            // 嘗試管理員認證
            if (roles.includes('admin') && token.startsWith(AUTH_CONFIG.admin.tokenPrefix)) {
                if (!adminTokens.has(token)) {
                    throw createAuthenticationError('管理員 Token 無效');
                }
                
                req.user = {
                    role: 'admin',
                    token: token,
                    authenticated: true
                };
                
                logger.info('🔐 [Auth] 通用認證成功 (管理員):', { 
                    token: token.substring(0, 20) + '...',
                    ip: req.ip 
                });
                
                return next();
            }
            
            // 嘗試講師認證
            if (roles.includes('teacher') && token.startsWith(AUTH_CONFIG.teacher.tokenPrefix)) {
                if (!teacherTokens.has(token)) {
                    throw createAuthenticationError('講師 Token 無效');
                }
                
                const tokenParts = token.split('_');
                const teacherId = tokenParts[1];
                
                req.user = {
                    role: 'teacher',
                    teacherId: teacherId,
                    token: token,
                    authenticated: true
                };
                
                logger.info('🔐 [Auth] 通用認證成功 (講師):', { 
                    teacherId,
                    token: token.substring(0, 20) + '...',
                    ip: req.ip 
                });
                
                return next();
            }
            
            throw createAuthenticationError('Token 類型不被允許');
            
        } catch (error) {
            logger.warn('🔐 [Auth] 通用認證失敗:', { 
                error: error.message, 
                ip: req.ip 
            });
            
            if (error.type) {
                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(401).json({ 
                success: false, 
                message: '未授權' 
            });
        }
    };
}

/**
 * 角色授權中間件
 */
function requireRole(requiredRole) {
    return (req, res, next) => {
        if (!req.user || !req.user.authenticated) {
            return res.status(401).json({
                success: false,
                message: '需要先進行認證'
            });
        }
        
        if (req.user.role !== requiredRole) {
            logger.warn('🔐 [Auth] 角色權限不足:', { 
                userRole: req.user.role, 
                requiredRole,
                ip: req.ip 
            });
            
            return res.status(403).json({
                success: false,
                message: '權限不足'
            });
        }
        
        next();
    };
}

/**
 * 可選認證中間件（不強制要求認證）
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        req.user = { authenticated: false };
        return next();
    }
    
    try {
        const token = extractBearerToken(authHeader);
        
        // 嘗試管理員認證
        if (token.startsWith(AUTH_CONFIG.admin.tokenPrefix) && adminTokens.has(token)) {
            req.user = {
                role: 'admin',
                token: token,
                authenticated: true
            };
            return next();
        }
        
        // 嘗試講師認證
        if (token.startsWith(AUTH_CONFIG.teacher.tokenPrefix) && teacherTokens.has(token)) {
            const tokenParts = token.split('_');
            const teacherId = tokenParts[1];
            
            req.user = {
                role: 'teacher',
                teacherId: teacherId,
                token: token,
                authenticated: true
            };
            return next();
        }
        
        req.user = { authenticated: false };
        next();
        
    } catch (error) {
        // 可選認證失敗時不阻擋請求
        req.user = { authenticated: false };
        next();
    }
}

/**
 * 管理員登入處理
 */
function handleAdminLogin(req, res) {
    const { password } = req.body;
    
    if (password === AUTH_CONFIG.admin.password) {
        const token = generateAdminToken();
        adminTokens.add(token);
        
        // Token 過期處理
        setTimeout(() => {
            adminTokens.delete(token);
            logger.info('🔐 [Auth] 管理員 Token 過期:', { 
                token: token.substring(0, 20) + '...' 
            });
        }, AUTH_CONFIG.admin.tokenExpiry);
        
        logger.info('🔐 [Auth] 管理員登入成功:', { 
            token: token.substring(0, 20) + '...',
            ip: req.ip 
        });
        
        return {
            success: true,
            token: token,
            expiresIn: AUTH_CONFIG.admin.tokenExpiry / 1000 // 秒
        };
    }
    
    logger.warn('🔐 [Auth] 管理員登入失敗:', { 
        ip: req.ip 
    });
    
    throw createAuthenticationError('密碼錯誤');
}

/**
 * 清理過期 Token（可由排程器調用）
 */
function cleanupExpiredTokens() {
    // 這裡可以加入更複雜的過期檢查邏輯
    // 目前簡單記錄當前 token 數量
    logger.info('🔐 [Auth] Token 狀態:', {
        adminTokens: adminTokens.size,
        teacherTokens: teacherTokens.size
    });
}

/**
 * 獲取認證統計資訊
 */
function getAuthStats() {
    return {
        adminTokens: adminTokens.size,
        teacherTokens: teacherTokens.size,
        config: {
            adminTokenExpiry: AUTH_CONFIG.admin.tokenExpiry,
            teacherTokenExpiry: AUTH_CONFIG.teacher.tokenExpiry
        }
    };
}

module.exports = {
    // 主要認證中間件
    verifyAdminToken,
    verifyTeacherToken,
    authenticateToken,
    optionalAuth,
    
    // 授權中間件
    requireRole,
    
    // 工具函數
    handleAdminLogin,
    generateAdminToken,
    generateTeacherToken,
    cleanupExpiredTokens,
    getAuthStats,
    
    // 配置和狀態（供測試使用）
    adminTokens,
    teacherTokens,
    AUTH_CONFIG
};
