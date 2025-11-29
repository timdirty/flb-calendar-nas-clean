/**
 * 地點對應表管理模組
 * 用於學生提醒的 Google Maps 導航功能
 */

// 全域變數
let locationMappingData = null;

/**
 * 載入地點對應表
 */
async function loadLocationMapping() {
    try {
        console.log('📍 載入地點對應表...');
        const response = await fetch('/api/location-mapping');
        const result = await response.json();
        
        if (result.success) {
            locationMappingData = result.data;
            console.log('✅ 地點對應表載入成功:', locationMappingData);
            renderLocationMappingList();
            
            // 更新預設地址欄位
            const defaultAddressInput = document.getElementById('defaultLocationAddress');
            if (defaultAddressInput && locationMappingData['預設地址']) {
                defaultAddressInput.value = locationMappingData['預設地址'];
            }
        } else {
            console.error('❌ 載入地點對應表失敗:', result.error);
            showError('載入地點對應表失敗');
        }
    } catch (error) {
        console.error('❌ 載入地點對應表異常:', error);
        showError('載入地點對應表時發生錯誤');
    }
}

/**
 * 渲染地點對應表列表
 */
function renderLocationMappingList() {
    const container = document.getElementById('locationMappingList');
    if (!container) return;
    
    if (!locationMappingData || !locationMappingData.mappings) {
        container.innerHTML = '<p class="help-text">尚未設定任何地點對應</p>';
        return;
    }
    
    const mappings = locationMappingData.mappings;
    const entries = Object.entries(mappings);
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="help-text">尚未設定任何地點對應</p>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 10px;">';
    
    entries.forEach(([name, address]) => {
        html += `
            <div class="location-item" data-location-name="${escapeHtml(name)}" style="
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            ">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #10b981; margin-bottom: 4px;">
                        📍 ${escapeHtml(name)}
                    </div>
                    <div style="font-size: 0.9em; color: #e5e7eb;">
                        ${escapeHtml(address)}
                    </div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteLocationMapping('${escapeHtml(name)}')" 
                        style="flex-shrink: 0;">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 新增地點對應
 */
async function addLocationMapping() {
    const nameInput = document.getElementById('newLocationName');
    const addressInput = document.getElementById('newLocationAddress');
    
    if (!nameInput || !addressInput) {
        console.error('❌ 找不到輸入欄位');
        return;
    }
    
    const name = nameInput.value.trim();
    const address = addressInput.value.trim();
    
    if (!name || !address) {
        showError('請填寫地點簡稱和具體地址');
        return;
    }
    
    try {
        console.log('➕ 新增地點對應:', { name, address });
        
        const response = await fetch('/api/location-mapping/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, address })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 新增地點對應成功');
            showSuccess(`已新增地點：${name}`);
            
            // 更新快取
            locationMappingData = result.data;
            
            // 重新渲染列表
            renderLocationMappingList();
            
            // 清空輸入欄位
            nameInput.value = '';
            addressInput.value = '';
        } else {
            console.error('❌ 新增地點對應失敗:', result.error);
            showError('新增地點對應失敗：' + result.error);
        }
    } catch (error) {
        console.error('❌ 新增地點對應異常:', error);
        showError('新增地點對應時發生錯誤');
    }
}

/**
 * 刪除地點對應
 */
async function deleteLocationMapping(name) {
    if (!confirm(`確定要刪除地點「${name}」嗎？`)) {
        return;
    }
    
    try {
        console.log('🗑️ 刪除地點對應:', name);
        
        const response = await fetch(`/api/location-mapping/location/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 刪除地點對應成功');
            showSuccess(`已刪除地點：${name}`);
            
            // 更新快取
            locationMappingData = result.data;
            
            // 重新渲染列表
            renderLocationMappingList();
        } else {
            console.error('❌ 刪除地點對應失敗:', result.error);
            showError('刪除地點對應失敗：' + result.error);
        }
    } catch (error) {
        console.error('❌ 刪除地點對應異常:', error);
        showError('刪除地點對應時發生錯誤');
    }
}

/**
 * 儲存地點對應表（包含預設地址）
 */
async function saveLocationMapping() {
    const defaultAddressInput = document.getElementById('defaultLocationAddress');
    
    if (!locationMappingData || !locationMappingData.mappings) {
        showError('請先載入地點對應表');
        return;
    }
    
    const defaultAddress = defaultAddressInput ? defaultAddressInput.value.trim() : '';
    
    if (!defaultAddress) {
        showError('請設定預設地址');
        return;
    }
    
    try {
        console.log('💾 儲存地點對應表...');
        
        const response = await fetch('/api/location-mapping', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mappings: locationMappingData.mappings,
                '預設地址': defaultAddress
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 儲存地點對應表成功');
            showSuccess('地點對應表已儲存');
            
            // 更新快取
            locationMappingData = result.data;
        } else {
            console.error('❌ 儲存地點對應表失敗:', result.error);
            showError('儲存地點對應表失敗：' + result.error);
        }
    } catch (error) {
        console.error('❌ 儲存地點對應表異常:', error);
        showError('儲存地點對應表時發生錯誤');
    }
}

/**
 * 重新載入地點對應表
 */
async function reloadLocationMapping() {
    console.log('🔄 重新載入地點對應表...');
    await loadLocationMapping();
    showSuccess('已重新載入地點對應表');
}

/**
 * HTML 跳脫函數
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 初始化地點對應表管理
 */
function initLocationMappingManager() {
    console.log('🚀 初始化地點對應表管理...');
    
    // 載入地點對應表
    loadLocationMapping();
    
    // 綁定事件監聽器
    const addBtn = document.getElementById('addLocationMapping');
    if (addBtn) {
        addBtn.addEventListener('click', addLocationMapping);
    }
    
    const saveBtn = document.getElementById('saveLocationMapping');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveLocationMapping);
    }
    
    const reloadBtn = document.getElementById('reloadLocationMapping');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', reloadLocationMapping);
    }
    
    console.log('✅ 地點對應表管理初始化完成');
}

// 確保在 DOM 載入完成後初始化（如果已經載入則立即執行）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocationMappingManager);
} else {
    // DOM 已經載入完成，延遲執行以確保其他腳本先載入
    setTimeout(initLocationMappingManager, 100);
}
