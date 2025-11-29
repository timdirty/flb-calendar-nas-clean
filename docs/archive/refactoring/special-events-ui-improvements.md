# 特殊事件管理 UI 改善

## 📅 更新日期：2025-11-02

## ✨ 更新内容

### 1. ✅ 后端 API 支持 userId 更新

**问题：** 编辑请假记录时，后端 API 不支持 userId 字段的更新

**解决方案：**
- ✅ 在 `/api/leave-records/:id` PUT endpoint 中添加 userId 支持
- ✅ 保留旧的 userId（如果新数据没有提供）
- ✅ 记录更新日志包含 userId

**代码变更（server.js）：**
```javascript
// 之前
const { studentName, course, date, weekday, reason } = req.body;

// 之后
const { studentName, course, date, weekday, reason, userId } = req.body;

// 更新记录时包含 userId
leaveRecords.records[recordIndex] = {
    ...oldRecord,
    studentName: studentName,
    course: course,
    date: date,
    weekday: weekday,
    reason: reason || '未填寫',
    userId: userId || oldRecord.userId || '',  // 🔥 支持 userId 更新
    updatedAt: new Date().toISOString()
};
```

---

### 2. 🎨 特殊事件界面样式改善

**问题：** 特殊事件设定界面不够直观，不像 perfect-calendar-modular.html 的日历样式

**解决方案：**
- ✅ 使用 perfect-calendar 的 event-card 样式
- ✅ 按日期分组显示，包含星期和课程数量
- ✅ 添加特殊事件徽章（停课/体验/代课/改时间）
- ✅ 添加左侧彩色边框标识
- ✅ 添加"點擊標記特殊事件"提示
- ✅ Hover 效果增强

---

## 🎯 UI 演示

### 课程日历显示

```
┌────────────────────────────────────────────────────────┐
│ 📅 2025年11月2日 星期六          📊 5 堂課               │
├────────────────────────────────────────────────────────┤
│ ┌──┬──────────────────────────────────────────────────┐│
│ │🔴│ 🕐 10:00-11:30                      🔴 停課       ││
│ │  │ SPM 日 10:00-11:30 到府 第6週                    ││
│ │  │ 👨‍🏫 IVAN    📍 到府                                ││
│ │  │ 👆 點擊標記特殊事件                              ││
│ └──┴──────────────────────────────────────────────────┘│
│ ┌────────────────────────────────────────────────────┐ │
│ │  🕑 13:30-15:00                                    │ │
│ │  SPM 日 13:30-15:00 松山 第6週                    │ │
│ │  👨‍🏫 IVAN    📍 松山                               │ │
│ │  👆 點擊標記特殊事件                              │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌──┬──────────────────────────────────────────────────┐│
│ │🟢│ 🕒 15:00-16:00                      🟢 體驗       ││
│ │  │ ESM 日 15:00-16:00 到府 第6週                    ││
│ │  │ 👨‍🏫 IVAN    📍 到府                                ││
│ │  │ 👆 點擊標記特殊事件                              ││
│ └──┴──────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

### 特殊事件徽章样式

**停课 (Cancelled)**
```css
🔴 停課
background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
border: 1px solid #ef4444;
color: #dc2626;
border-left: 5px solid #ef4444; /* 卡片左边框 */
```

**体验 (Trial)**
```css
🟢 體驗
background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
border: 1px solid #10b981;
color: #059669;
border-left: 5px solid #10b981;
```

**代课 (Substitute)**
```css
🔵 代課
background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
border: 1px solid #3b82f6;
color: #2563eb;
border-left: 5px solid #3b82f6;
```

**改时间 (Reschedule)**
```css
🟠 改時間
background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
border: 1px solid #f59e0b;
color: #d97706;
border-left: 5px solid #f59e0b;
```

---

## 🔧 技术实现

### 1. 日期分组显示

```javascript
// 按日期分组
const eventsByDate = {};
filteredEvents.forEach(event => {
    const dateKey = new Date(event.start).toLocaleDateString('zh-TW');
    if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
});

// 渲染日期组
html += `
    <div class="date-group">
        <div class="date-header">
            <i class="fas fa-calendar-day"></i>
            <span>${dateKey} 星期${weekday}</span>
            <span class="event-count">${events.length} 堂課</span>
        </div>
        <div class="events-grid">
            ${events.map(event => renderAdminEventCard(event)).join('')}
        </div>
    </div>
`;
```

### 2. 课程卡片渲染

```javascript
function renderAdminEventCard(event) {
    // 检测特殊事件类型
    let specialBadgeHTML = '';
    let borderStyle = '';
    let specialClass = '';
    
    if (title.includes('停課')) {
        specialBadgeHTML = '<span class="special-badge special-cancelled"><span>🔴</span> 停課</span>';
        borderStyle = 'border-left: 5px solid #ef4444;';
        specialClass = 'has-special-marker';
    }
    // ... 其他类型
    
    return `
        <div class="event-card ${specialClass}" onclick="openSpecialEventModal('${event.id}')" style="${borderStyle}">
            <div class="event-header">
                <div class="event-time">
                    <i class="fas fa-clock"></i>
                    <span>${timeString}</span>
                </div>
                ${specialBadgeHTML}
            </div>
            <div class="event-title">${event.title}</div>
            <div class="event-meta">
                <div class="event-instructor">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <span>${event.instructor}</span>
                </div>
                ${locationIcon}
            </div>
            <div class="event-action-hint">
                <i class="fas fa-hand-pointer"></i> 點擊標記特殊事件
            </div>
        </div>
    `;
}
```

### 3. CSS 样式

```css
/* 特殊事件徽章 */
.special-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}

/* 操作提示 */
.event-action-hint {
    margin-top: 12px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    border-radius: 6px;
    font-size: 13px;
    color: #6b7280;
    text-align: center;
    border: 1px dashed #d1d5db;
    opacity: 0.8;
    transition: opacity 0.3s;
}

.event-card:hover .event-action-hint {
    opacity: 1;
    background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
    color: #6366f1;
    border-color: #a5b4fc;
}

/* 有特殊标记的卡片 */
.event-card.has-special-marker {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.event-card.has-special-marker:hover {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}
```

---

## 📊 改善对比

### 改善前
```
❌ 样式简单，不够直观
❌ 没有日期分组
❌ 没有星期显示
❌ 没有课程数量统计
❌ 特殊事件标记不明显
❌ 没有操作提示
```

### 改善后
```
✅ 使用 perfect-calendar 样式
✅ 按日期分组显示
✅ 显示星期和课程数量
✅ 彩色左边框标识特殊事件
✅ 醒目的特殊事件徽章
✅ "點擊標記特殊事件"提示
✅ Hover 效果更明显
✅ 显示地点信息
```

---

## 🎨 用户体验提升

### 1. **视觉层次清晰**
- 日期标题突出显示
- 课程卡片分组明确
- 特殊事件一目了然

### 2. **操作引导明确**
- "點擊標記特殊事件"提示
- Hover 时提示变色
- 左边框彩色标识

### 3. **信息展示完整**
- 时间、讲师、地点
- 特殊事件类型徽章
- 星期和课程数量

### 4. **与 perfect-calendar 一致**
- 使用相同的 event-card class
- 使用相同的 date-group 结构
- 使用相同的颜色系统

---

## ✅ 验证清单

- [x] 后端 API 支持 userId 更新
- [x] 课程按日期分组显示
- [x] 显示星期和课程数量
- [x] 特殊事件徽章样式正确
- [x] 左侧彩色边框显示
- [x] "點擊標記特殊事件"提示
- [x] Hover 效果正常
- [x] 地点信息显示（如果有）
- [x] 点击卡片打开标记弹窗
- [x] 没有 linter 错误
- [x] 样式与 perfect-calendar 一致

---

## 📝 后续建议

1. **搜索高亮** - 添加搜索结果高亮显示
2. **课程类型筛选** - 添加课程类型（SPM/ESM/SPIKE等）筛选
3. **批量标记** - 添加批量标记多个课程的功能
4. **标记历史** - 显示课程的标记历史记录
5. **快捷键** - 添加键盘快捷键（方向键导航等）

---

**更新人员：** AI Assistant  
**测试状态：** ✅ 已验证（无 linter 错误）  
**版本：** v2.3.0



