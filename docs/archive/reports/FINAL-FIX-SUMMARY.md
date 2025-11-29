# 🎯 最终修复总结 - p-queue 兼容性问题

## 📊 问题诊断

### 症状
- ✅ 分片上传初始化成功（`/api/learning-records/upload/init` 返回 200）
- ❌ 分片上传失败（`/api/learning-records/upload/chunk` 返回 502）
- ❌ 传统上传失败（`/api/learning-records/upload` 返回 500）
- ⚠️  Docker 容器频繁重启（RestartCount: 16+）
- ⚠️  文件实际上传成功，但返回错误

### 根本原因
**p-queue v8.0.0 是纯 ES Module，无法使用 CommonJS `require()` 导入**

```javascript
// ❌ 错误的导入方式（v8.0.0）
const PQueue = require('p-queue').default;  // TypeError: Cannot read property 'default' of undefined

// ❌ 或者
const PQueue = require('p-queue');  // Error: require() of ES Module not supported
```

### 错误链
1. 前端上传文件 → 后端 `/api/learning-records/upload` 接收请求
2. 后端调用 `media-processor.js` 处理图片
3. `media-processor.js` 尝试 `require('p-queue')` → **崩溃**
4. Node.js 进程崩溃 → Docker 自动重启
5. Nginx 在进程重启期间返回 502 Bad Gateway

## 🔧 解决方案

### 1. 降级 p-queue
**从 v8.0.0（纯 ES Module）→ v6.6.2（支持 CommonJS）**

```json
// package.json
{
  "dependencies": {
    "p-queue": "^6.6.2"  // ✅ 支持 CommonJS require()
  }
}
```

### 2. 更新导入方式
```javascript
// utils/media-processor.js
// ✅ p-queue v6.6.2 的正确导入方式
const PQueue = require('p-queue');  // 直接导入，不需要 .default
```

### 3. 保持内存优化
```yaml
# docker-compose.yml
services:
  flb-calendar:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048  # 2GB 堆内存
    mem_limit: 3g
    mem_reservation: 512m
```

## 🚀 部署步骤

### 方法 1：使用自动化脚本（推荐）

```bash
# SSH 连接到 NAS
ssh ctctim14@nas-address

# 进入项目目录
cd ~/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 确保脚本可执行
chmod +x fix-pqueue-and-redeploy.sh

# 执行修复脚本
sudo ./fix-pqueue-and-redeploy.sh
```

### 方法 2：手动步骤

```bash
# 1. 停止容器
sudo docker-compose down

# 2. 重新构建镜像（包含 p-queue v6.6.2）
sudo docker-compose build --no-cache

# 3. 启动容器
sudo docker-compose up -d

# 4. 验证
sudo docker exec flb-calendar-nas node -e "const PQueue = require('p-queue'); console.log('✅ p-queue version:', require('p-queue/package.json').version);"
```

## ✅ 验证测试

### 1. 检查 p-queue 版本
```bash
sudo docker exec flb-calendar-nas node -e "console.log(require('p-queue/package.json').version)"
# 预期输出: 6.6.2
```

### 2. 测试模块导入
```bash
sudo docker exec flb-calendar-nas node -e "const PQueue = require('p-queue'); console.log('✅ p-queue 正常');"
# 预期输出: ✅ p-queue 正常
```

### 3. 检查容器稳定性
```bash
# 检查容器重启次数（应该为 0）
sudo docker ps | grep flb-calendar
# STATUS 应该显示 "Up XX minutes" 而不是频繁重启
```

### 4. 监控容器日志
```bash
sudo docker logs -f flb-calendar-nas
# 应该没有 "require() of ES Module" 错误
```

### 5. 测试上传功能
1. 打开浏览器：https://calendar.funlearnbar.synology.me/learning-record-upload.html
2. 清除浏览器缓存（Ctrl+Shift+Delete）
3. 上传小文件（< 10MB）→ 应该使用传统上传，返回 200
4. 上传大文件（> 10MB）→ 应该使用分片上传，返回 200

## 📈 预期结果

### 修复前
- 🔴 传统上传：500 Internal Server Error
- 🔴 分片上传：502 Bad Gateway（初始化成功，上传失败）
- 🔴 容器状态：频繁重启（RestartCount: 16+）

### 修复后
- 🟢 传统上传：200 OK（小文件）
- 🟢 分片上传：200 OK（大文件，完整流程）
- 🟢 容器状态：稳定运行（RestartCount: 0）

## 🔍 故障排查

### 如果仍然失败

1. **检查 package.json 是否正确**
   ```bash
   sudo docker exec flb-calendar-nas cat /app/package.json | grep p-queue
   # 应该显示: "p-queue": "^6.6.2",
   ```

2. **检查 node_modules 是否更新**
   ```bash
   sudo docker exec flb-calendar-nas ls -la /app/node_modules/p-queue/package.json
   sudo docker exec flb-calendar-nas cat /app/node_modules/p-queue/package.json | grep version
   # 应该显示: "version": "6.6.2"
   ```

3. **检查 media-processor.js 导入**
   ```bash
   sudo docker exec flb-calendar-nas grep "require('p-queue')" /app/utils/media-processor.js
   # 应该显示: const PQueue = require('p-queue');
   ```

4. **完全清理并重建**
   ```bash
   sudo docker-compose down -v
   sudo docker system prune -af
   sudo docker-compose build --no-cache
   sudo docker-compose up -d
   ```

## 📝 技术细节

### p-queue 版本差异

| 版本 | 模块类型 | 导入方式 | CommonJS 支持 |
|------|---------|---------|--------------|
| v8.0.0+ | 纯 ES Module | `import PQueue from 'p-queue'` | ❌ 不支持 |
| v6.6.2 | CommonJS/ESM 双模式 | `const PQueue = require('p-queue')` | ✅ 支持 |

### ES Module 错误示例
```
Error: require() of ES Module /app/node_modules/p-queue/dist/index.js from /app/utils/media-processor.js not supported.
Instead change the require of index.js in /app/utils/media-processor.js to a dynamic import() which is available in all CommonJS modules.
```

## 🎉 成功标志

- ✅ Docker 容器稳定运行（无重启）
- ✅ 传统上传返回 200 OK
- ✅ 分片上传完整流程成功
- ✅ 无 "require() of ES Module" 错误日志
- ✅ 图片缩略图正常生成

---

**修复日期**: 2025-11-03  
**影响范围**: 后端上传处理、媒体处理队列  
**优先级**: 🔥 高优先级（阻塞生产功能）  
**状态**: ✅ 已修复，等待部署
