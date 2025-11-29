'use strict';

(function() {
    const API_ENDPOINT = '/api/admin/student-sheet';
    const BOOLEAN_KEYS = new Set(['isEarlyBird', 'isReturning', 'isGroupSignup', 'isSuperEarlyBird']);
    const NUMERIC_KEYS = new Set(['purchasedSessions', 'remainingSessions', 'currentTuition']);
    const LONG_TEXT_KEYS = new Set(['note', 'billingInfo', 'coursePlan', 'formulaMemo', 'notificationNotes']);
    const DISPLAY_COLUMNS = [
        'name',
        'courseName',
        'remainingSessions',
        'courseCategory',
        'parentName',
        'userId',
        'notificationTargetType',
        'note'
    ];

    const state = {
        columns: [],
        rows: [],
        visibleRows: [],
        fetchedAt: null,
        isLoading: false,
        editingRowNumber: null,
        isCreating: false,
        filters: {
            keyword: '',
            courseName: '',
            category: '',
            target: '',
            remaining: 'all',
            missingUserId: false
        },
        filterConfig: null,
        rawRows: [],
        parentUsers: [],
        groups: []
    };
    const DEFAULT_FILTER_CONFIG = {
        debugMode: false,
        minRemainingClasses: 0,
        enableRemainingCheck: true,
        showInCurrentWeek: true,
        courseMatchMode: 'exact',
        timeMatchRules: {
            allowWeekSuffix: true,
            allowSubstituteKeyword: true,
            normalizeTimeFormat: true
        }
    };

    let keywordDebounceTimer = null;

    const elements = {
        tableBody: document.getElementById('studentTableBody'),
        statusSummary: document.getElementById('statusSummary'),
        statusTimestamp: document.getElementById('statusTimestamp'),
        toast: document.getElementById('toast'),
        refreshBtn: document.getElementById('refreshBtn'),
        forceRefreshBtn: document.getElementById('forceRefreshBtn'),
        addStudentBtn: document.getElementById('addStudentBtn'),
        modalBackdrop: document.getElementById('editorModal'),
        modalTitle: document.getElementById('modalTitle'),
        formContainer: document.getElementById('formFields'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        saveStudentBtn: document.getElementById('saveStudentBtn'),
        form: document.getElementById('studentForm'),
        filterKeyword: document.getElementById('filterKeyword'),
        filterCourse: document.getElementById('filterCourse'),
        filterCategory: document.getElementById('filterCategory'),
        filterTarget: document.getElementById('filterTarget'),
        filterRemaining: document.getElementById('filterRemaining'),
        filterMissingUserId: document.getElementById('filterMissingUserId'),
        parentNameDatalist: document.getElementById('parentNameOptions'),
        groupNameDatalist: document.getElementById('groupNameOptions'),
        metrics: {
            totalValue: document.getElementById('metricTotalStudents'),
            totalSubtitle: document.getElementById('metricTotalStudentsSubtitle'),
            individualValue: document.getElementById('metricIndividualCount'),
            individualSubtitle: document.getElementById('metricIndividualSubtitle'),
            groupValue: document.getElementById('metricGroupCount'),
            groupSubtitle: document.getElementById('metricGroupSubtitle'),
            pendingValue: document.getElementById('metricPendingCount'),
            pendingSubtitle: document.getElementById('metricPendingSubtitle')
        }
    };

    function showToast(message, type = 'info') {
        if (!elements.toast) return;
        elements.toast.textContent = message;

        let bgColor = '#1F2937';
        if (type === 'success') bgColor = '#047857';
        if (type === 'error') bgColor = '#B91C1C';
        if (type === 'warning') bgColor = '#B45309';

        elements.toast.style.background = bgColor;
        elements.toast.classList.add('show');

        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3200);
    }

    function toggleLoading(isLoading) {
        state.isLoading = isLoading;
        if (elements.refreshBtn) elements.refreshBtn.disabled = isLoading;
        if (elements.forceRefreshBtn) elements.forceRefreshBtn.disabled = isLoading;
        if (elements.addStudentBtn) elements.addStudentBtn.disabled = isLoading;
    }

    function getFilterConfig() {
        return state.filterConfig || DEFAULT_FILTER_CONFIG;
    }

    async function loadFilterConfig() {
        try {
            const response = await fetch('/api/student-filter-config');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                state.filterConfig = { ...DEFAULT_FILTER_CONFIG, ...result.data };
                return;
            }
            state.filterConfig = { ...DEFAULT_FILTER_CONFIG };
        } catch (error) {
            console.warn('⚠️ 載入學生篩選配置失敗，使用預設值:', error);
            state.filterConfig = { ...DEFAULT_FILTER_CONFIG };
        }
    }

    function isRowEligible(row) {
        if (!row || !row.values) return false;
        const values = row.values;
        const config = getFilterConfig();

        const category = (values.courseCategory || '').trim();
        const courseName = (values.courseName || '').trim();
        if (!category || category === '-' || !courseName || courseName === '-') {
            return false;
        }

        if (config.enableRemainingCheck !== false) {
            const minRemaining = Number(config.minRemainingClasses || 0);
            if (Number.isFinite(minRemaining) && minRemaining > 0) {
                const remainingRaw = Number(values.remainingSessions);
                const remaining = Number.isNaN(remainingRaw) ? 0 : remainingRaw;
                if (remaining < minRemaining) {
                    return false;
                }
            }
        }

        return true;
    }

    function filterEligibleRows(rows) {
        if (!Array.isArray(rows)) return [];
        return rows.filter(isRowEligible);
    }

    function escapeHtml(value) {
        if (value === undefined || value === null) return '';
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char] || char));
    }

    function formatShortId(value) {
        const str = String(value || '').trim();
        if (!str) return '';
        if (str.length <= 10) return str;
        return `${str.slice(0, 6)}…${str.slice(-4)}`;
    }

    function populateGroupNameOptions() {
        if (!elements.groupNameDatalist) return;
        const names = Array.from(
            new Set(
                (state.groups || [])
                    .map(group => (group.groupName || '').trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        elements.groupNameDatalist.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
    }

    function populateGroupSelector(select, searchTerm = '', selectedValue = '') {
        if (!select) return;
        const term = searchTerm.trim().toLowerCase();

        select.innerHTML = '<option value="">-- 選擇群組 --</option>';

        if (!state.groups || state.groups.length === 0) {
            if (selectedValue) {
                const fallbackOption = document.createElement('option');
                fallbackOption.value = selectedValue;
                fallbackOption.textContent = `${formatShortId(selectedValue)}（尚未載入群組資料）`;
                fallbackOption.selected = true;
                select.appendChild(fallbackOption);
            }
            return;
        }

        const filtered = state.groups.filter(group => {
            if (!term) return true;
            const name = (group.groupName || '').toLowerCase();
            const id = (group.groupId || '').toLowerCase();
            return name.includes(term) || id.includes(term);
        });

        let hasSelected = false;
        filtered.forEach(group => {
            const option = document.createElement('option');
            option.value = group.groupId || '';
            option.textContent = group.groupName ? `${group.groupName}｜${formatShortId(group.groupId)}` : (group.groupId || '(未命名群組)');
            if (selectedValue && option.value === selectedValue) {
                option.selected = true;
                hasSelected = true;
            }
            select.appendChild(option);
        });

        if (selectedValue && !hasSelected) {
            const matchedGroup = state.groups.find(group => group.groupId === selectedValue);
            const fallbackOption = document.createElement('option');
            fallbackOption.value = selectedValue;
            fallbackOption.textContent = matchedGroup
                ? `${matchedGroup.groupName || '(未命名群組)'}｜${formatShortId(selectedValue)}`
                : `${formatShortId(selectedValue)}（未在清單中）`;
            fallbackOption.selected = true;
            select.appendChild(fallbackOption);
        }
    }

    function updateMetrics() {
        if (!elements.metrics) return;
        const total = state.rows.length;
        const individuals = state.rows.filter(row => (row.values.notificationTargetType || '').toLowerCase() !== 'group');
        const groups = state.rows.filter(row => (row.values.notificationTargetType || '').toLowerCase() === 'group');
        const missingUserId = individuals.filter(row => !row.values.userId).length;
        const missingGroup = groups.filter(row => !row.values.notificationGroupId).length;
        const pending = missingUserId + missingGroup;

        if (elements.metrics.totalValue) elements.metrics.totalValue.textContent = total.toString();
        if (elements.metrics.totalSubtitle) elements.metrics.totalSubtitle.textContent = `個別 ${individuals.length} ｜ 群組 ${groups.length}`;

        if (elements.metrics.individualValue) elements.metrics.individualValue.textContent = individuals.length.toString();
        if (elements.metrics.individualSubtitle) {
            elements.metrics.individualSubtitle.textContent = missingUserId > 0
                ? `⚠️ ${missingUserId} 位缺少 userId`
                : '✅ 已完成 LINE userId 連結';
        }

        if (elements.metrics.groupValue) elements.metrics.groupValue.textContent = groups.length.toString();
        if (elements.metrics.groupSubtitle) {
            elements.metrics.groupSubtitle.textContent = missingGroup > 0
                ? `⚠️ ${missingGroup} 筆缺少群組 ID`
                : '✅ 群組資料完整';
        }

        if (elements.metrics.pendingValue) elements.metrics.pendingValue.textContent = pending.toString();
        if (elements.metrics.pendingSubtitle) {
            if (pending === 0) {
                elements.metrics.pendingSubtitle.textContent = '✅ 所有學生皆具備通知對象';
            } else {
                elements.metrics.pendingSubtitle.textContent = `請補齊 ${pending} 筆聯絡資訊（個別 ${missingUserId}、群組 ${missingGroup}）`;
            }
        }
    }

    function boolToBadge(value) {
        const truthy = ['TRUE', 'true', '1', '是', 'Yes', 'yes', 'y', 'Y', '✅'];
        const isTrue = truthy.includes(String(value).trim());
        return isTrue ? '<span class="badge-boolean"><i class="fas fa-check"></i> 是</span>' : '';
    }

    function populateFilterOptions() {
        const rows = state.rows || [];
        const courses = new Set();
        const categories = new Set();

        rows.forEach(row => {
            const courseName = (row.values.courseName || '').trim();
            const category = (row.values.courseCategory || '').trim();
            if (courseName) courses.add(courseName);
            if (category) categories.add(category);
        });

        if (elements.filterCourse) {
            const previous = state.filters.courseName;
            const sortedCourses = Array.from(courses).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
            elements.filterCourse.innerHTML = '<option value="">全部</option>' + sortedCourses.map(course => `<option value="${course}">${course}</option>`).join('');
            if (previous && courses.has(previous)) {
                elements.filterCourse.value = previous;
            } else {
                state.filters.courseName = '';
            }
        }

        if (elements.filterCategory) {
            const previous = state.filters.category;
            const sortedCategories = Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
            elements.filterCategory.innerHTML = '<option value="">全部</option>' + sortedCategories.map(category => `<option value="${category}">${category}</option>`).join('');
            if (previous && categories.has(previous)) {
                elements.filterCategory.value = previous;
            } else {
                state.filters.category = '';
            }
        }
    }

    function applyFilters() {
        const rows = state.rows || [];
        const filters = state.filters;
        const keyword = filters.keyword.trim().toLowerCase();

        // 🔥 前端額外過濾：移除沒有有效學生姓名的資料
        let visible = rows.filter(row => {
            const name = row.values?.name;
            return name && String(name).trim() !== '' && String(name).trim() !== '-';
        });

        if (keyword) {
            visible = visible.filter(row => {
                const values = row.values;
                const fields = [
                    values.name,
                    values.courseName,
                    values.courseCategory,
                    values.parentName,
                    values.parentPhone,
                    values.parentContact,
                    values.userId,
                    values.notificationTargetType,
                    values.notificationGroupName,
                    values.notificationGroupId,
                    values.note,
                    values.notificationNotes
                ];
                return fields.some(field => field && String(field).toLowerCase().includes(keyword));
            });
        }

        if (filters.courseName) {
            visible = visible.filter(row => (row.values.courseName || '') === filters.courseName);
        }

        if (filters.category) {
            visible = visible.filter(row => (row.values.courseCategory || '') === filters.category);
        }

        if (filters.target) {
            visible = visible.filter(row => {
                const type = (row.values.notificationTargetType || 'individual').toLowerCase();
                return type === filters.target;
            });
        }

        if (filters.remaining === 'zero') {
            visible = visible.filter(row => Number(row.values.remainingSessions) === 0);
        } else if (filters.remaining === 'low') {
            visible = visible.filter(row => {
                const num = Number(row.values.remainingSessions);
                return !Number.isNaN(num) && num <= 5;
            });
        }

        if (filters.missingUserId) {
            visible = visible.filter(row => {
                const isGroup = (row.values.notificationTargetType || '').toLowerCase() === 'group';
                return isGroup ? !row.values.notificationGroupId : !row.values.userId;
            });
        }

        state.visibleRows = visible;
        renderTable();
        updateStatusBar();
    }

    function populateParentNameOptions() {
        if (!elements.parentNameDatalist) return;
        const nameSet = new Set();
        state.parentUsers.forEach(parent => {
            const baseName = (parent.name || '').trim();
            if (baseName) nameSet.add(baseName);
            if (Array.isArray(parent.aliases)) {
                parent.aliases.forEach(alias => {
                    const trimmed = (alias || '').trim();
                    if (trimmed) nameSet.add(trimmed);
                });
            }
        });
        const uniqueNames = Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        elements.parentNameDatalist.innerHTML = uniqueNames.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
    }

    function filterParentList(searchTerm = '') {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return state.parentUsers;
        return state.parentUsers.filter(parent => {
            const name = (parent.name || '').toLowerCase();
            const userId = (parent.userId || '').toLowerCase();
            const aliasMatch = Array.isArray(parent.aliases)
                ? parent.aliases.some(alias => (alias || '').toLowerCase().includes(term))
                : false;
            return name.includes(term) || userId.includes(term) || aliasMatch;
        });
    }

    function filterGroupList(searchTerm = '') {
        const groups = state.groups || [];
        const term = searchTerm.trim().toLowerCase();
        if (!term) return groups;
        return groups.filter(group => {
            const name = (group.groupName || '').toLowerCase();
            const id = (group.groupId || '').toLowerCase();
            return name.includes(term) || id.includes(term);
        });
    }

    function populateParentSelector(select, searchTerm = '', selectedValue = '') {
        if (!select) return;
        const filtered = filterParentList(searchTerm);
        const filteredGroups = filterGroupList(searchTerm);

        select.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- 選擇家長或群組 --';
        select.appendChild(defaultOption);

        if (filtered.length > 0) {
            const parentGroup = document.createElement('optgroup');
            parentGroup.label = '家長';
            filtered.forEach(parent => {
                const option = document.createElement('option');
                option.value = parent.userId || '';
                option.dataset.type = 'parent';
                const displayId = parent.userId ? formatShortId(parent.userId) : '無 userId';
                option.textContent = `${parent.name || '(未命名)'}｜${displayId}`;
                if (selectedValue && option.value === selectedValue) {
                    option.selected = true;
                }
                parentGroup.appendChild(option);
            });
            select.appendChild(parentGroup);
        }

        if (filteredGroups && filteredGroups.length > 0) {
            const groupOptGroup = document.createElement('optgroup');
            groupOptGroup.label = '群組';
            filteredGroups.forEach(group => {
                const option = document.createElement('option');
                const groupId = group.groupId || '';
                option.value = groupId;
                option.dataset.type = 'group';
                option.dataset.groupId = groupId;
                const displayId = groupId ? formatShortId(groupId) : '';
                option.textContent = `${group.groupName || '(未命名群組)'}${displayId ? `｜${displayId}` : ''}`;
                groupOptGroup.appendChild(option);
            });
            select.appendChild(groupOptGroup);
        }
    }

    function maybeAutoFillUserId(nameInput, userIdInput, silent = false) {
        if (!nameInput || !userIdInput || !state.parentUsers.length) return;
        const name = nameInput.value.trim();
        if (!name) return;
        const matches = state.parentUsers.filter(parent => {
            const baseMatch = (parent.name || '').trim() === name;
            const aliasMatch = Array.isArray(parent.aliases) && parent.aliases.some(alias => (alias || '').trim() === name);
            return baseMatch || aliasMatch;
        });
        if (matches.length === 1) {
            userIdInput.value = matches[0].userId || '';
            userIdInput.dataset.autoFilled = 'true';
            if (!silent) {
                showToast('✅ 已根據家長姓名自動填入 LINE User ID', 'success');
            }
        } else if (matches.length > 1 && !silent) {
            showToast('⚠️ 找到多位同名家長，請從下方列表選擇正確的家長', 'warning');
        }
    }

    function setupParentHelper(wrapper, nameInput, getUserIdInput, selectedUserId = '') {
        if (!wrapper || !nameInput) return;
        const userIdInput = typeof getUserIdInput === 'function' ? getUserIdInput() : null;

        nameInput.setAttribute('list', 'parentNameOptions');
        nameInput.addEventListener('change', () => maybeAutoFillUserId(nameInput, userIdInput));
        nameInput.addEventListener('blur', () => maybeAutoFillUserId(nameInput, userIdInput, true));

        const helper = document.createElement('div');
        helper.className = 'parent-helper';
        helper.innerHTML = `
            <input type="text" class="parent-helper-search" placeholder="搜尋家長...">
            <select class="parent-helper-select">
                <option value="">-- 選擇家長或群組 --</option>
            </select>
        `;
        wrapper.appendChild(helper);

        const hint = document.createElement('small');
        hint.className = 'field-hint';
        hint.textContent = '選擇或輸入家長姓名後會自動填入 LINE User ID，也可直接選擇群組轉為群組通知。';
        wrapper.appendChild(hint);

        const searchInput = helper.querySelector('.parent-helper-search');
        const select = helper.querySelector('.parent-helper-select');

        populateParentSelector(select, '', selectedUserId);

        searchInput.addEventListener('input', () => {
            populateParentSelector(select, searchInput.value);
        });

        select.addEventListener('change', () => {
            const option = select.selectedOptions[0];
            if (!option) return;
            const type = option.dataset.type || 'parent';

            if (type === 'group') {
                const groupId = option.dataset.groupId || option.value;
                if (groupId) {
                    select.dispatchEvent(new CustomEvent('parent-helper-group-selected', {
                        detail: { groupId }
                    }));
                    select.value = '';
                    searchInput.value = '';
                    showToast('📣 已選擇群組，請確認通知設定', 'info');
                }
                return;
            }

            const targetUserId = option.value;
            if (!targetUserId) return;
            const parent = state.parentUsers.find(p => p.userId === targetUserId);
            if (parent) {
                nameInput.value = parent.name || '';
                if (userIdInput) {
                    userIdInput.value = parent.userId || '';
                    userIdInput.dataset.autoFilled = 'true';
                }
                showToast(`✅ 已套用家長「${parent.name || ''}」的 LINE User ID`, 'success');
            }
        });

        if (nameInput.value) {
            maybeAutoFillUserId(nameInput, userIdInput, true);
        }

        return { searchInput, select };
    }

    function configureNotificationControls({
        targetSelect,
        parentSection,
        userIdSection,
        groupSection,
        groupSelect,
        groupSearchInput,
        groupNameInput,
        parentSelect,
        parentNameInput
    }) {
        if (!targetSelect) return;

        const syncGroupName = () => {
            if (!groupNameInput || !groupSelect) return;
            const targetId = groupSelect.value;
            if (!targetId) {
                groupNameInput.value = '';
                return;
            }
            const matchedGroup = state.groups.find(group => group.groupId === targetId);
            if (matchedGroup) {
                groupNameInput.value = matchedGroup.groupName || '';
            }
        };

        const applyMode = () => {
            const mode = (targetSelect.value || '').toLowerCase() === 'group' ? 'group' : 'individual';
            targetSelect.value = mode;

            if (mode === 'group') {
                if (parentSection) parentSection.classList.add('is-hidden');
                if (userIdSection) userIdSection.classList.add('is-hidden');
                if (groupSection) groupSection.classList.remove('is-hidden');
            } else {
                if (parentSection) parentSection.classList.remove('is-hidden');
                if (userIdSection) userIdSection.classList.remove('is-hidden');
                if (groupSection) groupSection.classList.add('is-hidden');
            }
        };

        if (groupSelect) {
            populateGroupSelector(groupSelect, groupSearchInput ? groupSearchInput.value : '', groupSelect.value);
            groupSelect.addEventListener('change', () => {
                syncGroupName();
                if (groupSelect.value) {
                    targetSelect.value = 'group';
                    applyMode();
                }
            });
        }

        if (groupSearchInput) {
            groupSearchInput.addEventListener('input', () => {
                const previous = groupSelect ? groupSelect.value : '';
                populateGroupSelector(groupSelect, groupSearchInput.value, previous);
            });
        }

        if (parentSelect) {
            parentSelect.addEventListener('change', () => {
                if (targetSelect.value !== 'individual') {
                    targetSelect.value = 'individual';
                    applyMode();
                }
            });
            parentSelect.addEventListener('parent-helper-group-selected', event => {
                const groupId = event.detail?.groupId || '';
                if (!groupId) return;
                if (targetSelect) {
                    targetSelect.value = 'group';
                    applyMode();
                }
                if (groupSelect) {
                    populateGroupSelector(groupSelect, '', groupId);
                    groupSelect.value = groupId;
                }
                syncGroupName();
                if (groupSearchInput) groupSearchInput.value = '';
            });
        }

        if (parentNameInput) {
            parentNameInput.addEventListener('input', () => {
                if (targetSelect.value !== 'individual') {
                    targetSelect.value = 'individual';
                    applyMode();
                }
            });
        }

        targetSelect.addEventListener('change', () => {
            applyMode();
            if (targetSelect.value !== 'group' && groupSelect) {
                groupSelect.value = '';
                syncGroupName();
            }
        });

        applyMode();
        syncGroupName();
    }

    function renderTable() {
        if (!elements.tableBody) return;

        const rows = state.visibleRows || [];

        if (!rows.length) {
            const message = state.rows.length
                ? '沒有符合篩選條件的學生，請調整上方的篩選條件或重新整理。'
                : '目前沒有任何學生資料，請點選「重新整理」或「新增學生」。';
            elements.tableBody.innerHTML = `<tr><td colspan="9" class="empty-placeholder">${message}</td></tr>`;
            return;
        }

        const displayCols = DISPLAY_COLUMNS.filter(key => state.columns.some(col => col.key === key));

        elements.tableBody.innerHTML = rows.map(row => {
            const values = row.values;
            const remaining = values.remainingSessions;
            const remainingNum = Number(remaining);
            let badgeClass = 'badge-success';
            if (!Number.isNaN(remainingNum)) {
                if (remainingNum <= 0) {
                    badgeClass = 'badge-danger';
                } else if (remainingNum <= 5) {
                    badgeClass = 'badge-warning';
                }
            }

            const cells = displayCols.map(key => {
                const value = values[key] || '';
                const safeValue = escapeHtml(value || '-');
                if (BOOLEAN_KEYS.has(key)) {
                    return `<td>${boolToBadge(value)}</td>`;
                }
                if (key === 'remainingSessions') {
                    return `<td><span class="badge ${badgeClass}">${safeValue || '-'}</span></td>`;
                }
                if (key === 'parentName') {
                    const contact = values.parentPhone || values.parentContact;
                    const contactHtml = contact ? `<div class="table-subtext">${escapeHtml(contact)}</div>` : '';
                    return `<td><strong>${safeValue || '-'}</strong>${contactHtml}</td>`;
                }
                if (key === 'userId') {
                    if (!value) {
                        return '<td><span class="table-subtext text-warning">缺少 LINE userId</span></td>';
                    }
                    return `<td><code class="mono-code">${escapeHtml(formatShortId(value))}</code></td>`;
                }
                if (key === 'notificationTargetType') {
                    const type = String(value || 'individual').toLowerCase();
                    const isGroup = type === 'group';
                    const badgeClassName = isGroup ? 'tag tag-purple' : 'tag tag-green';
                    const label = isGroup ? '群組通知' : '個別通知';
                    let detail = '';
                    let detailClass = 'table-subtext';
                    if (isGroup) {
                        const groupName = values.notificationGroupName || '';
                        const groupId = values.notificationGroupId || '';
                        if (groupName || groupId) {
                            detail = `${escapeHtml(groupName || '（未命名）')}${groupId ? `｜${escapeHtml(formatShortId(groupId))}` : ''}`;
                        } else {
                            detail = '缺少群組資訊';
                            detailClass += ' text-warning';
                        }
                    } else {
                        if (values.userId) {
                            detail = values.parentName ? `家長：${escapeHtml(values.parentName)}` : '已設定 LINE userId';
                        } else {
                            detail = '缺少 LINE userId';
                            detailClass += ' text-warning';
                        }
                    }
                    return `<td><span class="${badgeClassName}"><i class="fas ${isGroup ? 'fa-people-group' : 'fa-user-check'}"></i> ${label}</span>${detail ? `<div class="${detailClass}">${detail}</div>` : ''}</td>`;
                }
                if (key === 'note' || LONG_TEXT_KEYS.has(key)) {
                    const raw = value || '';
                    if (!raw) {
                        return '<td>-</td>';
                    }
                    const noteHtml = escapeHtml(raw).replace(/\n/g, '<br>');
                    return `<td>${noteHtml}</td>`;
                }
                return `<td>${safeValue}</td>`;
            }).join('');

            return `
                <tr data-row="${row.rowNumber}">
                    <td><strong>${row.rowNumber}</strong></td>
                    ${cells}
                    <td class="actions-column">
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm" data-action="edit" data-row="${row.rowNumber}">
                                <i class="fas fa-pen-to-square"></i> 編輯
                            </button>
                            <button class="btn btn-danger btn-sm" data-action="delete" data-row="${row.rowNumber}">
                                <i class="fas fa-trash"></i> 刪除
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateStatusBar() {
        if (elements.statusSummary) {
            const total = state.rows.length;
            const visibleRows = state.visibleRows || [];
            const visible = visibleRows.length;
            const lowRemaining = visibleRows.filter(row => {
                const remaining = Number(row.values.remainingSessions);
                return !Number.isNaN(remaining) && remaining <= 5;
            }).length;
            elements.statusSummary.innerHTML = `<i class="fas fa-chart-bar"></i> 顯示 ${visible} / ${total} 筆資料，剩餘堂數 ≤ 5：${lowRemaining} 位`;
        }

        if (elements.statusTimestamp) {
            if (state.fetchedAt) {
                const date = new Date(state.fetchedAt);
                const formatted = date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
                elements.statusTimestamp.innerHTML = `<i class="fas fa-clock"></i> 讀取時間：${formatted}`;
            } else {
                elements.statusTimestamp.innerHTML = '<i class="fas fa-clock"></i> 尚未讀取資料';
            }
        }
    }

    async function fetchStudentSheet(force = false) {
        if (state.isLoading) return;
        toggleLoading(true);
        try {
            const url = new URL(API_ENDPOINT, window.location.origin);
            if (force) {
                url.searchParams.set('force', '1');
            }
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || '讀取失敗');
            }
            state.columns = result.columns || [];
            state.rawRows = result.rows || [];
            state.rows = filterEligibleRows(state.rawRows);
            state.fetchedAt = result.fetchedAt || null;
            updateMetrics();
            populateFilterOptions();
            applyFilters();
            console.log(`👀 已載入 ${state.rawRows.length} 筆學生資料，其中符合條件 ${state.rows.length} 筆`);
            showToast('✅ 成功載入學生資料', 'success');
        } catch (error) {
            console.error('❌ 讀取學生試算表失敗:', error);
            showToast(`❌ 讀取失敗：${error.message}`, 'error');
        } finally {
            toggleLoading(false);
        }
    }

    async function fetchParentUsers() {
        try {
            const response = await fetch('/api/parent-users');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                state.parentUsers = result.data;
                populateParentNameOptions();
                document.querySelectorAll('.parent-helper-select').forEach(select => {
                    const helper = select.closest('.parent-helper');
                    const searchInput = helper ? helper.querySelector('.parent-helper-search') : null;
                    const searchTerm = searchInput ? searchInput.value : '';
                    const currentValue = select.value;
                    populateParentSelector(select, searchTerm);
                    if (currentValue) {
                        select.value = currentValue;
                    }
                });
                const modalParentInputs = document.querySelectorAll('input[name="parentName"]');
                modalParentInputs.forEach(input => {
                    const userIdInput = elements.form ? elements.form.querySelector('input[name="userId"]') : null;
                    maybeAutoFillUserId(input, userIdInput, true);
                });
            } else {
                console.warn('⚠️ 無法載入家長資料：', result.message || '未知錯誤');
            }

    async function fetchGroups() {
        try {
            const response = await fetch('/api/admin/groups');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.success && Array.isArray(result.groups)) {
                state.groups = result.groups;
                populateGroupNameOptions();
                document.querySelectorAll('.group-helper-select').forEach(select => {
                    const currentValue = select.value;
                    populateGroupSelector(select, '', currentValue);
                    if (currentValue) {
                        select.value = currentValue;
                    }
                    const hiddenNameInput = document.getElementById('field-notificationGroupName');
                    if (hiddenNameInput) {
                        const matchedGroup = state.groups.find(group => group.groupId === select.value);
                        if (matchedGroup) {
                            hiddenNameInput.value = matchedGroup.groupName || '';
                        }
                    }
                });
            } else {
                console.warn('⚠️ 無法載入群組資料：', result.message || '未知錯誤');
            }
        } catch (error) {
            console.error('❌ 載入群組資料失敗:', error);
        }
    }

        } catch (error) {
            console.error('❌ 載入家長資料失敗:', error);
        }
    }

    function closeModal() {
        if (elements.modalBackdrop) {
            elements.modalBackdrop.classList.remove('show');
        }
        state.editingRowNumber = null;
        state.isCreating = false;
        if (elements.form) {
            elements.form.reset();
        }
        if (elements.formContainer) {
            elements.formContainer.innerHTML = '';
        }
    }

    function openModal({ rowNumber = null, isCreate = false }) {
        state.editingRowNumber = rowNumber;
        state.isCreating = isCreate;

        if (elements.modalTitle) {
            elements.modalTitle.textContent = isCreate ? '新增學生資料' : `編輯學生資料 - 第 ${rowNumber} 列`;
        }

        if (!elements.formContainer) return;

        const editableColumns = state.columns.filter(column => column.editable);

        let rowValues = {};
        if (!isCreate && rowNumber) {
            const target = state.rows.find(row => row.rowNumber === rowNumber);
            if (target) {
                rowValues = target.values;
            }
        }

        const fragment = document.createDocumentFragment();
        let parentFieldWrapper = null;
        let parentNameInput = null;
        let parentHelperControls = null;
        let userIdInput = null;
        let userIdWrapper = null;
        let notificationTargetSelect = null;
        let groupFieldWrapper = null;
        let groupSelect = null;
        let groupSearchInput = null;
        let notificationGroupNameInput = null;

        editableColumns.forEach(column => {
            if (column.key === 'notificationGroupName') {
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';

            const label = document.createElement('label');
            label.setAttribute('for', `field-${column.key}`);
            label.textContent = column.header || column.key;
            wrapper.appendChild(label);

            const existingValue = rowValues[column.key] || '';

            if (column.key === 'notificationTargetType') {
                const select = document.createElement('select');
                select.id = `field-${column.key}`;
                select.name = column.key;
                const normalized = (existingValue || 'individual').toLowerCase() === 'group' ? 'group' : 'individual';
                [
                    { value: 'individual', label: '個別通知' },
                    { value: 'group', label: '群組通知' }
                ].forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (opt.value === normalized) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                wrapper.appendChild(select);
                notificationTargetSelect = select;
                fragment.appendChild(wrapper);
                return;
            }

            if (column.key === 'notificationGroupId') {
                const helper = document.createElement('div');
                helper.className = 'group-helper';

                const searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.placeholder = '搜尋群組...';
                searchInput.className = 'group-helper-search';

                const selectEl = document.createElement('select');
                selectEl.className = 'group-helper-select';
                selectEl.id = `field-${column.key}`;
                selectEl.name = column.key;
                populateGroupSelector(selectEl, '', existingValue);
                if (existingValue) {
                    selectEl.value = existingValue;
                }

                helper.appendChild(searchInput);
                helper.appendChild(selectEl);
                wrapper.appendChild(helper);

                const hint = document.createElement('small');
                hint.className = 'field-hint';
                hint.textContent = '選擇群組後，系統會自動填入群組名稱與通知設定。';
                wrapper.appendChild(hint);

                const hiddenNameInput = document.createElement('input');
                hiddenNameInput.type = 'hidden';
                hiddenNameInput.name = 'notificationGroupName';
                hiddenNameInput.id = 'field-notificationGroupName';
                hiddenNameInput.value = rowValues.notificationGroupName || '';
                wrapper.appendChild(hiddenNameInput);

                groupFieldWrapper = wrapper;
                groupSelect = selectEl;
                groupSearchInput = searchInput;
                notificationGroupNameInput = hiddenNameInput;

                fragment.appendChild(wrapper);
                return;
            }

            let fieldElement = null;

            if (LONG_TEXT_KEYS.has(column.key)) {
                const textarea = document.createElement('textarea');
                textarea.id = `field-${column.key}`;
                textarea.name = column.key;
                textarea.value = existingValue;
                textarea.placeholder = '請輸入內容';
                fieldElement = textarea;
            } else if (BOOLEAN_KEYS.has(column.key)) {
                const select = document.createElement('select');
                select.id = `field-${column.key}`;
                select.name = column.key;

                const options = [
                    { value: '', label: '未設定' },
                    { value: 'TRUE', label: '是' },
                    { value: 'FALSE', label: '否' }
                ];

                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (existingValue === opt.value || (!existingValue && opt.value === '')) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                fieldElement = select;
            } else if (NUMERIC_KEYS.has(column.key)) {
                const input = document.createElement('input');
                input.type = 'number';
                input.id = `field-${column.key}`;
                input.name = column.key;
                input.value = existingValue;
                input.placeholder = '請輸入數字';
                fieldElement = input;
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `field-${column.key}`;
                input.name = column.key;
                input.value = existingValue;
                input.placeholder = '請輸入內容';
                fieldElement = input;
            }

            if (fieldElement) {
                wrapper.appendChild(fieldElement);
            }

            if (column.key === 'parentName') {
                parentFieldWrapper = wrapper;
                parentNameInput = fieldElement;
            }

            if (column.key === 'userId') {
                userIdWrapper = wrapper;
                userIdInput = fieldElement;
            }

            fragment.appendChild(wrapper);
        });

        elements.formContainer.innerHTML = '';
        elements.formContainer.appendChild(fragment);

        if (parentFieldWrapper && parentNameInput) {
            parentHelperControls = setupParentHelper(parentFieldWrapper, parentNameInput, () => {
                if (!userIdInput) {
                    userIdInput = elements.form ? elements.form.querySelector('input[name="userId"]') : null;
                }
                return userIdInput;
            }, rowValues.userId || '');
        }

        configureNotificationControls({
            targetSelect: notificationTargetSelect,
            parentSection: parentFieldWrapper,
            userIdSection: userIdWrapper,
            groupSection: groupFieldWrapper,
            groupSelect,
            groupSearchInput,
            groupNameInput: notificationGroupNameInput,
            parentSelect: parentHelperControls ? parentHelperControls.select : null,
            parentNameInput
        });

        if (elements.modalBackdrop) {
            elements.modalBackdrop.classList.add('show');
        }
    }
    async function submitForm() {
        if (!elements.form) return;

        const formData = new FormData(elements.form);
        const payload = {};
        const editableColumns = state.columns.filter(column => column.editable);
        let hasValue = false;

        editableColumns.forEach(column => {
            const value = formData.get(column.key);
            if (value !== null && value !== undefined) {
                const trimmed = typeof value === 'string' ? value.trim() : value;
                if (trimmed !== '') {
                    hasValue = true;
                }
                payload[column.key] = trimmed;
            }
        });

        if (state.isCreating && (!payload.name || payload.name === '')) {
            showToast('⚠️ 新增學生時必須填寫姓名', 'warning');
            return;
        }

        if (!state.isCreating && !hasValue) {
            showToast('⚠️ 請至少修改一個欄位', 'warning');
            return;
        }

        const normalizedTarget = (payload.notificationTargetType || (payload.notificationGroupId ? 'group' : 'individual')).toLowerCase() === 'group' ? 'group' : 'individual';
        payload.notificationTargetType = normalizedTarget;

        if (normalizedTarget === 'group') {
            if (!payload.notificationGroupId) {
                showToast('⚠️ 請選擇要通知的群組', 'warning');
                return;
            }
            if (!payload.notificationGroupName) {
                const groupMatch = state.groups.find(group => group.groupId === payload.notificationGroupId);
                payload.notificationGroupName = groupMatch ? (groupMatch.groupName || '') : '';
            }
        } else {
            if (!payload.userId) {
                showToast('⚠️ 請填寫或選擇家長以取得 LINE User ID', 'warning');
                return;
            }
            payload.notificationGroupId = '';
            payload.notificationGroupName = '';
        }

        try {
            let response;
            if (state.isCreating) {
                response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: payload })
                });
            } else {
                response = await fetch(`${API_ENDPOINT}/${state.editingRowNumber}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: payload })
                });
            }

            if (!response.ok) {
                const errorResult = await response.json().catch(() => ({}));
                throw new Error(errorResult.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || '操作失敗');
            }

            showToast(state.isCreating ? '✅ 已新增學生資料' : '✅ 已更新學生資料', 'success');
            closeModal();
            await fetchStudentSheet(true);
        } catch (error) {
            console.error('❌ 儲存學生資料失敗:', error);
            showToast(`❌ 儲存失敗：${error.message}`, 'error');
        }
    }

    async function handleDelete(rowNumber) {
        if (!rowNumber) return;
        const confirmed = window.confirm(`確定要刪除 Google Sheets 中第 ${rowNumber} 列嗎？此動作無法復原。`);
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_ENDPOINT}/${rowNumber}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorResult = await response.json().catch(() => ({}));
                throw new Error(errorResult.message || `HTTP ${response.status}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || '刪除失敗');
            }
            showToast('🗑️ 已刪除學生資料', 'success');
            await fetchStudentSheet(true);
        } catch (error) {
            console.error('❌ 刪除學生資料失敗:', error);
            showToast(`❌ 刪除失敗：${error.message}`, 'error');
        }
    }

    function bindEvents() {
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => fetchStudentSheet(false));
        }

        if (elements.forceRefreshBtn) {
            elements.forceRefreshBtn.addEventListener('click', () => fetchStudentSheet(true));
        }

        if (elements.addStudentBtn) {
            elements.addStudentBtn.addEventListener('click', () => openModal({ isCreate: true }));
        }

        if (elements.cancelEditBtn) {
            elements.cancelEditBtn.addEventListener('click', closeModal);
        }

        if (elements.saveStudentBtn) {
            elements.saveStudentBtn.addEventListener('click', submitForm);
        }

        if (elements.modalBackdrop) {
            elements.modalBackdrop.addEventListener('click', event => {
                if (event.target === elements.modalBackdrop) {
                    closeModal();
                }
            });
        }

        if (elements.tableBody) {
            elements.tableBody.addEventListener('click', event => {
                const target = event.target.closest('button[data-action]');
                if (!target) return;
                const action = target.dataset.action;
                const rowNumber = Number(target.dataset.row);
                if (action === 'edit') {
                    openModal({ rowNumber, isCreate: false });
                } else if (action === 'delete') {
                    handleDelete(rowNumber);
                }
            });
        }

        if (elements.filterKeyword) {
            elements.filterKeyword.addEventListener('input', event => {
                const value = event.target.value;
                if (keywordDebounceTimer) {
                    clearTimeout(keywordDebounceTimer);
                }
                keywordDebounceTimer = setTimeout(() => {
                    state.filters.keyword = value;
                    applyFilters();
                }, 220);
            });
        }

        if (elements.filterCourse) {
            elements.filterCourse.addEventListener('change', event => {
                state.filters.courseName = event.target.value;
                applyFilters();
            });
        }

        if (elements.filterCategory) {
            elements.filterCategory.addEventListener('change', event => {
                state.filters.category = event.target.value;
                applyFilters();
            });
        }

        if (elements.filterTarget) {
            elements.filterTarget.addEventListener('change', event => {
                state.filters.target = event.target.value;
                applyFilters();
            });
        }

        if (elements.filterRemaining) {
            elements.filterRemaining.addEventListener('change', event => {
                state.filters.remaining = event.target.value;
                applyFilters();
            });
        }

        if (elements.filterMissingUserId) {
            elements.filterMissingUserId.addEventListener('change', event => {
                state.filters.missingUserId = Boolean(event.target.checked);
                applyFilters();
            });
        }
    }

    async function init() {
        bindEvents();
        if (elements.filterRemaining) {
            elements.filterRemaining.value = state.filters.remaining;
        }
        if (elements.filterTarget) {
            elements.filterTarget.value = state.filters.target;
        }
        try {
            await loadFilterConfig();
        } catch (error) {
            console.warn('⚠️ 載入學生篩選配置失敗，改用預設值:', error);
            showToast('⚠️ 使用預設學生篩選規則', 'warning');
        }
        await fetchStudentSheet(false);
        fetchParentUsers();
        fetchGroups();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
