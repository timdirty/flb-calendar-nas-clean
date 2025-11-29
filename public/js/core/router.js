(function (global) {
    'use strict';

    // ✅ 超輕量前端 Router（Query + Hash）
    const listeners = [];

    function parseQuery(search) {
        const params = {};
        (search || '').replace(/^\?/, '').split('&').forEach(function (pair) {
            if (!pair) return;
            const idx = pair.indexOf('=');
            const k = idx >= 0 ? decodeURIComponent(pair.slice(0, idx)) : decodeURIComponent(pair);
            const v = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)) : '';
            params[k] = v;
        });
        return params;
    }

    function stringifyQuery(obj) {
        const keys = Object.keys(obj || {});
        if (!keys.length) return '';
        return '?' + keys.map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] == null ? '' : obj[k]); }).join('&');
    }

    function getRoute() {
        const q = parseQuery(global.location.search || '');
        const h = (global.location.hash || '').replace(/^#/, '');
        if (h && !q.step) q.step = h; // 兼容 hash
        q.step = q.step || 'select';
        return q;
    }

    function navigate(next, options) {
        const current = getRoute();
        const route = Object.assign({}, current, next || {});
        const url = global.location.pathname + stringifyQuery(route);
        if (options && options.replace) {
            global.history.replaceState(route, '', url);
        } else {
            global.history.pushState(route, '', url);
        }
        emit(route);
    }

    function onChange(fn) {
        if (typeof fn === 'function') listeners.push(fn);
    }

    function emit(route) {
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](route); } catch (e) { console.error('❌ Router listener error:', e); }
        }
    }

    global.addEventListener('popstate', function () { emit(getRoute()); });

    global.FLB = global.FLB || {};
    global.FLB.Router = {
        getRoute: getRoute,
        navigate: navigate,
        onChange: onChange,
        parseQuery: parseQuery,
        stringifyQuery: stringifyQuery
    };
})(window);


