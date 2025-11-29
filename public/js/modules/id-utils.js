(function (global) {
  function toLowerSafe(value) {
    return String(value == null ? '' : value).toLowerCase();
  }

  const Id = {
    normalizeCourseId(event) {
      if (!event) return null;
      return event.id || event.uid || event.evt_id || (event._raw && (event._raw.uid || event._raw.evt_id)) || null;
    },
    matches(targetId, course) {
      const t = toLowerSafe(targetId);
      const candidates = [course && course.id, course && course.uid, course && course.evt_id, course && course._raw && course._raw.uid, course && course._raw && course._raw.evt_id]
        .map(toLowerSafe);
      return t && candidates.includes(t);
    }
  };

  global.FLB = global.FLB || {};
  global.FLB.Id = Id;
})(window);





