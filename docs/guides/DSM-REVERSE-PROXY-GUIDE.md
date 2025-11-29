# 📘 Synology DSM 反向代理設置完整指南

**目的**: 修改 Nginx 反向代理配置以支持大文件分片上傳

---

## 🎯 步驟總覽

```
1. 登入 DSM
2. 開啟控制台
3. 進入登入門戶設定
4. 編輯反向代理規則
5. 添加自訂標頭
6. 保存並測試
```

---

## 📖 詳細步驟

### 步驟 1: 登入 Synology DSM

1. 打開瀏覽器
2. 訪問您的 NAS 管理頁面（例如：`http://192.168.x.x:5000` 或 `https://your-nas.synology.me:5001`）
3. 使用管理員帳號登入

---

### 步驟 2: 開啟控制台

1. 在 DSM 桌面，點擊左上角的 **【主選單】**（九宮格圖標）
2. 找到並點擊 **【控制台】**（齒輪圖標）

```
主選單 → 控制台
```

---

### 步驟 3: 進入登入門戶設定

在控制台中：

1. 找到 **【應用程式】** 區域
2. 點擊 **【登入門戶】**
   - 如果找不到，試試搜尋「登入門戶」或「Login Portal」
   - 或者找 **【應用程式入口網站】**（Application Portal）

```
控制台 → 登入門戶
```

---

### 步驟 4: 切換到反向代理伺服器頁籤

1. 在登入門戶視窗中，點擊頂部的 **【進階】** 標籤
2. 點擊 **【反向代理伺服器】** 子標籤

```
登入門戶 → 進階 → 反向代理伺服器
```

您應該會看到一個反向代理規則列表。

---

### 步驟 5: 找到並編輯 calendar 規則

1. 在反向代理規則列表中，找到：
   ```
   來源: calendar.funlearnbar.synology.me
   或
   描述中包含 "calendar" 或 "flb-calendar" 的規則
   ```

2. **選中該規則**（點擊該行）

3. 點擊上方的 **【編輯】** 按鈕

---

### 步驟 6: 修改反向代理規則

在編輯視窗中，您會看到幾個標籤頁：

#### 6.1 一般設定（確認基本配置）

確認以下設定：

| 欄位 | 值 |
|------|-----|
| 來源 - 協定 | `HTTPS` |
| 來源 - 主機名稱 | `calendar.funlearnbar.synology.me` |
| 來源 - 連接埠 | `443` |
| 目的地 - 協定 | `HTTP` |
| 目的地 - 主機名稱 | `localhost` |
| 目的地 - 連接埠 | `3001` |

**如果這裡的端口不是 3001，請改為 3001！** ⚠️

#### 6.2 自訂標頭（關鍵步驟）

1. 點擊 **【自訂標頭】** 標籤
2. 點擊 **【建立】** 或 **【新增】** 按鈕
3. **逐一添加**以下標頭：

##### 標頭 1: 上傳大小限制
```
標頭名稱: (留空或選擇 WebSocket)
值: client_max_body_size 500M
```

##### 標頭 2: 連接超時
```
標頭名稱: (留空)
值: proxy_connect_timeout 300s
```

##### 標頭 3: 發送超時
```
標頭名稱: (留空)
值: proxy_send_timeout 300s
```

##### 標頭 4: 讀取超時
```
標頭名稱: (留空)
值: proxy_read_timeout 300s
```

##### 標頭 5: 禁用請求緩衝
```
標頭名稱: (留空)
值: proxy_request_buffering off
```

##### 標頭 6: 禁用回應緩衝
```
標頭名稱: (留空)
值: proxy_buffering off
```

##### 標頭 7: 客戶端超時
```
標頭名稱: (留空)
值: client_body_timeout 300s
```

**完整自訂標頭列表**（複製貼上用）：
```
client_max_body_size 500M
proxy_connect_timeout 300s
proxy_send_timeout 300s
proxy_read_timeout 300s
proxy_request_buffering off
proxy_buffering off
client_body_timeout 300s
```

#### 6.3 進階設定（選擇性）

點擊 **【進階設定】** 標籤，可以額外配置：

- ☑️ 啟用 **WebSocket**（如果有此選項）
- ☑️ 啟用 **HTTP/2**（如果有此選項）

---

### 步驟 7: 保存設定

1. 點擊視窗底部的 **【確定】** 按鈕
2. 如果出現確認對話框，點擊 **【是】** 或 **【確定】**
3. 等待設定套用（通常幾秒鐘）

---

### 步驟 8: 驗證設定是否生效

#### 方法 1: 在 NAS 上測試

SSH 連接到 NAS，執行：

```bash
# 測試本地 API（應該成功）
curl -I http://localhost:3001/health

# 測試通過 Nginx 的 API（應該也成功了）
curl -I https://calendar.funlearnbar.synology.me/health
```

#### 方法 2: 在瀏覽器測試

1. **清除瀏覽器緩存**：
   - Chrome/Edge: `Ctrl + Shift + Delete`（Windows）或 `Cmd + Shift + Delete`（Mac）
   - 選擇「快取圖片和檔案」
   - 點擊「清除資料」

2. **強制重新載入頁面**：
   - Windows: `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

3. **訪問上傳頁面**：
   ```
   https://calendar.funlearnbar.synology.me/learning-record-upload.html
   ```

4. **打開開發者工具**：
   - 按 `F12`
   - 切換到 **Console（控制台）** 標籤

5. **上傳大文件測試**（> 10MB）：
   - 選擇一個大於 10MB 的影片或圖片
   - 觀察控制台輸出

**✅ 成功的日誌**：
```
📦 使用分片上傳: video.mp4 (25.5 MB)
🔄 初始化分片上傳...
✅ 初始化成功: uploadId=...
⬆️ 上傳分片 1/5 (20%)
⬆️ 上傳分片 2/5 (40%)
...
✅ 分片上傳成功
```

**❌ 如果還是 502 錯誤**：
```
POST .../upload/init 502 (Bad Gateway)
```

---

## 🔍 故障排除

### 問題 1: 找不到「登入門戶」選項

**解決方法**：
- 確認您使用的是管理員帳號
- DSM 版本太舊可能沒有此功能，請更新到 DSM 7.0+
- 試試搜尋「Application Portal」或「應用程式入口網站」

### 問題 2: 找不到 calendar 的反向代理規則

**可能原因**：
1. 反向代理規則可能用不同的名稱或描述
2. 規則可能尚未建立

**解決方法**：
如果沒有現有規則，請**建立新規則**：

1. 在反向代理伺服器頁面，點擊 **【建立】**
2. 填寫以下資訊：

   **反向代理規則名稱**：`FLB Calendar`

   **來源**：
   - 協定: `HTTPS`
   - 主機名稱: `calendar.funlearnbar.synology.me`
   - 連接埠: `443`
   - 啟用 HSTS（可選）

   **目的地**：
   - 協定: `HTTP`
   - 主機名稱: `localhost`
   - 連接埠: `3001`

3. 然後按照上面的步驟 6 添加自訂標頭

### 問題 3: 添加自訂標頭後仍然 502

**檢查清單**：

1. **確認目的地端口正確**：
   ```bash
   # 在 NAS 上執行，確認容器正在監聽 3001
   sudo netstat -tlnp | grep 3001
   # 應該看到 docker-proxy 監聽 3001
   ```

2. **確認 Docker 容器運行中**：
   ```bash
   docker ps | grep flb-calendar
   # 應該看到 Up X minutes (healthy)
   ```

3. **檢查 Nginx 錯誤日誌**：
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

4. **重啟 Nginx**（最後手段）：
   ```bash
   sudo synoservicectl --reload nginx
   ```

### 問題 4: 自訂標頭輸入框太小

**解決方法**：
- 每個標頭單獨添加，不要一次貼上全部
- 或者先在記事本準備好，再逐一複製貼上

---

## 📊 設定前後對比

### 修改前（預設值）
```nginx
client_max_body_size: 1M
proxy_connect_timeout: 60s
proxy_send_timeout: 60s
proxy_read_timeout: 60s
proxy_request_buffering: on
proxy_buffering: on
```
**結果**: ❌ 大文件上傳失敗，502 錯誤

### 修改後（建議值）
```nginx
client_max_body_size: 500M
proxy_connect_timeout: 300s
proxy_send_timeout: 300s
proxy_read_timeout: 300s
proxy_request_buffering: off
proxy_buffering: off
client_body_timeout: 300s
```
**結果**: ✅ 支持大文件分片上傳

---

## 🎯 快速檢查清單

完成以下步驟確保設定正確：

- [ ] 登入 DSM 控制台
- [ ] 進入「登入門戶」→「進階」→「反向代理伺服器」
- [ ] 找到或建立 calendar.funlearnbar.synology.me 規則
- [ ] 確認目的地端口為 `3001`
- [ ] 添加 7 個自訂標頭（見上方列表）
- [ ] 保存設定
- [ ] 清除瀏覽器緩存
- [ ] 強制重新載入頁面
- [ ] 測試上傳大文件（> 10MB）
- [ ] 確認控制台無 502 錯誤

---

## 📞 需要進一步協助？

如果按照以上步驟操作後仍有問題，請提供：

1. DSM 版本號（控制台 → 資訊中心 → 一般）
2. 反向代理規則截圖（來源、目的地、自訂標頭）
3. 瀏覽器控制台完整錯誤日誌
4. NAS 上的測試結果：
   ```bash
   curl -I http://localhost:3001/health
   curl -I https://calendar.funlearnbar.synology.me/health
   ```

---

**祝您設定順利！** 🎉

修改完成後，分片上傳功能應該就可以正常工作了！


