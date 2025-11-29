/**
 * Learning Upload Student Store
 * 提供 subscribe / notify 機制，讓 UI 只更新關聯學生的 DOM。
 */
(function (global) {
  'use strict';

  var records = {};
  var listeners = {};
  var globalListeners = [];

  function ensureRecord(index) {
    if (!records.hasOwnProperty(index)) {
      records[index] = {};
    }
    return records[index];
  }

  function notify(index) {
    var record = records[index];
    if (listeners[index]) {
      listeners[index].forEach(function (fn) {
        try { fn(record, index); } catch (e) {}
      });
    }
    globalListeners.forEach(function (fn) {
      try { fn(record, index); } catch (e) {}
    });
  }

  var store = {
    set: function (index, state) {
      records[index] = state || {};
      notify(index);
    },
    touch: function (index) {
      notify(index);
    },
    get: function (index) {
      return ensureRecord(index);
    },
    subscribe: function (index, callback) {
      if (!listeners[index]) listeners[index] = [];
      listeners[index].push(callback);
      return function () {
        if (!listeners[index]) return;
        var idx = listeners[index].indexOf(callback);
        if (idx > -1) listeners[index].splice(idx, 1);
      };
    },
    subscribeAll: function (callback) {
      globalListeners.push(callback);
      return function () {
        var idx = globalListeners.indexOf(callback);
        if (idx > -1) globalListeners.splice(idx, 1);
      };
    }
  };

  global.LearningUploadStudentStore = store;
})(typeof window !== 'undefined' ? window : this);
