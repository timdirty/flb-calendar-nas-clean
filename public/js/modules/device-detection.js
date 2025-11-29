/**
 * 📱 低階手機偵測：根據硬體與連線條件，加上 body.low-end 降噪樣式
 */
(function(){
  try {
    // 🔧 允許以 URL 參數強制開啟：?lite=1
    var forceLite = (function(){ try { var p=new URLSearchParams(location.search); return p.get('lite')==='1'; } catch(e){ return false; } })();
    if (forceLite) { window.__LOW_END = true; document.addEventListener('DOMContentLoaded', function(){ try { document.body.classList.add('low-end'); } catch(e){} }); return; }
    var hc = (navigator.hardwareConcurrency || 0);
    var dm = (navigator.deviceMemory || 0);
    var et = (navigator.connection && navigator.connection.effectiveType) || '';
    var isWeakCpu = hc && hc <= 4;
    var isLowMem = dm && dm <= 2;
    var isSlowNet = /(^|\b)(2g|slow-2g)\b/i.test(String(et));
    var isSmallScreen = Math.min(screen.width, screen.height) <= 420;
    if (isWeakCpu || isLowMem || isSlowNet || isSmallScreen) {
      document.addEventListener('DOMContentLoaded', function(){ try { document.body.classList.add('low-end'); } catch (e) {} });
    }
  } catch (e) {}
})();
