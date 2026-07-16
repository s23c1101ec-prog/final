/* ==========================================
   Priority Scheduler - Application Logic (V3)
   AI Schedule Suggestion + Email Auto-Parse
   ========================================== */

// ------------------------------------------
// 1. 状態管理と初期化
// ------------------------------------------
let items = [];
let currentDate = new Date();
let viewMode = 'month';
let overdueVisible = true;

let googleConfig = { clientId: '', apiKey: '', accessToken: null };
let claudeConfig = { apiKey: '' };

const STORAGE_KEY = 'priority_scheduler_items_v2';
const OVERDUE_VISIBLE_KEY = 'priority_scheduler_overdue_visible_v2';
const GOOGLE_CONFIG_KEY = 'priority_scheduler_google_config';
const CLAUDE_CONFIG_KEY = 'priority_scheduler_claude_config';

// DOM要素
const elements = {
    tabToday: document.getElementById('tab-today'),
    tabCalendar: document.getElementById('tab-calendar'),
    tabSettings: document.getElementById('tab-settings'),
    viewToday: document.getElementById('view-today'),
    viewCalendar: document.getElementById('view-calendar'),
    viewSettings: document.getElementById('view-settings'),

    btnNewItem: document.getElementById('btn-new-item'),
    itemModal: document.getElementById('item-modal'),
    itemForm: document.getElementById('item-form'),
    itemId: document.getElementById('item-id'),
    itemType: document.getElementById('item-type'),
    itemTitle: document.getElementById('item-title'),
    itemDesc: document.getElementById('item-desc'),
    btnDeleteItem: document.getElementById('btn-delete-item'),
    btnCancel: document.getElementById('btn-cancel'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalTitle: document.getElementById('modal-title'),

    modalTabTask: document.getElementById('modal-tab-task'),
    modalTabEvent: document.getElementById('modal-tab-event'),
    fieldsTask: document.getElementById('fields-task'),
    fieldsEvent: document.getElementById('fields-event'),

    taskDue: document.getElementById('task-due'),
    taskRepeat: document.getElementById('task-repeat'),
    timeSettingsGroup: document.getElementById('time-settings-group'),
    timeTypeRadios: document.getElementsByName('time-type'),
    specificTimeWrapper: document.getElementById('specific-time-input-wrapper'),
    taskTime: document.getElementById('task-time'),
    taskFeedback: document.getElementById('task-feedback'),
    taskEmailTo: document.getElementById('task-email-to'),

    eventDate: document.getElementById('event-date'),
    eventSyncGoogle: document.getElementById('event-sync-google'),
    eventStartTime: document.getElementById('event-start-time'),
    eventEndTime: document.getElementById('event-end-time'),

    timelineContainer: document.getElementById('timeline-container'),
    timelineDateBadge: document.getElementById('timeline-date-badge'),

    overdueSection: document.getElementById('overdue-section'),
    overdueList: document.getElementById('overdue-list'),
    overdueCount: document.getElementById('overdue-count'),
    btnToggleOverdue: document.getElementById('btn-toggle-overdue'),
    toggleOverdueIcon: document.getElementById('toggle-overdue-icon'),
    toggleOverdueText: document.getElementById('toggle-overdue-text'),

    todayList: document.getElementById('today-list'),
    todayCount: document.getElementById('today-count'),
    highPriorityList: document.getElementById('high-priority-list'),
    highPriorityCount: document.getElementById('high-priority-count'),
    futureList: document.getElementById('future-list'),
    futureCount: document.getElementById('future-count'),
    googleSyncStatus: document.getElementById('google-sync-status'),

    btnMonthView: document.getElementById('btn-month-view'),
    btnWeekView: document.getElementById('btn-week-view'),
    btnPrevPeriod: document.getElementById('btn-prev-period'),
    btnNextPeriod: document.getElementById('btn-next-period'),
    calendarPeriodLabel: document.getElementById('calendar-period-label'),
    calendarWeekdays: document.getElementById('calendar-weekdays'),
    calendarGrid: document.getElementById('calendar-grid'),

    googleSettingsForm: document.getElementById('google-settings-form'),
    googleCredentialsInputs: document.getElementById('google-credentials-inputs'),
    googleClientId: document.getElementById('google-client-id'),
    googleApiKey: document.getElementById('google-api-key'),
    btnGoogleAuth: document.getElementById('btn-google-auth'),

    // New AI elements
    claudeApiKey: document.getElementById('claude-api-key'),
    btnSaveClaudeKey: document.getElementById('btn-save-claude-key'),
    btnAiSuggest: document.getElementById('btn-ai-suggest'),
    btnParseEmails: document.getElementById('btn-parse-emails'),
    aiSuggestModal: document.getElementById('ai-suggest-modal'),
    aiSuggestContent: document.getElementById('ai-suggest-content'),
    btnCloseAiModal: document.getElementById('btn-close-ai-modal'),
    emailParseModal: document.getElementById('email-parse-modal'),
    emailParseContent: document.getElementById('email-parse-content'),
    btnCloseEmailModal: document.getElementById('btn-close-email-modal'),
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupNavigation();
    setupEventListeners();
    updateDashboard();
    renderCalendar();
    lucide.createIcons();
    if (googleConfig.clientId) initGoogleApi();
});

// ------------------------------------------
// 2. ユーティリティ関数
// ------------------------------------------
function getTodayString() { return formatDateString(new Date()); }

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

function getDaysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatDateJp(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = WEEKDAYS_JP[date.getDay()];
    return `${date.getFullYear()}年${month}月${day}日(${dayName})`;
}

function formatDateJpShort(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = WEEKDAYS_JP[date.getDay()];
    return `${month}月${day}日(${dayName})`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ------------------------------------------
// 3. データ処理とLocalStorage
// ------------------------------------------
function loadData() {
    const storedConfig = localStorage.getItem(GOOGLE_CONFIG_KEY);
    if (storedConfig) {
        try { googleConfig = { ...googleConfig, ...JSON.parse(storedConfig) }; } catch(e) {}
    }
    elements.googleClientId.value = googleConfig.clientId || '';
    elements.googleApiKey.value = googleConfig.apiKey || '';

    const storedClaude = localStorage.getItem(CLAUDE_CONFIG_KEY);
    if (storedClaude) {
        try { claudeConfig = { ...claudeConfig, ...JSON.parse(storedClaude) }; } catch(e) {}
    }
    if (elements.claudeApiKey && claudeConfig.apiKey) {
        elements.claudeApiKey.value = claudeConfig.apiKey;
    }

    const storedOverdue = localStorage.getItem(OVERDUE_VISIBLE_KEY);
    if (storedOverdue !== null) overdueVisible = storedOverdue === 'true';

    const storedItems = localStorage.getItem(STORAGE_KEY);
    if (storedItems) {
        try { items = JSON.parse(storedItems); } catch(e) { items = []; }
    } else { items = []; }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ------------------------------------------
// 4. SPAビューナビゲーション
// ------------------------------------------
function setupNavigation() {
    const tabs = [
        { btn: elements.tabToday, view: elements.viewToday },
        { btn: elements.tabCalendar, view: elements.viewCalendar },
        { btn: elements.tabSettings, view: elements.viewSettings }
    ];
    tabs.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            tabs.forEach(t => { t.btn.classList.remove('active'); t.view.classList.add('hidden-view'); });
            tab.btn.classList.add('active');
            tab.view.classList.remove('hidden-view');
            if (tab.view === elements.viewToday) updateDashboard();
            else if (tab.view === elements.viewCalendar) renderCalendar();
            lucide.createIcons();
        });
    });
}

// ------------------------------------------
// 5. Google API
// ------------------------------------------
function getAllDisplayItems() { return [...items]; }

let gapiInited = false;
let gisiInited = false;
let tokenClient;

function initGoogleApi() {
    console.log("Google API Initializing...");
}

// ------------------------------------------
// 6. アイテムフィルタリング
// ------------------------------------------
function isItemOccurringOn(item, targetDateStr) {
    if (item.type === 'event') return item.startDate === targetDateStr;
    const due = item.dueDate;
    if (targetDateStr < due) return false;
    if (item.repeat === 'none') return due === targetDateStr;
    const diffDays = getDaysDifference(due, targetDateStr);
    if (item.repeat === 'weekly') return diffDays % 7 === 0;
    if (item.repeat === 'biweekly') return diffDays % 14 === 0;
    return false;
}

function getItemInstanceForDate(item, dateStr) {
    if (item.type === 'event') return { ...item, occurrenceDate: dateStr, isInstanceCompleted: false };
    const isCompleted = item.completedDates ? item.completedDates.includes(dateStr) : false;
    return { ...item, occurrenceDate: dateStr, isInstanceCompleted: isCompleted };
}

function getItemInstancesInRange(startDateStr, endDateStr) {
    const instances = [];
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    const allItems = getAllDisplayItems();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        allItems.forEach(item => {
            if (isItemOccurringOn(item, dateStr)) instances.push(getItemInstanceForDate(item, dateStr));
        });
    }
    return instances;
}

// ------------------------------------------
// 7. タイムラインレンダリング
// ------------------------------------------
function renderTimeline() {
    elements.timelineContainer.innerHTML = '';
    elements.timelineDateBadge.textContent = formatDateJp(new Date());
    const today = getTodayString();
    const startHour = 6;
    const endHour = 24;
    const hourHeight = 60;

    for (let h = startHour; h <= endHour; h++) {
        const row = document.createElement('div');
        row.className = 'timeline-hour-row';
        row.style.top = `${(h - startHour) * hourHeight}px`;
        const label = document.createElement('span');
        label.className = 'hour-label';
        label.textContent = `${String(h).padStart(2, '0')}:00`;
        row.appendChild(label);
        elements.timelineContainer.appendChild(row);
    }

    const todayInstances = getItemInstancesInRange(today, today);
    const todayEvents = todayInstances.filter(inst => inst.type === 'event');

    todayEvents.forEach(evt => {
        const startMin = timeToMinutes(evt.startTime);
        const endMin = timeToMinutes(evt.endTime);
        const timelineStart = startHour * 60;
        if (startMin >= timelineStart && startMin < endHour * 60) {
            const topPx = (startMin - timelineStart) * (hourHeight / 60);
            const heightPx = Math.max(30, (endMin - startMin) * (hourHeight / 60));
            const card = document.createElement('div');
            card.className = 'timeline-event-card';
            if (evt.isGoogleEvent) card.classList.add('google-event');
            card.style.top = `${topPx}px`;
            card.style.height = `${heightPx}px`;
            let iconHtml = evt.isGoogleEvent
                ? '<i data-lucide="chrome" class="inline-icon" style="color:var(--color-primary);"></i>'
                : '<i data-lucide="calendar" class="inline-icon" style="color:var(--color-event);"></i>';
            card.innerHTML = `
                <div class="timeline-event-title">${iconHtml} ${escapeHTML(evt.title)}</div>
                <div class="timeline-event-time"><i data-lucide="clock"></i> ${evt.startTime} 〜 ${evt.endTime}</div>
            `;
            card.addEventListener('click', () => { if (!evt.isGoogleEvent) openModal(evt.id, today, 'event'); });
            elements.timelineContainer.appendChild(card);
        }
    });

    const todaySpecificTasks = todayInstances.filter(inst => inst.type === 'task' && inst.timeType === 'specific');
    todaySpecificTasks.forEach(task => {
        const taskMin = timeToMinutes(task.time);
        const timelineStart = startHour * 60;
        if (taskMin >= timelineStart && taskMin < endHour * 60) {
            const topPx = (taskMin - timelineStart) * (hourHeight / 60);
            const marker = document.createElement('div');
            marker.className = `timeline-task-marker priority-${task.priority}`;
            marker.style.top = `${topPx + 24}px`;
            marker.title = `タスク: ${task.title} (${task.time})`;
            elements.timelineContainer.appendChild(marker);
        }
    });
}

// ------------------------------------------
// 8. タスクダッシュボード
// ------------------------------------------
function updateDashboard() {
    const today = getTodayString();
    renderTimeline();
    const allDisplayItems = getAllDisplayItems();

    const overdueTasks = allDisplayItems.filter(item => {
        if (item.type !== 'task' || item.repeat !== 'none') return false;
        const isCompleted = item.completedDates.includes(item.dueDate);
        return item.dueDate < today && !isCompleted;
    });
    renderOverdueSection(overdueTasks);

    const todayInstances = [];
    allDisplayItems.forEach(item => {
        if (item.type === 'task' && isItemOccurringOn(item, today)) {
            todayInstances.push(getItemInstanceForDate(item, today));
        }
    });
    todayInstances.sort((a, b) => {
        if (a.isInstanceCompleted !== b.isInstanceCompleted) return a.isInstanceCompleted ? 1 : -1;
        if (a.timeType !== b.timeType) return a.timeType === 'specific' ? -1 : 1;
        if (a.timeType === 'specific' && a.time !== b.time) return a.time.localeCompare(b.time);
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    renderTaskList(elements.todayList, todayInstances, today, elements.todayCount);

    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 1);
    const futureEnd = new Date();
    futureEnd.setDate(futureEnd.getDate() + 60);

    const futureHighPriority = getItemInstancesInRange(formatDateString(futureStart), formatDateString(futureEnd))
        .filter(inst => inst.type === 'task' && inst.priority === 'high' && !inst.isInstanceCompleted);
    const uniqueHigh = getUniqueInstances(futureHighPriority);
    uniqueHigh.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.highPriorityList, uniqueHigh, null, elements.highPriorityCount);

    const allFuture = getItemInstancesInRange(formatDateString(futureStart), formatDateString(futureEnd))
        .filter(inst => inst.type === 'task' && !inst.isInstanceCompleted);
    const uniqueFuture = getUniqueInstances(allFuture);
    uniqueFuture.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.futureList, uniqueFuture, null, elements.futureCount);

    lucide.createIcons();
}

function getUniqueInstances(instances) {
    const seen = new Set();
    return instances.filter(inst => { const key = inst.id; if (seen.has(key)) return false; seen.add(key); return true; });
}

function renderOverdueSection(overdueTasks) {
    if (overdueTasks.length === 0) { elements.overdueSection.classList.add('hidden'); return; }
    elements.overdueSection.classList.remove('hidden');
    elements.overdueCount.textContent = overdueTasks.length;
    if (overdueVisible) {
        elements.overdueList.style.display = 'flex';
        elements.toggleOverdueIcon.setAttribute('data-lucide', 'eye-off');
        elements.toggleOverdueText.textContent = '非表示にする';
    } else {
        elements.overdueList.style.display = 'none';
        elements.toggleOverdueIcon.setAttribute('data-lucide', 'eye');
        elements.toggleOverdueText.textContent = '表示する';
    }
    elements.overdueList.innerHTML = '';
    overdueTasks.forEach(task => {
        const inst = getItemInstanceForDate(task, task.dueDate);
        elements.overdueList.appendChild(createTaskCard(inst, task.dueDate));
    });
}

function renderTaskList(containerEl, instances, targetDate, countEl) {
    containerEl.innerHTML = '';
    countEl.textContent = instances.length;
    if (instances.length === 0) {
        let icon = 'calendar-days', msg = '予定されているタスクはありません。';
        if (containerEl === elements.todayList) { icon = 'check-circle-2'; msg = '今日のタスクはありません。素晴らしい一日を！'; }
        else if (containerEl === elements.highPriorityList) { icon = 'star'; msg = '期日前の最重要タスクはありません。'; }
        containerEl.innerHTML = `<div class="empty-state"><i data-lucide="${icon}"></i><p>${msg}</p></div>`;
        return;
    }
    instances.forEach(inst => containerEl.appendChild(createTaskCard(inst, inst.occurrenceDate)));
}

function createTaskCard(inst, occurrenceDate) {
    const card = document.createElement('div');
    card.className = `task-card priority-${inst.priority}`;
    if (inst.isInstanceCompleted) card.classList.add('completed');
    if (inst.isGmailTask) card.classList.add('gmail-task');

    let repeatText = '';
    if (inst.repeat === 'weekly') repeatText = '<span class="repeat-badge">毎週</span>';
    if (inst.repeat === 'biweekly') repeatText = '<span class="repeat-badge">隔週</span>';

    let timeText = inst.timeType === 'specific' && inst.time
        ? `<span class="task-meta-item time-highlight"><i data-lucide="clock"></i> ${inst.time}</span>`
        : `<span class="task-meta-item"><i data-lucide="clock"></i> 終日</span>`;

    let feedbackBadge = '';
    if (inst.isGmailTask) feedbackBadge = `<span class="gmail-badge"><i data-lucide="mail"></i> 返信要(Gmail)</span>`;
    else if (inst.feedbackRequired) feedbackBadge = `<span class="feedback-badge"><i data-lucide="message-square-text"></i> フィードバック要</span>`;

    const dueFormatted = formatDateJpShort(new Date(occurrenceDate + 'T00:00:00'));

    let replyButton = '';
    if (inst.isGmailTask || (inst.feedbackRequired && inst.emailTo)) {
        const targetTo = inst.emailTo || '';
        const targetSub = inst.emailSubject || `Re: ${inst.title}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetTo)}&su=${encodeURIComponent(targetSub)}`;
        replyButton = `<button class="btn-gmail-reply" onclick="event.stopPropagation(); window.open('${gmailUrl}', '_blank')"><i data-lucide="reply"></i> 返信する</button>`;
    }

    card.innerHTML = `
        <div class="task-card-left">
            <div class="task-checkbox-wrapper">
                <input type="checkbox" class="task-checkbox" ${inst.isInstanceCompleted ? 'checked' : ''}>
                <span class="task-checkbox-custom"><i data-lucide="check"></i></span>
            </div>
            <div class="task-details">
                <div class="task-title-row">
                    <span class="task-title">${escapeHTML(inst.title)}</span>
                    ${feedbackBadge}
                </div>
                ${inst.description ? `<span class="task-desc-sub">${escapeHTML(inst.description)}</span>` : ''}
                <div class="task-meta-row">
                    <span class="task-meta-item"><i data-lucide="calendar"></i> ${dueFormatted}</span>
                    ${timeText}${repeatText}
                </div>
            </div>
        </div>
        <div class="task-card-right">
            ${replyButton}
            <button class="btn btn-icon btn-edit-item" title="編集"><i data-lucide="edit-3"></i></button>
        </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', (e) => {
        toggleTaskCompletion(inst.id, occurrenceDate, e.target.checked);
    });
    card.querySelector('.btn-edit-item').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(inst.id, occurrenceDate, 'task');
    });
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.task-checkbox-wrapper') && !e.target.closest('.btn-gmail-reply') && !e.target.closest('.btn-edit-item')) {
            openModal(inst.id, occurrenceDate, 'task');
        }
    });
    return card;
}

function toggleTaskCompletion(taskId, dateStr, isCompleted) {
    const item = items.find(i => i.id === taskId);
    if (!item) return;
    if (!item.completedDates) item.completedDates = [];
    if (isCompleted) { if (!item.completedDates.includes(dateStr)) item.completedDates.push(dateStr); }
    else { item.completedDates = item.completedDates.filter(d => d !== dateStr); }
    saveData();
    updateDashboard();
}

// ------------------------------------------
// 9. カレンダーレンダリング
// ------------------------------------------
function renderCalendar() {
    elements.calendarGrid.innerHTML = '';
    elements.calendarWeekdays.innerHTML = '';
    WEEKDAYS_JP.forEach(day => {
        const span = document.createElement('span');
        span.textContent = day;
        elements.calendarWeekdays.appendChild(span);
    });
    if (viewMode === 'month') renderMonthView();
    else renderWeekView();
}

function renderMonthView() {
    elements.calendarGrid.classList.remove('week-view');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    elements.calendarPeriodLabel.textContent = `${year}年${month + 1}月`;
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(year, month, 1 - firstDay.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41);
    const instances = getItemInstancesInRange(formatDateString(startDate), formatDateString(endDate));
    const byDate = {};
    instances.forEach(inst => {
        if (!byDate[inst.occurrenceDate]) byDate[inst.occurrenceDate] = [];
        byDate[inst.occurrenceDate].push(inst);
    });
    let d = new Date(startDate);
    const todayStr = getTodayString();
    for (let i = 0; i < 42; i++) {
        const dateStr = formatDateString(d);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (d.getMonth() !== month) dayCell.classList.add(d.getMonth() < month ? 'prev-month' : 'next-month');
        if (dateStr === todayStr) dayCell.classList.add('today');
        dayCell.innerHTML = `<div class="day-header"><span class="day-number">${d.getDate()}</span></div><div class="calendar-tasks"></div>`;
        const tasksContainer = dayCell.querySelector('.calendar-tasks');
        const dayInsts = byDate[dateStr] || [];
        dayInsts.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
            const timeA = a.type === 'event' ? a.startTime : (a.timeType === 'specific' ? a.time : '24:00');
            const timeB = b.type === 'event' ? b.startTime : (b.timeType === 'specific' ? b.time : '24:00');
            return timeA.localeCompare(timeB);
        });
        dayInsts.forEach(inst => {
            const item = document.createElement('div');
            item.className = 'cal-task-item';
            if (inst.type === 'event') item.classList.add(inst.isGoogleEvent ? 'google-event-item' : 'event-item');
            else { item.classList.add(`priority-${inst.priority}`); if (inst.isInstanceCompleted) item.classList.add('completed'); }
            let label = inst.type === 'event'
                ? `📅 [${inst.startTime}] ${inst.title}`
                : `${inst.feedbackRequired ? '💬 ' : ''}${inst.timeType === 'specific' && inst.time ? `[${inst.time}] ` : ''}${inst.title}`;
            item.innerHTML = `<span>${escapeHTML(label)}</span>`;
            item.addEventListener('click', (e) => { e.stopPropagation(); if (!inst.isGoogleEvent) openModal(inst.id, dateStr, inst.type); });
            tasksContainer.appendChild(item);
        });
        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => openModal(null, targetDateVal, 'task'));
        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1);
    }
}

function renderWeekView() {
    elements.calendarGrid.classList.add('week-view');
    const todayStr = getTodayString();
    const dayOfWeek = currentDate.getDay();
    const sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - dayOfWeek);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    elements.calendarPeriodLabel.textContent = `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日 〜 ${saturday.getDate()}日`;
    const instances = getItemInstancesInRange(formatDateString(sunday), formatDateString(saturday));
    const byDate = {};
    instances.forEach(inst => {
        if (!byDate[inst.occurrenceDate]) byDate[inst.occurrenceDate] = [];
        byDate[inst.occurrenceDate].push(inst);
    });
    let d = new Date(sunday);
    for (let i = 0; i < 7; i++) {
        const dateStr = formatDateString(d);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (dateStr === todayStr) dayCell.classList.add('today');
        dayCell.innerHTML = `<div class="day-header"><span class="day-number">${d.getDate()}日 (${WEEKDAYS_JP[d.getDay()]})</span></div><div class="calendar-tasks"></div>`;
        const tasksContainer = dayCell.querySelector('.calendar-tasks');
        const dayInsts = byDate[dateStr] || [];
        dayInsts.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
            const timeA = a.type === 'event' ? a.startTime : (a.timeType === 'specific' ? a.time : '24:00');
            const timeB = b.type === 'event' ? b.startTime : (b.timeType === 'specific' ? b.time : '24:00');
            return timeA.localeCompare(timeB);
        });
        dayInsts.forEach(inst => {
            const item = document.createElement('div');
            item.className = 'cal-task-item';
            item.style.cssText = 'white-space:normal;padding:4px 6px;min-height:36px;';
            if (inst.type === 'event') item.classList.add(inst.isGoogleEvent ? 'google-event-item' : 'event-item');
            else { item.classList.add(`priority-${inst.priority}`); if (inst.isInstanceCompleted) item.classList.add('completed'); }
            let label = inst.type === 'event'
                ? `📅 [${inst.startTime}-${inst.endTime}] ${inst.title}`
                : `${inst.timeType === 'specific' && inst.time ? `[${inst.time}] ` : ''}${inst.title}`;
            let fbIcon = (inst.type === 'task' && inst.feedbackRequired) ? '<i data-lucide="message-square-text" class="cal-feedback-star" style="margin-right:3px;"></i>' : '';
            item.innerHTML = `<div style="display:flex;align-items:flex-start;">${fbIcon}<span style="font-weight:600;">${escapeHTML(label)}</span></div>`;
            item.addEventListener('click', (e) => { e.stopPropagation(); if (!inst.isGoogleEvent) openModal(inst.id, dateStr, inst.type); });
            tasksContainer.appendChild(item);
        });
        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => openModal(null, targetDateVal, 'task'));
        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1);
    }
}

// ------------------------------------------
// 10. モーダル操作
// ------------------------------------------
function openModal(id = null, defaultDate = null, defaultType = 'task') {
    elements.itemForm.reset();
    elements.itemId.value = '';
    setModalType(defaultType);
    if (id) {
        const item = items.find(i => i.id === id);
        if (item) {
            elements.itemId.value = item.id;
            elements.itemTitle.value = item.title;
            elements.itemDesc.value = item.description || '';
            setModalType(item.type);
            if (item.type === 'task') {
                elements.modalTitle.innerHTML = '<i data-lucide="edit-3"></i> タスクの編集';
                elements.taskDue.value = item.dueDate;
                elements.taskRepeat.value = item.repeat;
                elements.taskFeedback.checked = item.feedbackRequired;
                elements.taskEmailTo.value = item.emailTo || '';
                document.querySelector(`input[name="task-priority"][value="${item.priority}"]`).checked = true;
                if (item.repeat === 'none') {
                    elements.timeSettingsGroup.classList.remove('hidden');
                    document.querySelector(`input[name="time-type"][value="${item.timeType}"]`).checked = true;
                    if (item.timeType === 'specific') {
                        elements.specificTimeWrapper.classList.remove('hidden');
                        elements.taskTime.value = item.time || '09:00';
                    }
                } else {
                    elements.timeSettingsGroup.classList.add('hidden');
                }
            } else {
                elements.modalTitle.innerHTML = '<i data-lucide="edit-3"></i> 予定の編集';
                elements.eventDate.value = item.startDate;
                elements.eventStartTime.value = item.startTime;
                elements.eventEndTime.value = item.endTime;
                elements.eventSyncGoogle.checked = !!item.syncGoogle;
            }
            elements.btnDeleteItem.classList.remove('hidden');
        }
    } else {
        elements.modalTitle.innerHTML = '<i data-lucide="plus-circle"></i> 新規アイテム作成';
        elements.btnDeleteItem.classList.add('hidden');
        const dateVal = defaultDate || getTodayString();
        elements.taskDue.value = dateVal;
        elements.eventDate.value = dateVal;
        document.querySelector('input[name="task-priority"][value="low"]').checked = true;
        document.querySelector('input[name="time-type"][value="allday"]').checked = true;
        elements.specificTimeWrapper.classList.add('hidden');
        elements.timeSettingsGroup.classList.remove('hidden');
    }
    elements.itemModal.classList.remove('hidden');
    lucide.createIcons();
}

function setModalType(type) {
    elements.itemType.value = type;
    if (type === 'task') {
        elements.modalTabTask.classList.add('active');
        elements.modalTabEvent.classList.remove('active');
        elements.fieldsTask.classList.remove('hidden');
        elements.fieldsEvent.classList.add('hidden');
    } else {
        elements.modalTabEvent.classList.add('active');
        elements.modalTabTask.classList.remove('active');
        elements.fieldsEvent.classList.remove('hidden');
        elements.fieldsTask.classList.add('hidden');
    }
}

function closeModal() { elements.itemModal.classList.add('hidden'); }

function deleteItem(id) {
    if (confirm('このアイテムを削除しますか？')) {
        items = items.filter(i => i.id !== id);
        saveData(); closeModal(); updateDashboard(); renderCalendar();
    }
}

// ------------------------------------------
// 11. ====== AI機能 ======
// ------------------------------------------

/**
 * Claude API を直接呼び出す
 */
async function callClaudeAPI(userPrompt) {
    if (!claudeConfig.apiKey) {
        alert('Claude API Keyが設定されていません。\n設定タブでAPIキーを入力・保存してください。');
        return null;
    }
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': claudeConfig.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2048,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTPエラー: ${response.status}`);
        }
        const data = await response.json();
        const text = data.content[0].text.trim();
        // コードブロック除去してJSON抽出
        const clean = text.replace(/```json|```/g, '').trim();
        const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        return match ? JSON.parse(match[0]) : JSON.parse(clean);
    } catch (e) {
        console.error('Claude API Error:', e);
        alert(`AI呼び出しエラー: ${e.message}`);
        return null;
    }
}

/**
 * AIスケジュール提案
 */
async function suggestScheduleWithAI() {
    const btn = elements.btnAiSuggest;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> AI分析中...';
    lucide.createIcons();

    // モーダルを先に開いてローディング表示
    elements.aiSuggestContent.innerHTML = `
        <div class="ai-loading">
            <i data-lucide="loader-2" class="spinning"></i>
            <p>タスクと予定を分析しています...</p>
        </div>`;
    elements.aiSuggestModal.classList.remove('hidden');
    lucide.createIcons();

    const today = getTodayString();
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    // 今日のブロック済み時間帯（予定）
    const todayEvents = items
        .filter(item => item.type === 'event' && item.startDate === today)
        .map(e => ({ title: e.title, startTime: e.startTime, endTime: e.endTime }));

    // 今日の未完了タスク
    const todayTasks = [];
    items.forEach(item => {
        if (item.type === 'task' && isItemOccurringOn(item, today)) {
            const inst = getItemInstanceForDate(item, today);
            if (!inst.isInstanceCompleted) {
                todayTasks.push({
                    id: item.id,
                    title: item.title,
                    priority: item.priority,
                    description: item.description || ''
                });
            }
        }
    });

    // 近日中の重要タスク（期日が7日以内）
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingTasks = items
        .filter(item => {
            if (item.type !== 'task' || item.repeat !== 'none') return false;
            const due = new Date(item.dueDate + 'T00:00:00');
            const isCompleted = item.completedDates.includes(item.dueDate);
            return due > new Date(today + 'T00:00:00') && due <= nextWeek && !isCompleted;
        })
        .map(item => ({
            id: item.id,
            title: item.title,
            priority: item.priority,
            dueDate: item.dueDate,
            description: item.description || ''
        }))
        .slice(0, 5);

    const allTasksForAI = [...todayTasks, ...upcomingTasks];

    if (allTasksForAI.length === 0) {
        elements.aiSuggestContent.innerHTML = `
            <div class="ai-empty">
                <i data-lucide="check-circle-2"></i>
                <p>提案するタスクがありません。<br>タスクを登録してから再度お試しください。</p>
            </div>`;
        lucide.createIcons();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="sparkles"></i> AIスケジュール提案';
        lucide.createIcons();
        return;
    }

    const prompt = `あなたはスケジュール管理AIアシスタントです。以下の情報を元に、各タスクを行う最適な時間帯を提案してください。

【現在時刻】${now}

【本日の予定（ブロック済み時間帯）】
${todayEvents.length > 0 ? JSON.stringify(todayEvents, null, 2) : 'なし（空き時間帯に自由に配置可能）'}

【提案が必要なタスクリスト】
${JSON.stringify(allTasksForAI, null, 2)}

【スケジューリングの条件】
- 作業時間帯は 09:00〜22:00 を想定
- 重要度「high」のタスクは午前中（09:00〜12:00）を優先
- 重要度「medium」のタスクは午後（13:00〜17:00）を優先
- 重要度「low」のタスクは夕方以降（17:00〜）を優先
- ブロック済み時間帯と重複しないこと
- 現在時刻（${now}）より前の時間は提案しないこと
- タスク間に最低15分の余裕を持たせること
- 所要時間の目安: high=90分, medium=60分, low=30分

以下のJSON配列のみで回答してください（説明文・コードブロック不要）:
[
  {
    "id": "タスクのid文字列",
    "title": "タスク名",
    "suggestedTime": "HH:MM",
    "estimatedMinutes": 推定所要時間の数値,
    "reason": "この時間を提案する理由（日本語、1〜2文）"
  }
]`;

    const suggestions = await callClaudeAPI(prompt);

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles"></i> AIスケジュール提案';
    lucide.createIcons();

    if (!suggestions) {
        elements.aiSuggestContent.innerHTML = `<div class="ai-empty"><i data-lucide="alert-circle"></i><p>提案の取得に失敗しました。</p></div>`;
        lucide.createIcons();
        return;
    }

    showAiSuggestResult(Array.isArray(suggestions) ? suggestions : [suggestions]);
}

/**
 * AI提案結果をモーダルに表示
 */
function showAiSuggestResult(suggestions) {
    const content = elements.aiSuggestContent;
    if (suggestions.length === 0) {
        content.innerHTML = `<div class="ai-empty"><i data-lucide="check-circle-2"></i><p>タスクの配置に問題はありません。</p></div>`;
        lucide.createIcons();
        return;
    }
    content.innerHTML = `
        <p class="ai-suggest-desc">AIが以下のスケジュールを提案しました。「適用する」で即時反映されます。</p>
        <div class="ai-suggestions-list">
            ${suggestions.map(s => `
                <div class="ai-suggestion-card" id="ai-card-${s.id}">
                    <div class="ai-suggestion-info">
                        <div class="ai-suggestion-title">${escapeHTML(s.title || '')}</div>
                        <div class="ai-suggestion-time">
                            <i data-lucide="clock"></i>
                            <strong>${s.suggestedTime}</strong>
                            <span class="ai-duration">（約${s.estimatedMinutes}分）</span>
                        </div>
                        <div class="ai-suggestion-reason">
                            <i data-lucide="lightbulb"></i>
                            ${escapeHTML(s.reason || '')}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-apply-suggestion"
                            onclick="applyAiSuggestion('${s.id}', '${s.suggestedTime}')">
                        <i data-lucide="check"></i> 適用する
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}

/**
 * AI提案を適用（タスクの時間を更新）
 */
function applyAiSuggestion(taskId, suggestedTime) {
    const item = items.find(i => i.id === taskId);
    if (!item) { alert('タスクが見つかりません。'); return; }

    item.timeType = 'specific';
    item.time = suggestedTime;
    saveData();
    updateDashboard();
    renderCalendar();

    // 適用済み表示
    const card = document.getElementById(`ai-card-${taskId}`);
    if (card) {
        card.classList.add('applied');
        const btn = card.querySelector('.btn-apply-suggestion');
        btn.innerHTML = '<i data-lucide="check-circle-2"></i> 適用済み';
        btn.disabled = true;
        lucide.createIcons();
    }
}

/**
 * Gmailからメールを取得してAIで予定を解析
 */
async function parseEmailsWithAI() {
    if (!googleConfig.accessToken) {
        alert('まずGoogleアカウントと連携してください。\n設定タブの「Google アカウントと連携する」ボタンを押してください。');
        return;
    }
    if (!claudeConfig.apiKey) {
        alert('Claude API Keyが設定されていません。\n設定タブでAPIキーを入力・保存してください。');
        return;
    }

    const btn = elements.btnParseEmails;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> メール読み取り中...';
    lucide.createIcons();

    // モーダルを開いてローディング
    elements.emailParseContent.innerHTML = `
        <div class="ai-loading">
            <i data-lucide="loader-2" class="spinning"></i>
            <p>メールを取得・解析しています...</p>
        </div>`;
    elements.emailParseModal.classList.remove('hidden');
    lucide.createIcons();

    try {
        // 未読メール最大15件を取得
        const listRes = await fetch(
            'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=is:unread',
            { headers: { 'Authorization': `Bearer ${googleConfig.accessToken}` } }
        );
        if (!listRes.ok) throw new Error(`メール一覧の取得に失敗しました (${listRes.status})`);

        const listData = await listRes.json();
        const messages = listData.messages || [];

        if (messages.length === 0) {
            elements.emailParseContent.innerHTML = `
                <div class="ai-empty">
                    <i data-lucide="mail-check"></i>
                    <p>未読メールが見つかりませんでした。</p>
                </div>`;
            lucide.createIcons();
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="mail-search"></i> メールから予定を取得';
            lucide.createIcons();
            return;
        }

        // 各メールの詳細取得（最大10件）
        const emailDetails = [];
        for (const msg of messages.slice(0, 10)) {
            try {
                const detailRes = await fetch(
                    `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                    { headers: { 'Authorization': `Bearer ${googleConfig.accessToken}` } }
                );
                if (!detailRes.ok) continue;
                const detail = await detailRes.json();
                const headers = detail.payload.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';

                // 本文取得
                let body = '';
                const extractBody = (payload) => {
                    if (payload.body?.data) {
                        try {
                            body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                        } catch(e) {}
                    }
                    if (payload.parts) {
                        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                        if (textPart?.body?.data) {
                            try {
                                body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                            } catch(e) {}
                        }
                    }
                };
                extractBody(detail.payload);

                // HTMLタグ除去・文字数制限
                const cleanBody = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
                emailDetails.push({ subject, from, receivedDate: date, body: cleanBody });
            } catch(e) {
                console.warn('メール詳細取得エラー:', e);
            }
        }

        if (emailDetails.length === 0) {
            elements.emailParseContent.innerHTML = `
                <div class="ai-empty">
                    <i data-lucide="alert-circle"></i>
                    <p>メールの詳細を取得できませんでした。</p>
                </div>`;
            lucide.createIcons();
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="mail-search"></i> メールから予定を取得';
            lucide.createIcons();
            return;
        }

        const today = getTodayString();
        const prompt = `あなたはメール解析AIです。以下のメール一覧を分析し、日程・会議・イベント・締め切りなどのスケジュールが含まれるものを抽出してください。

【今日の日付】${today}

【メール一覧】
${emailDetails.map((e, i) => `
--- メール${i + 1} ---
件名: ${e.subject}
差出人: ${e.from}
受信日時: ${e.receivedDate}
本文（抜粋）: ${e.body}
`).join('\n')}

【抽出ルール】
- 具体的な日付・時刻が含まれているメールのみ対象
- 会議・打ち合わせ・セミナー・締め切り・提出期限・イベントなどを検出
- 日付が過去のものは除外
- 日時が不明確なものは除外

予定が見つかった場合は以下のJSON配列のみで回答（説明文・コードブロック不要）:
[
  {
    "emailSubject": "元のメールの件名",
    "title": "予定のタイトル（簡潔に）",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "description": "詳細（場所・参加者など、なければ空文字）"
  }
]

予定が見つからない場合は [] のみ返してください。`;

        const parsedEvents = await callClaudeAPI(prompt);

        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="mail-search"></i> メールから予定を取得';
        lucide.createIcons();

        if (!parsedEvents) return;

        const events = Array.isArray(parsedEvents) ? parsedEvents : [];

        if (events.length === 0) {
            elements.emailParseContent.innerHTML = `
                <div class="ai-empty">
                    <i data-lucide="mail-check"></i>
                    <p>予定が含まれているメールは見つかりませんでした。</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        showEmailParseResult(events);

    } catch (err) {
        console.error('メール解析エラー:', err);
        elements.emailParseContent.innerHTML = `
            <div class="ai-empty">
                <i data-lucide="alert-circle"></i>
                <p>エラーが発生しました: ${escapeHTML(err.message)}</p>
            </div>`;
        lucide.createIcons();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="mail-search"></i> メールから予定を取得';
        lucide.createIcons();
    }
}

/**
 * メール解析結果をモーダルに表示
 */
function showEmailParseResult(events) {
    window._parsedEmailEvents = events;
    elements.emailParseContent.innerHTML = `
        <p class="ai-suggest-desc">メールから${events.length}件の予定が見つかりました。追加する予定にチェックを入れてください。</p>
        <div class="email-events-list">
            ${events.map((evt, i) => `
                <label class="email-event-card">
                    <div class="email-event-check-wrap">
                        <input type="checkbox" class="email-evt-checkbox" data-index="${i}" checked>
                        <span class="custom-checkbox"></span>
                    </div>
                    <div class="email-event-info">
                        <div class="email-event-title">${escapeHTML(evt.title)}</div>
                        <div class="email-event-meta">
                            <span><i data-lucide="calendar"></i> ${evt.date}</span>
                            <span><i data-lucide="clock"></i> ${evt.startTime}〜${evt.endTime}</span>
                        </div>
                        ${evt.description ? `<div class="email-event-desc">${escapeHTML(evt.description)}</div>` : ''}
                        <div class="email-event-from">メール件名: 「${escapeHTML(evt.emailSubject)}」</div>
                    </div>
                </label>
            `).join('')}
        </div>
        <div class="email-parse-actions">
            <button class="btn btn-primary" onclick="addCheckedEmailEvents()">
                <i data-lucide="calendar-plus"></i> 選択した予定をカレンダーに追加
            </button>
        </div>
    `;
    lucide.createIcons();
}

/**
 * チェックされたメール由来の予定をカレンダーに追加
 */
function addCheckedEmailEvents() {
    const checkboxes = document.querySelectorAll('.email-evt-checkbox:checked');
    const events = window._parsedEmailEvents;
    if (!events || checkboxes.length === 0) {
        alert('追加する予定が選択されていません。');
        return;
    }

    let addedCount = 0;
    checkboxes.forEach(cb => {
        const idx = parseInt(cb.dataset.index);
        const evt = events[idx];
        if (!evt) return;
        items.push({
            id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            type: 'event',
            title: evt.title,
            description: evt.description || '',
            startDate: evt.date,
            endDate: evt.date,
            startTime: evt.startTime,
            endTime: evt.endTime,
            syncGoogle: false
        });
        addedCount++;
    });

    if (addedCount > 0) {
        saveData();
        updateDashboard();
        renderCalendar();
        elements.emailParseModal.classList.add('hidden');
        alert(`✅ ${addedCount}件の予定をカレンダーに追加しました。`);
    }
}

// ------------------------------------------
// 12. イベントリスナー
// ------------------------------------------
function setupEventListeners() {
    elements.btnNewItem.addEventListener('click', () => openModal(null, getTodayString(), 'task'));
    elements.btnCloseModal.addEventListener('click', closeModal);
    elements.btnCancel.addEventListener('click', closeModal);
    elements.modalTabTask.addEventListener('click', () => setModalType('task'));
    elements.modalTabEvent.addEventListener('click', () => setModalType('event'));
    elements.btnDeleteItem.addEventListener('click', () => { const id = elements.itemId.value; if (id) deleteItem(id); });

    elements.taskRepeat.addEventListener('change', (e) => {
        if (e.target.value === 'none') {
            elements.timeSettingsGroup.classList.remove('hidden');
        } else {
            elements.timeSettingsGroup.classList.add('hidden');
            document.querySelector('input[name="time-type"][value="allday"]').checked = true;
            elements.specificTimeWrapper.classList.add('hidden');
        }
    });

    Array.from(elements.timeTypeRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'specific') elements.specificTimeWrapper.classList.remove('hidden');
            else elements.specificTimeWrapper.classList.add('hidden');
        });
    });

    elements.btnToggleOverdue.addEventListener('click', () => {
        overdueVisible = !overdueVisible;
        localStorage.setItem(OVERDUE_VISIBLE_KEY, overdueVisible);
        updateDashboard();
    });

    elements.btnMonthView.addEventListener('click', () => {
        viewMode = 'month';
        elements.btnMonthView.classList.add('active');
        elements.btnWeekView.classList.remove('active');
        renderCalendar();
    });
    elements.btnWeekView.addEventListener('click', () => {
        viewMode = 'week';
        elements.btnWeekView.classList.add('active');
        elements.btnMonthView.classList.remove('active');
        renderCalendar();
    });
    elements.btnPrevPeriod.addEventListener('click', () => {
        if (viewMode === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
        else currentDate.setDate(currentDate.getDate() - 7);
        renderCalendar();
    });
    elements.btnNextPeriod.addEventListener('click', () => {
        if (viewMode === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
        else currentDate.setDate(currentDate.getDate() + 7);
        renderCalendar();
    });

    // Google設定保存
    elements.googleSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        googleConfig.clientId = elements.googleClientId.value.trim();
        googleConfig.apiKey = elements.googleApiKey.value.trim();
        localStorage.setItem(GOOGLE_CONFIG_KEY, JSON.stringify({ clientId: googleConfig.clientId, apiKey: googleConfig.apiKey }));
        alert('Google API設定を保存しました！');
        updateDashboard();
        renderCalendar();
    });

    // Claude APIキー保存
    if (elements.btnSaveClaudeKey) {
        elements.btnSaveClaudeKey.addEventListener('click', () => {
            const key = elements.claudeApiKey.value.trim();
            if (!key) { alert('APIキーを入力してください。'); return; }
            claudeConfig.apiKey = key;
            localStorage.setItem(CLAUDE_CONFIG_KEY, JSON.stringify({ apiKey: key }));
            alert('✅ Claude APIキーを保存しました！\nAIスケジュール提案・メール解析が利用可能になりました。');
        });
    }

    // AIスケジュール提案ボタン
    if (elements.btnAiSuggest) {
        elements.btnAiSuggest.addEventListener('click', suggestScheduleWithAI);
    }

    // メール解析ボタン
    if (elements.btnParseEmails) {
        elements.btnParseEmails.addEventListener('click', parseEmailsWithAI);
    }

    // AIモーダルを閉じる
    if (elements.btnCloseAiModal) {
        elements.btnCloseAiModal.addEventListener('click', () => {
            elements.aiSuggestModal.classList.add('hidden');
        });
    }

    // メール解析モーダルを閉じる
    if (elements.btnCloseEmailModal) {
        elements.btnCloseEmailModal.addEventListener('click', () => {
            elements.emailParseModal.classList.add('hidden');
        });
    }

    // モーダル保存
    elements.itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = elements.itemId.value;
        const type = elements.itemType.value;
        const title = elements.itemTitle.value.trim();
        const description = elements.itemDesc.value.trim();
        let newItem = {
            id: id || 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            type, title, description
        };

        if (type === 'task') {
            const dueDate = elements.taskDue.value;
            const repeat = elements.taskRepeat.value;
            const feedbackRequired = elements.taskFeedback.checked;
            const priority = document.querySelector('input[name="task-priority"]:checked').value;
            const emailTo = elements.taskEmailTo.value.trim();
            let timeType = 'allday', time = null;
            if (repeat === 'none') {
                timeType = document.querySelector('input[name="time-type"]:checked').value;
                if (timeType === 'specific') time = elements.taskTime.value;
            }
            newItem = { ...newItem, dueDate, repeat, timeType, time, priority, feedbackRequired, emailTo,
                completedDates: id ? (items.find(i => i.id === id)?.completedDates || []) : [] };
        } else {
            const startDate = elements.eventDate.value;
            const startTime = elements.eventStartTime.value;
            const endTime = elements.eventEndTime.value;
            const syncGoogle = elements.eventSyncGoogle.checked;
            newItem = { ...newItem, startDate, startTime, endDate: startDate, endTime, syncGoogle };
        }

        if (id) {
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) items[idx] = newItem;
        } else {
            items.push(newItem);
        }

        saveData(); closeModal(); updateDashboard(); renderCalendar();
    });
}
