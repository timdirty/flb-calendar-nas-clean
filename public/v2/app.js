/**
 * ============================================
 * 學習歷程上傳系統 V2 - 主程式
 * ============================================
 * 架構：ES Module + 元件化
 * 目標：零依賴、高效能、易維護
 * 版本：2.0.0-beta
 */

// ==================== 模組導入 ====================
import { StateManager } from './services/StateManager.js';
import { DriveService } from './services/DriveService.js';
import { UploadService } from './services/UploadService.js';
import { CourseSelector } from './components/CourseSelector.js';
import { StudentCard } from './components/StudentCard.js';
import { MediaUploader } from './components/MediaUploader.js';

// ==================== 應用程式類 ====================
class App {
  constructor() {
    this.state = new StateManager();
    this.drive = new DriveService();
    this.uploader = new UploadService(this.drive);
    
    // 元件實例
    this.courseSelector = null;
    this.studentCards = [];
    this.mediaUploader = null;
    
    console.log('🚀 [V2] 應用程式初始化');
  }

  /**
   * 初始化應用程式
   */
  async init() {
    try {
      console.log('🔧 [V2] 開始初始化...');
      
      // 1. 檢查環境
      this.checkEnvironment();
      
      // 2. 載入課程列表
      await this.loadCourses();
      
      // 3. 綁定全域事件
      this.bindGlobalEvents();
      
      console.log('✅ [V2] 初始化完成');
    } catch (error) {
      console.error('❌ [V2] 初始化失敗:', error);
      this.showError('系統初始化失敗，請重新整理頁面');
    }
  }

  /**
   * 檢查環境
   */
  checkEnvironment() {
    // 檢查必要的 API
    if (!window.fetch) {
      throw new Error('瀏覽器不支援 Fetch API');
    }
    
    if (!window.FormData) {
      throw new Error('瀏覽器不支援 FormData');
    }
    
    console.log('✅ [V2] 環境檢查通過');
  }

  /**
   * 載入課程列表
   */
  async loadCourses() {
    try {
      const courses = await this.drive.fetchCourses();
      this.state.setCourses(courses);
      
      // 渲染課程選擇器
      const container = document.getElementById('course-list');
      this.courseSelector = new CourseSelector(container, {
        courses,
        onSelect: (course) => this.handleCourseSelect(course)
      });
      
      console.log(`✅ [V2] 載入 ${courses.length} 個課程`);
    } catch (error) {
      console.error('❌ [V2] 載入課程失敗:', error);
      throw error;
    }
  }

  /**
   * 處理課程選擇
   */
  async handleCourseSelect(course) {
    try {
      console.log('📚 [V2] 選擇課程:', course.title);
      
      this.state.setSelectedCourse(course);
      
      // 載入學生列表
      const students = await this.drive.fetchStudents(course);
      this.state.setStudents(students);
      
      // 渲染學生卡片
      this.renderStudentCards(students);
      
      // 初始化上傳器
      this.initMediaUploader(course);
      
    } catch (error) {
      console.error('❌ [V2] 處理課程選擇失敗:', error);
      this.showError('載入學生列表失敗');
    }
  }

  /**
   * 渲染學生卡片
   */
  renderStudentCards(students) {
    const container = document.getElementById('student-list');
    container.innerHTML = '';
    
    this.studentCards = students.map(student => {
      const card = new StudentCard(container, {
        student,
        onSelect: (s) => this.handleStudentSelect(s)
      });
      return card;
    });
    
    console.log(`✅ [V2] 渲染 ${students.length} 個學生卡片`);
  }

  /**
   * 初始化媒體上傳器
   */
  initMediaUploader(course) {
    const container = document.getElementById('media-uploader');
    this.mediaUploader = new MediaUploader(container, {
      course,
      uploader: this.uploader,
      onProgress: (progress) => this.handleUploadProgress(progress),
      onComplete: (result) => this.handleUploadComplete(result)
    });
    
    console.log('✅ [V2] 上傳器已初始化');
  }

  /**
   * 處理學生選擇
   */
  handleStudentSelect(student) {
    console.log('👤 [V2] 選擇學生:', student.name);
    this.state.setSelectedStudent(student);
    
    if (this.mediaUploader) {
      this.mediaUploader.setStudent(student);
    }
  }

  /**
   * 處理上傳進度
   */
  handleUploadProgress(progress) {
    console.log('📊 [V2] 上傳進度:', progress);
    // 更新 UI
  }

  /**
   * 處理上傳完成
   */
  handleUploadComplete(result) {
    console.log('✅ [V2] 上傳完成:', result);
    this.showSuccess('上傳成功！');
  }

  /**
   * 綁定全域事件
   */
  bindGlobalEvents() {
    // 錯誤捕獲
    window.addEventListener('error', (event) => {
      console.error('❌ [V2] 全域錯誤:', event.error);
    });
    
    // 未處理的 Promise 拒絕
    window.addEventListener('unhandledrejection', (event) => {
      console.error('❌ [V2] 未處理的 Promise 拒絕:', event.reason);
    });
  }

  /**
   * 顯示錯誤訊息
   */
  showError(message) {
    // TODO: 實作更好的 UI 提示
    alert(`❌ ${message}`);
  }

  /**
   * 顯示成功訊息
   */
  showSuccess(message) {
    // TODO: 實作更好的 UI 提示
    alert(`✅ ${message}`);
  }
}

// ==================== 應用程式啟動 ====================
const app = new App();

// DOM 載入完成後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// 暴露到全域（開發除錯用）
window.V2App = app;

export default app;
