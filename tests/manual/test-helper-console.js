/**
 * 🧪 特殊事件標記測試 - Console 輔助工具
 * 
 * 使用方式：
 * 1. 打開 Admin Dashboard: http://calendar.funlearnbar.synology.me/admin-dashboard.html
 * 2. 打開 Console (Cmd+Option+J 或 F12)
 * 3. 複製此檔案內容並貼上執行
 * 4. 使用以下輔助函數進行測試
 */

window.SpecialEventTestHelper = {
  
  /**
   * 📋 列出所有課程
   */
  listAllEvents() {
    if (!window.adminAllEvents || adminAllEvents.length === 0) {
      console.log('⚠️ 尚未載入課程，請稍候...');
      return;
    }
    
    console.log(`\n📚 共 ${adminAllEvents.length} 個課程：\n`);
    adminAllEvents.forEach((event, index) => {
      const markers = this.getEventMarkers(event);
      const markerStr = markers.length > 0 ? `[${markers.join(', ')}]` : '';
      console.log(`${index + 1}. ${event.title} ${markerStr}`);
      console.log(`   時間: ${event.dtstart || 'N/A'} - ${event.dtend || 'N/A'}`);
      console.log(`   ID: ${event.id}`);
      console.log('');
    });
  },

  /**
   * 🔍 查找特定課程
   */
  findEvent(keyword) {
    if (!window.adminAllEvents) {
      console.log('⚠️ 尚未載入課程');
      return null;
    }
    
    const event = adminAllEvents.find(e => 
      e.title.includes(keyword) || 
      (e.description && e.description.includes(keyword))
    );
    
    if (!event) {
      console.log(`❌ 找不到包含「${keyword}」的課程`);
      return null;
    }
    
    this.showEventDetail(event);
    return event;
  },

  /**
   * 📋 顯示課程詳細資訊
   */
  showEventDetail(event) {
    console.log('\n📋 課程詳細資訊：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏷️  標題: ${event.title}`);
    console.log(`🆔  ID: ${event.id}`);
    console.log(`⏰  時間: ${event.dtstart || 'N/A'} - ${event.dtend || 'N/A'}`);
    console.log(`👨‍🏫 講師: ${event.instructor || 'N/A'}`);
    console.log(`📅  日曆: ${event.calendarId || event.cal_id || 'N/A'}`);
    console.log(`\n📝 描述:\n${event.description || '(無描述)'}`);
    
    const markers = this.getEventMarkers(event);
    if (markers.length > 0) {
      console.log(`\n🏷️  檢測到的標記: ${markers.join(', ')}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },

  /**
   * 🏷️ 提取課程的所有標記
   */
  getEventMarkers(event) {
    const markers = [];
    const specialMarkers = ['停課', '體驗', '代課', '改時間', '公告', '調課', '延後', '提前'];
    
    specialMarkers.forEach(marker => {
      if (event.title.includes(`[${marker}]`) || event.title.includes(marker)) {
        markers.push(marker);
      }
    });
    
    return markers;
  },

  /**
   * ✅ 驗證原始描述是否保留
   */
  verifyDescriptionPreserved(eventKeyword, originalDescription) {
    const event = adminAllEvents.find(e => e.title.includes(eventKeyword));
    if (!event) {
      console.log(`❌ 找不到課程: ${eventKeyword}`);
      return false;
    }
    
    const currentDesc = event.description || '';
    const hasOriginal = currentDesc.includes(originalDescription);
    
    console.log('\n🔍 描述保留驗證：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 課程: ${event.title}`);
    console.log(`\n📝 當前描述:\n${currentDesc}`);
    console.log(`\n🎯 期望包含:\n${originalDescription}`);
    console.log(`\n結果: ${hasOriginal ? '✅ 保留完整' : '❌ 內容丟失'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return hasOriginal;
  },

  /**
   * 🧪 測試案例 1.1：停課標記
   */
  test_1_1_停課標記() {
    console.log('\n🧪 執行測試案例 1.1：停課標記');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 請手動執行以下步驟：');
    console.log('1. 找到「【測試】SPIKE 基礎班」課程');
    console.log('2. 點擊課程卡片');
    console.log('3. 勾選「停課」標記');
    console.log('4. 點擊「確認標記」');
    console.log('5. 確認預覽彈窗');
    console.log('\n執行完成後，使用以下命令驗證：');
    console.log('SpecialEventTestHelper.verify_1_1()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },

  /**
   * ✅ 驗證測試案例 1.1
   */
  verify_1_1() {
    console.log('\n✅ 驗證測試案例 1.1：停課標記');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const event = adminAllEvents.find(e => e.title.includes('SPIKE'));
    if (!event) {
      console.log('❌ 找不到 SPIKE 課程');
      return;
    }
    
    const checks = {
      '標題包含 [停課]': event.title.includes('[停課]'),
      '原始標題保留': event.title.includes('SPIKE 基礎班'),
      '描述保留原始內容': event.description && event.description.includes('原始描述內容'),
      '課程有紅色樣式': this.checkEventStyle(event, 'red')
    };
    
    console.log('檢查項目：');
    Object.entries(checks).forEach(([name, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n測試結果: ${allPassed ? '✅ 通過' : '❌ 失敗'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this.showEventDetail(event);
    return allPassed;
  },

  /**
   * 🎨 檢查課程樣式
   */
  checkEventStyle(event, expectedColor) {
    // 這裡只能檢查標記，實際樣式需要在 UI 中目視確認
    const markers = this.getEventMarkers(event);
    const colorMap = {
      'red': ['停課'],
      'green': ['體驗'],
      'blue': ['代課'],
      'orange': ['改時間', '調課', '延後', '提前'],
      'purple': ['公告']
    };
    
    const expectedMarkers = colorMap[expectedColor] || [];
    return markers.some(m => expectedMarkers.includes(m));
  },

  /**
   * 🧪 測試案例 1.3A：代課標記
   */
  test_1_3A_代課標記() {
    console.log('\n🧪 執行測試案例 1.3A：代課標記');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 請手動執行以下步驟：');
    console.log('1. 找到「【測試】Minecraft 程式班」課程');
    console.log('2. 記錄原授課講師');
    console.log('3. 勾選「代課」標記');
    console.log('4. 選擇不同的代課講師');
    console.log('5. 輸入備註：「原講師請假」');
    console.log('6. 確認標記');
    console.log('\n執行完成後，使用以下命令驗證：');
    console.log('SpecialEventTestHelper.verify_1_3A()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },

  /**
   * ✅ 驗證測試案例 1.3A
   */
  verify_1_3A() {
    console.log('\n✅ 驗證測試案例 1.3A：代課標記');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const event = adminAllEvents.find(e => e.title.includes('Minecraft'));
    if (!event) {
      console.log('❌ 找不到 Minecraft 課程');
      return;
    }
    
    const checks = {
      '標題包含 [代課]': event.title.includes('[代課]'),
      '描述包含代課講師': event.description && (
        event.description.includes('[代課講師]') ||
        event.description.includes('代課：')
      ),
      '描述包含備註': event.description && event.description.includes('原講師請假'),
      '課程有藍色樣式': this.checkEventStyle(event, 'blue')
    };
    
    console.log('檢查項目：');
    Object.entries(checks).forEach(([name, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n測試結果: ${allPassed ? '✅ 通過' : '❌ 失敗'}`);
    console.log('\n⚠️ 請手動確認：');
    console.log('- 課程是否移動到代課講師的日曆');
    console.log('- 原講師日曆中該課程是否消失');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this.showEventDetail(event);
    return allPassed;
  },

  /**
   * 🧪 測試案例 5.5：描述保留測試（最關鍵）
   */
  test_5_5_描述保留() {
    console.log('\n🧪 執行測試案例 5.5：描述保留測試（最關鍵）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const event = adminAllEvents.find(e => e.title.includes('Scratch'));
    if (!event) {
      console.log('❌ 找不到 Scratch 課程');
      return;
    }
    
    // 記錄原始描述
    const originalDesc = `豐富的描述內容，包含：
- 特殊字元 !@#$%
- 多行文字
- 空行測試`;
    
    console.log('📝 測試步驟：');
    console.log('步驟 1: 添加「體驗」標記');
    console.log('  → 驗證: SpecialEventTestHelper.verify_5_5_step1()');
    console.log('');
    console.log('步驟 2: 增量添加「公告」標記');
    console.log('  → 切換到「增量模式」');
    console.log('  → 勾選「公告」，輸入：「測試公告內容」');
    console.log('  → 驗證: SpecialEventTestHelper.verify_5_5_step2()');
    console.log('');
    console.log('步驟 3: 移除「公告」標記');
    console.log('  → 驗證: SpecialEventTestHelper.verify_5_5_step3()');
    console.log('');
    console.log('步驟 4: 移除「體驗」標記');
    console.log('  → 驗證: SpecialEventTestHelper.verify_5_5_step4()');
    console.log('');
    console.log('最終驗證: SpecialEventTestHelper.verify_5_5_final()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 儲存原始描述供後續驗證
    window._testOriginalDesc = originalDesc;
  },

  verify_5_5_step1() {
    return this.verifyDescriptionPreserved('Scratch', window._testOriginalDesc || '豐富的描述內容');
  },

  verify_5_5_step2() {
    const hasOriginal = this.verifyDescriptionPreserved('Scratch', window._testOriginalDesc || '豐富的描述內容');
    const event = adminAllEvents.find(e => e.title.includes('Scratch'));
    const hasAnnouncement = event?.description?.includes('測試公告內容');
    console.log(`${hasAnnouncement ? '✅' : '❌'} 包含公告內容`);
    return hasOriginal && hasAnnouncement;
  },

  verify_5_5_step3() {
    const hasOriginal = this.verifyDescriptionPreserved('Scratch', window._testOriginalDesc || '豐富的描述內容');
    const event = adminAllEvents.find(e => e.title.includes('Scratch'));
    const noAnnouncement = !event?.description?.includes('測試公告內容');
    console.log(`${noAnnouncement ? '✅' : '❌'} 公告已移除`);
    return hasOriginal && noAnnouncement;
  },

  verify_5_5_step4() {
    const event = adminAllEvents.find(e => e.title.includes('Scratch'));
    const noMarkers = !event?.title.includes('[體驗]');
    console.log(`${noMarkers ? '✅' : '❌'} 所有標記已移除`);
    return this.verifyDescriptionPreserved('Scratch', window._testOriginalDesc || '豐富的描述內容') && noMarkers;
  },

  verify_5_5_final() {
    console.log('\n🎯 最終驗證：描述完全恢復');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const event = adminAllEvents.find(e => e.title.includes('Scratch'));
    if (!event) {
      console.log('❌ 找不到課程');
      return false;
    }
    
    const originalDesc = window._testOriginalDesc || '豐富的描述內容';
    const currentDesc = (event.description || '').trim();
    
    // 完全一致性檢查
    const isExactMatch = currentDesc === originalDesc;
    const containsOriginal = currentDesc.includes(originalDesc);
    
    console.log('📋 原始描述:');
    console.log(originalDesc);
    console.log('\n📋 當前描述:');
    console.log(currentDesc);
    console.log('\n檢查結果:');
    console.log(`${isExactMatch ? '✅' : '⚠️'} 完全一致: ${isExactMatch}`);
    console.log(`${containsOriginal ? '✅' : '❌'} 包含原始內容: ${containsOriginal}`);
    
    if (!isExactMatch && containsOriginal) {
      console.log('\n⚠️ 描述包含原始內容但有額外內容，請檢查是否為預期行為');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return containsOriginal;
  },

  /**
   * 📊 執行所有基礎測試
   */
  runAllBasicTests() {
    console.log('\n🚀 開始執行所有基礎測試');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️ 請注意：測試需要手動執行操作');
    console.log('此工具提供測試步驟指引和結果驗證\n');
    
    this.listAllEvents();
    
    console.log('\n📋 測試清單：');
    console.log('1. SpecialEventTestHelper.test_1_1_停課標記()');
    console.log('2. SpecialEventTestHelper.test_1_3A_代課標記()');
    console.log('3. SpecialEventTestHelper.test_5_5_描述保留()');
    console.log('\n執行順序：執行測試 → 手動操作 → 執行驗證');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },

  /**
   * 📖 顯示幫助資訊
   */
  help() {
    console.log('\n📖 特殊事件測試輔助工具 - 使用說明');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('基礎功能：');
    console.log('  .listAllEvents()         - 列出所有課程');
    console.log('  .findEvent("關鍵字")     - 查找特定課程');
    console.log('  .showEventDetail(event)  - 顯示課程詳細資訊');
    console.log('');
    console.log('測試執行：');
    console.log('  .runAllBasicTests()      - 開始所有基礎測試');
    console.log('  .test_1_1_停課標記()     - 測試停課標記');
    console.log('  .test_1_3A_代課標記()    - 測試代課標記');
    console.log('  .test_5_5_描述保留()     - 測試描述保留（關鍵）');
    console.log('');
    console.log('結果驗證：');
    console.log('  .verify_1_1()            - 驗證停課標記');
    console.log('  .verify_1_3A()           - 驗證代課標記');
    console.log('  .verify_5_5_step1()      - 驗證描述保留-步驟1');
    console.log('  .verify_5_5_final()      - 驗證描述保留-最終');
    console.log('');
    console.log('輔助工具：');
    console.log('  .verifyDescriptionPreserved("關鍵字", "原始描述")');
    console.log('  .getEventMarkers(event)  - 提取課程標記');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
};

// 自動顯示歡迎訊息
console.log('\n✅ 特殊事件測試輔助工具已載入！');
console.log('💡 輸入 SpecialEventTestHelper.help() 查看使用說明');
console.log('🚀 輸入 SpecialEventTestHelper.runAllBasicTests() 開始測試\n');
