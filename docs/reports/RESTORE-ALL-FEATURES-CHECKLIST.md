# 功能恢復檢查清單

## ✅ 已恢復功能

### 1. CSS 樣式
- [x] scaleIn 動畫
- [x] Switch 開關樣式

### 2. UI 元素
- [x] 選擇指示器（currentSelectionIndicator）
- [x] 增量模式切換 UI（markerModeToggle）
- [x] 移除選中標記按鈕文字

### 3. JavaScript 函數
- [x] getSpecialEventStyles() - 多標記視覺樣式
- [x] applyMutualExclusionRules() - 互斥規則處理
- [x] toggleMarkerMode() - 模式切換
- [x] selectSpecialEventType() - Emoji 回饋（部分更新）

## 🔄 需要完整恢復的功能

### 4. 更新 `updateSpecialEventButtonsUI()` 函數
需要添加：
```javascript
// 選中狀態需要：
- btn.classList.add('selected')
- iconSpan 使用 scaleIn 動畫
- iconSpan.innerHTML = `<i class="fas fa-check-circle" style="font-size: 2rem; animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);"></i>`
- textSpan.innerHTML = `<strong>${btnType}</strong>`
- boxShadow: `0 8px 24px ${colors.solid}80, 0 0 0 4px ${colors.solid}20`

// 結尾添加：
updateSelectionIndicator();
```

### 5. 添加 `updateSelectionIndicator()` 函數
```javascript
function updateSelectionIndicator() {
    const indicator = document.getElementById('currentSelectionIndicator');
    const textEl = document.getElementById('currentSelectionText');
    
    if (!indicator || !textEl) return;
    
    if (adminSelectedEventTypes.length === 0) {
        indicator.style.display = 'none';
    } else {
        indicator.style.display = 'flex';
        const markerText = adminSelectedEventTypes.map(type => {
            const colorMap = {
                '停課': '🔴',
                '體驗': '🟢',
                '代課': '🔵',
                '改時間': '🟠',
                '公告': '🟣'
            };
            return `${colorMap[type] || ''} ${type}`;
        }).join(' + ');
        textEl.textContent = markerText;
    }
}
```

### 6. 更新 `confirmSpecialEventMark()` 函數
需要添加增量模式邏輯：
```javascript
// 在構建 requestData 之前添加：
const incrementalMode = document.getElementById('incrementalModeCheckbox')?.checked || false;

let finalMarkers = [...adminSelectedEventTypes];
if (incrementalMode) {
    const event = adminAllEvents.find(e => e.id === adminSelectedEventId);
    if (event) {
        const existingMarkers = detectExistingMarkers(event.title, event.description || '');
        console.log('📌 增量模式：現有標記', existingMarkers, '+ 新選標記', adminSelectedEventTypes);
        
        const mergedMarkers = [...new Set([...existingMarkers, ...adminSelectedEventTypes])];
        finalMarkers = applyMutualExclusionRules(mergedMarkers);
        
        console.log('📌 增量模式：最終標記', finalMarkers);
        showToast(`📌 增量模式：保留 ${existingMarkers.length} 個現有標記，新增 ${adminSelectedEventTypes.filter(m => !existingMarkers.includes(m)).length} 個標記`, 'info');
    }
} else {
    console.log('🔄 替換模式：直接使用新標記', finalMarkers);
}

// 然後 requestData 使用 finalMarkers：
const requestData = {
    eventId: adminSelectedEventId,
    specialTypes: finalMarkers,  // 使用合併後的標記
    specialType: finalMarkers[0],
    note: note
};
```

### 7. 添加 `removeSelectedMarkers()` 函數
完整的部分移除邏輯（見之前實作）

### 8. 更新渲染函數使用多標記視覺

#### renderAdminEventCardCompact()
```javascript
// 偵測多標記
const markers = detectExistingMarkers(event.title, event.description || '');
const styles = getSpecialEventStyles(markers);

// 生成多個 emoji 徽章
const markerEmojis = { '停課': '🔴', '體驗': '🟢', '代課': '🔵', '改時間': '🟠', '公告': '🟣' };
const badgeHTML = markers.length > 0 ? `
    <div style="display: flex; gap: 3px; margin-left: auto;">
        ${markers.map(m => `<span style="font-size: 0.9rem; animation: bounce-subtle 2s ease-in-out infinite;">${markerEmojis[m] || '⚪'}</span>`).join('')}
    </div>
` : '';

// 懸浮提示顯示所有標記
const tooltipHTML = markers.length > 0 ? `...` : '';

// 使用 data-hover-bg 實現 hover 效果
style="${styles.background}; ${styles.border};"
data-hover-bg="${styles.hoverBackground}"
onmouseover="if(el.dataset.hoverBg) el.style.background = el.dataset.hoverBg;"
onmouseout="el.style.background = '${styles.background}';"
```

#### renderAdminEventCardMini()
類似邏輯，適應月曆小卡片

---

## 📝 手動修改指引

由於檔案非常大（13000+ 行），以下是需要手動修改的關鍵位置：

### 位置 1：updateSpecialEventButtonsUI() 函數（約 12920 行）
在選中狀態分支中：
1. 添加 `btn.classList.add('selected')`
2. 修改 iconSpan 使用 scaleIn 動畫
3. 修改 textSpan 使用 `<strong>` 標籤
4. 更新 boxShadow
5. 在函數最後調用 `updateSelectionIndicator()`

### 位置 2：confirmSpecialEventMark() 函數（約 13230 行）
在 `const note = document.getElementById('specialEventNote').value;` 之後添加增量模式邏輯

### 位置 3：添加新函數
在 `removeSpecialEventMark()` 之前添加：
- `updateSelectionIndicator()`
- `removeSelectedMarkers()`

### 位置 4：渲染函數（約 12280 和 12345 行）
修改 `renderAdminEventCardCompact()` 和 `renderAdminEventCardMini()` 使用多標記視覺

---

## 🧪 測試計劃

### 測試 1：增量模式
1. 標記為「改時間」
2. 重新打開，切換到增量模式
3. 選擇「公告」→ 確認
4. 驗證：標題為 `[改時間][公告]`

### 測試 2：選擇指示器
1. 選擇「停課」
2. 再選擇「公告」
3. 驗證：右上角顯示「🔴 停課 + 🟣 公告」

### 測試 3：部分移除
1. 標記為「改時間」+「公告」
2. 重新打開，只選「公告」
3. 點「移除選中標記」
4. 驗證：只保留「改時間」

### 測試 4：多標記視覺
1. 標記為「改時間」+「公告」
2. 在週曆/月曆查看
3. 驗證：漸層背景、多個 emoji、hover 加深

---

## ⚠️ 注意事項

1. **修改前備份**：`cp public/admin-dashboard.html public/admin-dashboard.html.backup-restore`
2. **分步驟測試**：每修改一個函數就測試一次
3. **控制台除錯**：使用 F12 查看日誌和錯誤
4. **清除快取**：Ctrl+Shift+R

---

**當前狀態**：已恢復部分功能（CSS、UI、部分JS函數）  
**剩餘工作**：更新現有函數 + 添加新函數 + 更新渲染函數  
**預估時間**：30-40 分鐘手動修改

