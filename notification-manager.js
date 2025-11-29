const fs = require('fs');
const path = require('path');
const axios = require('axios');

class NotificationManager {
  constructor() {
    this.configPath = path.join(__dirname, 'notification-config.json');
    this.teacherDataPath = path.join(__dirname, 'teacher_data.json');
    this.flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');
    this.studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    this.config = this.loadConfig();
    this.teacherData = this.loadTeacherData();
    this._teacherNameIndex = null; // 快取清理後的講師名稱索引
    this.flexTemplates = this.loadFlexTemplates();
    
    // 🌟 特殊事件類型定義
    this.SPECIAL_EVENT_TYPES = {
      "停課": ["停課", "取消", "暫停", "休息", "放假", "請假"],
      "體驗": ["體驗", "體驗課", "體驗班"],
      "代課": ["代課", "代理", "支援"],
      "改時間": ["調課", "延後", "提前", "改時間"],
      "公告": ["公告", "通知", "提醒", "備註"]
    };
    
    // 🎨 特殊事件顏色配置
    this.SPECIAL_EVENT_COLORS = {
      '停課': { color: '#dc3545', emoji: '🔴', badge: '停課' },
      '體驗': { color: '#FFD700', emoji: '🟢', badge: '體驗' },
      '代課': { color: '#2196F3', emoji: '🔵', badge: '代課' },
      '改時間': { color: '#f59e0b', emoji: '🟠', badge: '改時間' },
      '公告': { color: '#8b5cf6', emoji: '🟣', badge: '公告' }
    };
    
    // 預設顏色配置（正常課程）
    this.DEFAULT_COLORS = {
      'today': '#4f46e5',
      'tomorrow': '#06b6d4',
      'beforeClass': '#f59e0b'
    };
  }

  // 標準化講師名稱（忽略大小寫/空白/表情/標點/結尾的「老師」）
  normalizeName(name = '') {
    try {
      return String(name)
        .toLowerCase()
        .replace(/老師$/g, '')
        .replace(/[\s\u3000\u00a0]/g, '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .replace(/[\-*+_()（）\[\]{}:;,.。？！!、·‧\"'`~^@#€$%&\\|<>]/g, '')
        .trim();
    } catch (e) {
      return (name || '').toString().trim().toLowerCase();
    }
  }

  // 取得講師的 LINE User ID（支援模糊比對）
  getTeacherUserIdByName(name) {
    if (!name) return null;
    const target = this.normalizeName(name);

    // 建立快取索引
    if (!this._teacherNameIndex) {
      this._teacherNameIndex = new Map();
      const list = Array.isArray(this.teacherData.teachers)
        ? this.teacherData.teachers
        : Object.entries(this.teacherData.teachers || {}).map(([n, id]) => ({ name: n, userId: id }));
      list.forEach(t => {
        const key = this.normalizeName(t.name);
        if (key) this._teacherNameIndex.set(key, t.userId || t.userIdString || t.id || null);
      });
      try {
        console.log('👥 [Notify] 已建立講師名稱索引，共', this._teacherNameIndex.size, '筆');
      } catch (e) {}
    }

    // 1) 完全清理後匹配
    if (this._teacherNameIndex.has(target)) {
      return this._teacherNameIndex.get(target);
    }

    // 2) 包含關係匹配
    for (const [key, id] of this._teacherNameIndex.entries()) {
      if (key.includes(target) || target.includes(key)) return id;
    }

    try { console.warn('⚠️ [Notify] 講師 ID 未匹配：', name, '→ 標準化：', target); } catch (e) {}
    return null;
  }

  // 載入配置檔案
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      } else {
        console.log('⚠️ 通知配置文件不存在，使用預設配置');
        return this.getDefaultConfig();
      }
    } catch (error) {
      console.error('❌ 載入通知配置失敗:', error);
      return this.getDefaultConfig();
    }
  }

  // 載入講師資料
  loadTeacherData() {
    try {
      const data = fs.readFileSync(this.teacherDataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ 載入講師資料失敗:', error);
      return { teachers: {} };
    }
  }

  // 載入 Flex Message 範本
  loadFlexTemplates() {
    try {
      if (fs.existsSync(this.flexTemplatePath)) {
        const data = fs.readFileSync(this.flexTemplatePath, 'utf8');
        return JSON.parse(data);
      } else {
        console.log('⚠️ Flex Message 範本文件不存在，使用預設範本');
        return this.getDefaultFlexTemplates();
      }
    } catch (error) {
      console.error('❌ 載入 Flex Message 範本失敗:', error);
      return this.getDefaultFlexTemplates();
    }
  }

  // 預設 Flex Message 範本
  getDefaultFlexTemplates() {
    return {
      enabled: false,
      templates: {
        today: this.getDefaultFlexBubble('當日課程提醒'),
        tomorrow: this.getDefaultFlexBubble('隔日課程提醒'),
        beforeClass: this.getDefaultFlexBubble('課前提醒'),
        student: this.getDefaultFlexBubble('學生課程提醒')
      },
      quickReply: {
        enabled: true,
        options: [
          { label: '✅ 會出席', data: 'attend' },
          { label: '🏥 請假', data: 'leave' },
          { label: '⏳ 待確認', data: 'pending' }
        ],
        leaveReasons: ['生病', '家庭因素', '臨時有事', '其他']
      },
      carousel: {
        maxBubbles: 10
      }
    };
  }

  // 預設 Flex Bubble 範本
  getDefaultFlexBubble(title) {
    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: title,
            color: '#ffffff',
            size: 'lg',
            weight: 'bold'
          }
        ],
        backgroundColor: '#4f46e5',
        paddingAll: '15px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '{teacherName} 講師',
            size: 'md',
            weight: 'bold',
            margin: 'none'
          },
          {
            type: 'text',
            text: '{courseName}',
            size: 'sm',
            color: '#555555',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '📅',
                    size: 'sm',
                    flex: 0
                  },
                  {
                    type: 'text',
                    text: '{courseDate} {weekday}',
                    size: 'sm',
                    color: '#666666',
                    flex: 5
                  }
                ]
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '⏰',
                    size: 'sm',
                    flex: 0
                  },
                  {
                    type: 'text',
                    text: '{courseTime}',
                    size: 'sm',
                    color: '#666666',
                    flex: 5
                  }
                ]
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '📍',
                    size: 'sm',
                    flex: 0
                  },
                  {
                    type: 'text',
                    text: '{location}',
                    size: 'sm',
                    color: '#666666',
                    flex: 5,
                    wrap: true
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: '查看教案',
              uri: '{lessonPlanUrl}'
            },
            color: '#4f46e5'
          },
          {
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: '地圖導航',
              uri: '{googleMapsUrl}'
            }
          }
        ]
      }
    };
  }

  // 預設配置
  getDefaultConfig() {
    return {
      roles: {
        admin: {
          name: "管理員",
          user_id: "Udb51363eb6fdc605a6a9816379a38103",
          permissions: ["receive_all_notifications"]
        },
        teacher: {
          name: "講師",
          permissions: ["receive_own_course_notifications"]
        }
      },
      notification_settings: {
        student_attendance: {
          enabled: true,
          send_to_admin: true,
          send_to_teacher: true
        },
        teacher_reports: {
          enabled: true,
          send_to_admin: true,
          send_to_teacher: false
        }
      }
    };
  }

  // 重新載入配置
  reloadConfig() {
    this.config = this.loadConfig();
    this.teacherData = this.loadTeacherData();
    console.log('✅ 通知配置已重新載入');
  }

  // 獲取管理員 User ID
  getAdminUserId() {
    return this.config.roles?.admin?.user_id || 'Udb51363eb6fdc605a6a9816379a38103';
  }
  
  // 取得管理員群組 ID（若有設定）
  getAdminGroupId() {
    try {
      return this.config.roles?.admin?.group_id || null;
    } catch (e) {
      return null;
    }
  }

  // 根據課程名稱獲取相關講師
  getTeachersForCourse(courseName) {
    const mappingRules = this.config.teacher_course_mapping?.mapping_rules;
    if (!mappingRules) {
      return Object.keys(this.teacherData.teachers);
    }

    // 檢查特定課程對應
    for (const [course, teachers] of Object.entries(mappingRules.specific_courses || {})) {
      if (courseName.includes(course)) {
        return teachers;
      }
    }

    // 預設返回所有講師
    return mappingRules.default === 'all_teachers' ? Object.keys(this.teacherData.teachers) : [];
  }

  // 格式化訊息模板
  formatMessage(template, variables) {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    return message;
  }

  // 🌟 偵測特殊事件類型
  detectSpecialEventType(eventTitle) {
    if (!eventTitle) return null;
    
    const title = eventTitle.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.SPECIAL_EVENT_TYPES)) {
      for (const keyword of keywords) {
        if (title.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }
    
    return null;
  }

  // 替換 Flex Message 中的變數
  replaceFlexVariables(obj, variables) {
    if (typeof obj === 'string') {
      // 替換字串中的變數
      let result = obj;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        // 如果值是空字串，保持空字串（稍後會清理）
        // 如果值存在且不為空，使用該值
        // 如果值不存在或為 null/undefined，使用「（無資訊）」
        let replacementValue;
        if (value === '') {
          replacementValue = '';  // 保持空字串
        } else if (value && String(value).trim()) {
          replacementValue = String(value);
        } else {
          replacementValue = '（無資訊）';
        }
        result = result.replace(new RegExp(placeholder, 'g'), replacementValue);
      }
      return result;
    } else if (Array.isArray(obj)) {
      // 遞迴處理陣列
      return obj.map(item => this.replaceFlexVariables(item, variables));
    } else if (obj && typeof obj === 'object') {
      // 遞迴處理物件
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceFlexVariables(value, variables);
      }
      return result;
    }
    return obj;
  }

  // 清理 Flex Message 中的空元素（避免 LINE API 400 錯誤）
  cleanFlexMessage(obj) {
    if (Array.isArray(obj)) {
      // 過濾掉無效的陣列元素
      return obj
        .map(item => this.cleanFlexMessage(item))
        .filter(item => {
          // 移除 text 為空字串的文字元素
          if (item && item.type === 'text' && item.text === '') {
            return false;
          }
          // 移除 backgroundColor 為空字串的元素
          if (item && item.backgroundColor === '') {
            delete item.backgroundColor;
          }
          // ✅ 關鍵修復：移除 text 元素的所有不支援屬性（LINE API 限制）
          if (item && item.type === 'text') {
            if (item.backgroundColor !== undefined) {
              console.log(`🧹 移除 text 元素的 backgroundColor: "${item.text}"`);
              delete item.backgroundColor;
            }
            if (item.paddingAll !== undefined) {
              console.log(`🧹 移除 text 元素的 paddingAll: "${item.text}"`);
              delete item.paddingAll;
            }
            if (item.cornerRadius !== undefined) {
              console.log(`🧹 移除 text 元素的 cornerRadius: "${item.text}"`);
              delete item.cornerRadius;
            }
          }
          return item !== null && item !== undefined;
        });
    } else if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // 清理嵌套物件和陣列
        const cleaned = this.cleanFlexMessage(value);
        
        // 移除空字串的屬性
        if (cleaned === '' && (key === 'backgroundColor' || key === 'color')) {
          continue;  // 跳過空的顏色屬性
        }
        
        // 特殊處理 contents：如果清理後為空陣列，移除整個父元素
        if (key === 'contents' && Array.isArray(cleaned) && cleaned.length === 0) {
          return null;
        }
        
        result[key] = cleaned;
      }
      
      // ✅ 關鍵修復：如果這是 text 元素，移除所有不支援的屬性
      if (result.type === 'text') {
        if (result.backgroundColor !== undefined) {
          console.log(`🧹 移除 text 元素的 backgroundColor: "${result.text}"`);
          delete result.backgroundColor;
        }
        if (result.paddingAll !== undefined) {
          console.log(`🧹 移除 text 元素的 paddingAll: "${result.text}"`);
          delete result.paddingAll;
        }
        if (result.cornerRadius !== undefined) {
          console.log(`🧹 移除 text 元素的 cornerRadius: "${result.text}"`);
          delete result.cornerRadius;
        }
      }
      
      return result;
    }
    return obj;
  }

  // 建構 Flex Message
  buildFlexMessage(templateType, variables) {
    if (!this.flexTemplates.enabled) {
      return null;
    }

    // 別名映射：before-class -> beforeClass
    const templateTypeMap = {
      'before-class': 'beforeClass',
      'beforeClass': 'beforeClass',
      'today': 'today',
      'tomorrow': 'tomorrow',
      'student': 'student',
      'specialEventAlert': 'specialEventAlert',
      'leaveNotification': 'leaveNotification',
      'pendingNotification': 'pendingNotification'  // ✅ 修復：添加待確認通知模板映射
    };
    const mappedType = templateTypeMap[templateType] || templateType;

    // ✅ 新增：检测特殊事件并自动切换到对应范本
    const courseName = variables.courseName || '';
    // ✅ 優先使用從 reminder 傳來的 specialEventType（學生提醒），否則從課程名稱檢測
    let specialEventType = variables.specialEventType || this.detectSpecialEventType(courseName);

    let finalTemplateType = mappedType;
    // ✅ 修改：student 也加入特殊事件檢測範圍
    if (specialEventType && ['today', 'tomorrow', 'beforeClass', 'student'].includes(mappedType)) {
      // 构建特殊事件范本名称映射（key 必須是中文，匹配 detectSpecialEventType 返回值）
      const specialTemplateMap = {
        '停課': 'Cancelled',      // 停课
        '體驗': 'Experience',    // 体验
        '代課': 'Substitute',    // 代课
        '改時間': 'TimeChange'     // 改时间
      };
      
      const specialTemplateName = mappedType + specialTemplateMap[specialEventType];
      
      // 检查特殊事件范本是否存在
      if (this.flexTemplates.templates[specialTemplateName]) {
        finalTemplateType = specialTemplateName;
        console.log(`🎯 切换到特殊事件范本: ${mappedType} → ${finalTemplateType} (特殊事件: ${specialEventType})`);
      } else {
        console.log(`⚠️ 特殊事件范本不存在: ${specialTemplateName}，使用通用范本`);
      }
    }

    const template = this.flexTemplates.templates[finalTemplateType];
    if (!template) {
      console.log(`⚠️ 找不到 Flex 範本類型: ${templateType} (映射: ${finalTemplateType})`);
      return null;
    }

    // 🌟 如果沒有切換到專用特殊事件范本，仍注入特殊事件變數，並支援特殊備註
    if (finalTemplateType === mappedType && specialEventType) {
      const specialConfig = this.SPECIAL_EVENT_COLORS[specialEventType];
      console.log(`🌟 偵測到特殊事件: "${courseName}" -> ${specialEventType} ${specialConfig.emoji}`);
      
      // 添加特殊事件相關變數
      variables.specialEventBadge = `${specialConfig.emoji} ${specialConfig.badge}`;
      variables.specialEventColor = specialConfig.color;
      variables.headerColor = specialConfig.color;
      variables.specialNote = variables.specialNote || variables.note || '';
    } else {
      // 正常課程：使用預設顏色，隱藏特殊事件標記
      variables.specialEventBadge = '';
      variables.specialEventColor = 'transparent';
      variables.headerColor = this.DEFAULT_COLORS[mappedType] || '#4f46e5';
      variables.specialNote = variables.specialNote || '';
    }

    // 深拷貝範本並替換變數
    const flexMessage = JSON.parse(JSON.stringify(template));
    let result = this.replaceFlexVariables(flexMessage, variables);
    
    // 🌟 移除空的特殊事件標記（正常課程）
    if (!specialEventType) {
      this.removeEmptySpecialEventBadge(result);
    }
    
    // 🧹 清理空元素（避免 LINE API 400 錯誤）
    result = this.cleanFlexMessage(result);
    
    // ✅ 只對有教案按鈕的範本（today、tomorrow）檢查並移除空按鈕
    // beforeClass 和 student 範本本身就沒有教案按鈕，不需要處理
    const templatesWithLessonPlan = ['today', 'tomorrow'];
    if (templatesWithLessonPlan.includes(mappedType)) {
      // 檢查是否為空或無效的教案連結
      const isEmptyLessonPlan = !variables.lessonPlanUrl || 
                                variables.lessonPlanUrl === '' || 
                                variables.lessonPlanUrl === 'https://example.com' ||
                                variables.lessonPlanUrl === 'https://example.com/';
      console.log(`🔍 [${templateType}] 檢查教案連結:`, {
        lessonPlanUrl: variables.lessonPlanUrl,
        isEmpty: isEmptyLessonPlan,
        courseName: variables.courseName
      });
      if (isEmptyLessonPlan) {
        console.log(`✂️ 準備移除空教案按鈕 - ${variables.courseName}`);
        this.removeEmptyLessonPlanButton(result);
      }
    }
    
    // 🔥 對學生提醒範本，檢查 googleMapsUrl，若為空則移除 footer（導航按鈕）
    const studentTemplates = ['student', 'studentExperience', 'studentSubstitute', 'studentTimeChange'];
    if (studentTemplates.includes(finalTemplateType) || studentTemplates.includes(mappedType)) {
      const isEmptyGoogleMapsUrl = !variables.googleMapsUrl || 
                                    variables.googleMapsUrl === '' || 
                                    variables.googleMapsUrl === 'https://maps.google.com';
      console.log(`🔍 [學生提醒] 檢查導航 URL:`, {
        googleMapsUrl: variables.googleMapsUrl,
        isEmpty: isEmptyGoogleMapsUrl,
        studentName: variables.studentName
      });
      if (isEmptyGoogleMapsUrl) {
        console.log(`✂️ 移除導航按鈕（無具體地址） - ${variables.studentName}`);
        // 直接刪除 footer
        if (result && result.footer) {
          delete result.footer;
        }
      }
    }
    
    return result;
  }
  
  // 移除空的教案按鈕
  removeEmptyLessonPlanButton(flexMessage) {
    if (!flexMessage || !flexMessage.footer || !flexMessage.footer.contents) {
      return;
    }
    
    // 過濾掉教案按鈕（label 包含 "教案"）
    flexMessage.footer.contents = flexMessage.footer.contents.filter(button => {
      if (button.action && button.action.label && button.action.label.includes('教案')) {
        console.log('🗑️ 移除空的教案按鈕');
        return false;
      }
      return true;
    });
    
    // 如果 footer 沒有內容了，移除整個 footer
    if (flexMessage.footer.contents.length === 0) {
      delete flexMessage.footer;
    }
  }

  // 🌟 移除空的特殊事件標記
  removeEmptySpecialEventBadge(flexMessage) {
    if (!flexMessage || !flexMessage.body || !flexMessage.body.contents) {
      return;
    }

    // 遞迴搜尋並移除空的特殊事件標記
    const removeEmptyBadgeFromContents = (contents) => {
      if (!Array.isArray(contents)) return;

      for (let i = contents.length - 1; i >= 0; i--) {
        const item = contents[i];
        
        // 檢查是否為包含特殊事件標記的 box
        if (item.type === 'box' && item.layout === 'horizontal' && item.contents) {
          // 過濾掉空的特殊事件標記
          item.contents = item.contents.filter(child => {
            if (child.type === 'text' && 
                (child.text === '' || child.backgroundColor === 'transparent')) {
              return false; // 移除空標記
            }
            return true;
          });

          // 如果 box 內只剩下一個元素（課程名稱），將 box 簡化為單一 text
          if (item.contents.length === 1 && item.contents[0].type === 'text') {
            const singleText = item.contents[0];
            // 保留原始的課程名稱文字設定
            singleText.margin = item.margin || singleText.margin;
            contents[i] = singleText;
          }
        }

        // 遞迴處理子元素
        if (item.contents) {
          removeEmptyBadgeFromContents(item.contents);
        }
      }
    };

    removeEmptyBadgeFromContents(flexMessage.body.contents);
  }

  // 建構 Carousel
  buildCarousel(events, templateType) {
    // ⚠️ 移除 enabled 檢查，只要有 events 就建構 carousel
    if (events.length === 0) {
      return null;
    }
    
    console.log(`🎠 [Carousel] 建構 ${events.length} 個 bubbles`);

    // 限制最大 bubble 數量
    const maxBubbles = this.flexTemplates.carousel?.maxBubbles || 10;
    const limitedEvents = events.slice(0, maxBubbles);

    if (limitedEvents.length === 1) {
      // 單一事件，返回單一 bubble
      return this.buildFlexMessage(templateType, limitedEvents[0]);
    }

    // 多個事件，建構 carousel
    const bubbles = limitedEvents.map(event => 
      this.buildFlexMessage(templateType, event)
    ).filter(bubble => bubble !== null);

    if (bubbles.length === 0) {
      return null;
    }

    return {
      type: 'carousel',
      contents: bubbles
    };
  }

  // 判斷特定提醒類型是否啟用 Quick Reply（優先使用 perType，再看總開關）
  isQuickReplyEnabledFor(type) {
    const qr = this.flexTemplates.quickReply || {};
    
    console.log('🔍 [Quick Reply] 檢查提醒類型:', type);
    console.log('🔍 [Quick Reply] 完整設定:', JSON.stringify(qr, null, 2));
    
    // 優先檢查 perType 設定
    if (qr.perType && typeof qr.perType[type] === 'boolean') {
      const result = qr.perType[type];
      console.log(`✅ [Quick Reply] 使用 perType[${type}] = ${result}`);
      return result;
    }
    
    // 沒有 perType 設定時，使用全域 enabled（預設僅學生提醒啟用）
    if (typeof qr.enabled === 'boolean') {
      const result = qr.enabled && type === 'student';
      console.log(`⚠️ [Quick Reply] 使用全域設定: enabled=${qr.enabled}, type=${type}, result=${result}`);
      return result;
    }
    
    // 完全沒設定時，預設僅學生提醒啟用
    const result = type === 'student';
    console.log(`⚠️ [Quick Reply] 使用預設值: type=${type}, result=${result}`);
    return result;
  }

  // 建構 Quick Reply（可傳入提醒類型 today|tomorrow|beforeClass|student）
  buildQuickReply(courseData, type = 'student') {
    console.log(`💬 [Quick Reply] buildQuickReply 被調用: type=${type}`);
    
    if (!this.isQuickReplyEnabledFor(type)) {
      console.log(`❌ [Quick Reply] 類型 ${type} 未啟用，返回 null`);
      return null;
    }

    console.log(`✅ [Quick Reply] 類型 ${type} 已啟用，開始建構按鈕`);
    const options = this.flexTemplates.quickReply.options || [];
    console.log(`💬 [Quick Reply] 選項數量: ${options.length}`);
    
    const items = options.map(option => {
      // ✅ 方案 1：先嘗試簡化版（使用短鍵名，移除冗長欄位）
      const dataObj = {
        action: 'attendance_reply',
        response: option.data,
        n: courseData.studentName,           // name -> n
        d: courseData.courseDate,            // date -> d
        t: courseData.courseTime || ''       // time -> t
        // ❌ 移除 courseName, location, weekday（可能太長，超過 300 字元）
      };
      
      let dataString = JSON.stringify(dataObj);
      
      // 檢查長度（LINE API 限制 300 字元）
      if (dataString.length > 300) {
        console.warn(`⚠️ [Quick Reply] data 長度超過限制: ${dataString.length} 字元，進一步簡化...`);
        
        // ✅ 方案 2：只保留最基本資訊
        const minimalDataObj = {
          action: 'attendance_reply',
          response: option.data,
          n: courseData.studentName
          // 只保留學生姓名和回應類型
        };
        
        dataString = JSON.stringify(minimalDataObj);
        console.log(`   最小化後長度: ${dataString.length} 字元`);
      } else {
        console.log(`✅ [Quick Reply] data 長度正常: ${dataString.length} 字元`);
      }
      
      return {
        type: 'action',
        action: {
          type: 'postback',
          label: option.label,
          data: dataString,
          displayText: option.label
        }
      };
    });

    console.log(`✅ [Quick Reply] 已建構 ${items.length} 個按鈕`);
    return {
      items: items
    };
  }

  // 建構多學生 Quick Reply（用於 Carousel - 一個家長多個孩子）
  buildMultiStudentQuickReply(studentsData, type = 'student') {
    console.log(`💬 [Multi-Student Quick Reply] buildMultiStudentQuickReply 被調用: type=${type}, 學生數=${studentsData.length}`);
    
    if (!this.isQuickReplyEnabledFor(type)) {
      console.log(`❌ [Multi-Student Quick Reply] 類型 ${type} 未啟用，返回 null`);
      return null;
    }

    if (!Array.isArray(studentsData) || studentsData.length === 0) {
      console.log(`❌ [Multi-Student Quick Reply] 無效的學生資料`);
      return null;
    }

    console.log(`✅ [Multi-Student Quick Reply] 類型 ${type} 已啟用，建構統一按鈕`);
    
    // 統一回覆按鈕（簡化版）
    const unifiedOptions = [
      {
        label: '✅ 全部會出席',
        data: 'attend_all',
        displayText: '✅ 全部會出席'
      },
      {
        label: '🏥 需要請假',
        data: 'leave_some',
        displayText: '🏥 需要請假'
      },
      {
        label: '⏳ 稍後確認',
        data: 'pending',
        displayText: '⏳ 稍後確認'
      }
    ];

    // ✅ 簡化學生資訊（LINE API 限制 postback data 最多 300 字元）
    // 使用極度簡化的字段名（n=name, d=date, t=time, c=course）
    const students = studentsData.map(student => ({
      n: student.studentName,      // name -> n
      d: student.courseDate,       // date -> d
      t: student.courseTime || '', // time -> t
      c: student.courseName || ''  // ✅ 添加 course -> c（請假流程需要）
      // ❌ 移除 location、weekday（節省空間）
    }));

    const items = unifiedOptions.map(option => {
      const dataObj = {
        action: 'multi_student_attendance_reply',
        response: option.data,
        count: studentsData.length,
        students: students  // ✅ 包含極簡學生陣列
      };
      
      const dataString = JSON.stringify(dataObj);
      
      // 檢查 data 長度（LINE API 限制 300 字元）
      if (dataString.length > 300) {
        console.warn(`⚠️ [Multi-Student Quick Reply] data 長度超過限制: ${dataString.length} 字元`);
        console.warn(`   進一步簡化：只保留學生姓名...`);
        
        // ✅ 方案 2：如果還是超過，只保留學生姓名陣列（最小化）
        const minimalDataObj = {
          action: 'multi_student_attendance_reply',
          response: option.data,
          count: studentsData.length,
          names: students.map(s => s.n),  // 只保留姓名陣列
          date: students[0]?.d || ''       // 假設所有課程同一天
        };
        
        const minimalDataString = JSON.stringify(minimalDataObj);
        console.log(`   最小化後長度: ${minimalDataString.length} 字元`);
        
        // ✅ 方案 3：如果連最小化都超過（極少發生），只保留必要資訊
        if (minimalDataString.length > 300) {
          console.error(`❌ [Multi-Student Quick Reply] 即使最小化仍超過限制！學生數=${studentsData.length}`);
          const fallbackDataObj = {
            action: 'multi_student_attendance_reply',
            response: option.data,
            count: studentsData.length
            // 完全不包含學生資料，只保留回應類型和數量
          };
          return {
            type: 'action',
            action: {
              type: 'postback',
              label: option.label,
              data: JSON.stringify(fallbackDataObj),
              displayText: option.label
            }
          };
        }
        
        return {
          type: 'action',
          action: {
            type: 'postback',
            label: option.label,
            data: minimalDataString,
            displayText: option.label
          }
        };
      }
      
      console.log(`✅ [Multi-Student Quick Reply] data 長度正常: ${dataString.length} 字元`);
      return {
        type: 'action',
        action: {
          type: 'postback',
          label: option.label,
          data: dataString,
          displayText: option.label
        }
      };
    });

    console.log(`✅ [Multi-Student Quick Reply] 已建構 ${items.length} 個統一按鈕（含學生陣列）`);
    return {
      items: items
    };
  }

  // 發送 LINE 訊息（支援文字、Flex Message 和 Quick Reply）
  async sendLineMessage(userId, message, options = {}) {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.log('⚠️ LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過訊息發送');
      return { success: false, error: 'LINE Token 未設定' };
    }

    // ✅ 驗證 User ID 格式
    // LINE User ID 格式：以 "U" 開頭（個人）或 "C" 開頭（群組），通常 33 字元
    const isValidUserId = userId && (
      (userId.startsWith('U') && userId.length === 33) ||
      (userId.startsWith('C') && userId.length >= 33)
    );
    
    // 測試 ID 或無效格式，跳過發送
    if (!isValidUserId || userId === 'local-test-user' || userId.startsWith('test-') || userId.startsWith('local-')) {
      console.log(`⚠️ 跳過發送給無效的 User ID: ${userId}`);
      console.log(`💡 提示：這是測試 ID 或無效格式，不會實際發送訊息`);
      console.log(`💡 有效的 LINE User ID 格式：以 "U" 開頭，33 個字元（例如：U1234567890abcdefghijklmnopqrstu）`);
      return { 
        success: false, 
        error: '無效的 User ID 格式',
        skipped: true,
        details: `User ID "${userId}" 不是有效的 LINE User ID 格式，已跳過發送`
      };
    }

    let requestBody; // 移到外層以便在 catch 塊中訪問
    
    try {
      let messagePayload;

      // 判斷訊息類型
      if (options.flexMessage) {
        // Flex Message
        messagePayload = {
          type: 'flex',
          altText: options.altText || message || '課程提醒',
          contents: options.flexMessage
        };
      } else if (typeof message === 'string') {
        // 文字訊息
        messagePayload = {
          type: 'text',
          text: message
        };
      } else {
        console.error('❌ 無效的訊息格式');
        return { success: false, error: '無效的訊息格式' };
      }

      requestBody = {
        to: userId,
        messages: [messagePayload]
      };

      // 添加 Quick Reply（如果有）
      if (options.quickReply) {
        console.log(`💬 [LINE API] 附加 Quick Reply 到訊息`);
        console.log(`💬 [LINE API] Quick Reply 內容:`, JSON.stringify(options.quickReply, null, 2));
        requestBody.messages[0].quickReply = options.quickReply;
      } else {
        console.log(`⚠️ [LINE API] 沒有 Quick Reply 需要附加`);
      }
      
      console.log(`📤 [LINE API] 最終請求體:`, JSON.stringify({
        to: userId,
        messageCount: requestBody.messages.length,
        messageType: requestBody.messages[0].type,
        hasQuickReply: !!requestBody.messages[0].quickReply
      }, null, 2));

      const response = await axios.post('https://api.line.me/v2/bot/message/push', requestBody, {
        headers: {
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: this.config.delivery_settings?.timeout_ms || 10000
      });

      console.log(`✅ 訊息已發送給 ${userId}`);
      return { success: true, response: response.data };
    } catch (error) {
      console.error(`❌ 發送訊息給 ${userId} 失敗:`, error.message);
      
      // ✅ 特別處理 401 認證錯誤
      if (error.response && error.response.status === 401) {
        console.error('🚨 LINE API 認證失敗 (401)');
        console.error('💡 可能原因：');
        console.error('   1. LINE Channel Access Token 已過期（通常有效期為 30 天）');
        console.error('   2. Token 設定錯誤或無效');
        console.error('   3. 環境變數 LINE_CHANNEL_ACCESS_TOKEN 未正確載入');
        console.error('💡 解決方案：');
        console.error('   1. 前往 LINE Developers Console (https://developers.line.biz/console/)');
        console.error('   2. 選擇您的 Provider 和 Channel');
        console.error('   3. 在 "Messaging API" 頁籤中，點擊 "Issue" 重新發行新的 Access Token');
        console.error('   4. 更新 .env.nas 檔案中的 LINE_CHANNEL_ACCESS_TOKEN');
        console.error('   5. 重啟 Docker 容器: docker-compose restart');
        
        if (error.response.data) {
          console.error('❌ LINE API 錯誤詳情:', JSON.stringify(error.response.data, null, 2));
        }
        
        return { 
          success: false, 
          error: 'LINE API 認證失敗 (401)',
          details: 'Access Token 可能已過期，請前往 LINE Developers Console 重新發行 Token 並更新環境變數'
        };
      }
      
      // ✅ 特別處理 400 請求錯誤（通常是參數格式錯誤）
      if (error.response && error.response.status === 400) {
        console.error('🚨 LINE API 請求格式錯誤 (400)');
        console.error('💡 可能原因：');
        console.error('   1. User ID 格式無效（應為 "U" 開頭，33 字元）');
        console.error('   2. 訊息內容格式不符合 LINE API 規範');
        console.error('   3. 請求體中缺少必要欄位或格式錯誤');
        console.error(`💡 當前 User ID: ${userId}`);
        console.error('💡 解決方案：');
        console.error('   1. 檢查 teacher_data.json 中的 userId 是否為有效的 LINE User ID');
        console.error('   2. 確認 User ID 格式：以 "U" 開頭，33 個字元');
        console.error('   3. 測試 ID（如 "local-test-user"）應替換為真實的 LINE User ID');
        console.error('   4. 可以從 LINE Developers Console 或透過 LINE Bot 取得真實 User ID');
        
        if (error.response.data) {
          console.error('❌ LINE API 錯誤詳情:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (requestBody) {
          console.error('❌ 發送的請求體:', JSON.stringify(requestBody, null, 2));
        }
        
        return { 
          success: false, 
          error: 'LINE API 請求格式錯誤 (400)',
          details: error.response.data?.message || '請求參數格式不正確，請檢查 User ID 和訊息格式'
        };
      }
      
      if (error.response && requestBody) {
        console.error('❌ LINE API 錯誤詳情:', JSON.stringify(error.response.data, null, 2));
        console.error('❌ 發送的請求體:', JSON.stringify(requestBody, null, 2));
      }
      return { success: false, error: error.message };
    }
  }

  // 建構「講師報表提交成功」Flex Message（giga）
  buildTeacherReportFlex(data = {}) {
    try {
      const {
        teacherName = '未知講師',
        courseName = '未知課程',
        time = '未知時間',
        date = '未知日期',
        studentCount = 0,
        courseContent = '（無內容）',
        mode = '講師模式',
        attendanceSummary = '無統計資料',
        teacherStatus = '已提交報表',
        presentNames = [],
        absentNames = [],
        unmarkedNames = []
      } = data;

      // 構建學生名單區塊（若有資料）
      const hasAnyList = (presentNames && presentNames.length) || (absentNames && absentNames.length) || (unmarkedNames && unmarkedNames.length);
      const listSection = hasAnyList ? {
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        spacing: 'sm',
        contents: [
          presentNames && presentNames.length ? {
            type: 'box', layout: 'vertical', backgroundColor: '#0b0b0c', cornerRadius: '8px', paddingAll: '6px', contents: [
              { type: 'text', text: `◆ 出席名單（${presentNames.length}）`, size: 'sm', color: '#d4af37', weight: 'bold' }
            ]
          } : null,
          presentNames && presentNames.length ? {
            type: 'text', text: presentNames.slice(0, 20).join('、') + (presentNames.length > 20 ? '…' : ''), wrap: true, size: 'sm', color: '#065f46'
          } : null,

          absentNames && absentNames.length ? {
            type: 'box', layout: 'vertical', backgroundColor: '#0b0b0c', cornerRadius: '8px', paddingAll: '6px', margin: 'sm', contents: [
              { type: 'text', text: `◆ 缺席名單（${absentNames.length}）`, size: 'sm', color: '#d4af37', weight: 'bold' }
            ]
          } : null,
          absentNames && absentNames.length ? {
            type: 'text', text: absentNames.slice(0, 20).join('、') + (absentNames.length > 20 ? '…' : ''), wrap: true, size: 'sm', color: '#7f1d1d'
          } : null,

          unmarkedNames && unmarkedNames.length ? {
            type: 'box', layout: 'vertical', backgroundColor: '#0b0b0c', cornerRadius: '8px', paddingAll: '6px', margin: 'sm', contents: [
              { type: 'text', text: `◆ 未選擇（${unmarkedNames.length}）`, size: 'sm', color: '#d4af37', weight: 'bold' }
            ]
          } : null,
          unmarkedNames && unmarkedNames.length ? {
            type: 'text', text: unmarkedNames.slice(0, 20).join('、') + (unmarkedNames.length > 20 ? '…' : ''), wrap: true, size: 'sm', color: '#374151'
          } : null
        ].filter(Boolean)
      } : null;

      // 圖像（logo）網址
      // 可靠的 logo 來源：環境變數優先，其次使用已確認可用的公開網址
      const logoUrl = (process.env.LINE_LOGO_URL && process.env.LINE_LOGO_URL.trim())
        || 'https://calendar.funlearnbar.synology.me/logo.jpg';

      const bubble = {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0b0b0c',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '提交成功', color: '#d4af37', size: 'lg', weight: 'bold' },
            { type: 'text', text: '講師報表', color: '#bfa76a', size: 'sm', margin: 'sm' },
            { type: 'image', url: logoUrl, size: 'xxs', aspectMode: 'cover', aspectRatio: '1:1', position: 'absolute', offsetEnd: '6px', offsetTop: '6px', gravity: 'top' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: `👨‍🏫 講師：${teacherName}`, size: 'md', weight: 'bold', color: '#111827' },
            { type: 'text', text: `📖 課程：${courseName}`, size: 'md', color: '#1f2937', wrap: true },
            { type: 'text', text: `⏰ 時間：${time}`, size: 'md', color: '#1f2937' },
            { type: 'text', text: `📅 日期：${date}`, size: 'md', color: '#1f2937' },
            { type: 'separator', margin: 'md', color: '#d4af37' },
            { type: 'text', text: `👥 學生人數：${studentCount} 人`, size: 'md', weight: 'bold', color: '#0f766e' },
            { type: 'text', text: `📝 課程內容：${String(courseContent).slice(0, 160)}`, wrap: true, size: 'sm', color: '#4b5563' },
            { type: 'text', text: `🔧 模式：${mode}`, size: 'sm', color: '#6b7280' },
            { type: 'text', text: `📊 出席統計：${attendanceSummary || '無統計資料'}`, wrap: true, size: 'sm', color: '#374151' },
            { type: 'text', text: `🧑‍🏫 講師簽到：${teacherStatus || '已提交報表'}`, size: 'sm', color: '#b45309' }
          ]
        }
      };

      if (listSection) {
        bubble.body.contents.push({ type: 'separator', margin: 'md', color: '#d4af37' });
        bubble.body.contents.push(listSection);
      }

      return bubble;
    } catch (e) {
      console.error('❌ 構建講師報表 Flex 失敗:', e);
      return null;
    }
  }

  // 發送講師報表 Flex Message（給對應講師）
  async sendTeacherReportFlexToTeacher(data) {
    const teacherUserId = this.getTeacherUserIdByName(data.teacherName);
    if (!teacherUserId) {
      console.warn('⚠️ 找不到講師 LINE User ID，跳過 Flex 發送:', data.teacherName);
      return { success: false, error: 'Teacher LINE ID not found' };
    }
    const flex = this.buildTeacherReportFlex(data);
    if (!flex) {
      return { success: false, error: 'Build flex failed' };
    }
    const altText = `📋 講師報表提交成功 - ${data.courseName}`;
    return await this.sendLineMessage(teacherUserId, '', { flexMessage: flex, altText });
  }

  // 發送講師報表 Flex 給管理員（優先群組ID，否則走管理員UserID）
  async sendTeacherReportFlexToAdmin(data) {
    const groupId = this.getAdminGroupId();
    const adminUserId = this.getAdminUserId();
    const targetId = groupId || adminUserId;
    if (!targetId) {
      return { success: false, error: 'Admin target not found' };
    }
    const flex = this.buildTeacherReportFlex(data);
    if (!flex) return { success: false, error: 'Build flex failed' };
    const altText = `📋 講師報表提交成功 - ${data.courseName}`;
    return await this.sendLineMessage(targetId, '', { flexMessage: flex, altText });
  }

  // 測試發送（僅發送給管理員）
  async sendTestMessage(message, options = {}) {
    const adminUserId = this.getAdminUserId();
    console.log('🧪 測試模式：僅發送給管理員', adminUserId);
    
    // 在訊息前加上測試標記
    let testMessage = message;
    if (typeof message === 'string') {
      testMessage = `[測試模式]\n${message}`;
    }
    
    const testOptions = { ...options };
    if (options.altText) {
      testOptions.altText = `[測試] ${options.altText}`;
    }
    
    return await this.sendLineMessage(adminUserId, testMessage, testOptions);
  }

  // 發送學生簽到通知
  async sendStudentAttendanceNotification(data) {
    const { teacherName, courseName, time, studentName, status, attendanceStats } = data;
    
    const notificationType = 'student_attendance';
    const settings = this.config.notification_settings[notificationType];
    
    if (!settings?.enabled) {
      console.log('⚠️ 學生簽到通知已停用');
      return { success: false, message: '通知已停用' };
    }

    const variables = {
      teacherName: teacherName || '未知講師',
      courseName: courseName || '未知課程',
      time: time || '未知時間',
      studentName: studentName || '未知學生',
      status: status === 'present' ? '出席' : '缺席',
      attendanceStats: attendanceStats || '無統計資料'
    };

    const results = [];

    // 發送給管理員 - 文字（保留）
    if (settings.send_to_admin) {
      const adminUserId = this.getAdminUserId();
      const adminTemplate = settings.message_template?.admin;
      if (adminTemplate) {
        const adminMessage = this.formatMessage(adminTemplate, variables);
        const adminResult = await this.sendLineMessage(adminUserId, adminMessage);
        results.push({ recipient: 'admin-text', userId: adminUserId, ...adminResult });
      }
      // 另外送 Flex（漂亮版）
      try {
        const flexData = {
          teacherName: variables.teacherName,
          courseName: variables.courseName,
          time: variables.time,
          date: variables.date,
          studentCount: variables.studentCount,
          courseContent: variables.courseContent,
          mode: variables.mode,
          attendanceSummary: data.attendanceSummary || data.attendanceStats || '無統計資料',
          teacherStatus: data.teacherStatus || '已提交報表'
        };
        const flexResultAdmin = await this.sendTeacherReportFlexToAdmin(flexData);
        results.push({ recipient: 'admin-flex', ...flexResultAdmin });
      } catch (e) {
        console.warn('⚠️ 發送管理員 Flex 失敗（不影響流程）:', e.message);
      }
    }

    // 發送給相關講師
    if (settings.send_to_teacher) {
      const teachers = this.getTeachersForCourse(courseName);
      const teacherTemplate = settings.message_template?.teacher;
      
      if (teacherTemplate) {
        for (const teacherName of teachers) {
          const teacherUserId = this.teacherData.teachers[teacherName];
          if (teacherUserId) {
            const teacherMessage = this.formatMessage(teacherTemplate, variables);
            const teacherResult = await this.sendLineMessage(teacherUserId, teacherMessage);
            results.push({ recipient: 'teacher', teacherName, userId: teacherUserId, ...teacherResult });
            
            // 批次延遲
            if (this.config.delivery_settings?.batch_delay_ms) {
              await new Promise(resolve => setTimeout(resolve, this.config.delivery_settings.batch_delay_ms));
            }
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`📊 學生簽到通知發送完成: ${successCount}/${totalCount} 成功`);

    return {
      success: successCount > 0,
      message: `已發送 ${successCount}/${totalCount} 個通知`,
      results: results
    };
  }

  // 發送講師報表通知
  async sendTeacherReportNotification(data) {
    const { teacherName, courseName, time, date, studentCount, courseContent, mode } = data;
    
    const notificationType = 'teacher_reports';
    const settings = this.config.notification_settings[notificationType];
    
    if (!settings?.enabled) {
      console.log('⚠️ 講師報表通知已停用');
      return { success: false, message: '通知已停用' };
    }

    // 根據模式調整學生人數顯示
    let displayStudentCount;
    if (mode === '助教模式' && (!studentCount || Number(studentCount) === 0)) {
      displayStudentCount = '未知';
    } else {
      const derivedCount = studentCount !== undefined && studentCount !== null
        ? studentCount
        : (Array.isArray(data.presentStudents) ? data.presentStudents.length : 0);
      displayStudentCount = derivedCount;
    }

    const variables = {
      teacherName: teacherName || '未知講師',
      courseName: courseName || '未知課程',
      time: time || '未知時間',
      date: date || '未知日期',
      studentCount: displayStudentCount,
      courseContent: courseContent || '無內容',
      mode: mode || '講師模式'
    };

    const results = [];

    // 管理員不再接收通知（依你的要求）

    // 發送 Flex 給對應講師（強制啟用）
    try {
        const flexData = {
          teacherName: variables.teacherName,
          courseName: variables.courseName,
          time: variables.time,
          date: variables.date,
          studentCount: variables.studentCount,
          courseContent: variables.courseContent,
          mode: variables.mode,
          attendanceSummary: data.attendanceSummary || data.attendanceStats || '無統計資料',
          teacherStatus: data.teacherStatus || '已提交報表',
          presentNames: data.presentStudents || [],
          absentNames: data.absentStudents || [],
          unmarkedNames: data.unmarkedStudents || []
        };
      const flexResult = await this.sendTeacherReportFlexToTeacher(flexData);
      results.push({ recipient: 'teacher-flex', ...flexResult });
    } catch (e) {
      console.warn('⚠️ 發送講師 Flex 失敗（不影響流程）:', e.message);
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`📊 講師報表通知發送完成: ${successCount}/${totalCount} 成功`);

    return {
      success: successCount > 0,
      message: `已發送 ${successCount}/${totalCount} 個通知`,
      results: results
    };
  }

  // 發送提醒通知
  async sendReminderNotification(data) {
    const { teacherName, courseName, time, date, message } = data;
    
    const notificationType = 'reminder_notifications';
    const settings = this.config.notification_settings[notificationType];
    
    if (!settings?.enabled) {
      console.log('⚠️ 提醒通知已停用');
      return { success: false, message: '通知已停用' };
    }

    const variables = {
      teacherName: teacherName || '未知講師',
      courseName: courseName || '未知課程',
      time: time || '未知時間',
      date: date || '未知日期',
      message: message || '無訊息'
    };

    const results = [];

    // 發送給管理員
    if (settings.send_to_admin) {
      const adminUserId = this.getAdminUserId();
      const adminTemplate = settings.message_template?.admin;
      if (adminTemplate) {
        const adminMessage = this.formatMessage(adminTemplate, variables);
        const adminResult = await this.sendLineMessage(adminUserId, adminMessage);
        results.push({ recipient: 'admin', userId: adminUserId, ...adminResult });
      }
    }

    // 發送給目標講師
    if (settings.send_to_teacher && teacherName) {
      const teacherUserId = this.teacherData.teachers[teacherName];
      if (teacherUserId) {
        const teacherTemplate = settings.message_template?.teacher;
        if (teacherTemplate) {
          const teacherMessage = this.formatMessage(teacherTemplate, variables);
          const teacherResult = await this.sendLineMessage(teacherUserId, teacherMessage);
          results.push({ recipient: 'teacher', teacherName, userId: teacherUserId, ...teacherResult });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`📊 提醒通知發送完成: ${successCount}/${totalCount} 成功`);

    return {
      success: successCount > 0,
      message: `已發送 ${successCount}/${totalCount} 個通知`,
      results: results
    };
  }

  // 獲取配置狀態
  getConfigStatus() {
    const lineConfig = this.config?.line || {};
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || lineConfig.channelAccessToken || '';
    const secret = process.env.LINE_CHANNEL_SECRET || lineConfig.channelSecret || '';
    const staffGroupId = lineConfig.staffGroupId || this.config?.roles?.admin?.group_id || 'C9cd9530405411fdd46de96f4e6cdecb7';

    return {
      config_loaded: !!this.config,
      teacher_data_loaded: !!this.teacherData,
      admin_user_id: this.getAdminUserId(),
      total_teachers: Object.keys(this.teacherData.teachers || {}).length,
      notification_types: Object.keys(this.config.notification_settings || {}),
      last_reload: new Date().toISOString(),
      line: {
        token_present: !!token,
        secret_present: !!secret,
        staff_group_id: staffGroupId
      }
    };
  }
}

module.exports = NotificationManager;
