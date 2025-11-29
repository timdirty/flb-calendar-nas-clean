// ============================================
// 全文搜尋管理器模組
// ============================================
// 版本：2025-01-16-SEARCH-FEATURE
// 功能：全文搜尋、搜尋建議、搜尋歷史

(function() {
    'use strict';
    
    console.log('🔍 載入搜尋管理器模組...');
    
    /**
     * 搜尋管理器類別
     */
    class SearchManager {
        constructor() {
            this.searchInput = null;
            this.searchClearBtn = null;
            this.searchSuggestions = null;
            this.searchStats = null;
            this.searchCount = null;
            this.searchNavigation = null;
            this.searchPrevBtn = null;
            this.searchNextBtn = null;
            this.searchCurrentIndex = null;
            this.manualNavigation = false;
            
            // 搜尋歷史記錄 (儲存在 localStorage)
            this.searchHistory = this.loadSearchHistory();
            
            // 搜尋結果快取
            this.searchResults = [];
            this.currentResultIndex = 0;
            
            // 防抖計時器
            this.debounceTimer = null;
            
            // 搜尋回調函數
            this.onSearchCallback = null;
            
            // 高亮回調函數
            this.onHighlightCallback = null;

            // 建議列表狀態
            this.suggestionItems = [];
            this.activeSuggestionIndex = -1;
            this.latestSuggestions = [];
            this.hideSuggestionsTimer = null;
            this.suggestionRenderCount = 0;
            this.suggestionIdPrefix = `search-suggestion-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            console.log('✅ 搜尋管理器初始化完成');
        }
        
        /**
         * 初始化搜尋功能
         * @param {Function} onSearch - 搜尋結果回調函數
         * @param {Function} onHighlight - 高亮顯示回調函數
         */
        init(onSearch, onHighlight) {
            this.onSearchCallback = onSearch;
            this.onHighlightCallback = onHighlight;
            
            // 取得 DOM 元素
            this.searchInput = document.getElementById('globalSearch');
            this.searchClearBtn = document.getElementById('searchClearBtn');
            this.searchSuggestions = document.getElementById('searchSuggestions');
            this.searchStats = document.getElementById('searchStats');
            this.searchCount = document.getElementById('searchCount');
            this.searchNavigation = document.getElementById('searchNavigation');
            this.searchPrevBtn = document.getElementById('searchPrevBtn');
            this.searchNextBtn = document.getElementById('searchNextBtn');
            this.searchCurrentIndex = document.getElementById('searchCurrentIndex');
            
            if (!this.searchInput) {
                console.warn('⚠️ 找不到搜尋輸入框');
                return;
            }
            
            // 綁定事件
            this.bindEvents();
            
            console.log('✅ 搜尋功能已啟用');
        }
        
        /**
         * 綁定事件監聽器
         */
        bindEvents() {
            console.log('🔗 開始綁定搜尋事件監聽器');
            
            // 輸入事件 (使用防抖)
            this.searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                console.log('📝 搜尋輸入:', query);
                
                // 顯示/隱藏清除按鈕
                if (query) {
                    if (this.searchClearBtn) {
                        this.searchClearBtn.style.display = 'flex';
                    }
                } else {
                    if (this.searchClearBtn) {
                        this.searchClearBtn.style.display = 'none';
                    }
                    this.hideSuggestions();
                    this.hideStats();
                    this.latestSuggestions = [];
                    this.clearActiveSuggestion();
                }
                
                // 防抖搜尋
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.performSearch(query);
                }, 300);
            });
            
            // 焦點事件 (顯示建議)
            this.searchInput.addEventListener('focus', () => {
                this.clearHideSuggestionsTimer();
                const query = this.searchInput.value.trim();
                if (query) {
                    this.showSuggestions();
                }
            });
            
            // 失焦事件 (延遲隱藏建議,讓點擊建議有時間執行)
            this.searchInput.addEventListener('blur', () => {
                this.hideSuggestionsTimer = setTimeout(() => {
                    this.hideSuggestions();
                }, 200);
            });
            
            // 清除按鈕點擊事件
            if (this.searchClearBtn) {
                this.searchClearBtn.addEventListener('click', () => {
                    this.clearSearch();
                });
            }
            
            // ESC 鍵清除搜尋
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                    return;
                }
                
                if (e.key === 'ArrowDown') {
                    if (!this.hasVisibleSuggestions()) {
                        this.showSuggestions();
                    }
                    
                    if (this.suggestionItems.length > 0) {
                        e.preventDefault();
                        if (this.activeSuggestionIndex === -1) {
                            this.setActiveSuggestion(0);
                        } else {
                            this.moveSuggestionFocus(1);
                        }
                    }
                } else if (e.key === 'ArrowUp') {
                    if (!this.hasVisibleSuggestions()) {
                        return;
                    }
                    
                    if (this.suggestionItems.length > 0) {
                        e.preventDefault();
                        if (this.activeSuggestionIndex === -1) {
                            this.setActiveSuggestion(this.suggestionItems.length - 1);
                        } else {
                            this.moveSuggestionFocus(-1);
                        }
                    }
                } else if (e.key === 'Enter') {
                    if (this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < this.suggestionItems.length) {
                        e.preventDefault();
                        this.selectSuggestion(this.activeSuggestionIndex, '搜尋建議鍵盤 Enter');
                    }
                } else if (e.key === 'Tab') {
                    if (this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < this.suggestionItems.length) {
                        this.selectSuggestion(this.activeSuggestionIndex, '搜尋建議鍵盤 Tab');
                    }
                }
            });
            
            // 點擊頁面其他地方隱藏建議
            document.addEventListener('click', (e) => {
                if (!this.searchInput.contains(e.target) && 
                    this.searchSuggestions && 
                    !this.searchSuggestions.contains(e.target)) {
                    this.hideSuggestions();
                }
            });
            
            // 🔍 搜尋結果導航按鈕
            if (this.searchPrevBtn) {
                this.searchPrevBtn.addEventListener('click', () => {
                    this.navigateToPreviousResult();
                });
            }
            
            if (this.searchNextBtn) {
                this.searchNextBtn.addEventListener('click', () => {
                    this.navigateToNextResult();
                });
            }
            
            // 🔍 鍵盤快捷鍵 (↑ 上一個, ↓ 下一個)
            document.addEventListener('keydown', (e) => {
                // 只有在搜尋框聚焦且有搜尋結果時才啟用
                if (this.searchResults.length > 0) {
                    if (e.key === 'ArrowUp' && e.altKey) {
                        e.preventDefault();
                        this.navigateToPreviousResult();
                    } else if (e.key === 'ArrowDown' && e.altKey) {
                        e.preventDefault();
                        this.navigateToNextResult();
                    }
                }
            });
            
            console.log('✅ 搜尋事件監聽器綁定完成');
        }
        
        /**
         * 執行搜尋
         * @param {string} query - 搜尋關鍵字
         */
        performSearch(query) {
            if (!query) {
                // 空查詢,重置搜尋結果
                if (this.onSearchCallback) {
                    this.onSearchCallback(null);
                }
                this.updateSearchResults([]);
                this.hideStats();
                return;
            }
            
            console.log(`🔍 搜尋關鍵字: "${query}"`);
            
            // 儲存搜尋歷史
            this.addToHistory(query);
            
            // 執行回調 (由 main.js 處理實際的搜尋邏輯)
            if (this.onSearchCallback) {
                const results = this.onSearchCallback(query);
                
                // 更新統計和導航
                this.updateSearchResults(results);
                this.updateStats(this.searchResults.length);
                
                // 顯示搜尋建議
                this.updateSuggestions(query);
            }
        }
        
        /**
         * 更新搜尋統計
         * @param {number} count - 搜尋結果數量
         */
        updateStats(count) {
            if (this.searchStats && this.searchCount) {
                this.searchCount.textContent = count;
                this.searchStats.style.display = 'flex';
            }
        }
        
        /**
         * 隱藏統計資訊
         */
        hideStats() {
            if (this.searchStats) {
                this.searchStats.style.display = 'none';
            }
        }
        
        /**
         * 更新搜尋建議
         * @param {string} query - 搜尋關鍵字
         */
        updateSuggestions(query) {
            if (!this.searchSuggestions) return;
            
            const suggestions = this.generateSuggestions(query);
            this.latestSuggestions = suggestions;
            
            if (suggestions.length === 0) {
                this.hideSuggestions();
                if (this.searchSuggestions) {
                    this.searchSuggestions.innerHTML = '';
                }
                this.suggestionItems = [];
                this.latestSuggestions = [];
                this.clearActiveSuggestion();
                return;
            }
            
            this.clearActiveSuggestion();
            
            // 渲染建議
            const html = suggestions.map((item, index) => {
                const highlightedText = this.highlightMatch(item.text, query);
                
                // 🔥 如果有講師資訊，顯示講師徽章
                let instructorBadge = '';
                if (item.instructor) {
                    const instructorColor = (window.instructorColors && window.instructorColors[item.instructor]) || '#818cf8';
                    instructorBadge = `
                        <span class="search-suggestion-instructor" style="--instructor-color: ${instructorColor};">
                            <i class="fas fa-user-circle"></i> ${item.instructor}
                        </span>
                    `;
                }
                
                return `
                    <div class="search-suggestion-item" data-query="${item.query}">
                        <div class="search-suggestion-icon">
                            <i class="fas ${item.icon}"></i>
                        </div>
                        <div class="search-suggestion-content">
                            <div class="search-suggestion-text">${highlightedText}</div>
                            ${instructorBadge}
                        </div>
                    </div>
                `;
            }).join('');
            
            this.searchSuggestions.innerHTML = html;
            this.suggestionItems = Array.from(this.searchSuggestions.querySelectorAll('.search-suggestion-item'));
            this.suggestionItems.forEach((item, index) => {
                const suggestionId = `${this.suggestionIdPrefix}-${this.suggestionRenderCount}-${index}`;
                item.setAttribute('id', suggestionId);
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', 'false');
                item.dataset.index = String(index);
                
                item.addEventListener('mouseenter', () => {
                    this.setActiveSuggestion(index);
                });
                
                item.addEventListener('mousedown', (event) => {
                    // 避免點擊時輸入框失焦
                    event.preventDefault();
                });
                
                item.addEventListener('click', () => {
                    this.selectSuggestion(index, '搜尋建議點擊');
                });
            });
            this.suggestionRenderCount += 1;
            
            this.showSuggestions();
        }
        
        /**
         * 生成搜尋建議
         * @param {string} query - 搜尋關鍵字
         * @returns {Array} 建議列表
         */
        generateSuggestions(query) {
            const suggestions = [];
            const lowerQuery = query.toLowerCase();
            
            // 1. 從搜尋歷史中找出匹配的
            const historyMatches = this.searchHistory
                .filter(h => h.toLowerCase().includes(lowerQuery) && h !== query)
                .slice(0, 3)
                .map(h => ({
                    text: h,
                    query: h,
                    icon: 'fa-history'
                }));
            
            suggestions.push(...historyMatches);
            
            // 2. 從當前搜尋結果中提取建議 (課程名稱、講師、地點)
            if (this.searchResults.length > 0) {
                const uniqueItems = new Set();
                
                this.searchResults.slice(0, 5).forEach(event => {
                    // 課程名稱 - 🔥 附帶講師資訊
                    if (event.title && event.title.toLowerCase().includes(lowerQuery)) {
                        uniqueItems.add(JSON.stringify({
                            text: event.title,
                            query: event.title,
                            icon: 'fa-book',
                            instructor: event.instructor || event.teacher || null
                        }));
                    }
                    
                    // 講師名稱
                    if (event.instructor && event.instructor.toLowerCase().includes(lowerQuery)) {
                        uniqueItems.add(JSON.stringify({
                            text: `講師: ${event.instructor}`,
                            query: event.instructor,
                            icon: 'fa-chalkboard-teacher',
                            instructor: event.instructor
                        }));
                    }
                    
                    // 地點 - 🔥 附帶講師資訊
                    if (event.location && event.location.toLowerCase().includes(lowerQuery)) {
                        uniqueItems.add(JSON.stringify({
                            text: `地點: ${event.location}`,
                            query: event.location,
                            icon: 'fa-map-marker-alt',
                            instructor: event.instructor || event.teacher || null
                        }));
                    }
                });
                
                const eventSuggestions = Array.from(uniqueItems)
                    .map(item => JSON.parse(item))
                    .slice(0, 5);
                
                suggestions.push(...eventSuggestions);
            }
            
            return suggestions.slice(0, 8); // 最多顯示 8 個建議
        }
        
        /**
         * 高亮顯示匹配文字
         * @param {string} text - 原始文字
         * @param {string} query - 搜尋關鍵字
         * @returns {string} 高亮後的 HTML
         */
        highlightMatch(text, query) {
            if (!query) return text;
            
            const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
            return text.replace(regex, '<span class="search-suggestion-match">$1</span>');
        }
        
        /**
         * 轉義正則表達式特殊字元
         * @param {string} str - 輸入字串
         * @returns {string} 轉義後的字串
         */
        escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        /**
         * 判斷建議列表是否可見
         * @returns {boolean}
         */
        hasVisibleSuggestions() {
            if (!this.searchSuggestions) return false;
            const styleDisplay = this.searchSuggestions.style.display || window.getComputedStyle(this.searchSuggestions).display;
            return styleDisplay !== 'none' && this.searchSuggestions.children.length > 0;
        }
        
        /**
         * 清除隱藏計時器
         */
        clearHideSuggestionsTimer() {
            if (this.hideSuggestionsTimer) {
                clearTimeout(this.hideSuggestionsTimer);
                this.hideSuggestionsTimer = null;
            }
        }
        
        /**
         * 設定目前啟用的建議項目
         * @param {number} index - 建議索引
         * @param {boolean} focusElement - 是否聚焦元素
         */
        setActiveSuggestion(index) {
            if (!this.suggestionItems || this.suggestionItems.length === 0) return;
            
            if (index < 0 || index >= this.suggestionItems.length) {
                this.clearActiveSuggestion();
                return;
            }
            
            this.activeSuggestionIndex = index;
            
            this.suggestionItems.forEach((item, idx) => {
                const isActive = idx === index;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-selected', isActive ? 'true' : 'false');
                
                if (isActive) {
                    this.searchInput.setAttribute('aria-activedescendant', item.id);
                    if (typeof item.scrollIntoView === 'function') {
                        item.scrollIntoView({ block: 'nearest' });
                    }
                }
            });
        }
        
        /**
         * 清除目前啟用的建議項目
         */
        clearActiveSuggestion() {
            this.activeSuggestionIndex = -1;
            if (this.suggestionItems && this.suggestionItems.length > 0) {
                this.suggestionItems.forEach(item => {
                    item.classList.remove('active');
                    item.setAttribute('aria-selected', 'false');
                });
            }
            if (this.searchInput) {
                this.searchInput.removeAttribute('aria-activedescendant');
            }
        }
        
        /**
         * 移動建議焦點
         * @param {number} step - 移動步數 (1 或 -1)
         */
        moveSuggestionFocus(step) {
            if (!this.suggestionItems || this.suggestionItems.length === 0) return;
            const total = this.suggestionItems.length;
            const current = this.activeSuggestionIndex === -1 ? (step > 0 ? 0 : total - 1) : this.activeSuggestionIndex + step;
            let nextIndex = current;
            if (nextIndex < 0) {
                nextIndex = total - 1;
            } else if (nextIndex >= total) {
                nextIndex = 0;
            }
            this.setActiveSuggestion(nextIndex);
        }
        
        /**
         * 套用建議項目的講師快速切換
         * @param {Object} suggestion
         * @param {string} source
         */
        applySuggestionInstructor(suggestion, source) {
            if (!suggestion || !suggestion.instructor) return;
            if (typeof window.autoSelectInstructor !== 'function') return;
            
            setTimeout(() => {
                const success = window.autoSelectInstructor(suggestion.instructor, source);
                if (success) {
                    console.log(`✅ 已自動切換到講師: ${suggestion.instructor}`);
                } else {
                    console.warn(`⚠️ 無法切換到講師: ${suggestion.instructor}`);
                }
            }, 300);
        }
        
        /**
         * 選擇建議項目
         * @param {number} index - 建議索引
         */
        selectSuggestion(index, source = '搜尋建議選擇') {
            if (!this.latestSuggestions || this.latestSuggestions.length === 0) return;
            const suggestion = this.latestSuggestions[index];
            if (!suggestion) return;
            
            const queryText = suggestion.query || suggestion.text || '';
            if (!queryText) return;
            
            this.searchInput.value = queryText;
            this.searchInput.focus({ preventScroll: true });
            this.performSearch(queryText);
            this.hideSuggestions();
            this.applySuggestionInstructor(suggestion, source);
        }
        
        /**
         * 顯示建議列表
         */
        showSuggestions() {
            if (this.searchSuggestions && this.searchSuggestions.children.length > 0) {
                this.clearHideSuggestionsTimer();
                if (this.suggestionItems.length === 0) {
                    this.suggestionItems = Array.from(this.searchSuggestions.querySelectorAll('.search-suggestion-item'));
                }
                this.searchSuggestions.style.display = 'block';
                this.searchSuggestions.setAttribute('aria-hidden', 'false');
                if (this.searchInput) {
                    this.searchInput.setAttribute('aria-expanded', 'true');
                }
            }
        }
        
        /**
         * 隱藏建議列表
         */
        hideSuggestions() {
            if (this.searchSuggestions) {
                this.clearHideSuggestionsTimer();
                this.searchSuggestions.style.display = 'none';
                this.searchSuggestions.setAttribute('aria-hidden', 'true');
                if (this.searchInput) {
                    this.searchInput.setAttribute('aria-expanded', 'false');
                }
                this.clearActiveSuggestion();
            }
        }
        
        /**
         * 清除搜尋
         */
        clearSearch() {
            this.searchInput.value = '';
            if (this.searchClearBtn) {
                this.searchClearBtn.style.display = 'none';
            }
            this.hideSuggestions();
            this.hideStats();
            if (this.searchSuggestions) {
                this.searchSuggestions.innerHTML = '';
            }
            this.suggestionItems = [];
            this.latestSuggestions = [];
            
            // 重置搜尋結果
            if (this.onSearchCallback) {
                this.onSearchCallback(null);
            }
            
            this.searchInput.focus({ preventScroll: true });
        }
        
        /**
         * 添加到搜尋歷史
         * @param {string} query - 搜尋關鍵字
         */
        addToHistory(query) {
            if (!query || query.length < 2) return;
            
            // 移除重複項目
            this.searchHistory = this.searchHistory.filter(h => h !== query);
            
            // 添加到開頭
            this.searchHistory.unshift(query);
            
            // 保留最近 20 筆
            this.searchHistory = this.searchHistory.slice(0, 20);
            
            // 儲存到 localStorage
            this.saveSearchHistory();
        }
        
        /**
         * 載入搜尋歷史
         * @returns {Array} 搜尋歷史陣列
         */
        loadSearchHistory() {
            try {
                const saved = localStorage.getItem('flb_search_history');
                return saved ? JSON.parse(saved) : [];
            } catch (error) {
                console.warn('⚠️ 載入搜尋歷史失敗:', error);
                return [];
            }
        }
        
        /**
         * 儲存搜尋歷史
         */
        saveSearchHistory() {
            try {
                localStorage.setItem('flb_search_history', JSON.stringify(this.searchHistory));
            } catch (error) {
                console.warn('⚠️ 儲存搜尋歷史失敗:', error);
            }
        }
        
        /**
         * 清除搜尋歷史
         */
        clearHistory() {
            this.searchHistory = [];
            this.saveSearchHistory();
            console.log('✅ 搜尋歷史已清除');
        }
        
        /**
         * 更新搜尋結果統計和導航
         * @param {Array} results - 搜尋結果陣列
         */
        updateSearchResults(results) {
            this.searchResults = results || [];
            this.currentResultIndex = 0;
            this.manualNavigation = false;
            
            // 更新統計顯示
            if (this.searchCount) {
                this.searchCount.textContent = this.searchResults.length;
            }
            
            // 顯示/隱藏導航按鈕
            if (this.searchNavigation) {
                if (this.searchResults.length > 1) {
                    this.searchNavigation.style.display = 'flex';
                    this.updateNavigationUI();
                } else {
                    this.searchNavigation.style.display = 'none';
                }
            }
            
            // 如果有結果，自動高亮第一個
            if (this.searchResults.length > 0) {
                setTimeout(() => {
                    this.highlightCurrentResult();
                }, 100);
            }
        }
        
        /**
         * 更新導航按鈕狀態
         */
        updateNavigationUI() {
            if (!this.searchCurrentIndex) return;
            
            const total = this.searchResults.length;
            const current = this.currentResultIndex + 1;
            
            this.searchCurrentIndex.textContent = `${current}/${total}`;
            
            // 更新按鈕啟用/禁用狀態
            if (this.searchPrevBtn) {
                this.searchPrevBtn.disabled = this.currentResultIndex === 0;
            }
            
            if (this.searchNextBtn) {
                this.searchNextBtn.disabled = this.currentResultIndex === total - 1;
            }
        }
        
        /**
         * 導航到上一個搜尋結果
         */
        navigateToPreviousResult() {
            if (this.searchResults.length === 0) return;
            
            if (this.currentResultIndex > 0) {
                this.currentResultIndex--;
                this.manualNavigation = true;
                this.highlightCurrentResult();
                this.updateNavigationUI();
                console.log(`🔍 導航到上一個結果 (${this.currentResultIndex + 1}/${this.searchResults.length})`);
            }
        }
        
        /**
         * 導航到下一個搜尋結果
         */
        navigateToNextResult() {
            if (this.searchResults.length === 0) return;
            
            if (this.currentResultIndex < this.searchResults.length - 1) {
                this.currentResultIndex++;
                this.manualNavigation = true;
                this.highlightCurrentResult();
                this.updateNavigationUI();
                console.log(`🔍 導航到下一個結果 (${this.currentResultIndex + 1}/${this.searchResults.length})`);
            }
        }
        
        /**
         * 高亮顯示當前搜尋結果
         */
        highlightCurrentResult() {
            if (this.searchResults.length === 0 || !this.onHighlightCallback) return;
            
            const currentEvent = this.searchResults[this.currentResultIndex];
            if (currentEvent) {
                console.log('🎯 高亮顯示結果:', currentEvent.title || currentEvent.id);
                this.onHighlightCallback(currentEvent, this.currentResultIndex, this.manualNavigation);
                this.manualNavigation = false;
            }
        }
    }
    
    // 導出到全域
    window.SearchManager = SearchManager;
    console.log('✅ 搜尋管理器模組載入完成');
})();
