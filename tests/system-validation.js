/**
 * 🔍 系統完整驗證工具
 * 
 * 功能：
 * 1. 驗證新進度條系統
 * 2. 檢查核心模組載入
 * 3. 測試關鍵功能
 * 4. 生成驗證報告
 * 
 * @version 1.0.0
 * @date 2025-11-18
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 驗證結果收集器
// ============================================
class ValidationCollector {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
      info: []
    };
    this.startTime = Date.now();
  }

  pass(category, message, details = null) {
    this.results.passed.push({ category, message, details, timestamp: Date.now() });
    console.log(`✅ [${category}] ${message}`);
  }

  fail(category, message, error = null) {
    this.results.failed.push({ category, message, error: error?.message || error, timestamp: Date.now() });
    console.error(`❌ [${category}] ${message}`);
    if (error) console.error('   錯誤詳情:', error);
  }

  warn(category, message) {
    this.results.warnings.push({ category, message, timestamp: Date.now() });
    console.warn(`⚠️  [${category}] ${message}`);
  }

  info(category, message) {
    this.results.info.push({ category, message, timestamp: Date.now() });
    console.log(`ℹ️  [${category}] ${message}`);
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    return {
      duration: duration,
      total: this.results.passed.length + this.results.failed.length,
      passed: this.results.passed.length,
      failed: this.results.failed.length,
      warnings: this.results.warnings.length,
      info: this.results.info.length,
      success: this.results.failed.length === 0
    };
  }

  generateReport() {
    const summary = this.getSummary();
    const report = [];

    report.push('');
    report.push('='.repeat(80));
    report.push('  🔍 系統驗證報告');
    report.push('='.repeat(80));
    report.push('');
    report.push(`執行時間: ${(summary.duration / 1000).toFixed(2)} 秒`);
    report.push(`總測試數: ${summary.total}`);
    report.push(`✅ 通過: ${summary.passed}`);
    report.push(`❌ 失敗: ${summary.failed}`);
    report.push(`⚠️  警告: ${summary.warnings}`);
    report.push('');

    if (summary.failed > 0) {
      report.push('失敗項目:');
      this.results.failed.forEach((item, index) => {
        report.push(`  ${index + 1}. [${item.category}] ${item.message}`);
        if (item.error) {
          report.push(`     錯誤: ${item.error}`);
        }
      });
      report.push('');
    }

    if (summary.warnings > 0) {
      report.push('警告項目:');
      this.results.warnings.forEach((item, index) => {
        report.push(`  ${index + 1}. [${item.category}] ${item.message}`);
      });
      report.push('');
    }

    report.push('='.repeat(80));
    report.push(summary.success ? '🎉 驗證成功！' : '❌ 驗證失敗，請修復上述問題');
    report.push('='.repeat(80));
    report.push('');

    return report.join('\n');
  }
}

// ============================================
// 檔案系統驗證
// ============================================
class FileSystemValidator {
  constructor(collector, rootPath) {
    this.collector = collector;
    this.rootPath = rootPath;
  }

  /**
   * 驗證檔案是否存在
   */
  validateFileExists(relativePath, category = 'File') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        this.collector.pass(category, `檔案存在: ${relativePath}`, {
          size: stats.size,
          modified: stats.mtime
        });
        return true;
      } else {
        this.collector.fail(category, `檔案不存在: ${relativePath}`);
        return false;
      }
    } catch (error) {
      this.collector.fail(category, `檢查檔案失敗: ${relativePath}`, error);
      return false;
    }
  }

  /**
   * 驗證 JavaScript 檔案語法
   */
  validateJavaScriptSyntax(relativePath, category = 'Syntax') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // 基本語法檢查
      const issues = [];
      
      // 檢查是否有未閉合的括號
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push(`大括號不匹配: { ${openBraces} vs } ${closeBraces}`);
      }

      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        issues.push(`小括號不匹配: ( ${openParens} vs ) ${closeParens}`);
      }

      // 檢查常見錯誤
      if (content.includes('function (')) {
        this.collector.warn(category, `${relativePath} 使用舊式 function 語法`);
      }

      if (issues.length > 0) {
        this.collector.fail(category, `語法問題: ${relativePath}`, issues.join('; '));
        return false;
      }

      this.collector.pass(category, `語法正確: ${relativePath}`, {
        lines: content.split('\n').length,
        size: content.length
      });
      return true;
    } catch (error) {
      this.collector.fail(category, `讀取檔案失敗: ${relativePath}`, error);
      return false;
    }
  }

  /**
   * 驗證 CSS 檔案
   */
  validateCSS(relativePath, category = 'CSS') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // 基本檢查
      const issues = [];
      
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push(`大括號不匹配: { ${openBraces} vs } ${closeBraces}`);
      }

      // 統計 !important 使用
      const importantCount = (content.match(/!important/g) || []).length;
      if (importantCount > 50) {
        this.collector.warn(category, `${relativePath} 過度使用 !important (${importantCount} 次)`);
      }

      if (issues.length > 0) {
        this.collector.fail(category, `CSS 問題: ${relativePath}`, issues.join('; '));
        return false;
      }

      this.collector.pass(category, `CSS 正確: ${relativePath}`, {
        lines: content.split('\n').length,
        importantCount: importantCount
      });
      return true;
    } catch (error) {
      this.collector.fail(category, `讀取 CSS 失敗: ${relativePath}`, error);
      return false;
    }
  }
}

// ============================================
// 模組載入驗證
// ============================================
class ModuleValidator {
  constructor(collector, rootPath) {
    this.collector = collector;
    this.rootPath = rootPath;
  }

  /**
   * 驗證 Node.js 模組是否可載入
   */
  validateNodeModule(relativePath, category = 'Module') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      // 清除快取
      delete require.cache[require.resolve(fullPath)];
      
      const module = require(fullPath);
      this.collector.pass(category, `模組可載入: ${relativePath}`, {
        exports: Object.keys(module || {})
      });
      return true;
    } catch (error) {
      this.collector.fail(category, `模組載入失敗: ${relativePath}`, error);
      return false;
    }
  }

  /**
   * 驗證前端模組結構
   */
  validateFrontendModule(relativePath, category = 'Frontend') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // 檢查是否為 IIFE
      const hasIIFE = /\(function\s*\([^)]*\)\s*{/.test(content) || 
                      /\(\s*function\s*\([^)]*\)\s*{/.test(content);
      
      // 檢查是否有全域導出
      const hasGlobalExport = /window\.[A-Za-z_$][\w$]*\s*=/.test(content) ||
                              /global\.[A-Za-z_$][\w$]*\s*=/.test(content);

      if (!hasIIFE) {
        this.collector.warn(category, `${relativePath} 未使用 IIFE 封裝`);
      }

      if (!hasGlobalExport) {
        this.collector.warn(category, `${relativePath} 未找到全域導出`);
      }

      this.collector.pass(category, `前端模組結構正確: ${relativePath}`, {
        hasIIFE: hasIIFE,
        hasGlobalExport: hasGlobalExport
      });
      return true;
    } catch (error) {
      this.collector.fail(category, `驗證前端模組失敗: ${relativePath}`, error);
      return false;
    }
  }
}

// ============================================
// 整合驗證
// ============================================
class IntegrationValidator {
  constructor(collector, rootPath) {
    this.collector = collector;
    this.rootPath = rootPath;
  }

  /**
   * 驗證環境變數
   */
  validateEnvironmentVariables(category = 'Environment') {
    const envPath = path.join(this.rootPath, '.env.nas');
    
    if (!fs.existsSync(envPath)) {
      this.collector.fail(category, '.env.nas 檔案不存在');
      return false;
    }

    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'TZ',
        'SYNOLOGY_HOST',
        'SYNOLOGY_USERNAME',
        'SYNOLOGY_PASSWORD'
      ];

      const missingVars = requiredVars.filter(varName => {
        return !new RegExp(`^${varName}\\s*=`, 'm').test(envContent);
      });

      if (missingVars.length > 0) {
        this.collector.fail(category, `缺少環境變數: ${missingVars.join(', ')}`);
        return false;
      }

      this.collector.pass(category, '環境變數配置完整');
      return true;
    } catch (error) {
      this.collector.fail(category, '讀取環境變數失敗', error);
      return false;
    }
  }

  /**
   * 驗證 package.json 依賴
   */
  validateDependencies(category = 'Dependencies') {
    const packagePath = path.join(this.rootPath, 'package.json');
    
    try {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const deps = packageData.dependencies || {};
      const devDeps = packageData.devDependencies || {};
      
      const totalDeps = Object.keys(deps).length + Object.keys(devDeps).length;
      
      // 檢查關鍵依賴
      const requiredDeps = [
        'express',
        'axios',
        'dotenv',
        'multer',
        'cors'
      ];

      const missingDeps = requiredDeps.filter(dep => !deps[dep]);

      if (missingDeps.length > 0) {
        this.collector.fail(category, `缺少依賴: ${missingDeps.join(', ')}`);
        return false;
      }

      this.collector.pass(category, `依賴完整 (${totalDeps} 個套件)`);
      return true;
    } catch (error) {
      this.collector.fail(category, '驗證依賴失敗', error);
      return false;
    }
  }
}

// ============================================
// 主驗證流程
// ============================================
async function runSystemValidation() {
  console.log('');
  console.log('='.repeat(80));
  console.log('  🔍 開始系統驗證');
  console.log('='.repeat(80));
  console.log('');

  const collector = new ValidationCollector();
  const rootPath = path.join(__dirname, '..');
  
  const fileValidator = new FileSystemValidator(collector, rootPath);
  const moduleValidator = new ModuleValidator(collector, rootPath);
  const integrationValidator = new IntegrationValidator(collector, rootPath);

  // ==================== 1. 新進度條系統驗證 ====================
  console.log('\n📊 驗證進度條系統...\n');

  const progressFiles = [
    'public/js/modules/file-progress-manager.js',
    'public/js/modules/file-progress-integration.js',
    'public/css/file-progress.css'
  ];

  progressFiles.forEach(file => {
    fileValidator.validateFileExists(file, 'ProgressSystem');
    
    if (file.endsWith('.js')) {
      fileValidator.validateJavaScriptSyntax(file, 'ProgressSystem');
      moduleValidator.validateFrontendModule(file, 'ProgressSystem');
    } else if (file.endsWith('.css')) {
      fileValidator.validateCSS(file, 'ProgressSystem');
    }
  });

  // ==================== 2. 核心後端模組驗證 ====================
  console.log('\n🔧 驗證核心後端模組...\n');

  const backendModules = [
    'server.js',
    'synology-drive-client.js',
    'drive-path-manager.js',
    'learning-upload-helper.js',
    'notification-manager.js',
    'reminder-scheduler.js'
  ];

  backendModules.forEach(file => {
    fileValidator.validateFileExists(file, 'Backend');
    fileValidator.validateJavaScriptSyntax(file, 'Backend');
  });

  // ==================== 3. 工具模組驗證 ====================
  console.log('\n🛠️  驗證工具模組...\n');

  const utilModules = [
    'utils/logger.js',
    'utils/safe-file-operations.js',
    'utils/semester-helper.js',
    'utils/date-formatter.js',
    'utils/course-name-cleaner.js',
    'utils/drive-path-helper.js',
    'utils/metadata-transformer.js'
  ];

  utilModules.forEach(file => {
    fileValidator.validateFileExists(file, 'Utils');
    moduleValidator.validateNodeModule(file, 'Utils');
  });

  // ==================== 4. 前端核心檔案驗證 ====================
  console.log('\n🎨 驗證前端核心檔案...\n');

  const frontendFiles = [
    'public/learning-record-upload.html',
    'public/js/pages/learning-record-upload.js',
    'public/css/learning-records.css'
  ];

  frontendFiles.forEach(file => {
    fileValidator.validateFileExists(file, 'Frontend');
    
    if (file.endsWith('.js')) {
      fileValidator.validateJavaScriptSyntax(file, 'Frontend');
    } else if (file.endsWith('.css')) {
      fileValidator.validateCSS(file, 'Frontend');
    }
  });

  // ==================== 5. 整合檢查 ====================
  console.log('\n🔗 驗證系統整合...\n');

  integrationValidator.validateEnvironmentVariables();
  integrationValidator.validateDependencies();

  // ==================== 6. 文檔驗證 ====================
  console.log('\n📚 驗證文檔...\n');

  const docs = [
    'README.md',
    'docs/PROGRESS-MIGRATION-GUIDE.md',
    'docs/PROGRESS-REFACTOR-SUMMARY.md',
    'AGENTS.md'
  ];

  docs.forEach(file => {
    fileValidator.validateFileExists(file, 'Documentation');
  });

  // ==================== 生成報告 ====================
  const report = collector.generateReport();
  console.log(report);

  // 寫入報告檔案
  const reportPath = path.join(__dirname, 'validation-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`📄 驗證報告已保存: ${reportPath}`);

  const summary = collector.getSummary();
  return summary.success ? 0 : 1;
}

// ==================== 執行驗證 ====================
if (require.main === module) {
  runSystemValidation()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('❌ 驗證過程發生錯誤:', error);
      process.exit(1);
    });
}

module.exports = {
  runSystemValidation,
  ValidationCollector,
  FileSystemValidator,
  ModuleValidator,
  IntegrationValidator
};
