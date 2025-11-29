# 📊 原版日曆課程卡片上傳統計顯示實施計畫

> **建立日期**: 2025-11-28  
> **目的**: 在 `perfect-calendar-modular.html` 的課程卡片中顯示學習歷程上傳統計  
> **狀態**: 📝 規劃中

---

## 🎯 需求說明

### 使用者需求
在原版日曆頁面 (`perfect-calendar-modular.html`) 的課程卡片中：
- 當課程已結束並顯示「上傳學習歷程」藍色按鈕時
- 同時在按鈕下方顯示該課程的上傳統計資訊

### 顯示內容
1. **已上傳學生數 / 總學生數**（例如：已上傳 3 / 總學生 5）
2. **總上傳檔案數**（例如：共 12 個檔案）
3. **課程總覽上傳狀態**（已上傳 ✓ / 尚未上傳）

---

## 📋 實施步驟

### **階段一：建立後端 API（新增）** ⭐

#### 1.1 新增課程統計查詢 API

**檔案**: `/routes/v2-courses.js`

**新增 API 端點**: `GET /api/v2/courses/upload-stats`

**功能**:
- 接受參數：`eventId`, `date`, `courseName`, `instructor`
- 返回該課程的上傳統計摘要

**實作細節**:
```javascript
/**
 * GET /api/v2/courses/upload-stats
 * 查詢單一課程的上傳統計（供原版日曆使用）
 * 
 * Query Parameters:
 * - eventId: 課程事件 ID
 * - date: 課程日期 (YYYY-MM-DD)
 * - courseName: 課程名稱
 * - instructor: 講師名稱（可選）
 */
router.get('/courses/upload-stats', async (req, res) => {
  try {
    const { eventId, date, courseName } = req.query;
    
    if (!date || !courseName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數 (date, courseName)'
      });
    }
    
    // 1. 取得學期
    const semester = semesterHelper.getCurrentSemester(date);
    
    // 2. 清理課程名稱（移除週次）
    const cleanedCourseName = courseNameCleaner.cleanCourseName(courseName);
    
    // 3. 從索引查詢統計資料
    const courseSummary = await learningRecordsIndex.getCourseSummary({
      semester,
      courseName: cleanedCourseName,
      date,
      topic: '' // 模糊匹配
    });
    
    // 4. 計算學生總數（從 Google Sheets）
    let totalStudents = 0;
    const googleSheetsStudents = req.app.get('googleSheetsStudents');
    
    if (googleSheetsStudents) {
      const studentResult = await googleSheetsStudents.getAllStudents();
      if (studentResult && studentResult.success) {
        // 使用相同的學生篩選邏輯
        const matchingStudents = studentResult.students.filter(/* 篩選邏輯 */);
        totalStudents = matchingStudents.length;
      }
    }
    
    // 5. 統計上傳資料
    let uploadedStudentCount = 0;
    let totalUploadedFiles = 0;
    let overviewUploaded = false;
    
    if (courseSummary) {
      // 學生統計
      const students = courseSummary.students || {};
      Object.values(students).forEach((student) => {
        const fileCount = (student.photoCount || 0) + (student.videoCount || 0);
        if (fileCount > 0 || student.hasComment) {
          uploadedStudentCount++;
          totalUploadedFiles += fileCount;
        }
      });
      
      // 課程總覽統計
      const overview = courseSummary.overview;
      if (overview) {
        overviewUploaded = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
      }
    }
    
    // 6. 返回統計結果
    res.json({
      success: true,
      data: {
        eventId,
        date,
        courseName: cleanedCourseName,
        studentCount: totalStudents,
        uploadedStudentCount,
        totalUploadedFiles,
        overviewUploaded,
        lastUpdatedAt: courseSummary?.updatedAt || null
      }
    });
    
  } catch (error) {
    console.error('❌ [V2 Courses] 查詢課程上傳統計失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### **階段二：前端整合（修改 main.js）** ⭐

#### 2.1 新增統計資料查詢函數

**檔案**: `/public/js/main.js`

**位置**: 在 `goToLearningRecordUpload()` 函數附近

```javascript
/**
 * 查詢課程上傳統計
 * @param {string} eventId - 課程事件 ID
 * @param {string} date - 課程日期 (YYYY-MM-DD)
 * @param {string} courseName - 課程名稱
 * @returns {Promise<Object>} 統計資料
 */
async function fetchCourseUploadStats(eventId, date, courseName) {
  try {
    const params = new URLSearchParams({
      eventId,
      date,
      courseName
    });
    
    const response = await fetch(`/api/v2/courses/upload-stats?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '查詢失敗');
    }
    
    return result.data;
    
  } catch (error) {
    console.warn('⚠️ 查詢課程上傳統計失敗:', error);
    return null;
  }
}

// 暴露為全域函數
window.fetchCourseUploadStats = fetchCourseUploadStats;
```

#### 2.2 修改倒數計時更新邏輯

**檔案**: `/public/js/main.js`

**函數**: `updateAllCountdowns()`

**修改位置**: 第 5805-5851 行（顯示藍色按鈕的地方）

```javascript
// 🔥 如果課程已結束，顯示獨立的「上傳學習歷程」按鈕 + 上傳統計
if (countdown.status === 'overdue') {
    // 獲取課程卡片的 eventId
    const card = element.closest('.event-card');
    if (!card) continue;
    
    const eventId = card.dataset.eventId;
    const dateStr = card.dataset.eventStart ? card.dataset.eventStart.split('T')[0] : '';
    const timeStr = element.dataset.time || '';
    const instructor = element.dataset.instructor || '';
    
    // 🆕 取得或建立統計容器
    let statsContainer = card.querySelector('.upload-stats-container');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.className = 'upload-stats-container';
        statsContainer.style.cssText = `
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 6px;
            font-size: 12px;
            color: #1f2937;
        `;
    }
    
    // 🆕 建立或更新上傳按鈕
    let uploadBtn = element.parentNode.querySelector('.upload-learning-container');
    if (!uploadBtn) {
        uploadBtn = document.createElement('div');
        uploadBtn.className = 'upload-learning-container';
        element.parentNode.insertBefore(uploadBtn, element.nextSibling);
    }
    
    uploadBtn.innerHTML = `
        <button class="upload-learning-btn" onclick="event.stopPropagation(); goToLearningRecordUpload('${eventId}', '${dateStr}', '${timeStr}', '${instructor}')">
            <i class="fas fa-book-open"></i> 上傳學習歷程
        </button>
    `;
    
    // 🆕 顯示載入中狀態
    statsContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; color: #6b7280;">
            <i class="fas fa-spinner fa-spin"></i>
            <span>載入上傳統計...</span>
        </div>
    `;
    uploadBtn.appendChild(statsContainer);
    
    // 🆕 非同步查詢統計資料
    const courseName = card.querySelector('.title')?.textContent?.trim() || '';
    
    fetchCourseUploadStats(eventId, dateStr, courseName).then(stats => {
        if (!stats) {
            // 查詢失敗，隱藏統計容器
            statsContainer.style.display = 'none';
            return;
        }
        
        // 🎨 渲染統計資料
        const statsHtml = [];
        
        // 學生上傳統計
        if (typeof stats.uploadedStudentCount === 'number' && stats.studentCount > 0) {
            const percentage = Math.round((stats.uploadedStudentCount / stats.studentCount) * 100);
            const progressColor = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#6b7280';
            
            statsHtml.push(`
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="color: #6b7280;">👥</span>
                    <span style="flex: 1;">
                        已上傳 <strong style="color: ${progressColor};">${stats.uploadedStudentCount}</strong> / 
                        總學生 <strong>${stats.studentCount}</strong>
                    </span>
                    <span style="font-size: 11px; color: ${progressColor}; font-weight: 600;">
                        ${percentage}%
                    </span>
                </div>
            `);
        }
        
        // 檔案統計
        if (stats.totalUploadedFiles > 0) {
            statsHtml.push(`
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="color: #6b7280;">📁</span>
                    <span>共 <strong>${stats.totalUploadedFiles}</strong> 個檔案</span>
                </div>
            `);
        }
        
        // 課程總覽狀態
        if (typeof stats.overviewUploaded === 'boolean') {
            const icon = stats.overviewUploaded ? '✅' : '⏳';
            const text = stats.overviewUploaded ? '課程總覽已上傳' : '課程總覽尚未上傳';
            const color = stats.overviewUploaded ? '#10b981' : '#9ca3af';
            
            statsHtml.push(`
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>${icon}</span>
                    <span style="color: ${color};">${text}</span>
                </div>
            `);
        }
        
        // 如果沒有任何統計資料，顯示提示
        if (statsHtml.length === 0) {
            statsContainer.innerHTML = `
                <div style="color: #9ca3af; text-align: center;">
                    尚無上傳記錄
                </div>
            `;
        } else {
            statsContainer.innerHTML = statsHtml.join('');
        }
        
    }).catch(error => {
        console.warn('⚠️ 渲染上傳統計失敗:', error);
        statsContainer.style.display = 'none';
    });
    
} else {
    // 課程尚未結束，移除上傳按鈕和統計（如果存在）
    const uploadBtn = element.parentNode.querySelector('.upload-learning-container');
    if (uploadBtn) {
        uploadBtn.remove();
    }
}
```

---

### **階段三：CSS 樣式調整** 🎨

**檔案**: `/public/css/styles.css` 或內嵌於 HTML

```css
/* 上傳學習歷程按鈕容器 */
.upload-learning-container {
    margin-top: 8px;
    width: 100%;
}

/* 上傳學習歷程按鈕 */
.upload-learning-btn {
    width: 100%;
    padding: 10px 16px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.upload-learning-btn:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
    transform: translateY(-1px);
}

.upload-learning-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

/* 上傳統計容器 */
.upload-stats-container {
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
}

/* 統計項目樣式 */
.upload-stats-container strong {
    font-weight: 600;
}

/* 載入中旋轉動畫 */
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.fa-spinner.fa-spin {
    animation: spin 1s linear infinite;
}

/* 手機版優化 */
@media (max-width: 768px) {
    .upload-stats-container {
        font-size: 11px;
        padding: 8px 10px;
    }
    
    .upload-learning-btn {
        padding: 8px 14px;
        font-size: 13px;
    }
}
```

---

### **階段四：效能優化** ⚡

#### 4.1 快取策略

**問題**: 每次更新倒數計時都會查詢統計（頻繁 API 呼叫）

**解決方案**: 前端快取統計資料，設定 TTL（Time To Live）

```javascript
// 建立課程統計快取
const courseStatsCache = new Map();
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

async function fetchCourseUploadStatsWithCache(eventId, date, courseName) {
    const cacheKey = `${eventId}-${date}`;
    
    // 檢查快取
    const cached = courseStatsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < STATS_CACHE_TTL) {
        console.log('📦 使用快取的統計資料:', cacheKey);
        return cached.data;
    }
    
    // 查詢新資料
    const stats = await fetchCourseUploadStats(eventId, date, courseName);
    
    // 儲存快取
    if (stats) {
        courseStatsCache.set(cacheKey, {
            data: stats,
            timestamp: Date.now()
        });
    }
    
    return stats;
}
```

#### 4.2 避免重複渲染

**問題**: 每次倒數計時更新都重新渲染統計

**解決方案**: 只在統計容器不存在時才查詢和渲染

```javascript
// 檢查是否已經渲染過統計
const existingStats = card.querySelector('.upload-stats-container');
if (existingStats && existingStats.dataset.rendered === 'true') {
    // 已經渲染過，跳過
    continue;
}

// 標記為已渲染
statsContainer.dataset.rendered = 'true';
```

---

## 🧪 測試計畫

### 測試案例

#### 1. 基本功能測試
- [ ] 課程已結束時，顯示藍色按鈕
- [ ] 藍色按鈕下方顯示統計資訊
- [ ] 統計資料正確（學生數、檔案數、總覽狀態）

#### 2. 邊界情況測試
- [ ] 沒有任何上傳記錄時，顯示「尚無上傳記錄」
- [ ] API 查詢失敗時，隱藏統計容器
- [ ] 課程尚未結束時，不顯示統計

#### 3. 效能測試
- [ ] 快取機制正常運作（5分鐘內不重複查詢）
- [ ] 多個課程卡片同時更新時，不阻塞 UI
- [ ] 手機版載入速度正常

#### 4. 視覺測試
- [ ] 電腦版樣式正確
- [ ] 手機版樣式正確
- [ ] 不同上傳進度的顏色正確（綠色、橙色、灰色）

---

## 📁 修改檔案清單

### 新增檔案
- [ ] `/docs/CALENDAR-UPLOAD-STATS-IMPLEMENTATION-PLAN.md`（本檔案）

### 修改檔案
1. [ ] `/routes/v2-courses.js`
   - 新增 `GET /api/v2/courses/upload-stats` API

2. [ ] `/public/js/main.js`
   - 新增 `fetchCourseUploadStats()` 函數
   - 新增 `fetchCourseUploadStatsWithCache()` 函數
   - 修改 `updateAllCountdowns()` 函數（第 5805-5851 行）

3. [ ] `/public/css/styles.css`
   - 新增上傳統計相關樣式

4. [ ] `/public/perfect-calendar-modular.html`
   - 確認引入所有必要的 CSS

---

## ⚠️ 注意事項

### 1. 課程名稱一致性
- 必須使用 `course-name-cleaner.js` 清理課程名稱（移除週次）
- 確保 API 查詢時的課程名稱與索引中一致

### 2. 學期格式統一
- 統一使用 `semester-helper.js` 計算學期
- 確保索引更新和查詢使用相同的學期格式

### 3. 效能考量
- 使用快取避免頻繁 API 呼叫
- 避免在每次倒數計時更新時重複渲染
- 考慮使用節流（throttle）限制查詢頻率

### 4. 錯誤處理
- API 查詢失敗時，優雅降級（隱藏統計容器）
- 不影響原有的倒數計時和藍色按鈕功能

---

## 🚀 部署計畫

### 開發環境測試
```bash
# 1. 啟動開發伺服器
npm run dev

# 2. 開啟瀏覽器
http://localhost:3002/perfect-calendar-modular.html

# 3. 檢查已結束的課程是否顯示統計
```

### 生產環境部署
```bash
# 1. 備份現有檔案
cp public/js/main.js public/js/main.js.backup-$(date +%Y%m%d-%H%M%S)
cp routes/v2-courses.js routes/v2-courses.js.backup-$(date +%Y%m%d-%H%M%S)

# 2. 部署新版本
git add .
git commit -m "feat: 新增原版日曆課程卡片上傳統計顯示功能"
git push

# 3. 重啟伺服器
pm2 restart flb-calendar-nas
```

---

## 📊 預期成果

### 使用者體驗提升
- ✅ 講師可以直接在日曆頁面看到上傳進度
- ✅ 不需要進入 V2 上傳中心就能快速了解狀況
- ✅ 一目瞭然哪些課程還需要補充學習歷程

### 技術價值
- ✅ 複用現有的索引系統，無需額外資料庫
- ✅ 前端快取機制，效能優異
- ✅ 統一的課程名稱處理邏輯

---

## 📝 後續優化建議

1. **批次查詢優化**
   - 一次 API 呼叫查詢多個課程的統計
   - 減少 HTTP 請求次數

2. **WebSocket 即時更新**
   - 當有新的學習歷程上傳時，即時推送更新
   - 不需要等待快取過期

3. **統計資料視覺化**
   - 使用進度條顯示上傳百分比
   - 使用圖表顯示歷史趨勢

---

## 🔗 相關文檔

- [V2 上傳統計完整架構](./V2-UPLOAD-STATS-ARCHITECTURE.md)
- [學習記錄索引系統說明](../utils/learning-records-index.js)
- [課程名稱清理邏輯](../utils/course-name-cleaner.js)
- [V2 課程 API 文檔](../routes/v2-courses.js)
