/**
 * Shared UI components for Learning Record Upload.
 */
(function (global) {
  'use strict';

  function createOverlay(options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'file-uploading-overlay flb-overlay';
    var text = document.createElement('span');
    text.className = 'progress-text flb-overlay-text';
    text.textContent = (options && options.text) || '處理中';
    wrapper.appendChild(text);
    return wrapper;
  }

  function createProgressBar() {
    var bar = document.createElement('div');
    bar.className = 'file-upload-progress flb-progress';
    var fill = document.createElement('div');
    fill.className = 'file-upload-progress-fill flb-progress-fill';
    bar.appendChild(fill);
    return { root: bar, fill: fill };
  }

  function createGlassFab(options) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'glass-fab ' + (options && options.variant ? ('glass-fab--' + options.variant) : 'glass-fab--slate');
    if (options && options.id) btn.id = options.id;
    if (options && options.title) btn.title = options.title;
    if (options && options.iconClass) {
      var icon = document.createElement('i');
      icon.className = options.iconClass;
      btn.appendChild(icon);
    }
    if (options && options.label) {
      var span = document.createElement('span');
      span.textContent = options.label;
      btn.appendChild(span);
    }
    return btn;
  }

  global.FLBSharedUI = {
    createOverlay: createOverlay,
    createProgressBar: createProgressBar,
    createGlassFab: createGlassFab
  };
})(typeof window !== 'undefined' ? window : this);
