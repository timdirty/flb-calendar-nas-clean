(function (global) {
  // 💎 液態玻璃樣式：建立容器與樣式（僅注入一次）
  function ensureToastAssets() {
    if (document.getElementById('flb-toast-style')) return;
    const css = `
      .toast-container{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:1200;display:flex;flex-direction:column;gap:8px;align-items:center;width:min(92%,560px);pointer-events:none}
      .toast{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);backdrop-filter: blur(12px);-webkit-backdrop-filter: blur(12px);color:#0f172a;box-shadow:0 10px 30px rgba(2,6,23,.16);font-weight:700}
      .toast i{color:inherit}
      .toast.success{color:#065f46;background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.22)}
      .toast.error{color:#7f1d1d;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.22)}
      .toast.warning{color:#7c2d12;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.22)}
      .toast.info{color:#1e3a8a;background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.22)}
    `;
    const style = document.createElement('style');
    style.id = 'flb-toast-style';
    style.textContent = css;
    document.head.appendChild(style);
    let cont = document.createElement('div');
    cont.className = 'toast-container';
    cont.id = 'flb-toast-container';
    document.body.appendChild(cont);
  }
  function toast(message, type) {
    ensureToastAssets();
    const t = (type || 'info');
    const div = document.createElement('div');
    div.className = 'toast ' + t;
    div.style.pointerEvents = 'none';
    const icon = t === 'success' ? 'fa-check-circle' : t === 'error' ? 'fa-exclamation-circle' : t === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    div.innerHTML = '<i class="fas ' + icon + '"></i><span>' + String(message || '') + '</span>';
    const container = document.getElementById('flb-toast-container') || document.body;
    // 🔒 單例：同時間只顯示一個 toast（覆蓋前一個）
    try {
      const prev = container.querySelector('.toast');
      if (prev) prev.remove();
    } catch (e) {}
    container.appendChild(div);
    setTimeout(function () { try { div.remove(); } catch (e) {} }, 2500);
  }

  // ============================================
  // 📊 進度 Toast（大量檔案處理時顯示進度）
  // ============================================
  
  /**
   * 顯示進度 Toast
   * @param {string} title - 標題（例如：「壓縮照片」）
   * @param {number} progress - 進度百分比（0-100）
   * @returns {string} Toast ID
   */
  function showProgressToast(title, progress) {
    ensureToastAssets();
    const id = 'progress-toast-' + Date.now();
    const pct = Math.max(0, Math.min(100, progress || 0));
    const html = `
      <div id="${id}" class="toast toast-progress">
        <div class="toast-header">${title}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="progress-text">${pct}%</div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    return id;
  }

  /**
   * 更新進度 Toast
   * @param {string} id - Toast ID
   * @param {number} progress - 進度百分比（0-100）
   */
  function updateProgressToast(id, progress) {
    const toastEl = document.getElementById(id);
    if (!toastEl) return;
    
    const pct = Math.max(0, Math.min(100, progress || 0));
    const fill = toastEl.querySelector('.progress-fill');
    const text = toastEl.querySelector('.progress-text');
    
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
  }

  /**
   * 隱藏進度 Toast
   * @param {string} id - Toast ID
   */
  function hideProgressToast(id) {
    const toastEl = document.getElementById(id);
    if (toastEl) {
      toastEl.style.opacity = '0';
      setTimeout(function() { 
        try { toastEl.remove(); } catch (e) {} 
      }, 300);
    }
  }

  global.FLB = global.FLB || {};
  global.FLB.UI = global.FLB.UI || {};
  global.FLB.UI.toast = toast;
  global.FLB.UI.showProgressToast = showProgressToast;
  global.FLB.UI.updateProgressToast = updateProgressToast;
  global.FLB.UI.hideProgressToast = hideProgressToast;
})(window);

