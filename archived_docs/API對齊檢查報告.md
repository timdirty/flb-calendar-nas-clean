# 🔍 API 端點對齊檢查報告

## 📋 前端調用的 API（admin-dashboard.html）

### ✅ 已確認存在的 API

| 前端調用 | 後端端點 | 狀態 |
|----------|----------|------|
| GET /api/teachers | ✅ Line 1847 | 正常 |
| GET /api/students | ❌ **缺失** | **需要添加** |
| POST /api/proxy/google-sheets | ✅ Line 793 | 正常 |
| GET /api/line-config | ✅ Line 4613 | 正常 |
| POST /api/line-config | ✅ Line 4641 | 正常 |
| POST /api/test-line-notification | ❌ **缺失** | **需要添加** |
| GET /api/admin/info | ❌ **缺失** | **需要添加** |
| POST /api/admin/set | ❌ **缺失** | **需要添加** |
| POST /api/student-attendance-notification | ✅ Line 1225 | 正常 |
| GET /api/logs | ✅ Line 175 | 正常 |
| GET /api/events | ✅ Line 699 | 正常 |
| GET /api/reminders | ✅ Line 2405 | 正常 |

### ❌ 缺失的 API 端點（需要立即添加）

1. **GET /api/students** - 獲取學生列表
2. **POST /api/test-line-notification** - 測試 LINE 通知
3. **GET /api/admin/info** - 獲取管理員資訊
4. **POST /api/admin/set** - 設定管理員

---

## 🔧 立即修復

### 需要添加的 API

#### 1. GET /api/students
```javascript
app.get('/api/students', (req, res) => {
  try {
    const studentDataPath = path.join(__dirname, 'public/student_data.json');
    
    if (!fs.existsSync(studentDataPath)) {
      return res.status(404).json({
        success: false,
        message: '學生資料檔案不存在'
      });
    }
    
    const data = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('獲取學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生資料失敗: ' + error.message
    });
  }
});
```

#### 2. POST /api/test-line-notification
```javascript
app.post('/api/test-line-notification', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ACCESS_TOKEN 未設定',
        hint: '請在 .env.nas 中設定 LINE_CHANNEL_ACCESS_TOKEN'
      });
    }
    
    const testUserId = userId || process.env.ADMIN_USER_ID || 'U0291ce9023f7911a99cf79a54be90de8';
    const testMessage = message || '🧪 LINE 通知測試\n\n系統正常運作中！';
    
    const response = await axios.post('https://api.line.me/v2/bot/message/push', {
      to: testUserId,
      messages: [{
        type: 'text',
        text: testMessage
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      message: 'LINE 通知測試成功',
      data: {
        userId: testUserId,
        messageLength: testMessage.length,
        lineResponse: response.data
      }
    });
    
  } catch (error) {
    console.error('LINE 通知測試失敗:', error);
    res.status(500).json({
      success: false,
      message: 'LINE 通知測試失敗',
      error: error.response?.data || error.message,
      hint: '請檢查 LINE_CHANNEL_ACCESS_TOKEN 是否正確'
    });
  }
});
```

#### 3. GET /api/admin/info
```javascript
app.get('/api/admin/info', (req, res) => {
  try {
    const adminUserId = process.env.ADMIN_USER_ID || null;
    
    res.json({
      success: true,
      data: {
        userId: adminUserId,
        hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
      }
    });
  } catch (error) {
    console.error('獲取管理員資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取管理員資訊失敗: ' + error.message
    });
  }
});
```

#### 4. POST /api/admin/set
```javascript
app.post('/api/admin/set', async (req, res) => {
  try {
    const { adminUserId } = req.body;
    
    if (!adminUserId || adminUserId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '管理員 User ID 為必填'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加 ADMIN_USER_ID
    if (envContent.includes('ADMIN_USER_ID=')) {
      envContent = envContent.replace(
        /ADMIN_USER_ID=.*/g,
        `ADMIN_USER_ID=${adminUserId}`
      );
    } else {
      envContent += `\nADMIN_USER_ID=${adminUserId}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ 管理員 User ID 已更新:', adminUserId);
    
    res.json({
      success: true,
      message: '管理員設定成功，請重啟服務以載入新配置',
      data: {
        adminUserId: adminUserId
      }
    });
    
  } catch (error) {
    console.error('設定管理員失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定管理員失敗: ' + error.message
    });
  }
});
```

---

## 📊 完整 API 清單對比

### 前端需要的 API（16個）
1. ✅ GET /api/teachers
2. ❌ GET /api/students
3. ✅ POST /api/proxy/google-sheets
4. ✅ GET /api/line-config
5. ✅ POST /api/line-config
6. ❌ POST /api/test-line-notification
7. ❌ GET /api/admin/info
8. ❌ POST /api/admin/set
9. ✅ POST /api/student-attendance-notification
10. ✅ GET /api/logs
11. ✅ GET /api/events
12. ✅ GET /api/reminders

### 後端現有的 API（60+ 個）
✅ 已實現但前端未使用的還有很多...

---

## 🚨 立即行動

### 優先級 1：修復缺失的 API（立即）

```bash
# 需要在 server.js 添加以下 API：
1. GET /api/students
2. POST /api/test-line-notification  
3. GET /api/admin/info
4. POST /api/admin/set
```

### 優先級 2：部署到 NAS

```bash
# 等待 Synology Drive 同步完成（1-2分鐘）
# 然後重啟服務
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd flb-calendar-nas
sudo docker-compose restart
```

### 優先級 3：驗證所有 API

```bash
# 測試每個 API 端點
curl http://localhost:3001/api/students
curl http://localhost:3001/api/admin/info
curl -X POST http://localhost:3001/api/admin/set -H "Content-Type: application/json" -d '{"adminUserId":"test"}'
curl -X POST http://localhost:3001/api/test-line-notification -H "Content-Type: application/json" -d '{"message":"test"}'
```

---

## ✅ 完整性檢查清單

### 前端（admin-dashboard.html）
- [ ] 所有 fetch 調用都有對應的後端 API
- [ ] 錯誤處理完整
- [ ] 顯示載入狀態
- [ ] 用戶友好的錯誤訊息

### 後端（server.js）
- [ ] 所有前端需要的 API 都已實現
- [ ] 參數驗證完整
- [ ] 錯誤處理完整
- [ ] 日誌記錄完整
- [ ] 回應格式統一

### 部署
- [ ] 代碼已同步到 NAS
- [ ] Docker 服務已重啟
- [ ] 所有 API 測試通過
- [ ] 前端功能正常

---

## 📝 後續建議

### 1. 建立 API 文檔
創建一個 `API.md` 文件，記錄所有 API 端點、參數、回應格式

### 2. 自動化測試
編寫測試腳本，自動檢查前後端 API 對齊

### 3. 版本控制
使用 Git 追蹤所有變更，避免前後端不同步

### 4. 開發流程
- 添加新功能時，先定義 API
- 同時開發前後端
- 測試後再部署

---

**立即執行修復！** 🚀


