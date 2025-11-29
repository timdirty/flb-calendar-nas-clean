/**
 * ============================================
 * Pending Media Store
 * ============================================
 * 輕量狀態容器，用來追蹤尚未上傳完成的媒體檔案
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'lr_pending_media_store_v1';
  var storageAvailable = (function () {
    try {
      return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
    } catch (e) {
      return false;
    }
  })();

  function loadStore() {
    if (!storageAvailable) return {};
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw && raw.length) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('⚠️ [PendingMediaStore] 無法載入快取:', e.message);
    }
    return {};
  }

  var store = loadStore();
  var seq = Object.keys(store).length;
  var persistTimer = null;

  function persistStore() {
    if (!storageAvailable) return;
    if (persistTimer) return;
    persistTimer = setTimeout(function () {
      persistTimer = null;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch (e) {
        console.warn('⚠️ [PendingMediaStore] 無法寫入快取:', e.message);
      }
    }, 50);
  }

  function create(meta) {
    var id = 'pending-' + Date.now() + '-' + (++seq);
    store[id] = Object.assign({
      id: id,
      state: 'queued',
      createdAt: Date.now()
    }, meta || {});
    persistStore();
    return id;
  }

  function update(id, patch) {
    if (!id || !store[id]) return;
    Object.assign(store[id], patch || {});
    persistStore();
  }

  function remove(id) {
    if (!id || !store[id]) return;
    delete store[id];
    persistStore();
  }

  function get(id) {
    if (!id) return null;
    return store[id] || null;
  }

  function listByStudent(studentIndex, type) {
    return Object.keys(store).map(function (key) { return store[key]; }).filter(function (item) {
      if (typeof studentIndex === 'number' && item.studentIndex !== studentIndex) return false;
      if (type && item.type !== type) return false;
      return true;
    });
  }

  function listAll() {
    return Object.keys(store).map(function (key) { return store[key]; });
  }

  var PendingMediaStore = {
    create: create,
    update: update,
    remove: remove,
    get: get,
    listByStudent: listByStudent,
    listAll: listAll
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PendingMediaStore;
  } else {
    global.PendingMediaStore = PendingMediaStore;
  }

  console.log('✅ [PendingMediaStore] 初始化完成');

})(typeof window !== 'undefined' ? window : this);
