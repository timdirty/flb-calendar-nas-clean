// ========================================
// 完整 API 修復和補充
// 添加到 server.js 中
// ========================================

const fs = require('fs');
const path = require('path');

// ========================================
// 1. 講師管理 API (完整 CRUD)
// ========================================

// POST /api/teachers - 新增講師
app.post('/api/teachers', async (req, res) => {
  try {
    const { name, lineUserId, color, enabled } = req.body;
    
    if (!name || !lineUserId) {
      return res.status(400).json({
        success: false,
        message: '講師名稱和 LINE User ID 為必填'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const data = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    // 檢查是否已存在
    if (data.teachers[name]) {
      return res.status(400).json({
        success: false,
        message: '該講師已存在'
      });
    }
    
    // 新增講師
    data.teachers[name] = lineUserId;
    data.last_update = new Date().toISOString();
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ 新增講師成功: ${name}`);
    res.json({
      success: true,
      message: '講師新增成功',
      data: { name, lineUserId }
    });
    
  } catch (error) {
    console.error('新增講師失敗:', error);
    res.status(500).json({
      success: false,
      message: '新增講師失敗: ' + error.message
    });
  }
});

// PUT /api/teachers/:name - 更新講師
app.put('/api/teachers/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { lineUserId, newName } = req.body;
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const data = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    if (!data.teachers[name]) {
      return res.status(404).json({
        success: false,
        message: '找不到該講師'
      });
    }
    
    // 如果要更名
    if (newName && newName !== name) {
      if (data.teachers[newName]) {
        return res.status(400).json({
          success: false,
          message: '新名稱已被使用'
        });
      }
      data.teachers[newName] = lineUserId || data.teachers[name];
      delete data.teachers[name];
    } else {
      // 只更新 User ID
      if (lineUserId) {
        data.teachers[name] = lineUserId;
      }
    }
    
    data.last_update = new Date().toISOString();
    fs.writeFileSync(teacherDataPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ 更新講師成功: ${name}`);
    res.json({
      success: true,
      message: '講師更新成功',
      data: { name: newName || name, lineUserId: data.teachers[newName || name] }
    });
    
  } catch (error) {
    console.error('更新講師失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新講師失敗: ' + error.message
    });
  }
});

// DELETE /api/teachers/:name - 刪除講師
app.delete('/api/teachers/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const data = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    if (!data.teachers[name]) {
      return res.status(404).json({
        success: false,
        message: '找不到該講師'
      });
    }
    
    delete data.teachers[name];
    data.last_update = new Date().toISOString();
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ 刪除講師成功: ${name}`);
    res.json({
      success: true,
      message: '講師刪除成功'
    });
    
  } catch (error) {
    console.error('刪除講師失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除講師失敗: ' + error.message
    });
  }
});

// ========================================
// 2. 訊息模板 API (完整 CRUD)
// ========================================

// GET /api/templates - 獲取所有模板
app.get('/api/templates', (req, res) => {
  try {
    const templatesPath = path.join(__dirname, 'data/templates.json');
    
    if (!fs.existsSync(templatesPath)) {
      // 如果不存在，創建默認模板
      const defaultTemplates = {
        studentAttendance: {
          present: "✅ 出席：{present}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}",
          absent: "❌ 缺席：{absent}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}",
          unmarked: "⏳ 未標記：{unmarked}\n📚 課程：{course} {weekday} {time}\n🏫 地點：{location}\n\n👨‍🏫 講師：{teacher}\n⏰ 簽到時間：{time}"
        },
        courseReminder: {
          template: "🔔 課程提醒\n\n👨‍🏫 講師：{teacher}\n📚 課程：{course}\n📅 日期：{date}\n⏰ 時間：{time}\n🏫 地點：{location}"
        },
        dailyReminder: {
          template: "📅 今日課程提醒\n\n您今天有 {count} 堂課：\n{courseList}\n\n請準時出席！"
        },
        nextDayReminder: {
          template: "📅 明日課程提醒\n\n您明天有 {count} 堂課：\n{courseList}\n\n請提前準備！"
        },
        beforeClassReminder: {
          template: "⏰ 課前提醒\n\n您的課程即將開始：\n📚 {course}\n⏰ {time}\n🏫 {location}\n\n請準備上課！"
        },
        studentReminder: {
          template: "👨‍🎓 學生提醒\n\n{studentName} 同學：\n📚 課程：{course}\n📅 {date} ({weekday})\n⏰ {time}\n🏫 {location}\n\n📝 剩餘堂數：{remainingClasses}"
        },
        courseCancellation: {
          template: "❌ 課程取消通知\n\n📚 課程：{course}\n📅 原定時間：{date} {time}\n🏫 地點：{location}\n\n📝 取消原因：{reason}"
        },
        systemNotification: {
          template: "📢 系統通知\n\n{message}"
        }
      };
      
      fs.writeFileSync(templatesPath, JSON.stringify(defaultTemplates, null, 2));
      
      return res.json({
        success: true,
        data: defaultTemplates
      });
    }
    
    const data = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('獲取模板失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取模板失敗: ' + error.message
    });
  }
});

// PUT /api/templates/:type - 更新模板
app.put('/api/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { template, present, absent, unmarked } = req.body;
    
    const templatesPath = path.join(__dirname, 'data/templates.json');
    const data = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    if (!data[type]) {
      return res.status(404).json({
        success: false,
        message: '找不到該模板類型'
      });
    }
    
    // 更新模板
    if (template !== undefined) {
      data[type].template = template;
    }
    if (present !== undefined) {
      data[type].present = present;
    }
    if (absent !== undefined) {
      data[type].absent = absent;
    }
    if (unmarked !== undefined) {
      data[type].unmarked = unmarked;
    }
    
    fs.writeFileSync(templatesPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ 更新模板成功: ${type}`);
    res.json({
      success: true,
      message: '模板更新成功',
      data: data[type]
    });
    
  } catch (error) {
    console.error('更新模板失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新模板失敗: ' + error.message
    });
  }
});

// POST /api/templates - 新增模板類型
app.post('/api/templates', async (req, res) => {
  try {
    const { type, template } = req.body;
    
    if (!type || !template) {
      return res.status(400).json({
        success: false,
        message: '模板類型和內容為必填'
      });
    }
    
    const templatesPath = path.join(__dirname, 'data/templates.json');
    const data = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    if (data[type]) {
      return res.status(400).json({
        success: false,
        message: '該模板類型已存在'
      });
    }
    
    data[type] = { template };
    fs.writeFileSync(templatesPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ 新增模板成功: ${type}`);
    res.json({
      success: true,
      message: '模板新增成功',
      data: data[type]
    });
    
  } catch (error) {
    console.error('新增模板失敗:', error);
    res.status(500).json({
      success: false,
      message: '新增模板失敗: ' + error.message
    });
  }
});

// ========================================
// 3. LINE Token 測試 API
// ========================================

// POST /api/test-line-notification - 測試 LINE 通知
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

// GET /api/line-config-status - 檢查 LINE 配置狀態
app.get('/api/line-config-status', (req, res) => {
  const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const tokenLength = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0;
  
  res.json({
    success: true,
    data: {
      hasToken,
      tokenLength,
      tokenPreview: hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 20) + '...' : null,
      adminUserId: process.env.ADMIN_USER_ID || null,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// ========================================
// 4. 系統配置 API
// ========================================

// GET /api/system-config - 獲取系統配置
app.get('/api/system-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'system-settings.json');
    
    if (!fs.existsSync(configPath)) {
      return res.json({
        success: true,
        data: {
          reminders: {
            sendDelay: 1000,
            maxRetries: 3,
            dailyTime: { hour: 8, minute: 0 },
            nextDayTime: { hour: 18, minute: 0 },
            beforeClassMinutes: 30
          },
          api: {
            baseUrl: 'http://localhost:3000'
          }
        }
      });
    }
    
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('獲取系統配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取系統配置失敗: ' + error.message
    });
  }
});

// PUT /api/system-config - 更新系統配置
app.put('/api/system-config', async (req, res) => {
  try {
    const newConfig = req.body;
    const configPath = path.join(__dirname, 'system-settings.json');
    
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ 系統配置更新成功');
    res.json({
      success: true,
      message: '系統配置更新成功',
      data: newConfig
    });
    
  } catch (error) {
    console.error('更新系統配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新系統配置失敗: ' + error.message
    });
  }
});

// ========================================
// 5. LINE 配置管理 API
// ========================================

// GET /api/line-config - 獲取 LINE 配置狀態
app.get('/api/line-config', (req, res) => {
  try {
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const tokenLength = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0;
    const tokenPreview = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 20) : null;
    const liffClientId = process.env.LIFF_CLIENT_ID || null;
    
    res.json({
      success: true,
      data: {
        hasToken,
        tokenLength,
        tokenPreview,
        liffClientId,
        adminUserId: process.env.ADMIN_USER_ID || null,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('獲取 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取 LINE 配置失敗: ' + error.message
    });
  }
});

// POST /api/line-config - 更新 LINE 配置
app.post('/api/line-config', async (req, res) => {
  try {
    const { lineChannelToken, liffClientId } = req.body;
    
    if (!lineChannelToken || lineChannelToken.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'LINE Channel Access Token 為必填'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    
    // 讀取現有的 .env.nas 內容
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加 LINE_CHANNEL_ACCESS_TOKEN
    const tokenLine = `LINE_CHANNEL_ACCESS_TOKEN=${lineChannelToken}`;
    const liffLine = liffClientId ? `LIFF_CLIENT_ID=${liffClientId}` : '';
    
    // 檢查是否已存在
    if (envContent.includes('LINE_CHANNEL_ACCESS_TOKEN=')) {
      // 替換現有的 Token
      envContent = envContent.replace(
        /LINE_CHANNEL_ACCESS_TOKEN=.*/g,
        tokenLine
      );
    } else {
      // 添加新的 Token
      envContent += '\n\n# LINE Messaging API\n' + tokenLine + '\n';
    }
    
    // 更新或添加 LIFF_CLIENT_ID
    if (liffClientId) {
      if (envContent.includes('LIFF_CLIENT_ID=')) {
        envContent = envContent.replace(
          /LIFF_CLIENT_ID=.*/g,
          liffLine
        );
      } else {
        envContent += liffLine + '\n';
      }
    }
    
    // 寫入文件
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ LINE 配置已更新到 .env.nas');
    console.log('⚠️ 請重啟 Docker 服務以載入新配置');
    
    res.json({
      success: true,
      message: 'LINE 配置已儲存，請重啟 Docker 服務以載入新配置',
      needRestart: true,
      data: {
        tokenLength: lineChannelToken.length,
        tokenPreview: lineChannelToken.substring(0, 20) + '...',
        liffClientId: liffClientId || null
      }
    });
    
  } catch (error) {
    console.error('更新 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新 LINE 配置失敗: ' + error.message
    });
  }
});

console.log('✅ 所有 API 端點已添加');
console.log('📚 講師管理: POST/PUT/DELETE /api/teachers');
console.log('📝 模板管理: GET/POST/PUT /api/templates');
console.log('📱 LINE 測試: POST /api/test-line-notification');
console.log('🔑 LINE 配置: GET/POST /api/line-config');
console.log('⚙️ 系統配置: GET/PUT /api/system-config');

