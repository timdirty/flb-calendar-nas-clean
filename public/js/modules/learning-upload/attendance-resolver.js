/**
 * 學習歷程上傳系統 - 出缺席狀態解析器
 * 處理學生出缺席狀態的解析和判斷
 */

(function (global) {
  'use strict';

  const Constants = global.LearningUploadConstants || {};

  // ============================================
  // 出缺席解析器
  // ============================================
  class AttendanceResolver {
    constructor() {
      this.statusText = Constants.ATTENDANCE?.TEXT || {
        present: '✅ 已出席，請完成上傳。',
        leave: '🏥 今日已請假，系統已鎖定上傳。',
        absent: '⚠️ 今日缺席，系統已鎖定上傳。',
        unknown: '🕒 尚未紀錄出缺席。'
      };

      this.statusClass = Constants.ATTENDANCE?.CLASS || {
        present: 'status-present',
        leave: 'status-leave',
        absent: 'status-absent',
        unknown: 'status-unknown'
      };
    }

    /**
     * 格式化日期為 YYYY-MM-DD
     */
    formatDateKey(value) {
      if (!value && value !== 0) return '';
      try {
        if (value instanceof Date) {
          if (isNaN(value.getTime())) return '';
          return value.toISOString().slice(0, 10);
        }
        if (typeof value === 'number') {
          const dateFromNumber = new Date(value);
          if (isNaN(dateFromNumber.getTime())) return '';
          return dateFromNumber.toISOString().slice(0, 10);
        }
        const text = String(value || '').trim();
        if (!text) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const parsed = new Date(text);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      } catch (e) {}
      return '';
    }

    /**
     * 解析學生出缺席狀態
     */
    resolve(student, targetDateKey) {
      const fallback = {
        status: 'unknown',
        message: this.statusText.unknown,
        record: null,
        class: this.statusClass.unknown
      };

      if (!student || !targetDateKey) {
        return fallback;
      }

      const records = Array.isArray(student.attendance) ? student.attendance : [];
      let matchedRecord = null;

      for (let i = 0; i < records.length; i++) {
        const entry = records[i];
        if (!entry) continue;
        const entryKey = this.formatDateKey(entry.date);
        if (entryKey === targetDateKey) {
          matchedRecord = entry;
          break;
        }
      }

      if (!matchedRecord) {
        return fallback;
      }

      const presentValue = matchedRecord.present;
      let status = 'unknown';

      if (presentValue === true) {
        status = 'present';
      } else if (presentValue === false) {
        status = 'absent';
      } else if (typeof presentValue === 'string') {
        const normalized = presentValue.toLowerCase();
        if (normalized === 'leave') {
          status = 'leave';
        } else if (normalized === 'absent' || normalized === 'absence') {
          status = 'absent';
        } else if (normalized === 'present') {
          status = 'present';
        }
      }

      return {
        status: status,
        message: this.statusText[status] || this.statusText.unknown,
        record: matchedRecord,
        class: this.statusClass[status] || this.statusClass.unknown
      };
    }

    /**
     * 為課程補充出缺席資訊
     */
    augmentCourse(course) {
      if (!course || !Array.isArray(course.students)) {
        return;
      }

      const targetKey = this.formatDateKey(course.start) ||
                       this.formatDateKey(course.date) ||
                       this.formatDateKey(course.dateKey);

      if (!targetKey && course.meta && course.meta.date) {
        targetKey = this.formatDateKey(course.meta.date);
      }

      course.attendanceDateKey = targetKey;

      course.students.forEach((student) => {
        const info = targetKey
          ? this.resolve(student, targetKey)
          : {
              status: 'unknown',
              message: this.statusText.unknown,
              record: null,
              class: this.statusClass.unknown
            };

        student.attendanceStatus = info.status;
        student.attendanceMessage = info.message;
        student.attendanceRecord = info.record;
        student.attendanceClass = info.class;
      });
    }

    /**
     * 判斷學生是否可以上傳（根據出缺席狀態）
     */
    canUpload(student) {
      if (!student) return false;
      const status = student.attendanceStatus || 'unknown';
      return status === 'present' || status === 'unknown';
    }

    /**
     * 獲取出缺席狀態文字
     */
    getStatusText(status) {
      return this.statusText[status] || this.statusText.unknown;
    }

    /**
     * 獲取出缺席狀態 CSS 類
     */
    getStatusClass(status) {
      return this.statusClass[status] || this.statusClass.unknown;
    }
  }

  // ============================================
  // 導出
  // ============================================
  const resolver = new AttendanceResolver();
  global.LearningUploadAttendance = resolver;

})(window);
