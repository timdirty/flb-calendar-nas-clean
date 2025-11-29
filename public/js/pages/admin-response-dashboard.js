(function (window, document) {
    'use strict';

    const STATUS_LABELS = {
        attend: '✅ 會出席',
        leave: '🏥 請假',
        pending: '⏳ 待確認',
        'no-response': '❔ 未回應'
    };

    const state = {
        initialized: false,
        isActive: false,
        quickRange: 'today',
        startDate: '',
        endDate: '',
        status: 'all',
        teacher: 'all',
        course: 'all',
        student: 'all',
        lastSummary: null
        // filters: populated dynamically
    };

    const elements = {};

    function init() {
        if (state.initialized) {
            return;
        }

        cacheElements();
        bindEvents();
        applyQuickRange('today', { silent: true });
        state.initialized = true;

        if (isSectionActive()) {
            fetchSummary();
        }
    }

    function cacheElements() {
        elements.section = document.getElementById('response-stats');
        if (!elements.section) {
            console.warn('response-stats section not found');
            return;
        }
        elements.quickRangeButtons = Array.from(elements.section.querySelectorAll('.response-range-btn'));
        elements.startDateInput = document.getElementById('responseStartDate');
        elements.endDateInput = document.getElementById('responseEndDate');
        elements.statusSelect = document.getElementById('responseStatusFilter');
        elements.teacherSelect = document.getElementById('responseTeacherFilter');
        elements.courseSelect = document.getElementById('responseCourseFilter');
        elements.studentSelect = document.getElementById('responseStudentFilter');
        elements.refreshBtn = document.getElementById('responseRefreshBtn');
        elements.exportBtn = document.getElementById('responseExportCsvBtn');
        elements.summary = {
            total: document.getElementById('responseSummaryTotal'),
            responded: document.getElementById('responseSummaryResponded'),
            attend: document.getElementById('responseSummaryAttend'),
            leave: document.getElementById('responseSummaryLeave'),
            pending: document.getElementById('responseSummaryPending'),
            noResponse: document.getElementById('responseSummaryNoResponse'),
            rate: document.getElementById('responseSummaryRate'),
            attendShare: document.getElementById('responseSummaryAttendShare'),
            leaveShare: document.getElementById('responseSummaryLeaveShare'),
            pendingShare: document.getElementById('responseSummaryPendingShare'),
            noResponseShare: document.getElementById('responseSummaryNoResponseShare')
        };
        elements.selectedRange = document.getElementById('responseSelectedRange');
        elements.lastUpdated = document.getElementById('responseLastUpdated');
        elements.trendContainer = document.getElementById('responseTrendContainer');
        elements.detailsBody = document.getElementById('responseDetailsBody');
        elements.detailsEmpty = document.getElementById('responseDetailsEmpty');
        elements.previewContainer = document.getElementById('responsePreviewContainer');
        elements.loadingOverlay = document.getElementById('responseLoading');
    }

    function bindEvents() {
        if (!elements.section) return;

        elements.quickRangeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-range');
                applyQuickRange(range);
            });
        });

        if (elements.startDateInput) {
            elements.startDateInput.addEventListener('change', handleCustomDateChange);
        }

        if (elements.endDateInput) {
            elements.endDateInput.addEventListener('change', handleCustomDateChange);
        }

        if (elements.statusSelect) {
            elements.statusSelect.addEventListener('change', () => {
                state.status = elements.statusSelect.value || 'all';
                fetchSummary();
            });
        }

        if (elements.teacherSelect) {
            elements.teacherSelect.addEventListener('change', () => {
                state.teacher = elements.teacherSelect.value || 'all';
                fetchSummary();
            });
        }

        if (elements.courseSelect) {
            elements.courseSelect.addEventListener('change', () => {
                state.course = elements.courseSelect.value || 'all';
                fetchSummary();
            });
        }

        if (elements.studentSelect) {
            elements.studentSelect.addEventListener('change', () => {
                state.student = elements.studentSelect.value || 'all';
                fetchSummary();
            });
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => fetchSummary());
        }

        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', handleExport);
        }
    }

    function applyQuickRange(range, options = {}) {
        state.quickRange = range;
        elements.quickRangeButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-range') === range;
            btn.classList.toggle('active', isActive);
        });

        let startDate;
        let endDate;

        switch (range) {
            case 'today':
                startDate = createTaiwanDate(0);
                endDate = createTaiwanDate(0);
                break;
            case 'yesterday':
                startDate = createTaiwanDate(-1);
                endDate = createTaiwanDate(-1);
                break;
            case 'last7':
                endDate = createTaiwanDate(0);
                startDate = createTaiwanDate(-6);
                break;
            case 'last30':
                endDate = createTaiwanDate(0);
                startDate = createTaiwanDate(-29);
                break;
            default:
                startDate = parseDateInput(elements.startDateInput?.value) || createTaiwanDate(0);
                endDate = parseDateInput(elements.endDateInput?.value) || createTaiwanDate(0);
                break;
        }

        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);
        state.startDate = startStr;
        state.endDate = endStr;

        if (elements.startDateInput) {
            elements.startDateInput.value = startStr;
        }
        if (elements.endDateInput) {
            elements.endDateInput.value = endStr;
        }

        if (!options.silent) {
            fetchSummary();
        }
    }

    function handleCustomDateChange() {
        state.quickRange = 'custom';
        elements.quickRangeButtons.forEach(btn => btn.classList.remove('active'));

        let startStr = elements.startDateInput?.value;
        let endStr = elements.endDateInput?.value;

        if (!startStr && endStr) {
            startStr = endStr;
        } else if (startStr && !endStr) {
            endStr = startStr;
        }

        if (!startStr || !endStr) {
            return;
        }

        const startDate = parseDateInput(startStr);
        const endDate = parseDateInput(endStr);
        if (!startDate || !endDate) {
            return;
        }

        if (endDate < startDate) {
            const temp = new Date(startDate);
            startStr = formatDate(endDate);
            endStr = formatDate(temp);
            if (elements.startDateInput) elements.startDateInput.value = startStr;
            if (elements.endDateInput) elements.endDateInput.value = endStr;
        }

        state.startDate = formatDate(parseDateInput(elements.startDateInput.value));
        state.endDate = formatDate(parseDateInput(elements.endDateInput.value));
        fetchSummary();
    }

    function fetchSummary() {
        if (!elements.section) return;
        if (!state.startDate || !state.endDate) return;

        setLoading(true);
        const params = new URLSearchParams();
        params.append('start', state.startDate);
        params.append('end', state.endDate);

        if (state.status && state.status !== 'all') params.append('status', state.status);
        if (state.teacher && state.teacher !== 'all') params.append('teacher', state.teacher);
        if (state.course && state.course !== 'all') params.append('course', state.course);
        if (state.student && state.student !== 'all') params.append('student', state.student);

        fetch(`/api/student-responses/summary?${params.toString()}`, { cache: 'no-cache' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(payload => {
                if (!payload.success) {
                    throw new Error(payload.message || '資料載入失敗');
                }
                state.lastSummary = payload.data || null;
                renderSummary(payload.data || {});
            })
            .catch(error => {
                console.error('載入家長回應統計失敗:', error);
                notify('❌ 無法載入回應統計：' + error.message, 'error');
            })
            .finally(() => {
                setLoading(false);
            });
    }

    function renderSummary(data) {
        if (!data) return;
        const totals = data.totals || {};
        updateFilters(data.filters || {}, data.statusLabels || STATUS_LABELS);
        updateSummaryCards(totals);
        updateMeta(data.range || {}, data.generatedAt);
        renderDailyTrend(data.daily || []);
        renderDetails(data.details || [], data.statusLabels || STATUS_LABELS);
        renderPreviews(data.reportPreviews || []);
    }

    function updateFilters(filters, labelMap) {
        if (elements.statusSelect && filters.statuses) {
            populateSelect(elements.statusSelect, filters.statuses.map(item => ({
                value: item.value,
                label: labelMap[item.value] || item.label || item.value
            })), state.status);
        }
        if (elements.teacherSelect && filters.teachers) {
            populateSelect(elements.teacherSelect, filters.teachers.map(name => ({ value: name, label: name })), state.teacher);
        }
        if (elements.courseSelect && filters.courses) {
            populateSelect(elements.courseSelect, filters.courses.map(name => ({ value: name, label: name })), state.course);
        }
        if (elements.studentSelect && filters.students) {
            populateSelect(elements.studentSelect, filters.students.map(name => ({ value: name, label: name })), state.student);
        }
    }

    function updateSummaryCards(totals) {
        const totalReminders = totals.totalReminders || 0;
        const responded = totals.responded || 0;
        const attend = totals.attend || 0;
        const leave = totals.leave || 0;
        const pending = totals.pending || 0;
        const noResponse = totals['no-response'] || 0;
        const responseRate = (totals.responseRate || 0);

        if (elements.summary.total) elements.summary.total.textContent = formatNumber(totalReminders);
        if (elements.summary.responded) elements.summary.responded.textContent = formatNumber(responded);
        if (elements.summary.attend) elements.summary.attend.textContent = formatNumber(attend);
        if (elements.summary.leave) elements.summary.leave.textContent = formatNumber(leave);
        if (elements.summary.pending) elements.summary.pending.textContent = formatNumber(pending);
        if (elements.summary.noResponse) elements.summary.noResponse.textContent = formatNumber(noResponse);

        if (elements.summary.rate) {
            elements.summary.rate.textContent = `回覆率 ${formatPercent(responseRate)}`;
        }
        if (elements.summary.attendShare) {
            elements.summary.attendShare.textContent = `佔比 ${formatPercent(totalReminders ? attend / totalReminders : 0)}`;
        }
        if (elements.summary.leaveShare) {
            elements.summary.leaveShare.textContent = `佔比 ${formatPercent(totalReminders ? leave / totalReminders : 0)}`;
        }
        if (elements.summary.pendingShare) {
            elements.summary.pendingShare.textContent = `佔比 ${formatPercent(totalReminders ? pending / totalReminders : 0)}`;
        }
        if (elements.summary.noResponseShare) {
            elements.summary.noResponseShare.textContent = `佔比 ${formatPercent(totalReminders ? noResponse / totalReminders : 0)}`;
        }
    }

    function updateMeta(range, generatedAt) {
        if (elements.selectedRange) {
            const start = range.start || '';
            const end = range.end || '';
            elements.selectedRange.textContent = start === end ? start : `${start} ~ ${end}`;
        }
        if (elements.lastUpdated) {
            if (generatedAt) {
                const time = formatDateTime(generatedAt);
                elements.lastUpdated.textContent = time;
            } else {
                elements.lastUpdated.textContent = '--';
            }
        }
    }

    function renderDailyTrend(daily) {
        if (!elements.trendContainer) return;
        elements.trendContainer.innerHTML = '';
        if (!daily.length) {
            elements.trendContainer.appendChild(createEmptyElement('尚無資料'));
            return;
        }
        daily.forEach(day => {
            const item = document.createElement('div');
            item.className = 'response-trend-item';

            const header = document.createElement('div');
            header.className = 'response-trend-header';
            header.innerHTML = `
                <span>${day.date}</span>
                <span>回覆率 ${formatPercent(day.responseRate || 0)}</span>
            `;

            const bar = document.createElement('div');
            bar.className = 'response-trend-bar';
            const total = day.totalReminders || 1;

            ['attend', 'leave', 'pending', 'no-response'].forEach(status => {
                const count = day[status] || 0;
                const segment = document.createElement('div');
                segment.className = `response-trend-segment ${status === 'no-response' ? 'no-response' : status}`;
                segment.style.width = `${total ? (count / total) * 100 : 0}%`;
                bar.appendChild(segment);
            });

            const stats = document.createElement('div');
            stats.className = 'response-trend-stats';
            stats.innerHTML = `
                <span style="color:#047857;">✅ ${day.attend || 0}</span>
                <span style="color:#b91c1c;">🏥 ${day.leave || 0}</span>
                <span style="color:#b45309;">⏳ ${day.pending || 0}</span>
                <span style="color:#4338ca;">❔ ${day['no-response'] || 0}</span>
            `;

            item.appendChild(header);
            item.appendChild(bar);
            item.appendChild(stats);
            elements.trendContainer.appendChild(item);
        });
    }

    function renderDetails(details, labelMap) {
        if (!elements.detailsBody || !elements.detailsEmpty) return;
        elements.detailsBody.innerHTML = '';
        if (!details.length) {
            elements.detailsEmpty.style.display = 'block';
            return;
        }
        elements.detailsEmpty.style.display = 'none';

        details.forEach(detail => {
            const row = document.createElement('tr');

            const dateCell = document.createElement('td');
            dateCell.textContent = detail.weekday ? `${detail.courseDate} ${detail.weekday}` : detail.courseDate;

            const timeCell = document.createElement('td');
            timeCell.textContent = detail.courseTime || '--';

            const courseCell = document.createElement('td');
            const teacherInfo = detail.teacherName ? `<div style="color:#6b7280;font-size:0.85rem;">${detail.teacherName}</div>` : '';
            courseCell.innerHTML = `<div>${detail.courseName || '未命名課程'}</div>${teacherInfo}`;

            const studentCell = document.createElement('td');
            studentCell.textContent = detail.studentName || '未知學生';

            const statusCell = document.createElement('td');
            const badge = document.createElement('span');
            const status = detail.status || 'no-response';
            badge.className = 'response-status-badge';
            badge.setAttribute('data-status', status);
            badge.innerHTML = labelMap[status] || STATUS_LABELS[status] || status;
            statusCell.appendChild(badge);

            const remarkCell = document.createElement('td');
            remarkCell.innerHTML = buildRemark(detail, status);

            const respondedCell = document.createElement('td');
            respondedCell.textContent = detail.respondedAt ? formatDateTime(detail.respondedAt) : '—';

            row.appendChild(dateCell);
            row.appendChild(timeCell);
            row.appendChild(courseCell);
            row.appendChild(studentCell);
            row.appendChild(statusCell);
            row.appendChild(remarkCell);
            row.appendChild(respondedCell);
            elements.detailsBody.appendChild(row);
        });
    }

    function renderPreviews(previews) {
        if (!elements.previewContainer) return;
        elements.previewContainer.innerHTML = '';
        if (!previews.length) {
            elements.previewContainer.appendChild(createEmptyElement('尚無報告預覽'));
            return;
        }
        previews.forEach(preview => {
            const item = document.createElement('div');
            item.className = 'response-preview-item';
            if (preview.hasAttention) {
                item.classList.add('attention');
            }

            const header = document.createElement('div');
            header.className = 'preview-header';
            header.innerHTML = `
                <span><i class="fas fa-calendar-day"></i> ${preview.date}</span>
                <span>總計 ${formatNumber(preview.total)} 位</span>
            `;

            const meta = document.createElement('div');
            meta.className = 'preview-meta';
            meta.innerHTML = `
                <span>✅ ${preview.attend || 0}</span>
                <span>🏥 ${preview.leave || 0}</span>
                <span>⏳ ${preview.pending || 0}</span>
                <span>❔ ${preview.noResponse || 0}</span>
                <span>回覆率 ${formatPercent(preview.responseRate || 0)}</span>
            `;

            const summary = document.createElement('div');
            summary.className = 'preview-summary';
            summary.textContent = preview.summaryText || '';

            item.appendChild(header);
            item.appendChild(meta);
            item.appendChild(summary);
            elements.previewContainer.appendChild(item);
        });
    }

    function populateSelect(select, options, currentValue) {
        if (!select) return;
        const previous = currentValue || 'all';
        const fragment = document.createDocumentFragment();
        const defaultOption = document.createElement('option');
        defaultOption.value = 'all';
        defaultOption.textContent = '全部';
        fragment.appendChild(defaultOption);
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            fragment.appendChild(option);
        });
        select.innerHTML = '';
        select.appendChild(fragment);
        if (Array.from(select.options).some(opt => opt.value === previous)) {
            select.value = previous;
        } else {
            select.value = 'all';
        }
        switch (select.id) {
            case 'responseStatusFilter':
                state.status = select.value;
                break;
            case 'responseTeacherFilter':
                state.teacher = select.value;
                break;
            case 'responseCourseFilter':
                state.course = select.value;
                break;
            case 'responseStudentFilter':
                state.student = select.value;
                break;
        }
    }

    function setLoading(isLoading) {
        if (!elements.loadingOverlay) return;
        elements.loadingOverlay.classList.toggle('active', !!isLoading);
    }

    function handleExport() {
        if (!state.lastSummary || !Array.isArray(state.lastSummary.details) || state.lastSummary.details.length === 0) {
            notify('⚠️ 沒有可匯出的資料', 'warning');
            return;
        }
        const rows = state.lastSummary.details;
        const headers = ['日期', '時間', '課程', '講師', '學生', '狀態', '備註', '回覆時間'];
        const statusLabels = state.lastSummary.statusLabels || STATUS_LABELS;
        const csvLines = [headers.join(',')];
        rows.forEach(detail => {
            const status = detail.status || 'no-response';
            const row = [
                `"${detail.courseDate || ''}"`,
                `"${detail.courseTime || ''}"`,
                `"${(detail.courseName || '').replace(/"/g, '""')}"`,
                `"${(detail.teacherName || '').replace(/"/g, '""')}"`,
                `"${(detail.studentName || '').replace(/"/g, '""')}"`,
                `"${(statusLabels[status] || status).replace(/"/g, '""')}"`,
                `"${buildPlainRemark(detail, status).replace(/"/g, '""')}"`,
                `"${detail.respondedAt ? formatDateTime(detail.respondedAt) : ''}"`
            ];
            csvLines.push(row.join(','));
        });

        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        // 🔥 使用 BlobURLManager
        const url = window.BlobURLManager ? 
            window.BlobURLManager.createObjectURL(blob, { source: 'csv-export' }) : 
            URL.createObjectURL(blob);
        link.href = url;
        const rangeText = state.startDate === state.endDate ? state.startDate : `${state.startDate}_${state.endDate}`;
        link.download = `parent-responses-${rangeText}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // 🔥 使用 BlobURLManager
        if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(url);
        } else {
            URL.revokeObjectURL(url);
        }
        notify('✅ 已匯出 CSV', 'success');
    }

    function buildRemark(detail, status) {
        if (status === 'leave') {
            const reason = detail.leaveReason ? detail.leaveReason : '未填寫原因';
            return `<span style="color:#b91c1c;">${escapeHtml(reason)}</span>`;
        }
        if (status === 'pending') {
            return '<span style="color:#b45309;">待家長確認</span>';
        }
        if (status === 'no-response') {
            return '<span style="color:#4338ca;">尚未回覆</span>';
        }
        if (detail.dataIncomplete && Array.isArray(detail.missingFields) && detail.missingFields.length) {
            return `<span style="color:#b45309;">⚠️ 資料缺失：${escapeHtml(detail.missingFields.join('、'))}</span>`;
        }
        return '—';
    }

    function buildPlainRemark(detail, status) {
        if (status === 'leave') {
            return detail.leaveReason ? detail.leaveReason : '未填寫原因';
        }
        if (status === 'pending') {
            return '待家長確認';
        }
        if (status === 'no-response') {
            return '尚未回覆';
        }
        if (detail.dataIncomplete && Array.isArray(detail.missingFields) && detail.missingFields.length) {
            return `資料缺失：${detail.missingFields.join('、')}`;
        }
        return '';
    }

    function createEmptyElement(text) {
        const empty = document.createElement('div');
        empty.className = 'response-empty';
        empty.textContent = text;
        return empty;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('zh-TW');
    }

    function formatPercent(value) {
        const percent = Math.round((value || 0) * 1000) / 10;
        return `${percent.toFixed(1)}%`;
    }

    function formatDateTime(value) {
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            return date.toLocaleString('zh-TW', {
                timeZone: 'Asia/Taipei',
                hour12: false
            });
        } catch (error) {
            return '';
        }
    }

    function createTaiwanDate(offsetDays) {
        const now = new Date();
        const localeString = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
        const tzDate = new Date(localeString);
        tzDate.setHours(0, 0, 0, 0);
        tzDate.setDate(tzDate.getDate() + (offsetDays || 0));
        return tzDate;
    }

    function formatDate(date) {
        if (!(date instanceof Date)) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDateInput(value) {
        if (!value) return null;
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date;
    }

    function escapeHtml(text) {
        if (text === undefined || text === null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function notify(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type || 'info');
        } else if (typeof window.showAlert === 'function') {
            window.showAlert(message, type || 'info');
        } else {
            console.log(message);
        }
    }

    function isSectionActive() {
        return elements.section && elements.section.classList.contains('active');
    }

    window.AdminResponseDashboard = {
        init,
        refresh: fetchSummary,
        onPageEnter() {
            state.isActive = true;
            if (!state.initialized) {
                init();
            } else {
                fetchSummary();
            }
        },
        onPageLeave() {
            state.isActive = false;
        }
    };
})(window, document);
