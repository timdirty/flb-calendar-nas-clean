(function (global) {
    'use strict';

    // 🔎 統一校驗規則（≥3 照片 / 評語有字即可；影片為建議項目不強制）
    function validateStudentDraft(draft) {
        const photos = (draft && draft.photos) ? draft.photos.length : 0;
        const videos = (draft && draft.videos) ? draft.videos.length : 0;
        const commentLen = ((draft && draft.comment) || '').length;
        const missing = [];
        if (photos < 3) missing.push('缺照片');
        // 影片改為建議，不列入缺失
        if (commentLen < 1) missing.push('缺評語');
        return { done: missing.length === 0, missing: missing };
    }

    function compute(students, drafts, uploaded) {
        // ✅ 同時考慮「本地草稿」與「伺服器既有記錄」
        //    以伺服器資料為優先（authoritative），避免重新整理後出現已完成卻顯示未完成的狀況。
        const uploadedList = (uploaded && Array.isArray(uploaded.students)) ? uploaded.students : [];
        const uploadedMap = {};
        uploadedList.forEach(function (r) {
            if (!r || !r.studentName) return;
            try {
                if (typeof NormalizeUtils !== 'undefined' && NormalizeUtils.normalizeStudentName) {
                    uploadedMap[NormalizeUtils.normalizeStudentName(r.studentName)] = r;
                    return;
                }
            } catch (e) {}
            uploadedMap[String(r.studentName).trim().toLowerCase().replace(/\s+/g, '')] = r;
        });

        const list = (students || []).map(function (s, i) {
            const key = String(i);
            const name = (s && s.name) || String(s || '');
            const draft = drafts && drafts[key];

            // 🧮 伺服器記錄：以 files/photos、files/videos 與 comment 長度為準
            let normName;
            try { normName = (typeof NormalizeUtils !== 'undefined' && NormalizeUtils.normalizeStudentName) ? NormalizeUtils.normalizeStudentName(name) : String(name).trim().toLowerCase().replace(/\s+/g, ''); } catch (e) { normName = String(name).trim().toLowerCase().replace(/\s+/g, ''); }
            const rec = uploadedMap[normName];
            let upPhotos = 0, upVideos = 0, upComment = 0;
            if (rec) {
                const photos = (rec.files && Array.isArray(rec.files.photos)) ? rec.files.photos : [];
                const videos = (rec.files && Array.isArray(rec.files.videos)) ? rec.files.videos : [];
                upPhotos = (typeof rec.photos === 'number') ? rec.photos : photos.length;
                upVideos = (typeof rec.videos === 'number') ? rec.videos : videos.length;
                upComment = (rec.comment || '').length;
            }

            // ✅ 與頁面一致：照片≥3 且評語有字即可
            const uploadedOk = (upPhotos >= 3 && upComment >= 1);

            // 本地草稿檢查（僅在伺服器尚未完成時才影響顯示）
            const result = validateStudentDraft(draft);
            const done = uploadedOk || result.done;
            const reasons = uploadedOk ? [] : result.missing;

            return { index: i, name: name, done: done, reasons: reasons };
        });

        const completed = list.filter(function (x) { return x.done; }).length;
        const total = list.length;
        const percent = total ? (completed / total) * 100 : 0;
        const unfinished = list.filter(function (x) { return !x.done; }).map(function (x) { return { type: 'student', index: x.index, name: x.name, reason: (x.reasons[0] || '未完成') }; });

        return { percent: percent, completed: completed, total: total, unfinished: unfinished };
    }

    global.FLB = global.FLB || {};
    global.FLB.Checklist = { compute: compute, validateStudentDraft: validateStudentDraft };
})(window);
