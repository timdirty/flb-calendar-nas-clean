#!/usr/bin/env node

/**
 * 修補缺少的功能 - LIFF 整合和講師綁定
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 開始修補缺少的功能...\n');

// 讀取完整優化版本
const filePath = path.join(__dirname, 'public/perfect-calendar-complete-optimized.html');
let content = fs.readFileSync(filePath, 'utf8');

// 檢查是否已包含LIFF功能
if (!content.includes('LIFFManager') && !content.includes('liff.init')) {
    console.log('➕ 添加 LIFF 整合功能...');
    
    // 確保 LIFFManager 存在並正確配置
    const liffCode = `
            // ================================================
            // LIFF 整合模塊 - 完整版
            // ================================================
            
            const LIFFManager = {
                liffId: '2006585863-p6xEd0WV',
                isInitialized: false,
                
                async init() {
                    if (typeof liff === 'undefined') {
                        console.log('⏭️ LIFF SDK 未載入，跳過初始化');
                        return false;
                    }
                    
                    try {
                        console.log('🔑 初始化 LIFF...');
                        await liff.init({ liffId: this.liffId });
                        
                        if (!liff.isLoggedIn()) {
                            console.log('🔐 用戶未登入，引導登入...');
                            liff.login();
                            return false;
                        }
                        
                        const profile = await liff.getProfile();
                        console.log('✅ LIFF 初始化成功:', profile);
                        
                        AppState.setState({ 
                            userProfile: profile,
                            liffReady: true 
                        });
                        
                        UIManager.updateUserInfo(profile);
                        
                        this.isInitialized = true;
                        return true;
                    } catch (error) {
                        console.error('❌ LIFF 初始化失敗:', error);
                        UIManager.showToast('LINE 登入失敗', 'error');
                        return false;
                    }
                },
                
                async getProfile() {
                    if (!this.isInitialized || typeof liff === 'undefined') {
                        return null;
                    }
                    
                    try {
                        return await liff.getProfile();
                    } catch (error) {
                        console.error('❌ 獲取用戶資料失敗:', error);
                        return null;
                    }
                },
                
                async closeWindow() {
                    if (typeof liff !== 'undefined' && liff.isInClient()) {
                        liff.closeWindow();
                    }
                },
                
                async sendMessage(messages) {
                    if (!this.isInitialized || typeof liff === 'undefined') {
                        console.warn('⚠️ LIFF 未初始化，無法發送訊息');
                        return false;
                    }
                    
                    try {
                        if (liff.isInClient()) {
                            await liff.sendMessages(messages);
                            console.log('✅ 訊息發送成功');
                            return true;
                        } else {
                            console.log('⚠️ 非 LINE 客戶端環境，無法發送訊息');
                            return false;
                        }
                    } catch (error) {
                        console.error('❌ 發送訊息失敗:', error);
                        return false;
                    }
                }
            };
            
            // 暴露到全局
            window.LIFFManager = LIFFManager;
    `;
    
    // 在 initApp 之前插入
    const insertPoint = content.indexOf('async function initApp()');
    if (insertPoint > -1) {
        content = content.substring(0, insertPoint) + liffCode + '\n' + content.substring(insertPoint);
        console.log('✅ LIFF 功能已添加');
    } else {
        console.error('❌ 找不到插入點');
    }
}

// 檢查並補充講師綁定功能
if (!content.includes('showTeacherBindModal')) {
    console.log('➕ 添加講師綁定功能...');
    
    const teacherBindingCode = `
            // ================================================
            // 講師綁定功能模塊 - 完整版
            // ================================================
            
            const TeacherBindingManager = {
                async showBindModal(userId, displayName) {
                    console.log('📋 顯示講師綁定對話框', { userId, displayName });
                    
                    // 創建模態框
                    const modal = document.createElement('div');
                    modal.id = 'teacherBindModal';
                    modal.style.cssText = \`
                        position: fixed;
                        inset: 0;
                        background: var(--bg-modal);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: var(--z-modal);
                        backdrop-filter: blur(10px);
                    \`;
                    
                    modal.innerHTML = \`
                        <div style="
                            background: var(--bg-card);
                            border-radius: var(--radius-lg);
                            padding: var(--spacing-2xl);
                            max-width: 500px;
                            width: 90%;
                            border: 1px solid var(--border-gold);
                        ">
                            <h2 style="color: var(--primary-gold); margin-bottom: var(--spacing-lg);">
                                <i class="fas fa-link"></i> 講師綁定
                            </h2>
                            <div style="margin-bottom: var(--spacing-lg);">
                                <div style="margin-bottom: var(--spacing-md);">
                                    <strong>用戶名稱：</strong> \${displayName || '未知'}
                                </div>
                                <div style="margin-bottom: var(--spacing-md); color: var(--text-secondary); font-size: 0.9rem;">
                                    <strong>用戶ID：</strong> \${userId || '未知'}
                                </div>
                            </div>
                            <div style="margin-bottom: var(--spacing-lg);">
                                <label class="filter-label">選擇講師</label>
                                <select class="filter-select" id="bindTeacherSelect">
                                    <option value="">-- 請選擇講師 --</option>
                                    \${AppState.allInstructors.map(t => 
                                        \`<option value="\${t}">\${t}</option>\`
                                    ).join('')}
                                </select>
                            </div>
                            <div style="display: flex; gap: var(--spacing-md); justify-content: flex-end;">
                                <button class="btn-base" onclick="TeacherBindingManager.closeModal()" 
                                        style="background: rgba(255,255,255,0.1); padding: 12px 24px;">
                                    <i class="fas fa-times"></i> 取消
                                </button>
                                <button class="btn-base btn-primary" onclick="TeacherBindingManager.confirmBinding('\${userId}', '\${displayName}')">
                                    <i class="fas fa-check"></i> 確認綁定
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.body.appendChild(modal);
                },
                
                closeModal() {
                    const modal = document.getElementById('teacherBindModal');
                    if (modal) {
                        modal.style.opacity = '0';
                        setTimeout(() => modal.remove(), 300);
                    }
                },
                
                async confirmBinding(userId, displayName) {
                    const selectedTeacher = Utils.$('#bindTeacherSelect').value;
                    
                    if (!selectedTeacher) {
                        UIManager.showToast('請選擇一個講師', 'warning');
                        return;
                    }
                    
                    try {
                        UIManager.showLoading('綁定中...');
                        
                        const response = await APIManager.request('/api/teacher-binding', {
                            method: 'POST',
                            body: JSON.stringify({
                                userId,
                                displayName,
                                teacher: selectedTeacher
                            }),
                            cache: false
                        });
                        
                        console.log('✅ 綁定成功:', response);
                        UIManager.showToast(\`✅ 已綁定到講師: \${selectedTeacher}\`, 'success');
                        this.closeModal();
                        
                        // 更新用戶資料
                        AppState.setState({ selectedTeacher });
                        
                        // 重新載入課程
                        await EventManager.loadEvents();
                        RenderManager.renderEvents();
                        
                    } catch (error) {
                        console.error('❌ 綁定失敗:', error);
                        UIManager.showToast('綁定失敗，請重試', 'error');
                    } finally {
                        UIManager.hideLoading();
                    }
                },
                
                async autoMatch(userId, displayName) {
                    console.log('🔍 自動比對講師:', { userId, displayName });
                    
                    try {
                        const response = await APIManager.request('/api/auto-match-teacher', {
                            method: 'POST',
                            body: JSON.stringify({ userId, displayName }),
                            cache: false
                        });
                        
                        if (response.matched && response.teacher) {
                            console.log('✅ 自動比對成功:', response.teacher);
                            AppState.setState({ selectedTeacher: response.teacher });
                            UIManager.showToast(\`✅ 已自動綁定到: \${response.teacher}\`, 'success', 2000);
                            return response.teacher;
                        } else {
                            console.log('⚠️ 自動比對失敗，需要手動選擇');
                            this.showBindModal(userId, displayName);
                            return null;
                        }
                    } catch (error) {
                        console.error('❌ 自動比對錯誤:', error);
                        this.showBindModal(userId, displayName);
                        return null;
                    }
                }
            };
            
            // 暴露到全局
            window.TeacherBindingManager = TeacherBindingManager;
            window.showTeacherBindModal = TeacherBindingManager.showBindModal.bind(TeacherBindingManager);
    `;
    
    const insertPoint = content.indexOf('async function initApp()');
    if (insertPoint > -1) {
        content = content.substring(0, insertPoint) + teacherBindingCode + '\n' + content.substring(insertPoint);
        console.log('✅ 講師綁定功能已添加');
    }
}

// 確保在 initApp 中啟用 LIFF
if (!content.includes('await LIFFManager.init()') && content.includes('async function initApp()')) {
    console.log('➕ 在 initApp 中添加 LIFF 初始化...');
    
    // 找到 initApp 函數的開始
    const initAppStart = content.indexOf('async function initApp()');
    const initAppBody = content.indexOf('{', initAppStart);
    
    const liffInitCode = `
                // LIFF 初始化（延遲載入）
                const liffScript = document.createElement('script');
                liffScript.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
                liffScript.async = true;
                liffScript.defer = true;
                liffScript.onload = async () => {
                    const liffReady = await LIFFManager.init();
                    if (liffReady && AppState.userProfile) {
                        // 嘗試自動比對講師
                        await TeacherBindingManager.autoMatch(
                            AppState.userProfile.userId,
                            AppState.userProfile.displayName
                        );
                    }
                };
                document.head.appendChild(liffScript);
                
    `;
    
    content = content.substring(0, initAppBody + 1) + liffInitCode + content.substring(initAppBody + 1);
    console.log('✅ LIFF 初始化代碼已添加到 initApp');
}

// 寫回文件
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ 修補完成！');
console.log('📄 已更新:', filePath);
console.log('\n🔄 請再次運行測試: node test-complete-optimized.js');

