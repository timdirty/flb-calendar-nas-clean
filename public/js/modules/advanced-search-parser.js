// ============================================
// 進階搜尋解析器模組（Google/Spotlight 風格）
// ============================================
// 版本：2025-10-30-ADVANCED-SEARCH
// 功能：支援多關鍵字、OR/AND、引號、排除等進階搜尋語法

(function() {
    'use strict';
    
    console.log('🔍 載入進階搜尋解析器模組...');
    
    /**
     * 進階搜尋解析器類別
     */
    class AdvancedSearchParser {
        constructor() {
            this.operators = {
                OR: 'OR',
                AND: 'AND',
                NOT: '-',
                REQUIRED: '+',
                EXACT: '"'
            };
        }
        
        /**
         * 解析搜尋查詢字串
         * @param {string} query - 原始搜尋查詢
         * @returns {Object} 解析後的搜尋條件
         * 
         * 支援語法：
         * - "exact phrase" : 精確匹配
         * - keyword1 keyword2 : AND 邏輯（同時包含）
         * - keyword1 OR keyword2 : OR 邏輯（任一包含）
         * - -excluded : 排除關鍵字
         * - +required : 必須包含
         */
        parse(query) {
            if (!query || typeof query !== 'string') {
                return {
                    isEmpty: true,
                    terms: [],
                    exactPhrases: [],
                    requiredTerms: [],
                    excludedTerms: [],
                    orGroups: [],
                    defaultOperator: 'AND'
                };
            }
            
            const trimmed = query.trim();
            if (!trimmed) {
                return {
                    isEmpty: true,
                    terms: [],
                    exactPhrases: [],
                    requiredTerms: [],
                    excludedTerms: [],
                    orGroups: [],
                    defaultOperator: 'AND'
                };
            }
            
            console.log('🔍 解析搜尋查詢:', trimmed);
            
            const result = {
                isEmpty: false,
                terms: [],                  // 一般關鍵字（AND 邏輯）
                exactPhrases: [],           // 精確匹配的短語
                requiredTerms: [],          // 必須包含的關鍵字
                excludedTerms: [],          // 排除的關鍵字
                orGroups: [],               // OR 邏輯的關鍵字組
                defaultOperator: 'AND'      // 預設運算符
            };
            
            let remaining = trimmed;
            
            // 1. 提取精確匹配短語（引號內的內容）
            const exactMatches = remaining.match(/"([^"]+)"/g);
            if (exactMatches) {
                exactMatches.forEach(match => {
                    const phrase = match.replace(/"/g, '').trim();
                    if (phrase) {
                        result.exactPhrases.push(phrase);
                    }
                    remaining = remaining.replace(match, '');
                });
            }
            
            // 2. 分割剩餘部分為 token（保留 OR 作為特殊 token）
            const tokens = remaining
                .split(/\s+/)
                .filter(token => token.length > 0);
            
            // 3. 處理 token
            let i = 0;
            while (i < tokens.length) {
                const token = tokens[i];
                
                // 跳過空 token
                if (!token || token.trim() === '') {
                    i++;
                    continue;
                }
                
                // 檢查是否為 OR 運算符
                if (token.toUpperCase() === 'OR') {
                    // 取前一個和後一個 token 組成 OR 組
                    const prev = tokens[i - 1];
                    const next = tokens[i + 1];
                    
                    if (prev && next) {
                        // 從 terms 中移除前一個 token（如果存在）
                        const prevIndex = result.terms.indexOf(prev.toLowerCase());
                        if (prevIndex !== -1) {
                            result.terms.splice(prevIndex, 1);
                        }
                        
                        // 檢查是否已經有包含這些關鍵字的 OR 組
                        let existingGroup = result.orGroups.find(group => 
                            group.includes(prev.toLowerCase()) || group.includes(next.toLowerCase())
                        );
                        
                        if (existingGroup) {
                            // 添加到現有組
                            if (!existingGroup.includes(prev.toLowerCase())) {
                                existingGroup.push(prev.toLowerCase());
                            }
                            if (!existingGroup.includes(next.toLowerCase())) {
                                existingGroup.push(next.toLowerCase());
                            }
                        } else {
                            // 創建新的 OR 組
                            result.orGroups.push([prev.toLowerCase(), next.toLowerCase()]);
                        }
                        
                        i += 2; // 跳過 OR 和下一個 token
                        continue;
                    }
                }
                
                // 檢查是否為排除關鍵字（-keyword）
                if (token.startsWith('-') && token.length > 1) {
                    const excluded = token.substring(1).toLowerCase();
                    if (!result.excludedTerms.includes(excluded)) {
                        result.excludedTerms.push(excluded);
                    }
                    i++;
                    continue;
                }
                
                // 檢查是否為必須包含關鍵字（+keyword）
                if (token.startsWith('+') && token.length > 1) {
                    const required = token.substring(1).toLowerCase();
                    if (!result.requiredTerms.includes(required)) {
                        result.requiredTerms.push(required);
                    }
                    i++;
                    continue;
                }
                
                // 一般關鍵字（AND 邏輯）
                const term = token.toLowerCase();
                if (!result.terms.includes(term)) {
                    result.terms.push(term);
                }
                
                i++;
            }
            
            console.log('📊 解析結果:', {
                terms: result.terms,
                exactPhrases: result.exactPhrases,
                requiredTerms: result.requiredTerms,
                excludedTerms: result.excludedTerms,
                orGroups: result.orGroups
            });
            
            return result;
        }
        
        /**
         * 檢查事件是否匹配搜尋條件
         * @param {Object} event - 事件物件
         * @param {Object} searchCriteria - 解析後的搜尋條件
         * @returns {boolean} 是否匹配
         */
        matchEvent(event, searchCriteria) {
            if (!event || searchCriteria.isEmpty) {
                return false;
            }
            
            // 收集事件的所有可搜尋文字
            const searchableText = this.getSearchableText(event);
            
            // 1. 檢查排除關鍵字（任一匹配則排除）
            if (searchCriteria.excludedTerms.length > 0) {
                const hasExcluded = searchCriteria.excludedTerms.some(term => 
                    searchableText.includes(term)
                );
                if (hasExcluded) {
                    return false; // 包含排除關鍵字，不匹配
                }
            }
            
            // 2. 檢查必須包含關鍵字（全部必須匹配）
            if (searchCriteria.requiredTerms.length > 0) {
                const allRequired = searchCriteria.requiredTerms.every(term => 
                    searchableText.includes(term)
                );
                if (!allRequired) {
                    return false; // 缺少必須關鍵字，不匹配
                }
            }
            
            // 3. 檢查精確匹配短語（全部必須匹配）
            if (searchCriteria.exactPhrases.length > 0) {
                const allExact = searchCriteria.exactPhrases.every(phrase => 
                    searchableText.includes(phrase.toLowerCase())
                );
                if (!allExact) {
                    return false; // 缺少精確匹配短語，不匹配
                }
            }
            
            // 4. 檢查 OR 組（至少一個 OR 組中的任一關鍵字匹配）
            if (searchCriteria.orGroups.length > 0) {
                const hasOrMatch = searchCriteria.orGroups.some(group => 
                    group.some(term => searchableText.includes(term))
                );
                if (!hasOrMatch) {
                    return false; // 沒有匹配任何 OR 組，不匹配
                }
            }
            
            // 5. 檢查一般關鍵字（AND 邏輯，全部必須匹配）
            if (searchCriteria.terms.length > 0) {
                const allTerms = searchCriteria.terms.every(term => 
                    searchableText.includes(term)
                );
                if (!allTerms) {
                    return false; // 缺少一般關鍵字，不匹配
                }
            }
            
            // 所有條件都滿足
            return true;
        }
        
        /**
         * 取得事件的所有可搜尋文字（合併所有欄位）
         * @param {Object} event - 事件物件
         * @returns {string} 小寫的合併文字
         */
        getSearchableText(event) {
            const parts = [];
            
            // 課程標題
            if (event.title) {
                parts.push(event.title);
            }
            
            // 講師名稱
            if (event.instructor) {
                parts.push(event.instructor);
            }
            if (event.teacher) {
                parts.push(event.teacher);
            }
            
            // 地點
            if (event.location) {
                parts.push(event.location);
            }
            
            // 描述
            if (event.description) {
                parts.push(event.description);
            }
            
            // 課程類型
            if (event.courseType) {
                parts.push(event.courseType);
            }
            
            // 🔥 添加日期相關資訊（支援日期搜尋）
            if (event.start) {
                try {
                    const startDate = new Date(event.start);
                    if (!isNaN(startDate.getTime())) {
                        // 添加多種日期格式以支援各種搜尋方式
                        const year = startDate.getFullYear();
                        const month = String(startDate.getMonth() + 1).padStart(2, '0');
                        const day = String(startDate.getDate()).padStart(2, '0');
                        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                        const weekday = weekdays[startDate.getDay()];
                        
                        // 添加各種日期格式
                        parts.push(`${year}-${month}-${day}`); // 2025-01-30
                        parts.push(`${year}/${month}/${day}`); // 2025/01/30
                        parts.push(`${month}-${day}`); // 01-30
                        parts.push(`${month}/${day}`); // 01/30
                        parts.push(`${year}年${parseInt(month)}月${parseInt(day)}日`); // 2025年1月30日
                        parts.push(`${parseInt(month)}月${parseInt(day)}日`); // 1月30日
                        parts.push(`星期${weekday}`); // 星期三
                        parts.push(weekday); // 三
                    }
                } catch (e) {
                    console.warn('日期解析失敗:', e);
                }
            }
            
            // 學生姓名
            if (event.students && Array.isArray(event.students)) {
                event.students.forEach(student => {
                    if (student.name) {
                        parts.push(student.name);
                    }
                });
            }
            
            // 合併並轉小寫
            return parts.join(' ').toLowerCase();
        }
        
        /**
         * 取得搜尋說明文字
         * @returns {string} 說明文字
         */
        getHelpText() {
            return `
🔍 進階搜尋語法說明：

基本搜尋：
  • 輸入關鍵字即可搜尋（例：spm）

多關鍵字搜尋（AND 邏輯）：
  • 空格分隔多個關鍵字，結果會同時包含所有關鍵字
  • 例：spm 到府 → 搜尋同時包含 "spm" 和 "到府" 的課程

OR 搜尋：
  • 使用 OR 連接關鍵字，結果包含任一關鍵字即可
  • 例：spm OR scratch → 搜尋包含 "spm" 或 "scratch" 的課程

精確匹配：
  • 使用雙引號包裹短語，完全匹配該短語
  • 例："Python 基礎" → 只搜尋完全符合 "Python 基礎" 的課程

排除關鍵字：
  • 使用 - 符號排除不想要的結果
  • 例：程式 -scratch → 搜尋包含 "程式" 但不包含 "scratch" 的課程

必須包含：
  • 使用 + 符號指定必須包含的關鍵字
  • 例：+spm 到府 → "spm" 必須存在，"到府" 可選

組合使用：
  • 可以組合多種語法
  • 例：+spm 到府 OR 線上 -取消 → 必須包含 "spm"，包含 "到府" 或 "線上"，但不包含 "取消"
`;
        }
    }
    
    // 導出到全域
    window.AdvancedSearchParser = AdvancedSearchParser;
    console.log('✅ 進階搜尋解析器模組載入完成');
})();

