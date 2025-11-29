/**
 * 🔍 API 端點分析工具
 * 
 * 自動掃描 server.js 中的所有 API 端點
 * 按功能域分組並建立遷移優先級清單
 * 生成詳細的分析報告
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const fs = require('fs');
const path = require('path');

/**
 * API 端點類型枚舉
 */
const EndpointTypes = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    PATCH: 'PATCH',
    USE: 'USE' // 中間件或路由掛載
};

/**
 * 功能域分類
 */
const FunctionDomains = {
    HOLIDAYS: 'holidays',
    TEMPLATES: 'templates', 
    SYSTEM: 'system',
    STUDENTS: 'students',
    TEMPORARY_STUDENTS: 'temporary-students',
    ATTENDANCE: 'attendance',
    REMINDERS: 'reminders',
    NOTIFICATIONS: 'notifications',
    STUDENT_REMINDERS: 'student-reminders',
    WEBHOOK: 'webhook',
    MEDIA: 'media',
    DRIVE_UPLOAD: 'drive-upload',
    DRIVE_MEDIA: 'drive-media',
    LEARNING_RECORDS: 'learning-records',
    EVENTS: 'events',
    CALENDAR: 'calendar',
    ADMIN: 'admin',
    SPECIAL_EVENTS: 'special-events',
    UNKNOWN: 'unknown'
};

/**
 * 路由模式匹配規則
 */
const RoutePatterns = {
    [FunctionDomains.HOLIDAYS]: /^\/api\/holidays/,
    [FunctionDomains.TEMPLATES]: /^\/api\/(templates|flex-templates)/,
    [FunctionDomains.SYSTEM]: /^\/api\/(health|system-time|system-status|logs|cache)/,
    [FunctionDomains.STUDENTS]: /^\/api\/(students|student-data)/,
    [FunctionDomains.TEMPORARY_STUDENTS]: /^\/api\/temporary-students/,
    [FunctionDomains.ATTENDANCE]: /^\/api\/(attendance|attendance-status)/,
    [FunctionDomains.REMINDERS]: /^\/api\/reminders/,
    [FunctionDomains.NOTIFICATIONS]: /^\/api\/(notification-config|student-attendance-notification|notify-leave|notify-class-cancellation|notify-class-resumption)/,
    [FunctionDomains.STUDENT_REMINDERS]: /^\/api\/student-reminders/,
    [FunctionDomains.WEBHOOK]: /^\/webhook/,
    [FunctionDomains.MEDIA]: /^\/api\/media/,
    [FunctionDomains.DRIVE_UPLOAD]: /^\/api\/drive-upload/,
    [FunctionDomains.DRIVE_MEDIA]: /^\/api\/drive-media/,
    [FunctionDomains.LEARNING_RECORDS]: /^\/api\/learning-records/,
    [FunctionDomains.EVENTS]: /^\/api\/events/,
    [FunctionDomains.CALENDAR]: /^\/api\/(calendar-events|calendar|address-mappings)/,
    [FunctionDomains.ADMIN]: /^\/api\/admin/,
    [FunctionDomains.SPECIAL_EVENTS]: /^\/api\/(special-events|special-events-config|special-event-types|special-event-keywords)/
};

/**
 * 遷移優先級定義
 */
const MigrationPriority = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

/**
 * 功能域優先級映射
 */
const DomainPriority = {
    [FunctionDomains.HOLIDAYS]: MigrationPriority.HIGH,
    [FunctionDomains.TEMPLATES]: MigrationPriority.HIGH,
    [FunctionDomains.SYSTEM]: MigrationPriority.HIGH,
    [FunctionDomains.STUDENTS]: MigrationPriority.MEDIUM,
    [FunctionDomains.TEMPORARY_STUDENTS]: MigrationPriority.MEDIUM,
    [FunctionDomains.ATTENDANCE]: MigrationPriority.MEDIUM,
    [FunctionDomains.REMINDERS]: MigrationPriority.MEDIUM,
    [FunctionDomains.NOTIFICATIONS]: MigrationPriority.MEDIUM,
    [FunctionDomains.STUDENT_REMINDERS]: MigrationPriority.MEDIUM,
    [FunctionDomains.WEBHOOK]: MigrationPriority.MEDIUM,
    [FunctionDomains.MEDIA]: MigrationPriority.LOW,
    [FunctionDomains.DRIVE_UPLOAD]: MigrationPriority.LOW,
    [FunctionDomains.DRIVE_MEDIA]: MigrationPriority.LOW,
    [FunctionDomains.LEARNING_RECORDS]: MigrationPriority.LOW,
    [FunctionDomains.EVENTS]: MigrationPriority.LOW,
    [FunctionDomains.CALENDAR]: MigrationPriority.LOW,
    [FunctionDomains.ADMIN]: MigrationPriority.LOW,
    [FunctionDomains.SPECIAL_EVENTS]: MigrationPriority.LOW
};

/**
 * API 端點資訊類別
 */
class ApiEndpoint {
    constructor(method, route, lineNumber, content) {
        this.method = method;
        this.route = route;
        this.lineNumber = lineNumber;
        this.content = content;
        this.domain = this.classifyDomain();
        this.priority = DomainPriority[this.domain] || MigrationPriority.LOW;
        this.dependencies = this.extractDependencies();
        this.complexity = this.assessComplexity();
    }
    
    /**
     * 分類功能域
     */
    classifyDomain() {
        for (const [domain, pattern] of Object.entries(RoutePatterns)) {
            if (pattern.test(this.route)) {
                return domain;
            }
        }
        return FunctionDomains.UNKNOWN;
    }
    
    /**
     * 提取依賴關係
     */
    extractDependencies() {
        const dependencies = [];
        
        // 檢查常見依賴模式
        if (this.content.includes('SynologyCalendarClient')) {
            dependencies.push('SynologyCalendarClient');
        }
        if (this.content.includes('SynologyDriveClient')) {
            dependencies.push('SynologyDriveClient');
        }
        if (this.content.includes('NotificationManager')) {
            dependencies.push('NotificationManager');
        }
        if (this.content.includes('ReminderScheduler')) {
            dependencies.push('ReminderScheduler');
        }
        if (this.content.includes('FastAttendanceManager')) {
            dependencies.push('FastAttendanceManager');
        }
        if (this.content.includes('Google Sheets') || this.content.includes('google-sheets')) {
            dependencies.push('GoogleSheets');
        }
        if (this.content.includes('LINE') || this.content.includes('line-bot')) {
            dependencies.push('LINE');
        }
        if (this.content.includes('multer')) {
            dependencies.push('multer');
        }
        if (this.content.includes('fs.') || this.content.includes('readFileSync') || this.content.includes('writeFileSync')) {
            dependencies.push('FileSystem');
        }
        
        return dependencies;
    }
    
    /**
     * 評估複雜度
     */
    assessComplexity() {
        let complexity = 1;
        
        // 根據程式碼行數
        const lines = this.content.split('\n').length;
        if (lines > 50) complexity += 2;
        else if (lines > 20) complexity += 1;
        
        // 根據依賴數量
        if (this.dependencies.length > 5) complexity += 2;
        else if (this.dependencies.length > 2) complexity += 1;
        
        // 根據關鍵字複雜度
        if (this.content.includes('async') && this.content.includes('await')) complexity += 1;
        if (this.content.includes('try') && this.content.includes('catch')) complexity += 1;
        if (this.content.includes('Promise')) complexity += 1;
        if (this.content.includes('spawn') || this.content.includes('exec')) complexity += 2;
        
        return Math.min(complexity, 5); // 最高複雜度為 5
    }
}

/**
 * API 分析器類別
 */
class ApiAnalyzer {
    constructor(serverFilePath = './server.js') {
        this.serverFilePath = serverFilePath;
        this.endpoints = [];
        this.domains = new Map();
        this.stats = {
            totalEndpoints: 0,
            byMethod: {},
            byDomain: {},
            byPriority: {},
            totalDependencies: new Set(),
            avgComplexity: 0
        };
    }
    
    /**
     * 掃描 server.js 檔案
     */
    async scanServerFile() {
        try {
            const content = fs.readFileSync(this.serverFilePath, 'utf8');
            const lines = content.split('\n');
            
            // 掃描所有路由定義
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNumber = i + 1;
                
                // 匹配路由定義模式
                const routeMatches = [
                    // app.get('/api/...', (req, res) => { ... })
                    /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // app.use('/api/...', router)
                    /app\.use\s*\(\s*['"`]([^'"`]+)['"`]/g
                ];
                
                for (const pattern of routeMatches) {
                    pattern.lastIndex = 0; // 重置 regex 狀態
                    const match = pattern.exec(line);
                    
                    if (match) {
                        const method = match[1] || 'USE';
                        const route = match[2];
                        
                        // 提取函數內容（簡化版本，實際可能需要更複雜的解析）
                        const functionContent = this.extractFunctionContent(lines, i);
                        
                        const endpoint = new ApiEndpoint(method, route, lineNumber, functionContent);
                        this.endpoints.push(endpoint);
                    }
                }
            }
            
            this.analyzeResults();
            return this.generateReport();
            
        } catch (error) {
            throw new Error(`掃描 server.js 失敗: ${error.message}`);
        }
    }
    
    /**
     * 提取函數內容（簡化版本）
     */
    extractFunctionContent(lines, startIndex) {
        let content = '';
        let braceCount = 0;
        let inFunction = false;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            content += line + '\n';
            
            // 檢查是否進入函數
            if (line.includes('=>') || line.includes('function')) {
                inFunction = true;
            }
            
            // 計算大括號
            if (inFunction) {
                for (const char of line) {
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                }
                
                // 如果大括號平衡，結束提取
                if (braceCount === 0 && inFunction) {
                    break;
                }
            }
            
            // 防止無限循環
            if (i - startIndex > 100) {
                break;
            }
        }
        
        return content;
    }
    
    /**
     * 分析結果
     */
    analyzeResults() {
        // 統計方法
        this.stats.byMethod = {};
        this.stats.byDomain = {};
        this.stats.byPriority = {};
        this.stats.totalDependencies = new Set();
        
        let totalComplexity = 0;
        
        for (const endpoint of this.endpoints) {
            // 統計方法
            this.stats.byMethod[endpoint.method] = (this.stats.byMethod[endpoint.method] || 0) + 1;
            
            // 統計功能域
            this.stats.byDomain[endpoint.domain] = (this.stats.byDomain[endpoint.domain] || 0) + 1;
            
            // 統計優先級
            const priorityName = Object.keys(MigrationPriority).find(key => MigrationPriority[key] === endpoint.priority);
            this.stats.byPriority[priorityName] = (this.stats.byPriority[priorityName] || 0) + 1;
            
            // 統計依賴
            endpoint.dependencies.forEach(dep => this.stats.totalDependencies.add(dep));
            
            // 累計複雜度
            totalComplexity += endpoint.complexity;
        }
        
        this.stats.totalEndpoints = this.endpoints.length;
        this.stats.avgComplexity = this.endpoints.length > 0 ? (totalComplexity / this.endpoints.length).toFixed(2) : 0;
    }
    
    /**
     * 生成分析報告
     */
    generateReport() {
        console.log('🔍 [DEBUG] generateReport 開始執行');
        console.log('🔍 [DEBUG] this.endpoints 數量:', this.endpoints.length);
        console.log('🔍 [DEBUG] this.stats:', JSON.stringify(this.stats, null, 2));
        
        const domains = this.groupByDomain();
        console.log('🔍 [DEBUG] groupByDomain 結果:', Object.keys(domains));
        
        const report = {
            summary: {
                totalEndpoints: this.stats.totalEndpoints,
                totalDomains: Object.keys(this.stats.byDomain).length,
                totalDependencies: this.stats.totalDependencies.size,
                avgComplexity: this.stats.avgComplexity,
                scanDate: new Date().toISOString()
            },
            statistics: {
                byMethod: this.stats.byMethod,
                byDomain: this.stats.byDomain,
                byPriority: this.stats.byPriority,
                dependencies: Array.from(this.stats.totalDependencies)
            },
            domains: domains,
            migrationPlan: this.generateMigrationPlan(),
            endpoints: this.endpoints.map(ep => ({
                method: ep.method,
                route: ep.route,
                domain: ep.domain,
                priority: ep.priority,
                complexity: ep.complexity,
                dependencies: ep.dependencies,
                lineNumber: ep.lineNumber
            }))
        };
        
        console.log('🔍 [DEBUG] 報告生成完成');
        return report;
    }
    
    /**
     * 按功能域分組
     */
    groupByDomain() {
        const domains = {};
        
        for (const endpoint of this.endpoints) {
            if (!domains[endpoint.domain]) {
                domains[endpoint.domain] = {
                    name: endpoint.domain,
                    endpoints: [],
                    stats: {
                        count: 0,
                        avgComplexity: 0,
                        dependencies: new Set()
                    }
                };
            }
            
            domains[endpoint.domain].endpoints.push({
                method: endpoint.method,
                route: endpoint.route,
                complexity: endpoint.complexity,
                dependencies: endpoint.dependencies,
                lineNumber: endpoint.lineNumber
            });
            
            domains[endpoint.domain].stats.count++;
            domains[endpoint.domain].stats.dependencies = new Set([
                ...domains[endpoint.domain].stats.dependencies,
                ...endpoint.dependencies
            ]);
        }
        
        // 計算平均複雜度
        for (const domain of Object.values(domains)) {
            const totalComplexity = domain.endpoints.reduce((sum, ep) => sum + ep.complexity, 0);
            domain.stats.avgComplexity = (totalComplexity / domain.stats.count).toFixed(2);
            domain.stats.dependencies = Array.from(domain.stats.dependencies);
        }
        
        return domains;
    }
    
    /**
     * 生成遷移計畫
     */
    generateMigrationPlan() {
        const phases = [
            { name: 'Phase 1', title: '基礎設施準備', domains: [], priority: MigrationPriority.CRITICAL },
            { name: 'Phase 2', title: '獨立模組遷移', domains: [], priority: MigrationPriority.HIGH },
            { name: 'Phase 3', title: '學生管理模組', domains: [], priority: MigrationPriority.MEDIUM },
            { name: 'Phase 4', title: '通知系統模組', domains: [], priority: MigrationPriority.MEDIUM },
            { name: 'Phase 5', title: '媒體系統模組', domains: [], priority: MigrationPriority.LOW },
            { name: 'Phase 6', title: '日曆核心模組', domains: [], priority: MigrationPriority.LOW }
        ];
        
        // 根據優先級分配功能域到階段
        for (const endpoint of this.endpoints) {
            let targetPhase;
            
            // 🔥 修正：使用字串比較而非數值常量
            const priorityName = Object.keys(MigrationPriority).find(key => MigrationPriority[key] === endpoint.priority);
            
            console.log('🔍 [DEBUG] 處理端點:', endpoint.route, '優先級:', endpoint.priority, '優先級名稱:', priorityName);
            
            switch (priorityName) {
                case 'HIGH':
                    targetPhase = phases[2]; // Phase 2
                    break;
                case 'MEDIUM':
                    if (endpoint.domain === FunctionDomains.STUDENTS || 
                        endpoint.domain === FunctionDomains.TEMPORARY_STUDENTS || 
                        endpoint.domain === FunctionDomains.ATTENDANCE) {
                        targetPhase = phases[3]; // Phase 3
                    } else {
                        targetPhase = phases[4]; // Phase 4
                    }
                    break;
                case 'LOW':
                    if (endpoint.domain === FunctionDomains.MEDIA || 
                        endpoint.domain === FunctionDomains.DRIVE_UPLOAD || 
                        endpoint.domain === FunctionDomains.DRIVE_MEDIA || 
                        endpoint.domain === FunctionDomains.LEARNING_RECORDS) {
                        targetPhase = phases[5]; // Phase 5
                    } else {
                        targetPhase = phases[5]; // 🔥 修正：改為 phases[5] 而非 phases[6]
                    }
                    break;
                default:
                    targetPhase = phases[2]; // 預設到 Phase 2
            }
            
            // 🔥 修正：添加安全檢查
            if (targetPhase && endpoint.domain && !targetPhase.domains.includes(endpoint.domain)) {
                targetPhase.domains.push(endpoint.domain);
                console.log('🔍 [DEBUG] 分配', endpoint.domain, '到', targetPhase.name);
            }
        }
        
        // 為每個階段添加統計資訊
        for (const phase of phases) {
            const phaseEndpoints = this.endpoints.filter(ep => phase.domains.includes(ep.domain));
            phase.stats = {
                endpointCount: phaseEndpoints.length,
                domains: phase.domains.length,
                estimatedComplexity: phaseEndpoints.reduce((sum, ep) => sum + ep.complexity, 0),
                dependencies: Array.from(new Set(phaseEndpoints.flatMap(ep => ep.dependencies)))
            };
        }
        
        return phases;
    }
    
    /**
     * 儲存報告到檔案
     */
    async saveReport(outputPath = './docs/API-ANALYSIS-REPORT.json') {
        const report = await this.scanServerFile();
        
        // 確保目錄存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`📊 API 分析報告已儲存到: ${outputPath}`);
        
        return report;
    }
    
    /**
     * 生成 Markdown 報告
     */
    generateMarkdownReport() {
        const report = this.generateReport();
        
        let markdown = `# 📊 API 端點分析報告\n\n`;
        markdown += `> 生成時間: ${report.summary.scanDate}\n\n`;
        
        // 摘要
        markdown += `## 📈 摘要統計\n\n`;
        markdown += `- **總端點數**: ${report.summary.totalEndpoints}\n`;
        markdown += `- **功能域數**: ${report.summary.totalDomains}\n`;
        markdown += `- **依賴模組數**: ${report.summary.totalDependencies}\n`;
        markdown += `- **平均複雜度**: ${report.summary.avgComplexity}\n\n`;
        
        // 按方法統計
        markdown += `## 🔧 按方法統計\n\n`;
        markdown += `| 方法 | 數量 |\n`;
        markdown += `|------|------|\n`;
        for (const [method, count] of Object.entries(report.statistics.byMethod)) {
            markdown += `| ${method} | ${count} |\n`;
        }
        markdown += `\n`;
        
        // 按功能域統計
        markdown += `## 🏗️ 按功能域統計\n\n`;
        markdown += `| 功能域 | 端點數 | 平均複雜度 |\n`;
        markdown += `|--------|--------|------------|\n`;
        for (const [domain, stats] of Object.entries(report.statistics.byDomain)) {
            const domainInfo = report.domains && report.domains[domain];
            const avgComplexity = domainInfo ? domainInfo.stats.avgComplexity : 'N/A';
            markdown += `| ${domain} | ${stats} | ${avgComplexity} |\n`;
        }
        markdown += `\n`;
        
        // 遷移計畫
        markdown += `## 🚀 遷移計畫\n\n`;
        for (const phase of report.migrationPlan) {
            markdown += `### ${phase.name}: ${phase.title}\n\n`;
            markdown += `- **端點數**: ${phase.stats.endpointCount}\n`;
            markdown += `- **功能域**: ${phase.stats.domains}\n`;
            markdown += `- **預估複雜度**: ${phase.stats.estimatedComplexity}\n`;
            markdown += `- **依賴**: ${phase.stats.dependencies.join(', ')}\n\n`;
        }
        
        // 詳細端點清單
        markdown += `## 📋 詳細端點清單\n\n`;
        for (const endpoint of report.endpoints) {
            markdown += `#### ${endpoint.method} ${endpoint.route}\n\n`;
            markdown += `- **功能域**: ${endpoint.domain}\n`;
            markdown += `- **優先級**: ${endpoint.priority}\n`;
            markdown += `- **複雜度**: ${endpoint.complexity}\n`;
            markdown += `- **依賴**: ${endpoint.dependencies.join(', ') || '無'}\n`;
            markdown += `- **行號**: ${endpoint.lineNumber}\n\n`;
        }
        
        return markdown;
    }
}

module.exports = {
    ApiAnalyzer,
    ApiEndpoint,
    EndpointTypes,
    FunctionDomains,
    MigrationPriority,
    RoutePatterns
};
