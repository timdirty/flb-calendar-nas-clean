// ============================================
// 快取工具（分層：今日/本週/本月）- 簡易版
// 統一使用台北時區工具進行日期計算
// 版本：v1-20251101
// ============================================
(function () {
    'use strict';

    const SCHEMA = 'FLB_CACHE_V1'; // 💡 如結構有變更請遞增
    const PREFIX = SCHEMA + ':events:'; // key 前綴

    // 預設 TTL（毫秒）
    const TTL = {
        today: 15 * 60 * 1000,   // 15 分鐘
        week: 60 * 60 * 1000,    // 60 分鐘
        month: 6 * 60 * 60 * 1000 // 6 小時
    };

    function safeParse(json) {
        try { return JSON.parse(json); } catch (_) { return null; }
    }

    function keyForRange(range, baseDate) {
        const T = window.TaipeiTimeUtils || {};
        const dStart = (T.getDateStartInTaipei ? T.getDateStartInTaipei(baseDate) : new Date(baseDate));
        const y = dStart.getFullYear();
        const mm = String(dStart.getMonth() + 1).padStart(2, '0');
        const dd = String(dStart.getDate()).padStart(2, '0');

        if (range === 'today') {
            return `${PREFIX}today:${y}${mm}${dd}`;
        }
        if (range === 'week') {
            const start = (T.getWeekStartInTaipei ? T.getWeekStartInTaipei(baseDate) : new Date(baseDate));
            if (!T.getWeekStartInTaipei) {
                start.setDate(start.getDate() - start.getDay());
                start.setHours(0,0,0,0);
            }
            const end = new Date(start);
            end.setDate(start.getDate() + 7); // 下週日
            const mk = (dt) => `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`;
            return `${PREFIX}week:${mk(start)}-${mk(end)}`;
        }
        if (range === 'month') {
            return `${PREFIX}month:${y}${mm}`;
        }
        return `${PREFIX}misc:${y}${mm}${dd}`;
    }

    function setJSON(key, value, ttlMs) {
        const payload = {
            schema: SCHEMA,
            t: Date.now(),
            e: Date.now() + (ttlMs || (60*60*1000)),
            data: value
        };
        try { localStorage.setItem(key, JSON.stringify(payload)); } catch (_) {}
    }

    function getJSONIfFresh(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = safeParse(raw);
        if (!obj || obj.schema !== SCHEMA) return null;
        if (typeof obj.e !== 'number' || obj.e < Date.now()) return null;
        return obj.data;
    }

    function cleanupExpired() {
        try {
            const now = Date.now();
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(PREFIX)) continue;
                const obj = safeParse(localStorage.getItem(k));
                if (!obj || obj.schema !== SCHEMA || (obj.e && obj.e < now)) {
                    localStorage.removeItem(k);
                }
            }
        } catch (e) { console.warn('⚠️ 快取清理失敗:', e.message); }
    }

    function readEvents(range, baseDate) {
        const key = keyForRange(range, baseDate);
        return getJSONIfFresh(key);
    }

    function writeEvents(range, baseDate, events) {
        const key = keyForRange(range, baseDate);
        setJSON(key, { success: true, events }, TTL[range] || (60*60*1000));
    }

    window.FLB_Cache = {
        SCHEMA,
        keyForRange,
        readEvents,
        writeEvents,
        cleanupExpired,
        TTL
    };

    console.log('✅ 分層快取工具已載入（today/week/month）');
})();

