/**
 * 🔍 請求驗證中間件
 * 
 * 提供標準化的請求參數驗證功能
 * 支援型別檢查、格式驗證、業務規則驗證
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createValidationError } = require('../middleware/errorHandler');
const logger = require('../../utils/logger');

/**
 * 常用驗證規則
 */
const ValidationRules = {
    // 字串驗證
    required: (value) => {
        if (value === null || value === undefined || value === '') {
            return '此欄位為必填';
        }
        return null;
    },
    
    optional: (value) => {
        // 可選欄位，如果為空則跳過後續驗證
        return value === null || value === undefined || value === '' ? null : 'continue';
    },
    
    minLength: (min) => (value) => {
        if (value && value.length < min) {
            return `長度不能少於 ${min} 個字元`;
        }
        return null;
    },
    
    maxLength: (max) => (value) => {
        if (value && value.length > max) {
            return `長度不能超過 ${max} 個字元`;
        }
        return null;
    },
    
    email: (value) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return '請輸入有效的電子郵件地址';
        }
        return null;
    },
    
    phone: (value) => {
        if (value && !/^09\d{8}$/.test(value.replace(/[^\d]/g, ''))) {
            return '請輸入有效的手機號碼';
        }
        return null;
    },
    
    date: (value) => {
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return '請輸入有效的日期格式 (YYYY-MM-DD)';
        }
        return null;
    },
    
    datetime: (value) => {
        if (value && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
            return '請輸入有效的日期時間格式 (YYYY-MM-DDTHH:mm:ss)';
        }
        return null;
    },
    
    number: (value) => {
        if (value !== null && value !== undefined && value !== '' && isNaN(Number(value))) {
            return '請輸入有效的數字';
        }
        return null;
    },
    
    integer: (value) => {
        if (value !== null && value !== undefined && value !== '') {
            const num = Number(value);
            if (isNaN(num) || !Number.isInteger(num)) {
                return '請輸入有效的整數';
            }
        }
        return null;
    },
    
    positive: (value) => {
        if (value !== null && value !== undefined && value !== '') {
            const num = Number(value);
            if (isNaN(num) || num <= 0) {
                return '請輸入正數';
            }
        }
        return null;
    },
    
    array: (value) => {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
            return '請輸入有效的陣列格式';
        }
        return null;
    },
    
    object: (value) => {
        if (value !== null && value !== undefined && typeof value !== 'object') {
            return '請輸入有效的物件格式';
        }
        return null;
    },
    
    boolean: (value) => {
        if (value !== null && value !== undefined && typeof value !== 'boolean') {
            return '請輸入有效的布林值';
        }
        return null;
    },
    
    enum: (values) => (value) => {
        if (value !== null && value !== undefined && !values.includes(value)) {
            return `請輸入有效的值：${values.join(', ')}`;
        }
        return null;
    },
    
    url: (value) => {
        if (value && !/^https?:\/\/.+/.test(value)) {
            return '請輸入有效的 URL 地址';
        }
        return null;
    },
    
    json: (value) => {
        if (value && typeof value === 'string') {
            try {
                JSON.parse(value);
            } catch (e) {
                return '請輸入有效的 JSON 格式';
            }
        }
        return null;
    }
};

/**
 * 執行單一欄位驗證
 */
function validateField(value, rules, fieldName) {
    const errors = [];
    
    for (const rule of rules) {
        const result = rule(value);
        
        if (result === 'continue') {
            continue; // 可選欄位為空，跳過後續驗證
        }
        
        if (result) {
            errors.push(`${fieldName}: ${result}`);
        }
    }
    
    return errors;
}

/**
 * 驗證請求物件
 */
function validateObject(obj, schema, context = 'request') {
    const errors = [];
    const validatedData = {};
    
    // 檢查必填欄位
    for (const [fieldName, rules] of Object.entries(schema)) {
        const value = obj[fieldName];
        
        // 執行驗證規則
        const fieldErrors = validateField(value, rules, fieldName);
        errors.push(...fieldErrors);
        
        // 如果驗證通過，添加到驗證後的資料
        if (fieldErrors.length === 0 && value !== undefined) {
            validatedData[fieldName] = value;
        }
    }
    
    // 檢查是否有未定義的欄位
    const allowedFields = Object.keys(schema);
    const extraFields = Object.keys(obj).filter(key => !allowedFields.includes(key));
    
    if (extraFields.length > 0) {
        logger.warn('🔍 [Validator] 發現未定義的欄位:', {
            context,
            extraFields,
            allowedFields
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        data: validatedData
    };
}

/**
 * 請求驗證中間件工廠
 */
function validateBody(schema) {
    return (req, res, next) => {
        try {
            const result = validateObject(req.body, schema, 'body');
            
            if (!result.isValid) {
                logger.warn('🔍 [Validator] 請求 body 驗證失敗:', {
                    errors: result.errors,
                    body: req.body,
                    url: req.originalUrl,
                    ip: req.ip
                });
                
                throw createValidationError('請求參數驗證失敗', {
                    fieldErrors: result.errors
                });
            }
            
            // 將驗證後的資料附加到 request
            req.validatedBody = result.data;
            next();
            
        } catch (error) {
            if (error.type) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    details: error.details
                });
            }
            
            next(error);
        }
    };
}

/**
 * 查詢參數驗證中間件工廠
 */
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const result = validateObject(req.query, schema, 'query');
            
            if (!result.isValid) {
                logger.warn('🔍 [Validator] 查詢參數驗證失敗:', {
                    errors: result.errors,
                    query: req.query,
                    url: req.originalUrl,
                    ip: req.ip
                });
                
                throw createValidationError('查詢參數驗證失敗', {
                    fieldErrors: result.errors
                });
            }
            
            req.validatedQuery = result.data;
            next();
            
        } catch (error) {
            if (error.type) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    details: error.details
                });
            }
            
            next(error);
        }
    };
}

/**
 * 路徑參數驗證中間件工廠
 */
function validateParams(schema) {
    return (req, res, next) => {
        try {
            const result = validateObject(req.params, schema, 'params');
            
            if (!result.isValid) {
                logger.warn('🔍 [Validator] 路徑參數驗證失敗:', {
                    errors: result.errors,
                    params: req.params,
                    url: req.originalUrl,
                    ip: req.ip
                });
                
                throw createValidationError('路徑參數驗證失敗', {
                    fieldErrors: result.errors
                });
            }
            
            req.validatedParams = result.data;
            next();
            
        } catch (error) {
            if (error.type) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    details: error.details
                });
            }
            
            next(error);
        }
    };
}

/**
 * 綜合驗證中間件（同時驗證 body、query、params）
 */
function validateRequest(schemas = {}) {
    const { body, query, params } = schemas;
    
    return (req, res, next) => {
        try {
            const errors = [];
            const validatedData = {};
            
            // 驗證 body
            if (body) {
                const bodyResult = validateObject(req.body, body, 'body');
                if (!bodyResult.isValid) {
                    errors.push(...bodyResult.errors);
                } else {
                    validatedData.body = bodyResult.data;
                }
            }
            
            // 驗證 query
            if (query) {
                const queryResult = validateObject(req.query, query, 'query');
                if (!queryResult.isValid) {
                    errors.push(...queryResult.errors);
                } else {
                    validatedData.query = queryResult.data;
                }
            }
            
            // 驗證 params
            if (params) {
                const paramsResult = validateObject(req.params, params, 'params');
                if (!paramsResult.isValid) {
                    errors.push(...paramsResult.errors);
                } else {
                    validatedData.params = paramsResult.data;
                }
            }
            
            if (errors.length > 0) {
                logger.warn('🔍 [Validator] 綜合驗證失敗:', {
                    errors,
                    url: req.originalUrl,
                    ip: req.ip
                });
                
                throw createValidationError('請求參數驗證失敗', {
                    fieldErrors: errors
                });
            }
            
            // 附加驗證後的資料
            req.validatedBody = validatedData.body || {};
            req.validatedQuery = validatedData.query || {};
            req.validatedParams = validatedData.params || {};
            
            next();
            
        } catch (error) {
            if (error.type) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    details: error.details
                });
            }
            
            next(error);
        }
    };
}

/**
 * 常用驗證模板
 */
const CommonSchemas = {
    // 分頁參數
    pagination: {
        page: [ValidationRules.optional, ValidationRules.integer, ValidationRules.positive],
        limit: [ValidationRules.optional, ValidationRules.integer, ValidationRules.positive],
        offset: [ValidationRules.optional, ValidationRules.integer]
    },
    
    // 日期範圍
    dateRange: {
        startDate: [ValidationRules.optional, ValidationRules.date],
        endDate: [ValidationRules.optional, ValidationRules.date]
    },
    
    // 學期參數
    semester: {
        semester: [ValidationRules.required]
    },
    
    // 課程參數
    course: {
        courseId: [ValidationRules.required],
        courseName: [ValidationRules.optional, ValidationRules.maxLength(100)],
        date: [ValidationRules.optional, ValidationRules.date]
    },
    
    // 學生參數
    student: {
        studentName: [ValidationRules.required, ValidationRules.maxLength(50)],
        studentId: [ValidationRules.optional, ValidationRules.maxLength(20)]
    },
    
    // 管理員登入
    adminLogin: {
        password: [ValidationRules.required, ValidationRules.minLength(6)]
    },
    
    // 檔案上傳
    fileUpload: {
        fileName: [ValidationRules.required, ValidationRules.maxLength(255)],
        fileSize: [ValidationRules.required, ValidationRules.integer, ValidationRules.positive],
        mimeType: [ValidationRules.required]
    }
};

module.exports = {
    ValidationRules,
    validateField,
    validateObject,
    validateBody,
    validateQuery,
    validateParams,
    validateRequest,
    CommonSchemas
};
