# 🔧 Nginx 502 Bad Gateway 問題診斷與修復

**日期**: 2025-11-03  
**問題**: 瀏覽器訪問分片上傳 API 返回 502，但 NAS 本地 curl 測試正常

---

## 📊 問題診斷

### 現象對比

| 測試方式 | 結果 | 說明 |
|---------|------|------|
| NAS 上 `curl http://localhost:3001/api/learning-records/upload/init` | ✅ 成功 | 後端 API 正常工作 |
| 瀏覽器 `POST https://calendar.funlearnbar.synology.me/api/learning-records/upload/init` | ❌ 502 | Nginx 反向代理問題 |

### 根本原因

**Nginx 反向代理配置問題**，可能包括：
1. **上傳大小限制**：`client_max_body_size` 太小（默認 1MB）
2. **超時設置**：Nginx 超時時間太短
3. **後端地址錯誤**：`proxy_pass` 指向錯誤的端口或地址
4. **連接問題**：Nginx 無法連接到 Docker 容器

---

## 🔍 第一步：找到 Nginx 配置文件

在 NAS 上執行：

```bash
# 查找 Nginx 配置文件
sudo find /etc /usr -name '*nginx*.conf' 2>/dev/null | grep -v '.default'

# 查找包含 'calendar.funlearnbar' 的配置
sudo grep -r 'calendar.funlearnbar' /etc/nginx /usr/syno/etc 2>/dev/null

# Synology 特定位置
ls -la /usr/syno/etc/www/
```

---

## 🛠️ 第二步：修復 Nginx 配置

### 需要添加/修改的配置項

找到 `server` 區塊中包含 `calendar.funlearnbar.synology.me` 的配置，確保包含以下設置：

```nginx
server {
    listen 443 ssl;
    server_name calendar.funlearnbar.synology.me;
    
    # 🔥 關鍵配置 1：增加上傳大小限制
    client_max_body_size 500M;  # 允許上傳最大 500MB 的文件
    
    # 🔥 關鍵配置 2：增加超時時間
    proxy_connect_timeout 300s;  # 連接超時
    proxy_send_timeout 300s;     # 發送超時
    proxy_read_timeout 300s;     # 讀取超時
    
    # 🔥 關鍵配置 3：增加緩衝區大小
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    
    # 🔥 關鍵配置 4：支持大請求體
    client_body_buffer_size 512k;
    client_body_timeout 300s;
    
    location / {
        # 正確的後端地址
        proxy_pass http://localhost:3001;  # 或 http://127.0.0.1:3001
        
        # 必要的 proxy 頭
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 禁用緩衝（對上傳很重要）
        proxy_request_buffering off;
        proxy_buffering off;
    }
}
```

---

## 📝 完整配置範例（Synology 適用）

如果您使用 Synology 的反向代理設置，可能需要手動編輯配置文件：

```nginx
# /usr/syno/etc/www/sites-enabled-user/calendar.conf

upstream flb_calendar_backend {
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name calendar.funlearnbar.synology.me;
    
    # SSL 證書（Synology 自動管理）
    ssl_certificate /usr/syno/etc/certificate/ReverseProxy/.../fullchain.pem;
    ssl_certificate_key /usr/syno/etc/certificate/ReverseProxy/.../privkey.pem;
    
    # ==================== 核心上傳配置 ====================
    
    # 允許大文件上傳
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    client_body_timeout 300s;
    
    # 超時設置
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # 緩衝區設置
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    
    # ==================== 主要位置配置 ====================
    
    location / {
        proxy_pass http://flb_calendar_backend;
        
        # 必要的 HTTP 頭
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # 禁用緩衝（對分片上傳很重要）
        proxy_request_buffering off;
        proxy_buffering off;
        
        # HTTP 版本
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    # ==================== 特殊路由優化 ====================
    
    # 分片上傳 API（額外優化）
    location ~ ^/api/learning-records/upload/(init|chunk|complete) {
        proxy_pass http://flb_calendar_backend;
        
        # 更長的超時時間
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        client_body_timeout 600s;
        
        # 必要頭
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 完全禁用緩衝
        proxy_request_buffering off;
        proxy_buffering off;
        
        # HTTP 1.1
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    # 日誌
    access_log /var/log/nginx/calendar_access.log;
    error_log /var/log/nginx/calendar_error.log warn;
}
```

---

## 🚀 第三步：應用配置並重啟 Nginx

### 方法 A：透過 Synology DSM（推薦）

1. 登入 DSM
2. 開啟 **控制台** → **登入門戶** → **進階** → **反向代理伺服器**
3. 編輯 `calendar.funlearnbar.synology.me` 的規則
4. 在**自訂標頭**中添加以下內容：
   ```
   client_max_body_size 500M
   proxy_connect_timeout 300s
   proxy_send_timeout 300s
   proxy_read_timeout 300s
   proxy_request_buffering off
   ```

### 方法 B：手動編輯配置文件（進階）

```bash
# 1. 備份現有配置
sudo cp /usr/syno/etc/www/sites-enabled-user/calendar.conf \
        /usr/syno/etc/www/sites-enabled-user/calendar.conf.backup

# 2. 編輯配置文件
sudo nano /usr/syno/etc/www/sites-enabled-user/calendar.conf

# 3. 測試配置
sudo nginx -t

# 4. 如果測試通過，重新載入 Nginx
sudo nginx -s reload
# 或
sudo synoservicectl --reload nginx
```

---

## ✅ 第四步：驗證修復

### 1. 檢查 Nginx 錯誤日誌

```bash
sudo tail -f /var/log/nginx/error.log
```

### 2. 測試 API 端點

在 NAS 上執行：

```bash
# 測試健康檢查
curl -I http://localhost:3001/health

# 測試分片上傳初始化
curl -X POST http://localhost:3001/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp4","fileSize":52428800,"fileType":"video/mp4","chunkSize":5242880}'
```

### 3. 瀏覽器測試

1. **清除瀏覽器緩存**：Ctrl + Shift + Delete
2. **強制刷新頁面**：Ctrl + F5（Windows）或 Cmd + Shift + R（Mac）
3. **上傳大文件測試**（> 10MB）
4. **觀察控制台輸出**：
   ```
   ✅ 正確: 📦 使用分片上傳: video.mp4 (25.5 MB)
            ⬆️ 上傳分片 1/5 (20%)
            ✅ 分片上傳成功
   
   ❌ 錯誤: POST .../upload/chunk 502 (Bad Gateway)
   ```

---

## 🔍 常見問題排查

### Q1: 找不到 Nginx 配置文件

**A**: Synology 的 Nginx 配置可能在：
```bash
/usr/syno/etc/www/nginx*.conf
/usr/syno/etc/www/sites-enabled-user/
/etc/nginx/conf.d/
```

### Q2: 修改配置後仍然 502

**A**: 可能的原因：
1. Nginx 沒有正確重載：`sudo synoservicectl --reload nginx`
2. Docker 容器網絡問題：`docker inspect flb-calendar-nas | grep IPAddress`
3. 防火牆規則：檢查 DSM 防火牆設置

### Q3: 如何確認 Nginx 正在使用新配置？

**A**: 
```bash
# 檢查 Nginx 進程啟動時間
ps aux | grep nginx

# 檢查配置文件最後修改時間
stat /usr/syno/etc/www/sites-enabled-user/calendar.conf

# 測試配置語法
sudo nginx -t
```

### Q4: 502 錯誤只出現在特定 API

**A**: 可能是該 API 路由需要更長超時或更大緩衝區。參考上面的**特殊路由優化**配置。

---

## 📊 修復前後對比

| 配置項 | 修復前（默認） | 修復後（建議） |
|--------|---------------|---------------|
| `client_max_body_size` | 1MB | 500MB |
| `proxy_connect_timeout` | 60s | 300s |
| `proxy_send_timeout` | 60s | 300s |
| `proxy_read_timeout` | 60s | 300s |
| `proxy_request_buffering` | on | off |
| `proxy_buffering` | on | off |

---

## 🎯 快速檢查清單

- [ ] 找到 Nginx 配置文件
- [ ] 添加 `client_max_body_size 500M`
- [ ] 增加超時時間（300s）
- [ ] 禁用 `proxy_request_buffering` 和 `proxy_buffering`
- [ ] 測試配置：`sudo nginx -t`
- [ ] 重載 Nginx：`sudo nginx -s reload`
- [ ] 清除瀏覽器緩存
- [ ] 測試上傳大文件（> 10MB）
- [ ] 確認控制台無 502 錯誤

---

**下一步**: 請在 NAS 上執行 `diagnose-nginx.sh` 腳本，找到並分享您的 Nginx 配置文件內容，我會幫您精確修正！


