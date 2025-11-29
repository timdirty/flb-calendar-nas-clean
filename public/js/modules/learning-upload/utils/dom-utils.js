/**
 * 學習歷程上傳系統 - DOM 操作優化工具
 * 提供高效的 DOM 操作、事件委派、查詢快取等功能
 */

(function (global) {
  'use strict';

  // ============================================
  // DOM 查詢快取
  // ============================================
  class DOMCache {
    constructor() {
      this.cache = new Map();
      this.observer = null;
      this.setupObserver();
    }

    /**
     * 設置 MutationObserver 監聽 DOM 變化，自動清理快取
     */
    setupObserver() {
      if (typeof MutationObserver !== 'undefined') {
        this.observer = new MutationObserver(() => {
          // DOM 結構變化時清理快取
          this.clear();
        });
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }

    /**
     * 獲取元素（帶快取）
     */
    get(selector, forceRefresh) {
      if (forceRefresh || !this.cache.has(selector)) {
        const element = document.querySelector(selector);
        if (element) {
          this.cache.set(selector, element);
        }
        return element;
      }
      const cached = this.cache.get(selector);
      // 驗證快取元素是否仍然在 DOM 中
      if (cached && cached.isConnected) {
        return cached;
      }
      // 元素已移除，重新查詢
      this.cache.delete(selector);
      return this.get(selector, true);
    }

    /**
     * 獲取多個元素（帶快取）
     */
    getAll(selector, forceRefresh) {
      const cacheKey = `all:${selector}`;
      if (forceRefresh || !this.cache.has(cacheKey)) {
        const elements = Array.from(document.querySelectorAll(selector));
        this.cache.set(cacheKey, elements);
        return elements;
      }
      return this.cache.get(cacheKey);
    }

    /**
     * 清除快取
     */
    clear(selector) {
      if (selector) {
        this.cache.delete(selector);
        this.cache.delete(`all:${selector}`);
      } else {
        this.cache.clear();
      }
    }

    /**
     * 清理資源
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.clear();
    }
  }

  // ============================================
  // DOM 操作工具
  // ============================================
  class DOMUtils {
    constructor() {
      this.cache = new DOMCache();
    }

    /**
     * 批量創建元素（使用 DocumentFragment）
     */
    createElements(elements) {
      const fragment = document.createDocumentFragment();
      
      elements.forEach(config => {
        const element = this.createElement(config);
        if (element) {
          fragment.appendChild(element);
        }
      });
      
      return fragment;
    }

    /**
     * 創建單個元素
     */
    createElement(config) {
      const {
        tag = 'div',
        className = '',
        id = '',
        text = '',
        html = '',
        attributes = {},
        children = [],
        events = {}
      } = config;

      const element = document.createElement(tag);
      
      if (className) element.className = className;
      if (id) element.id = id;
      if (text) element.textContent = text;
      if (html) element.innerHTML = html;
      
      // 設置屬性
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      
      // 添加子元素
      children.forEach(child => {
        const childElement = this.createElement(child);
        if (childElement) {
          element.appendChild(childElement);
        }
      });
      
      // 綁定事件
      Object.entries(events).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
      });
      
      return element;
    }

    /**
     * 批量更新 DOM（減少重排）
     */
    batchUpdate(container, updates) {
      // 使用 requestAnimationFrame 批量更新
      requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        
        updates.forEach(update => {
          if (update.type === 'append') {
            fragment.appendChild(update.element);
          } else if (update.type === 'remove') {
            const element = this.cache.get(update.selector);
            if (element && element.parentNode) {
              element.parentNode.removeChild(element);
            }
          } else if (update.type === 'replace') {
            const oldElement = this.cache.get(update.selector);
            if (oldElement && oldElement.parentNode) {
              oldElement.parentNode.replaceChild(update.element, oldElement);
            }
          } else if (update.type === 'update') {
            const element = this.cache.get(update.selector);
            if (element) {
              Object.entries(update.props || {}).forEach(([key, value]) => {
                if (key === 'text') {
                  element.textContent = value;
                } else if (key === 'html') {
                  element.innerHTML = value;
                } else if (key === 'class') {
                  element.className = value;
                } else {
                  element.setAttribute(key, value);
                }
              });
            }
          }
        });
        
        if (fragment.hasChildNodes()) {
          container.appendChild(fragment);
        }
        
        // 清除相關快取
        updates.forEach(update => {
          if (update.selector) {
            this.cache.clear(update.selector);
          }
        });
      });
    }

    /**
     * 事件委派管理器
     */
    createEventDelegate(container, eventMap) {
      const handler = (event) => {
        const target = event.target;
        if (!target) return;
        
        // 查找匹配的選擇器和處理函數
        for (const [selector, callback] of Object.entries(eventMap)) {
          if (target.matches(selector) || target.closest(selector)) {
            const matchedElement = target.matches(selector) ? target : target.closest(selector);
            callback.call(matchedElement, event, matchedElement);
            break;
          }
        }
      };
      
      // 綁定所有事件類型
      const eventTypes = new Set();
      Object.keys(eventMap).forEach(selector => {
        // 從選擇器推斷事件類型（可改進）
      });
      
      // 預設綁定常見事件
      ['click', 'change', 'input'].forEach(eventType => {
        container.addEventListener(eventType, handler);
      });
      
      return {
        destroy: () => {
          ['click', 'change', 'input'].forEach(eventType => {
            container.removeEventListener(eventType, handler);
          });
        }
      };
    }

    /**
     * 獲取元素（帶快取）
     */
    $(selector, forceRefresh) {
      return this.cache.get(selector, forceRefresh);
    }

    /**
     * 獲取多個元素（帶快取）
     */
    $$(selector, forceRefresh) {
      return this.cache.getAll(selector, forceRefresh);
    }

    /**
     * 安全設置 innerHTML（使用 DocumentFragment）
     */
    safeSetHTML(element, html) {
      if (!element) return;
      
      const fragment = document.createDocumentFragment();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      
      element.innerHTML = '';
      element.appendChild(fragment);
    }

    /**
     * 清理資源
     */
    destroy() {
      this.cache.destroy();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const domUtils = new DOMUtils();
  global.LearningUploadDOM = domUtils;

})(window);
