/**
 * 共用預覽渲染工具（學生/課程總覽一致化）
 * - 封裝 overlay/進度/完成狀態，呼叫既有全域函式以維持樣式一致
 * - 僅處理前端視覺與互動，不涉路徑與 API
 * 
 * 🔥 [統一 2025-11-19] 統一進度顯示機制：
 * - 學生頁面和課程總覽都使用此模組的統一接口
 * - ensureOverlay: 確保預覽有進度 overlay
 * - setProgress: 設置進度 (0-100)
 * - markSynced: 標記為已同步
 * - bindDelete: 綁定刪除按鈕（可選，優先使用 ensureDeleteButtonWorks）
 */
(function (global) {
  'use strict';

  function safe(fn) {
    try { return fn && fn(); } catch (e) { /* noop */ }
  }

  function ensureOverlay(node) {
    if (!node) return null;
    if (typeof global.ensureFilePreviewOverlay === 'function') {
      return global.ensureFilePreviewOverlay(node);
    }
    // 極簡降級：建立必要節點
    var overlay = node.querySelector('.file-uploading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      node.appendChild(overlay);
    }
    var text = overlay.querySelector('.progress-text');
    if (!text) {
      text = document.createElement('div');
      text.className = 'progress-text';
      overlay.appendChild(text);
    }
    var bar = overlay.querySelector('.file-upload-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'file-upload-progress';
      var fill = document.createElement('div');
      fill.className = 'file-upload-progress-fill';
      bar.appendChild(fill);
      overlay.appendChild(bar);
    }
    return { overlay: overlay, progressText: text };
  }

  function setProgress(node, percent, label) {
    if (!node) return;
    ensureOverlay(node);
    try { node.classList.add('uploading'); node.classList.remove('pending','upload-error'); } catch (e) {}
    if (typeof global.setPreviewProgress === 'function') {
      safe(function(){ global.setPreviewProgress(node, Math.max(0, Math.min(100, Math.round(percent || 0)))); });
    } else {
      // 🔥 [修復 2025-11-18] 降級邏輯也要使用像素值
      var fill = node.querySelector('.file-upload-progress-fill, .file-upload-progress .fill');
      if (fill) {
        var bounded = Math.max(0, Math.min(100, Math.round(percent || 0)));
        var pixelWidth = Math.round(70 * bounded / 100);
        fill.style.width = pixelWidth + 'px';
      }
    }
    var textEl = node.querySelector('.file-uploading-overlay .progress-text');
    if (textEl && label) textEl.textContent = label;
    var ov = node.querySelector('.file-uploading-overlay');
    if (ov) ov.style.display = 'flex';
  }

  function markSynced(node) {
    if (!node) return;
    ensureOverlay(node);
    node.classList.remove('new-upload', 'pending', 'uploading', 'hover-disabled');
    node.classList.add('existing', 'synced-preview', 'upload-success');
    node.setAttribute('data-awaiting-sync', '1');
    var ov = node.querySelector('.file-uploading-overlay');
    if (ov) ov.style.display = 'none';
  }

  function bindDelete(node, handler) {
    if (!node) return;
    var btn = node.querySelector('.remove-btn');
    if (!btn || btn.__sp_bound) return;
    btn.__sp_bound = true;
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof handler === 'function') handler(node, btn);
    });
  }

  global.SharedPreviewRenderer = {
    ensureOverlay: ensureOverlay,
    setProgress: setProgress,
    markSynced: markSynced,
    bindDelete: bindDelete
  };
})(window);
