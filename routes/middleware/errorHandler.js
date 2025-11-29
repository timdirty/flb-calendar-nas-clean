/**
 * 🔧 統一錯誤處理中間件
 * 
 * 提供標準化的錯誤處理和回應格式
 * 支援日誌記錄和錯誤分類
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const logger = require('../../utils/logger');

/**
 * 錯誤類型枚舉
 */
const ErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    BUSINESS_ERROR: 'BUSINESS_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * 自定義錯誤類別
 */
class RouteError extends Error {
    constructor(message, type = ErrorTypes.BUSINESS_ERROR, statusCode = 400, details = null) {
        super(message);
        this.name = 'RouteError';
        this.type = type;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * 統一錯誤處理中間件
 */
const errorHandler = (err, req, res, next) => {
    // 記錄錯誤日誌
    const errorInfo = {
        message: err.message,
        type: err.type || ErrorTypes.INTERNAL_ERROR,
        statusCode: err.statusCode || 500,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };

    // 根據錯誤類型決定日誌級別
    switch (err.type) {
        case ErrorTypes.VALIDATION_ERROR:
            logger.warn('🔍 [RouteError] 驗證錯誤:', errorInfo);
            break;
        case ErrorTypes.AUTHENTICATION_ERROR:
        case ErrorTypes.AUTHORIZATION_ERROR:
            logger.warn('🔐 [RouteError] 認證錯誤:', errorInfo);
            break;
        case ErrorTypes.NOT_FOUND_ERROR:
            logger.info('🔍 [RouteError] 資源未找到:', errorInfo);
            break;
        case ErrorTypes.EXTERNAL_API_ERROR:
            logger.error('🌐 [RouteError] 外部 API 錯誤:', errorInfo);
            break;
        case ErrorTypes.INTERNAL_ERROR:
            logger.error('💥 [RouteError] 內部錯誤:', errorInfo);
            break;
        default:
            logger.error('❓ [RouteError] 未知錯誤:', errorInfo);
    }

    // 建構標準錯誤回應
    const errorResponse = {
        success: false,
        error: {
            type: err.type || ErrorTypes.INTERNAL_ERROR,
            message: err.message,
            timestamp: err.timestamp || new Date().toISOString()
        }
    };

    // 開發環境包含詳細資訊
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.details = err.details;
        errorResponse.error.stack = err.stack;
        errorResponse.debug = {
            method: req.method,
            url: req.originalUrl,
            body: req.body,
            query: req.query,
            params: req.params
        };
    }

    // 生產環境不暴露敏感資訊
    if (process.env.NODE_ENV === 'production' && err.type === ErrorTypes.INTERNAL_ERROR) {
        errorResponse.error.message = '伺服器內部錯誤，請稍後再試';
    }

    res.status(err.statusCode || 500).json(errorResponse);
};

/**
 * 404 錯誤處理中間件
 */
const notFoundHandler = (req, res) => {
    const errorInfo = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
    };

    logger.info('🔍 [RouteError] 端點未找到:', errorInfo);

    res.status(404).json({
        success: false,
        error: {
            type: ErrorTypes.NOT_FOUND_ERROR,
            message: `端點 ${req.method} ${req.originalUrl} 不存在`,
            timestamp: new Date().toISOString()
        }
    });
};

/**
 * 非同步錯誤包裝器
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 建立特定類型錯誤的便利函數
 */
const createValidationError = (message, details = null) => {
    return new RouteError(message, ErrorTypes.VALIDATION_ERROR, 400, details);
};

const createAuthenticationError = (message = '認證失敗') => {
    return new RouteError(message, ErrorTypes.AUTHENTICATION_ERROR, 401);
};

const createAuthorizationError = (message = '權限不足') => {
    return new RouteError(message, ErrorTypes.AUTHORIZATION_ERROR, 403);
};

const createNotFoundError = (message = '資源未找到') => {
    return new RouteError(message, ErrorTypes.NOT_FOUND_ERROR, 404);
};

const createBusinessError = (message, details = null) => {
    return new RouteError(message, ErrorTypes.BUSINESS_ERROR, 400, details);
};

const createExternalApiError = (message, details = null) => {
    return new RouteError(message, ErrorTypes.EXTERNAL_API_ERROR, 502, details);
};

const createInternalError = (message = '內部伺服器錯誤', details = null) => {
    return new RouteError(message, ErrorTypes.INTERNAL_ERROR, 500, details);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    ErrorTypes,
    RouteError,
    createValidationError,
    createAuthenticationError,
    createAuthorizationError,
    createNotFoundError,
    createBusinessError,
    createExternalApiError,
    createInternalError
};
