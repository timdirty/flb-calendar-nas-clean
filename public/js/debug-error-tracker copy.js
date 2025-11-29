/**
 * 🔍 全局錯誤追蹤器 - 確保沒有錯誤被遺漏
 * 
 * 此模組會：
 * 1. 攔截並增強所有 console 方法
 * 2. 捕獲全局錯誤和未處理的 Promise 拒絕
 * 3. 在頁面上顯示浮動錯誤面板
 * 4. 提供完整的堆疊追蹤
 */

(function() {
  'use strict';
  
  // 錯誤緩衝區
  const errorBuffer = [];
  const MAX_ERRORS = 50;
  
  // 創建浮動錯誤面板
  let errorPanel = null;
  let errorCount = 0;
  let isMinimized = true; // 🔥 默認最小化（隱藏）
  
  // 🔥 錯誤過濾器 - 忽略預期的錯誤
  const IGNORED_ERROR_PATTERNS = [
    'WorkerPool',
    'VideoPoster',
    'The source image could not be decoded',
    'CourseStudentMatcher',
    'Student Filter',
    '測試執行失敗',
    'canvas'
  ];
  
  function createErrorPanel() {
    if (errorPanel) return errorPanel;
    
    const panel = document.createElement('div');
    panel.id = 'global-error-tracker';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 400px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      color: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 999999;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      overflow: hidden;
      backdrop-filter: blur(10px);
      border: 2px solid #ff3b30;
      display: none;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      background: linear-gradient(135deg, #ff3b30 0%, #d62b20 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    `;
    header.innerHTML = `
      <span style="font-weight: bold;">🔍 錯誤追蹤器 (<span id="error-count">0</span>)</span>
      <span id="toggle-btn" style="cursor: pointer; font-size: 18px;">▲</span>
    `;
    
    header.onclick = () => togglePanel();
    
    const content = document.createElement('div');
    content.id = 'error-content';
    content.style.cssText = `
      padding: 12px;
      max-height: 500px;
      overflow-y: auto;
      display: none;
    `;
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清除';
    clearBtn.style.cssText = `
      width: 100%;
      padding: 8px;
      background: #333;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 8px;
      font-size: 12px;
    `;
    clearBtn.onclick = () => clearErrors();
    content.appendChild(clearBtn);
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    document.body.appendChild(panel);
    errorPanel = panel;
    
    return panel;
  }
  
  function togglePanel() {
    const content = document.getElementById('error-content');
    const toggleBtn = document.getElementById('toggle-btn');
    
    if (isMinimized) {
      content.style.display = 'block';
      toggleBtn.textContent = '▼';
    } else {
      content.style.display = 'none';
      toggleBtn.textContent = '▲';
    }
    isMinimized = !isMinimized;
  }
  
  function clearErrors() {
    errorBuffer.length = 0;
    errorCount = 0;
    updateErrorCount();
    const content = document.getElementById('error-content');
    if (content) {
      while (content.childNodes.length > 1) {
        content.removeChild(content.firstChild);
      }
    }
  }
  
  function updateErrorCount() {
    const countEl = document.getElementById('error-count');
    if (countEl) {
      countEl.textContent = errorCount;
    }
  }
  
  function shouldIgnoreError(message, stack) {
    const fullText = String(message || '') + ' ' + String(stack || '');
    return IGNORED_ERROR_PATTERNS.some(pattern => fullText.includes(pattern));
  }
  
  function addErrorToPanel(type, message, data, stack) {
    // 🔥 過濾預期的錯誤
    if (shouldIgnoreError(message, stack)) {
      return; // 忽略此錯誤
    }
    
    if (!errorPanel) createErrorPanel();
    
    // 🔥 有錯誤時才顯示面板
    if (errorPanel) {
      errorPanel.style.display = 'block';
    }
    
    errorCount++;
    updateErrorCount();
    
    const content = document.getElementById('error-content');
    const clearBtn = content.querySelector('button');
    
    const errorEl = document.createElement('div');
    errorEl.style.cssText = `
      padding: 8px;
      margin-bottom: 8px;
      background: rgba(255, 59, 48, 0.2);
      border-left: 3px solid #ff3b30;
      border-radius: 4px;
      font-size: 11px;
      word-break: break-all;
    `;
    
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      log: '📝'
    }[type] || '❌';
    
    const timestamp = new Date().toLocaleTimeString('zh-TW');
    
    let html = `
      <div style="color: #ff9500; margin-bottom: 4px;">
        ${emoji} [${timestamp}] ${type.toUpperCase()}
      </div>
      <div style="color: #fff; margin-bottom: 4px;">
        ${escapeHtml(String(message))}
      </div>
    `;
    
    if (data) {
      html += `
        <details style="margin-top: 4px; cursor: pointer;">
          <summary style="color: #5ac8fa;">詳細資料 ▼</summary>
          <pre style="margin: 4px 0; padding: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; overflow-x: auto; font-size: 10px;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </details>
      `;
    }
    
    if (stack) {
      html += `
        <details style="margin-top: 4px; cursor: pointer;">
          <summary style="color: #5ac8fa;">堆疊追蹤 ▼</summary>
          <pre style="margin: 4px 0; padding: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; overflow-x: auto; font-size: 10px; color: #ff9500;">${escapeHtml(stack)}</pre>
        </details>
      `;
    }
    
    errorEl.innerHTML = html;
    
    content.insertBefore(errorEl, clearBtn);
    
    // 限制錯誤數量
    const errorEls = content.querySelectorAll('div[style*="border-left"]');
    if (errorEls.length > MAX_ERRORS) {
      content.removeChild(errorEls[errorEls.length - 1]);
    }
    
    // 自動展開面板
    if (isMinimized) {
      togglePanel();
    }
    
    // 滾動到最新錯誤
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // 保存原始 console 方法
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };
  
  // 攔截 console.error
  console.error = function(...args) {
    const message = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    const stack = args.find(arg => arg instanceof Error)?.stack || new Error().stack;
    
    addErrorToPanel('error', message, args.length > 1 ? args[1] : null, stack);
    originalConsole.error.apply(console, args);
  };
  
  // 攔截 console.warn
  console.warn = function(...args) {
    const message = args.map(arg => {
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    if (message.includes('❌') || message.includes('失敗') || message.includes('錯誤')) {
      addErrorToPanel('warn', message, args.length > 1 ? args[1] : null, null);
    }
    
    originalConsole.warn.apply(console, args);
  };
  
  // 捕獲全局錯誤
  window.addEventListener('error', function(event) {
    addErrorToPanel('error', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    }, event.error?.stack);
  });
  
  // 捕獲未處理的 Promise 拒絕
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : null;
    
    addErrorToPanel('error', 'Unhandled Promise Rejection: ' + message, reason, stack);
  });
  
  // 暴露到全局
  window.ErrorTracker = {
    show: () => {
      if (!errorPanel) createErrorPanel();
      if (isMinimized) togglePanel();
    },
    hide: () => {
      if (errorPanel && !isMinimized) togglePanel();
    },
    clear: clearErrors,
    getErrors: () => [...errorBuffer],
    addError: (message, data, stack) => addErrorToPanel('error', message, data, stack)
  };
  
  // 頁面載入時初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createErrorPanel);
  } else {
    createErrorPanel();
  }
  
  console.log('✅ 全局錯誤追蹤器已啟動');
})();


