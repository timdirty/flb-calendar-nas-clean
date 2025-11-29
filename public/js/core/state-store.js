(function (global) {
    'use strict';

    const subscribers = {};
    const state = {
        selectedCourse: null,
        students: [],
        currentStudentIndex: 0,
        uploadedRecordsCache: {},
        drafts: {},
        progress: { percent: 0, completed: 0, total: 0 }
    };

    function getState() { return state; }

    function setPartial(patch) {
        const keys = Object.keys(patch || {});
        if (!keys.length) return;
        keys.forEach(function (k) { state[k] = patch[k]; });
        notify(keys);
    }

    function on(keys, fn) {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(function (k) {
            subscribers[k] = subscribers[k] || [];
            if (typeof fn === 'function') subscribers[k].push(fn);
        });
    }

    function notify(keys) {
        (keys || Object.keys(subscribers)).forEach(function (k) {
            const list = subscribers[k] || [];
            for (var i = 0; i < list.length; i++) {
                try { list[i](state[k], state); } catch (e) { console.error('❌ State subscriber error:', e); }
            }
        });
    }

    global.FLB = global.FLB || {};
    global.FLB.State = {
        get: getState,
        set: setPartial,
        on: on
    };
})(window);


