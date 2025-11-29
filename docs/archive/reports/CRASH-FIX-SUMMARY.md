# 🔧 后端崩溃问题诊断与修复总结

**日期**: 2025-11-03  
**问题**: 上传功能部分成功但频繁出现 502 错误  
**根本原因**: Node.js 应用内存溢出导致崩溃

---

## 📊 问题诊断

### 症状

1. **用户反馈**: 
   - 照片上传成功但报错
   - 频繁出现 502 Bad Gateway

2. **Nginx 错误日志**:
   ```
   recv() failed (104: Connection reset by peer)
   upstream prematurely closed connection
   connect() failed (111: Connection refused)
   ```

3. **Docker 诊断结果**:
   ```bash
   RestartCount: 16  # 容器已重启 16 次！
   Memory: 0         # 未设置内存限制
   ```

### 根本原因

**Node.js 应用在处理大文件上传或高并发请求时内存溢出崩溃！**

#### 证据链

```
时间线：
12:12:29 → Nginx: "Connection reset by peer" → 后端崩溃
12:14:50 → Nginx: "Connection prematurely closed" → 后端崩溃
12:14:51 → Nginx: "Connection refused" → 后端重启中
12:19:54 → 测试成功 → 后端重启完成

Docker 日志：
- RestartCount: 16 → 证实频繁崩溃
- Memory: 0 → 没有内存限制，可能无限增长
```

---

## 🛠️ 解决方案

### 修改 1: 增加 Node.js 堆内存限制

**文件**: `docker-compose.yml`

**修改前**:
```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
```

**修改后**:
```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  # 🔥 增加 Node.js 内存限制，防止崩溃
  - NODE_OPTIONS=--max-old-space-size=2048
```

**说明**: 设置 Node.js 堆大小为 2GB，足够处理大文件上传和并发请求。

---

### 修改 2: 增加 Docker 容器内存限制

**文件**: `docker-compose.yml`

**修改前**:
```yaml
container_name: flb-calendar-nas
restart: unless-stopped
ports:
  - "3001:3000"
```

**修改后**:
```yaml
container_name: flb-calendar-nas
restart: unless-stopped
# 🔥 设置容器资源限制
mem_limit: 3g
mem_reservation: 512m
ports:
  - "3001:3000"
```

**说明**: 
- `mem_limit: 3g` - 硬限制，容器最多使用 3GB 内存
- `mem_reservation: 512m` - 软限制，保证容器至少有 512MB 可用

---

## 🚀 部署步骤

### 方法 A: 使用自动化脚本（推荐）

```bash
cd ~/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
sudo ./fix-crash-and-deploy.sh
```

脚本会自动：
1. 停止现有容器
2. 重新构建镜像
3. 启动新容器
4. 验证部署

---

### 方法 B: 手动部署

```bash
# 1. 停止容器
docker-compose down

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 启动容器
docker-compose up -d

# 4. 验证
docker ps | grep flb-calendar
docker logs -f flb-calendar-nas
```

---

## ✅ 验证修复

### 1. 检查容器配置

```bash
# 检查内存限制
docker inspect flb-calendar-nas | grep -A 2 "Memory"

# 期望输出：
# "Memory": 3221225472  (3GB)
# "MemoryReservation": 536870912  (512MB)
```

### 2. 检查 Node.js 配置

```bash
# 检查环境变量
docker exec flb-calendar-nas env | grep NODE_OPTIONS

# 期望输出：
# NODE_OPTIONS=--max-old-space-size=2048
```

### 3. 监控资源使用

```bash
# 实时监控
docker stats flb-calendar-nas

# 期望看到：
# MEM USAGE / LIMIT: xxx MB / 3 GiB
```

### 4. 测试上传功能

1. 清除浏览器缓存（Ctrl + Shift + Delete）
2. 访问: https://calendar.funlearnbar.synology.me/learning-record-upload.html
3. 上传大文件（> 10MB）
4. 观察控制台，应该看到：

```javascript
✅ 正常日志：
📦 使用分片上傳: video.mp4 (25.5 MB)
⬆️ 上傳分片 1/5 (20%)
...
✅ 分片上傳成功

❌ 如果还是 502，检查容器日志：
docker logs -f flb-calendar-nas
```

---

## 📈 修复前后对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| Node.js 堆大小 | 默认（~1.5GB） | **2GB** |
| Docker 内存限制 | 无限制 | **3GB 硬限制** |
| Docker 内存预留 | 无 | **512MB** |
| 容器重启次数 | 16 次 | **0 次**（期望） |
| 502 错误 | 频繁 | **消失**（期望） |

---

## 🔍 持续监控

### 监控脚本

创建 `monitor-memory.sh`:

```bash
#!/bin/bash
echo "监控 FLB Calendar 容器内存使用..."
while true; do
    docker stats flb-calendar-nas --no-stream --format \
      "{{.Container}}: CPU {{.CPUPerc}} | MEM {{.MemUsage}}"
    sleep 5
done
```

### 告警阈值

如果看到以下情况，需要进一步优化：

- **内存使用 > 2GB**: Node.js 接近堆限制
- **内存使用 > 2.5GB**: 容器接近硬限制
- **容器重启次数增加**: 仍有崩溃问题

---

## 🆘 如果问题仍然存在

### 检查清单

1. **确认配置已应用**:
   ```bash
   docker inspect flb-calendar-nas | grep -A 2 "Memory\|NODE_OPTIONS"
   ```

2. **检查容器日志中的错误**:
   ```bash
   docker logs flb-calendar-nas | grep -i "error\|crash\|fatal"
   ```

3. **测试本地 API**:
   ```bash
   curl -X POST http://localhost:3001/api/learning-records/upload/init \
     -H "Content-Type: application/json" \
     -d '{"filename":"test.mp4","fileSize":104857600,"fileType":"video/mp4","chunkSize":5242880}'
   ```

4. **如果仍崩溃，增加内存限制**:
   ```yaml
   # docker-compose.yml
   mem_limit: 4g  # 增加到 4GB
   NODE_OPTIONS=--max-old-space-size=3072  # 增加到 3GB
   ```

---

## 📚 相关文档

- `docker-compose.yml` - 容器配置
- `fix-crash-and-deploy.sh` - 自动化部署脚本
- `check-docker-crash.sh` - 诊断脚本
- `NGINX-502-FIX.md` - Nginx 配置修复（已完成）
- `DEPLOYMENT-SUCCESS-SUMMARY.md` - 整体部署总结

---

## 🎯 预期结果

修复后：
- ✅ 容器稳定运行，不再重启
- ✅ 大文件上传成功，无 502 错误
- ✅ 内存使用稳定在 2GB 以下
- ✅ 所有 API 端点正常响应

---

**修复完成后，请测试并反馈结果！** 🚀


