(function (global) {
  const UrlParams = {
    parse() {
      try {
        const sp = new URLSearchParams(global.location.search);
        return {
          eventId: (sp.get('eventId') || '').trim(),
          date: (sp.get('date') || '').trim(),
          time: (sp.get('time') || '').trim(),
          instructor: (sp.get('instructor') || '').trim(),
          // 🔥 擴充以支援歷史紀錄深連結
          course: (sp.get('course') || '').trim(),
          topic: (sp.get('topic') || '').trim(),
          student: (sp.get('student') || '').trim(),
          autoLoad: (sp.get('autoLoad') || '').trim()
        };
      } catch (e) {
        return { eventId: '', date: '', time: '', instructor: '', course: '', topic: '', student: '', autoLoad: '' };
      }
    },
    getTargetInfo() { return this.parse(); }
  };

  global.FLB = global.FLB || {};
  global.FLB.UrlParams = UrlParams;
})(window);




