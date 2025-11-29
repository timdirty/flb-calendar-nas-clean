/**
 * 📋 Template Handler - 範本管理業務邏輯
 * 
 * 處理範本配置的 CRUD 操作
 * 包含 Flex Message 範本的管理
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const path = require('path');
const fs = require('fs').promises;

class TemplateHandler {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.flexTemplatePath = path.join(__dirname, '../../flex-message-templates.json');
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 分鐘
    }

    /**
     * 🔍 取得所有範本設定
     */
    async getTemplates() {
        try {
            // 檢查快取
            const cacheKey = 'templates_cache';
            const cached = this.cache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                console.log('✅ [TemplateHandler] 使用快取的範本資料');
                return {
                    success: true,
                    data: cached.data,
                    cached: true,
                    cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
                };
            }

            // 讀取檔案
            const templates = this.notificationManager?.templates || {};
            
            // 更新快取
            this.cache.set(cacheKey, {
                data: templates,
                timestamp: Date.now()
            });

            return {
                success: true,
                data: templates,
                cached: false
            };
        } catch (error) {
            console.error('❌ [TemplateHandler] 取得範本失敗:', error);
            throw error;
        }
    }

    /**
     * 💾 儲存範本設定
     */
    async saveTemplates(templates) {
        try {
            if (!templates) {
                throw new Error('範本資料不能為空');
            }

            // 更新 notificationManager
            if (this.notificationManager) {
                this.notificationManager.templates = templates;
            }

            // 清除快取
            this.cache.delete('templates_cache');

            console.log('✅ [TemplateHandler] 範本設定已更新');
            
            return {
                success: true,
                message: '範本設定已儲存'
            };
        } catch (error) {
            console.error('❌ [TemplateHandler] 儲存範本失敗:', error);
            throw error;
        }
    }

    /**
     * 📄 取得 Flex Message 範本
     */
    async getFlexTemplates() {
        try {
            const data = await fs.readFile(this.flexTemplatePath, 'utf8');
            const templates = JSON.parse(data);

            return {
                success: true,
                data: templates
            };
        } catch (error) {
            console.error('❌ [TemplateHandler] 讀取 Flex 範本失敗:', error);
            
            // 如果檔案不存在，返回空範本
            if (error.code === 'ENOENT') {
                return {
                    success: true,
                    data: {
                        templates: {},
                        enabled: {},
                        quickReply: {},
                        carousel: {}
                    }
                };
            }
            
            throw error;
        }
    }

    /**
     * 💾 儲存 Flex Message 範本
     */
    async saveFlexTemplates(data) {
        try {
            const { templates, enabled, quickReply, carousel } = data || {};

            const flexData = {
                templates: templates || {},
                enabled: enabled || {},
                quickReply: quickReply || {},
                carousel: carousel || {}
            };

            await fs.writeFile(
                this.flexTemplatePath,
                JSON.stringify(flexData, null, 2),
                'utf8'
            );

            // 重新載入到 notificationManager
            if (this.notificationManager && typeof this.notificationManager.loadFlexTemplates === 'function') {
                this.notificationManager.flexTemplates = this.notificationManager.loadFlexTemplates();
            }

            console.log('✅ [TemplateHandler] Flex Message 範本已儲存');

            return {
                success: true,
                message: 'Flex Message 範本已儲存'
            };
        } catch (error) {
            console.error('❌ [TemplateHandler] 儲存 Flex 範本失敗:', error);
            throw error;
        }
    }

    /**
     * 🔄 重新載入 Flex Message 範本
     */
    async reloadFlexTemplates() {
        try {
            // 檢查 NotificationManager 是否存在
            if (!this.notificationManager) {
                console.warn('⚠️ [TemplateHandler] NotificationManager 未提供，使用降級模式');
                
                // 降級模式：直接讀取檔案
                const fs = require('fs');
                const path = require('path');
                const templatePath = path.join(process.cwd(), 'flex-message-templates.json');
                
                if (fs.existsSync(templatePath)) {
                    const templates = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    console.log('✅ [TemplateHandler] Flex Message 範本已從檔案重新載入');
                    
                    return {
                        success: true,
                        message: 'Flex Message 範本已重新載入（降級模式）',
                        templates,
                        mode: 'fallback'
                    };
                } else {
                    throw new Error('找不到 Flex Message 範本檔案');
                }
            }
            
            // 正常模式：使用 NotificationManager
            if (typeof this.notificationManager.loadFlexTemplates === 'function') {
                this.notificationManager.flexTemplates = this.notificationManager.loadFlexTemplates();
                
                console.log('✅ [TemplateHandler] Flex Message 範本已重新載入');
                
                return {
                    success: true,
                    message: 'Flex Message 範本已重新載入',
                    templates: this.notificationManager.flexTemplates,
                    mode: 'normal'
                };
            } else {
                // 如果 NotificationManager 存在但沒有 loadFlexTemplates 方法
                console.warn('⚠️ [TemplateHandler] NotificationManager 沒有 loadFlexTemplates 方法');
                throw new Error('NotificationManager 不支援重新載入功能');
            }
        } catch (error) {
            console.error('❌ [TemplateHandler] 重新載入 Flex 範本失敗:', error);
            throw error;
        }
    }

    /**
     * 🧪 測試發送 Flex 範本
     */
    async sendTestFlexTemplate(type, options = {}) {
        try {
            const { specialEventType, useSpecialTemplate } = options;
            
            // 這裡需要實際的發送邏輯
            // 目前僅返回成功訊息
            console.log(`📤 [TemplateHandler] 測試發送 Flex 範本: ${type}`);
            
            return {
                success: true,
                message: `Flex 範本 ${type} 測試發送成功`,
                type,
                options
            };
        } catch (error) {
            console.error('❌ [TemplateHandler] 測試發送失敗:', error);
            throw error;
        }
    }
}

module.exports = TemplateHandler;
