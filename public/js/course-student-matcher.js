(function (global) {
  // Node.js (server) 環境：轉載到新路徑的模組
  if (typeof module !== 'undefined' && module.exports) {
    try {
      module.exports = require('./modules/course-student-matcher.js');
      return;
    } catch (err) {
      throw err;
    }
  }

  // 瀏覽器環境：動態載入新位置的實體檔案，維持舊路徑相容性
  if (typeof document !== 'undefined') {
    var already = document.querySelector('script[data-loader="course-student-matcher-shim"]');
    if (!already) {
      var s = document.createElement('script');
      s.src = '/js/modules/course-student-matcher.js';
      s.async = false;
      s.setAttribute('data-loader', 'course-student-matcher-shim');
      document.head.appendChild(s);
    }
  }
})(typeof window !== 'undefined' ? window : this);



