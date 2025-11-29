# 🚀 服务器启动指南

## 📋 当前问题

用户报告：`❌ 未找到匹配課程 coursesAvailable: 0`

**原因**：服务器进程混乱，课程列表为空

---

## ✅ 解决方案

### 步骤 1: 清理所有进程

```bash
# 杀死所有 node 进程
pkill -9 -f "node.*server.js"
pkill -9 -f "nodemon"

# 或者杀死占用 3002 端口的进程
lsof -ti:3002 | xargs kill -9
```

### 步骤 2: 启动服务器

```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 方式 1: 使用 npm（推荐）
npm run dev

# 方式 2: 直接运行
node server.js
```

### 步骤 3: 等待课程加载

服务器启动后，需要等待 10-30 秒让课程从 Synology Calendar 加载。

**日志中应该看到**：
```
✅ 事件快取更新成功，獲取 426 個事件
```

### 步骤 4: 验证

```bash
# 检查健康状态
curl http://localhost:3002/health

# 检查课程数量
curl http://localhost:3002/api/events | grep -o '"events":\[' | wc -l
```

---

## 🔍 问题诊断

### 如果端口被占用

```bash
# 查看占用端口的进程
lsof -i:3002

# 强制杀死
lsof -ti:3002 | xargs kill -9
```

### 如果课程列表为空

**可能原因**：
1. ⏳ 服务器刚启动，课程还在加载中（等待 30 秒）
2. ❌ Synology Calendar 连接失败
3. ❌ 日期范围不对

**检查日志**：
```bash
tail -f /tmp/flb-server.log | grep "事件快取"
```

**应该看到**：
```
✅ 事件快取更新成功，獲取 XXX 個事件
```

### 如果 Synology Calendar 连接失败

**检查 .env.nas 配置**：
```bash
cat .env.nas | grep SYNOLOGY
```

**确认**：
- SYNOLOGY_USERNAME
- SYNOLOGY_PASSWORD
- SYNOLOGY_HOST

---

## 📊 正常启动流程

```
1. npm run dev
   ↓
2. 初始化服务 (5-10秒)
   - Drive 客戶端
   - PathManager
   - UploadHelper
   ↓
3. 启动服务器 (localhost:3002)
   ↓
4. 连接 Synology Calendar (10-20秒)
   ↓
5. 获取课程事件 (10-30秒)
   ✅ 事件快取更新成功，獲取 426 個事件
   ↓
6. 准备就绪 ✅
```

---

## 🎯 快速测试

```bash
# 1. 启动服务器（新终端）
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
npm run dev

# 2. 等待 30 秒

# 3. 检查（另一个终端）
curl http://localhost:3002/api/events | python3 -m json.tool | head -50

# 应该看到课程列表，不是空数组 []
```

---

## ⚠️ 常见错误

### Error: listen EADDRINUSE

**原因**: 端口已被占用

**解决**:
```bash
lsof -ti:3002 | xargs kill -9
# 然后重新启动
```

### events: []

**原因**: 课程还没加载完成

**解决**: 等待 30 秒，然后刷新浏览器

### Connection refused

**原因**: 服务器未启动

**解决**: 检查服务器进程，重新启动

---

## 📝 建议操作顺序

**请按以下步骤操作**：

1. **新建终端窗口**
2. **清理所有进程**:
   ```bash
   pkill -9 -f "node.*server.js"
   pkill -9 -f "nodemon"
   ```
3. **启动服务器**:
   ```bash
   cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
   npm run dev
   ```
4. **等待 30 秒**（观察日志）
5. **刷新浏览器**
6. **选择课程**
7. **测试上传**

---

**当前状态**：服务器进程混乱，需要重新启动

**请在新终端中执行上述步骤！** 🚀

