// ============================================================
// מערכת פיקוח פרויקטים - JavaScript
// ============================================================

// ========== נתוני ברירת מחדל ==========
const DEFAULT_DATA = {
    adminUser: 'admin',
    adminPass: '1234',

    workerTypes: [
        'אינסטלטור', 'חשמלאי', 'מיזוג', 'מודד', 'מנהל עבודה',
        'מנהל פרויקט', 'מהנדס', 'טפסן', 'ברזלן', 'בטונאי',
        'עובד כללי', 'מפעיל מנוף', 'מפעיל טרקטור', 'משאבות בטון'
    ],

    // כל תתי הקטגוריות - שלבי עבודה
    workStages: [
        'הכנת שטח',
        'חפירה טרקטור',
        'ישור השטח לגובה',
        'קלקר',
        'ניילון',
        'יישור קוצים',
        'בטון רזה',
        'איטום',
        'ברזל רצפה',
        'תפסנות',
        'בדיקת ברזל קונסטרוקטור',
        'יציקת בטון ברצפה',
        'ברזל קירות ועמודים',
        'חלונות',
        'ממ"ד',
        'תיקרה',
        'ברזל',
        'תבניות',
        'אינסטלטור',
        'חשמלאי',
        'משאבות בטון',
        'מיזוג',
        'מערכות נוספות',
        'הזמנת ברזל',
        'ציוד',
        'חומרי גלם',
        'כלים',
        'מודד',
        'בקרת איכות',
        'מנהל עבודה',
        'מנהל פרויקט',
        'מהנדס',
        'מנופים'
    ],

    projects: [
        {
            id: 'proj1',
            name: 'פרויקט 1',
            location: '',
            description: '',
            createdAt: new Date().toISOString(),
            active: true
        }
    ],

    stageBudgetHours: 250, // תקציב שעות לכל תת-קטגוריה

    workers: [],
    logs: []
};

// ========== אתחול מערכת ==========
let data;
let supabaseAttendance = [];

function initData() {
    const saved = localStorage.getItem('projectManagementData');
    if (saved) {
        data = JSON.parse(saved);
        if (!data.workStages) {
            data.workStages = DEFAULT_DATA.workStages;
            saveData();
        }
    } else {
        data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
    }

    initSupabase();
}

async function initSupabase() {
    try {
        if (typeof supabaseSelect === 'function') {
            await loadAttendance();
            setInterval(loadAttendance, 30000);
        }
    } catch (e) {
        console.log('Supabase not configured:', e.message);
    }
}

async function loadAttendance() {
    try {
        const records = await supabaseSelect('attendance');
        supabaseAttendance = records || [];
        if (document.getElementById('tab-overview')?.classList.contains('active')) {
            renderOverview();
        }
        if (document.getElementById('tab-logs')?.classList.contains('active')) {
            renderLogs();
        }
    } catch (e) {
        console.log('Error loading attendance:', e.message);
    }
}

function saveData() {
    localStorage.setItem('projectManagementData', JSON.stringify(data));
}

function resetData() {
    if (confirm('האם אתה בטוח שברצונך לאפס את כל הנתונים?')) {
        localStorage.removeItem('projectManagementData');
        initData();
        showToast('הנתונים אופסו', 'info');
        renderAll();
    }
}

// ========== ניווט מסכים ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'workerScan') {
        setTimeout(() => document.getElementById('barcodeInput').focus(), 100);
    }
    if (screenId === 'adminDashboard') {
        renderAll();
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'workers') renderWorkers();
    if (tabName === 'logs') renderLogs();
    if (tabName === 'hours') renderHours();
    if (tabName === 'projects') renderProjects();
    if (tabName === 'manage') renderManage();
    if (tabName === 'worklog') renderWorkLog();
    if (tabName === 'overview') renderOverview();
    if (tabName === 'analytics') renderAnalytics();
}

// ========== כניסת מנהל ==========
function adminLoginSubmit(e) {
    e.preventDefault();
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    if (user === data.adminUser && pass === data.adminPass) {
        showScreen('adminDashboard');
        showToast('ברוך הבא, מנהל!', 'success');
        setTimeout(() => autoDailyExport(), 3000);
    } else {
        showToast('שם משתמש או סיסמה שגויים', 'error');
    }
}

// ========== סריקת ברקוד ==========
function processBarcode() {
    const input = document.getElementById('barcodeInput');
    const code = input.value.trim();

    if (!code) {
        showToast('הכנס מספר עובד או סרוק ברקוד', 'error');
        return;
    }

    const worker = data.workers.find(w => w.id === code);
    if (!worker) {
        showToast('עובד לא נמצא! בדוק את מספר העובד', 'error');
        input.value = '';
        input.focus();
        return;
    }

    // Check if worker has an open session (checked in but not out)
    const openLog = data.logs.find(l => l.workerId === worker.id && !l.checkoutTime);

    if (openLog) {
        // Worker is checking out
        showCheckoutScreen(worker, openLog);
    } else {
        // Worker is checking in
        performCheckin(worker);
    }

    input.value = '';
}

function performCheckin(worker) {
    const now = new Date();
    const logEntry = {
        id: generateId(),
        workerId: worker.id,
        workerName: worker.name,
        workerType: worker.type,
        projectId: worker.projectId,
        projectName: getProjectName(worker.projectId),
        checkinTime: now.toISOString(),
        checkoutTime: null,
        totalHours: null,
        workDescription: '',
        notes: '',
        date: now.toLocaleDateString('he-IL')
    };

    data.logs.push(logEntry);
    saveData();

    // Show checkin confirmation screen
    document.getElementById('checkinName').textContent = worker.name;
    document.getElementById('checkinType').textContent = worker.type;
    document.getElementById('checkinProject').textContent = getProjectName(worker.projectId);
    document.getElementById('checkinTime').textContent = formatTime(now);

    showScreen('workerCheckin');
}

function showCheckoutScreen(worker, logEntry) {
    const now = new Date();
    const checkinTime = new Date(logEntry.checkinTime);
    const diffMs = now - checkinTime;
    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    document.getElementById('checkoutWorkerInfo').textContent =
        `${worker.name} | ${worker.type} | ${getProjectName(worker.projectId)}`;
    document.getElementById('checkoutEntryTime').textContent = formatTime(checkinTime);
    document.getElementById('checkoutExitTime').textContent = formatTime(now);
    document.getElementById('checkoutTotalHours').textContent = diffHours + ' שעות';

    // Build work description with checkboxes for stages
    buildWorkDescriptionForm();

    // Store current checkout data
    window._checkoutData = {
        logId: logEntry.id,
        checkoutTime: now.toISOString(),
        totalHours: parseFloat(diffHours)
    };

    showScreen('workerCheckout');
}

function buildWorkDescriptionForm() {
    const container = document.getElementById('workDescription');
    // Replace textarea with a stage selection + notes
    const parent = container.parentElement;
    parent.innerHTML = `
        <label>מה בוצע בפועל? (בחר שלבים)</label>
        <div class="stages-checklist" id="stagesChecklist">
            ${data.workStages.map((stage, i) => `
                <label class="stage-checkbox-item">
                    <input type="checkbox" name="workStage" value="${stage}">
                    <span>${stage}</span>
                </label>
            `).join('')}
        </div>
        <div class="form-group" style="margin-top: 1rem;">
            <label>פירוט נוסף</label>
            <textarea id="workDescriptionText" rows="3" placeholder="פרט את העבודה שבוצעה..."></textarea>
        </div>
    `;

    // Add styles for checklist
    if (!document.getElementById('checklistStyles')) {
        const style = document.createElement('style');
        style.id = 'checklistStyles';
        style.textContent = `
            .stages-checklist {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 0.4rem;
                max-height: 250px;
                overflow-y: auto;
                padding: 0.75rem;
                background: var(--bg-input);
                border-radius: var(--radius-sm);
                border: 1px solid var(--border);
            }
            .stage-checkbox-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.4rem 0.6rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                transition: background 0.15s;
            }
            .stage-checkbox-item:hover {
                background: var(--bg-hover);
            }
            .stage-checkbox-item input[type="checkbox"] {
                width: 16px;
                height: 16px;
                accent-color: var(--primary);
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }
}

function submitCheckout(e) {
    e.preventDefault();

    const checkoutData = window._checkoutData;
    if (!checkoutData) return;

    // Get selected stages
    const selectedStages = [];
    document.querySelectorAll('#stagesChecklist input[type="checkbox"]:checked').forEach(cb => {
        selectedStages.push(cb.value);
    });

    const descText = document.getElementById('workDescriptionText')?.value || '';
    const notes = document.getElementById('workNotes')?.value || '';

    const workDescription = selectedStages.length > 0
        ? selectedStages.join(', ') + (descText ? ' | ' + descText : '')
        : descText || 'לא פורט';

    // Find and update the log
    const log = data.logs.find(l => l.id === checkoutData.logId);
    if (log) {
        log.checkoutTime = checkoutData.checkoutTime;
        log.totalHours = checkoutData.totalHours;
        log.workDescription = workDescription;
        log.selectedStages = selectedStages;
        log.notes = notes;
        saveData();
    }

    showToast('יציאה נרשמה בהצלחה! ' + checkoutData.totalHours + ' שעות', 'success');
    showScreen('loginScreen');
}

// ========== ייבוא טפסי קליטה ממתינים ==========
function checkPendingRegistrations() {
    const pending = JSON.parse(localStorage.getItem('pendingWorkerRegistrations') || '[]');
    if (pending.length === 0) return;

    const count = pending.length;
    showToast(`יש ${count} טפסי קליטה ממתינים!`, 'info');

    // Show notification in overview
    setTimeout(() => {
        showPendingModal(pending);
    }, 500);
}

function showPendingModal(pending) {
    // Create modal dynamically
    let modal = document.getElementById('pendingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pendingModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeModal('pendingModal')"></div>
        <div class="modal-content" style="max-width: 650px; max-height: 85vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>טפסי קליטה ממתינים (${pending.length})</h3>
                <button class="close-btn" onclick="closeModal('pendingModal')">&times;</button>
            </div>
            ${pending.map((reg, i) => `
                <div style="background: var(--bg-input); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div>
                            <strong style="font-size: 1.1rem;">${reg.firstName} ${reg.lastName}</strong>
                            <span class="badge badge-type" style="margin-right: 0.5rem;">${reg.workerType}</span>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${reg.submittedAt}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                        ת.ז.: ${reg.idNumber} | טלפון: ${reg.phone}
                        ${reg.email ? ' | אימייל: ' + reg.email : ''}
                        ${reg.experience ? ' | ניסיון: ' + reg.experience + ' שנים' : ''}
                        ${reg.address ? '<br>כתובת: ' + reg.address : ''}
                        ${reg.emergencyName ? '<br>חירום: ' + reg.emergencyName + ' - ' + reg.emergencyPhone : ''}
                        ${reg.notes ? '<br>הערות: ' + reg.notes : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                        <button class="btn btn-primary btn-small" onclick="approvePending(${i})">אשר וקלוט</button>
                        <button class="btn btn-danger btn-small" onclick="rejectPending(${i})">דחה</button>
                    </div>
                </div>
            `).join('')}
            <button class="btn btn-primary btn-full" onclick="approveAllPending()" style="margin-top: 0.5rem;">אשר הכל</button>
        </div>
    `;

    modal.classList.remove('hidden');
}

function approvePending(index) {
    const pending = JSON.parse(localStorage.getItem('pendingWorkerRegistrations') || '[]');
    const reg = pending[index];
    if (!reg) return;

    // Use last 4 digits of ID as barcode, or full ID if short
    const workerId = reg.idNumber.slice(-4) || reg.idNumber;

    // Check if already exists
    if (data.workers.find(w => w.id === workerId)) {
        showToast('מספר עובד כבר קיים! ערוך ידנית', 'error');
        return;
    }

    // Add worker - assign to first active project
    const activeProject = data.projects.find(p => p.active);
    data.workers.push({
        id: workerId,
        name: reg.firstName + ' ' + reg.lastName,
        type: reg.workerType,
        projectId: activeProject ? activeProject.id : '',
        phone: reg.phone,
        idNumber: reg.idNumber,
        email: reg.email || '',
        address: reg.address || '',
        emergencyName: reg.emergencyName || '',
        emergencyPhone: reg.emergencyPhone || ''
    });
    saveData();

    // Remove from pending
    pending.splice(index, 1);
    localStorage.setItem('pendingWorkerRegistrations', JSON.stringify(pending));

    showToast(`${reg.firstName} ${reg.lastName} נקלט בהצלחה! ברקוד: ${workerId}`, 'success');

    if (pending.length > 0) {
        showPendingModal(pending);
    } else {
        closeModal('pendingModal');
    }
    renderWorkers();
}

function rejectPending(index) {
    const pending = JSON.parse(localStorage.getItem('pendingWorkerRegistrations') || '[]');
    const reg = pending[index];
    if (confirm(`למחוק את הטופס של ${reg.firstName} ${reg.lastName}?`)) {
        pending.splice(index, 1);
        localStorage.setItem('pendingWorkerRegistrations', JSON.stringify(pending));
        if (pending.length > 0) {
            showPendingModal(pending);
        } else {
            closeModal('pendingModal');
        }
        showToast('הטופס נדחה', 'info');
    }
}

function approveAllPending() {
    const pending = JSON.parse(localStorage.getItem('pendingWorkerRegistrations') || '[]');
    const activeProject = data.projects.find(p => p.active);
    let added = 0;

    pending.forEach(reg => {
        const workerId = reg.idNumber.slice(-4) || reg.idNumber;
        if (!data.workers.find(w => w.id === workerId)) {
            data.workers.push({
                id: workerId,
                name: reg.firstName + ' ' + reg.lastName,
                type: reg.workerType,
                projectId: activeProject ? activeProject.id : '',
                phone: reg.phone,
                idNumber: reg.idNumber,
                email: reg.email || '',
                address: reg.address || '',
                emergencyName: reg.emergencyName || '',
                emergencyPhone: reg.emergencyPhone || ''
            });
            added++;
        }
    });

    saveData();
    localStorage.setItem('pendingWorkerRegistrations', '[]');
    closeModal('pendingModal');
    showToast(`${added} עובדים נקלטו בהצלחה!`, 'success');
    renderWorkers();
}

// ========== רינדור דשבורד ==========
async function renderAll() {
    await loadAttendance();
    renderOverview();
    checkPendingRegistrations();
}

function renderOverview() {
    // Stats
    document.getElementById('statTotalWorkers').textContent = data.workers.length;
    const activeNow = data.logs.filter(l => !l.checkoutTime).length;
    document.getElementById('statActiveNow').textContent = activeNow;

    const today = new Date().toLocaleDateString('he-IL');
    const todayHours = data.logs
        .filter(l => l.date === today && l.totalHours)
        .reduce((sum, l) => sum + l.totalHours, 0);
    document.getElementById('statTodayHours').textContent = todayHours.toFixed(1);

    const activeProjects = data.projects.filter(p => p.active).length;
    document.getElementById('statProjects').textContent = activeProjects;

    // Active workers list
    const activeWorkers = data.logs.filter(l => !l.checkoutTime);
    const activeList = document.getElementById('activeWorkersList');

    if (activeWorkers.length === 0) {
        activeList.innerHTML = '<div class="empty-state">אין עובדים נוכחים כרגע</div>';
    } else {
        activeList.innerHTML = activeWorkers.map(log => {
            const checkinTime = new Date(log.checkinTime);
            const now = new Date();
            const elapsed = ((now - checkinTime) / (1000 * 60 * 60)).toFixed(1);
            return `
                <div class="active-worker-item">
                    <div class="active-worker-info">
                        <span class="active-worker-name">${log.workerName}</span>
                        <span class="active-worker-meta">${log.workerType} | ${log.projectName}</span>
                    </div>
                    <span class="active-worker-time">${elapsed} שעות | נכנס ${formatTime(checkinTime)}</span>
                </div>
            `;
        }).join('');
    }

    // Recent activity - combine local logs + Firebase attendance
    const recentLocalLogs = [...data.logs].reverse().slice(0, 10).map(log => {
        const isCheckout = !!log.checkoutTime;
        const time = isCheckout ? new Date(log.checkoutTime) : new Date(log.checkinTime);
        return {
            name: log.workerName,
            type: log.workerType,
            action: isCheckout ? 'יציאה' : 'כניסה',
            dotClass: isCheckout ? 'out' : 'in',
            time,
            date: log.date,
            workDescription: isCheckout ? log.workDescription : '',
            source: 'local'
        };
    });

    const recentFirebaseLogs = supabaseAttendance.slice(0, 20).map(entry => ({
        name: entry.full_name,
        type: entry.role,
        action: entry.type === 'checkout' ? 'יציאה' : 'כניסה',
        dotClass: entry.type === 'checkout' ? 'out' : 'in',
        time: new Date(entry.time),
        date: entry.date,
        workDescription: entry.work_done || '',
        source: 'firebase'
    }));

    const allActivity = [...recentLocalLogs, ...recentFirebaseLogs]
        .sort((a, b) => b.time - a.time)
        .slice(0, 15);

    const activityList = document.getElementById('recentActivity');

    if (allActivity.length === 0) {
        activityList.innerHTML = '<div class="empty-state">אין פעילות אחרונה</div>';
    } else {
        activityList.innerHTML = allActivity.map(item => `
            <div class="activity-item">
                <div class="activity-dot ${item.dotClass}"></div>
                <div>
                    <div class="activity-text"><strong>${item.name}</strong> - ${item.action} | ${item.type}</div>
                    <div class="activity-time">${formatTime(item.time)} | ${item.date}</div>
                    ${item.workDescription ? `<div class="activity-time">${item.workDescription}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
}

// ========== רינדור עובדים ==========
async function renderWorkers() {
    const tbody = document.getElementById('workersTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">טוען...</td></tr>`;

    try {
        const workers = await supabaseSelectAll('workers');

        if (!workers || workers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">אין עובדים רשומים</td></tr>`;
        } else {
            tbody.innerHTML = workers.sort((a, b) => a.worker_number - b.worker_number).map(worker => {
                const regDate = worker.created_at ? new Date(worker.created_at).toLocaleDateString('he-IL') : '-';
                return `
                <tr>
                    <td><strong>${worker.worker_number}</strong></td>
                    <td>${worker.full_name}</td>
                    <td><span class="badge badge-type">${worker.role}</span></td>
                    <td>${regDate}</td>
                    <td><button class="btn-delete" onclick="deleteWorkerRecord(${worker.id})" title="הסר עובד">🗑</button></td>
                </tr>`;
            }).join('');
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">שגיאה בטעינה: ${e.message}</td></tr>`;
    }

    updateWorkerFormSelects();
}

function updateWorkerFormSelects() {
    const typeSelect = document.getElementById('newWorkerTypeSelect');
    if (typeSelect) {
        typeSelect.innerHTML = data.workerTypes.map(t =>
            `<option value="${t}">${t}</option>`
        ).join('');
    }

    const projSelect = document.getElementById('newWorkerProject');
    if (projSelect) {
        projSelect.innerHTML = data.projects.filter(p => p.active).map(p =>
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
    }
}

function addWorker(e) {
    e.preventDefault();
    const name = document.getElementById('newWorkerName').value.trim();
    const type = document.getElementById('newWorkerTypeSelect').value;
    const projectId = document.getElementById('newWorkerProject').value;
    const id = document.getElementById('newWorkerId').value.trim();

    if (data.workers.find(w => w.id === id)) {
        showToast('מספר עובד כבר קיים!', 'error');
        return;
    }

    data.workers.push({ id, name, type, projectId });
    saveData();

    closeModal('addWorkerModal');
    showToast(`העובד ${name} נוסף בהצלחה`, 'success');
    renderWorkers();

    // Clear form
    document.getElementById('newWorkerName').value = '';
    document.getElementById('newWorkerId').value = '';
}

function deleteWorker(id) {
    const worker = data.workers.find(w => w.id === id);
    if (!worker) return;

    if (confirm(`האם למחוק את העובד ${worker.name}?`)) {
        data.workers = data.workers.filter(w => w.id !== id);
        saveData();
        renderWorkers();
        showToast('העובד נמחק', 'info');
    }
}

function editWorker(id) {
    const worker = data.workers.find(w => w.id === id);
    if (!worker) return;

    document.getElementById('newWorkerName').value = worker.name;
    document.getElementById('newWorkerId').value = worker.id;
    document.getElementById('newWorkerId').disabled = true;

    updateWorkerFormSelects();

    setTimeout(() => {
        document.getElementById('newWorkerTypeSelect').value = worker.type;
        document.getElementById('newWorkerProject').value = worker.projectId;
    }, 50);

    // Change submit handler temporarily
    const form = document.querySelector('#addWorkerModal form');
    form.onsubmit = function(e) {
        e.preventDefault();
        worker.name = document.getElementById('newWorkerName').value.trim();
        worker.type = document.getElementById('newWorkerTypeSelect').value;
        worker.projectId = document.getElementById('newWorkerProject').value;
        saveData();
        closeModal('addWorkerModal');
        showToast('העובד עודכן', 'success');
        renderWorkers();
        document.getElementById('newWorkerId').disabled = false;
        form.onsubmit = function(e) { addWorker(e); };
    };

    showModal('addWorkerModal');
    document.querySelector('#addWorkerModal .modal-header h3').textContent = 'עריכת עובד';
}

// ========== שעות עובדים - 250 שעות ==========
function renderHours() {
    const monthFilter = document.getElementById('hoursFilterMonth');
    const tbody = document.getElementById('hoursTableBody');

    // Build month options
    const months = new Set();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    months.add(currentMonth);

    supabaseAttendance.forEach(entry => {
        if (entry.time) {
            const d = new Date(entry.time);
            const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.add(m);
        }
    });

    const sortedMonths = [...months].sort().reverse();
    const selectedMonth = monthFilter.value || currentMonth;

    monthFilter.innerHTML = sortedMonths.map(m => {
        const [y, mo] = m.split('-');
        const label = new Date(y, mo - 1).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
        return `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${label}</option>`;
    }).join('');

    // Filter attendance for selected month
    const monthEntries = supabaseAttendance.filter(entry => {
        if (!entry.time) return false;
        const d = new Date(entry.time);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return m === selectedMonth;
    });

    const checkins = monthEntries.filter(e => e.type === 'checkin');
    const checkouts = monthEntries.filter(e => e.type === 'checkout');

    // Calculate monthly hours per worker
    const workerHours = {};

    checkins.forEach(ci => {
        const key = ci.worker_id;
        if (!workerHours[key]) {
            workerHours[key] = { name: ci.full_name, role: ci.role, workerId: ci.worker_id, monthHours: 0, totalHours: 0 };
        }
        const matchingCheckout = checkouts.find(co =>
            co.worker_id === ci.worker_id && co.date === ci.date
        );
        if (matchingCheckout) {
            const ciTime = new Date(ci.time);
            const coTime = new Date(matchingCheckout.time);
            const hours = (coTime - ciTime) / (1000 * 60 * 60);
            if (hours > 0 && hours < 24) {
                workerHours[key].monthHours += hours;
            }
        }
    });

    // Calculate total hours across all months
    const allCheckins = supabaseAttendance.filter(e => e.type === 'checkin');
    const allCheckouts = supabaseAttendance.filter(e => e.type === 'checkout');

    allCheckins.forEach(ci => {
        const key = ci.worker_id;
        if (!workerHours[key]) {
            workerHours[key] = { name: ci.full_name, role: ci.role, workerId: ci.worker_id, monthHours: 0, totalHours: 0 };
        }
        const matchingCheckout = allCheckouts.find(co =>
            co.worker_id === ci.worker_id && co.date === ci.date
        );
        if (matchingCheckout) {
            const ciTime = new Date(ci.time);
            const coTime = new Date(matchingCheckout.time);
            const hours = (coTime - ciTime) / (1000 * 60 * 60);
            if (hours > 0 && hours < 24) {
                workerHours[key].totalHours += hours;
            }
        }
    });

    const workers = Object.values(workerHours).sort((a, b) => b.totalHours - a.totalHours);

    // Get month label for display
    const [selY, selM] = selectedMonth.split('-');
    const monthLabel = new Date(selY, selM - 1).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });

    if (workers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">אין נתוני שעות לחודש זה</td></tr>`;
    } else {
        tbody.innerHTML = workers.map(w => {
            return `
            <tr>
                <td><strong>${w.workerId}</strong></td>
                <td>${w.name}</td>
                <td><span class="badge badge-type">${w.role}</span></td>
                <td><strong>${w.monthHours.toFixed(1)}</strong></td>
                <td><strong>${w.totalHours.toFixed(1)}</strong></td>
            </tr>`;
        }).join('');
    }
}

// ========== רינדור יומן נוכחות ==========
function renderLogs() {
    const filterProject = document.getElementById('logFilterProject').value;
    const filterWorker = document.getElementById('logFilterWorker').value;
    const filterDate = document.getElementById('logFilterDate').value;

    // Update filter selects
    updateLogFilters();

    let filteredLogs = [...data.logs].reverse();

    if (filterProject) {
        filteredLogs = filteredLogs.filter(l => l.projectId === filterProject);
    }
    if (filterWorker) {
        filteredLogs = filteredLogs.filter(l => l.workerId === filterWorker);
    }
    if (filterDate) {
        const dateStr = new Date(filterDate).toLocaleDateString('he-IL');
        filteredLogs = filteredLogs.filter(l => l.date === dateStr);
    }

    // Add Firebase attendance to logs
    const firebaseLogs = supabaseAttendance.map(entry => ({
        id: entry.id,
        date: entry.date,
        workerName: entry.full_name,
        workerType: entry.role,
        projectName: '-',
        checkinTime: entry.type === 'checkin' ? entry.time : null,
        checkoutTime: entry.type === 'checkout' ? entry.time : null,
        totalHours: null,
        workDescription: entry.work_done || '',
        notes: '',
        workerId: entry.worker_id,
        isFirebase: true,
        type: entry.type
    }));

    // Match checkins with checkouts by workerId + date
    const pairedLogs = [];
    const checkins = firebaseLogs.filter(l => l.type === 'checkin');
    const checkouts = firebaseLogs.filter(l => l.type === 'checkout');

    checkins.forEach(ci => {
        const matchingCheckout = checkouts.find(co =>
            co.workerId === ci.workerId && co.date === ci.date
        );
        if (matchingCheckout) {
            const ciTime = new Date(ci.checkinTime);
            const coTime = new Date(matchingCheckout.checkoutTime);
            const hours = ((coTime - ciTime) / (1000 * 60 * 60));
            pairedLogs.push({
                ...ci,
                checkoutId: matchingCheckout.id,
                checkoutTime: matchingCheckout.checkoutTime,
                totalHours: hours > 0 ? hours : null,
                workDescription: matchingCheckout.workDescription
            });
        } else {
            pairedLogs.push(ci);
        }
    });

    // Add checkouts without matching checkin
    checkouts.forEach(co => {
        const hasMatch = checkins.some(ci => ci.workerId === co.workerId && ci.date === co.date);
        if (!hasMatch) {
            pairedLogs.push(co);
        }
    });

    const allLogs = [...filteredLogs, ...pairedLogs].sort((a, b) => {
        const timeA = new Date(a.checkoutTime || a.checkinTime || 0);
        const timeB = new Date(b.checkoutTime || b.checkinTime || 0);
        return timeB - timeA;
    });

    const tbody = document.getElementById('logsTableBody');

    if (allLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">אין רשומות נוכחות</td></tr>`;

    } else {
        tbody.innerHTML = allLogs.map(log => {
            const deleteIds = [];
            if (log.id) deleteIds.push(log.id);
            if (log.checkoutId) deleteIds.push(log.checkoutId);
            const deleteBtn = log.isFirebase && deleteIds.length > 0
                ? `<button class="btn-delete" onclick="deleteAttendanceRecord([${deleteIds.join(',')}])" title="מחק רשומה">🗑</button>`
                : '-';
            return `
            <tr>
                <td>${log.date}</td>
                <td><strong>${log.workerName}</strong></td>
                <td><span class="badge badge-type">${log.workerType}</span></td>
                <td>${log.checkinTime ? formatTime(new Date(log.checkinTime)) : '-'}</td>
                <td>${log.checkoutTime ? formatTime(new Date(log.checkoutTime)) : '<span class="badge badge-active">עדיין באתר</span>'}</td>
                <td>${log.totalHours ? log.totalHours.toFixed(2) : '-'}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${log.workDescription || ''}">${log.workDescription || '-'}</td>
                <td>${deleteBtn}</td>
            </tr>`;
        }).join('');
    }
}

function updateLogFilters() {
    const projectFilter = document.getElementById('logFilterProject');
    const workerFilter = document.getElementById('logFilterWorker');

    const currentProject = projectFilter.value;
    const currentWorker = workerFilter.value;

    // Only rebuild if options count changed
    if (projectFilter.options.length !== data.projects.length + 1) {
        projectFilter.innerHTML = '<option value="">כל הפרויקטים</option>' +
            data.projects.map(p => `<option value="${p.id}" ${p.id === currentProject ? 'selected' : ''}>${p.name}</option>`).join('');
    }

    if (workerFilter.options.length !== data.workers.length + 1) {
        workerFilter.innerHTML = '<option value="">כל העובדים</option>' +
            data.workers.map(w => `<option value="${w.id}" ${w.id === currentWorker ? 'selected' : ''}>${w.name}</option>`).join('');
    }
}

// ========== תקציב שעות לפי מקצוע ==========
function getRoleBudgets(projectName) {
    const key = 'roleBudgets_' + projectName;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
}

function setRoleBudget(projectName, role, hours) {
    const key = 'roleBudgets_' + projectName;
    const budgets = getRoleBudgets(projectName);
    if (hours > 0) {
        budgets[role] = hours;
    } else {
        delete budgets[role];
    }
    localStorage.setItem(key, JSON.stringify(budgets));
}

function editRoleBudget(projectName, role) {
    const budgets = getRoleBudgets(projectName);
    const current = budgets[role] || '';
    const input = prompt('הגדר תקציב שעות עבור ' + role + ':', current);
    if (input === null) return;
    const hours = parseFloat(input);
    if (isNaN(hours) || hours < 0) {
        showToast('יש להזין מספר חיובי', 'error');
        return;
    }
    setRoleBudget(projectName, role, hours);
    renderProjects();
    showToast(hours > 0 ? 'תקציב עודכן: ' + hours + ' שעות' : 'תקציב הוסר', 'success');
}

// ========== חלונית מקצוע ==========
function openRoleModal(projectName, role) {
    const roleBudgets = getRoleBudgets(projectName);
    const budget = roleBudgets[role] || 0;
    const hasBudget = budget > 0;

    // Calculate actual hours for this role in this project
    const projAttendance = supabaseAttendance.filter(e => e.project === projectName);
    const checkins = projAttendance.filter(e => e.type === 'checkin' && e.role === role);
    const checkouts = projAttendance.filter(e => e.type === 'checkout' && e.role === role);

    let totalHours = 0;
    const workerDetails = {};

    checkins.forEach(ci => {
        const co = checkouts.find(c => c.worker_id === ci.worker_id && c.date === ci.date);
        if (co) {
            const hours = (new Date(co.time) - new Date(ci.time)) / (1000 * 60 * 60);
            if (hours > 0 && hours < 24) {
                totalHours += hours;
                if (!workerDetails[ci.worker_id]) {
                    workerDetails[ci.worker_id] = { name: ci.full_name, hours: 0, days: 0 };
                }
                workerDetails[ci.worker_id].hours += hours;
                workerDetails[ci.worker_id].days += 1;
            }
        }
    });

    const workers = Object.values(workerDetails).sort((a, b) => b.hours - a.hours);
    const percent = hasBudget ? Math.min((totalHours / budget) * 100, 100) : 0;
    const isOver = hasBudget && totalHours > budget;
    const barColor = isOver ? 'var(--danger)' : 'var(--primary)';
    const escapedName = projectName.replace(/'/g, "\\'");
    const escapedRole = role.replace(/'/g, "\\'");

    let modal = document.getElementById('roleModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'roleModal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeModal('roleModal')"></div>
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header">
                <h3>${role}</h3>
                <button class="close-btn" onclick="closeModal('roleModal')">&times;</button>
            </div>

            <div style="display: flex; gap: 1rem; margin-bottom: 1.2rem;">
                <div style="flex:1; background: var(--bg-input); border-radius: var(--radius-sm); padding: 1rem; text-align: center;">
                    <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary-light);">${totalHours.toFixed(1)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">שעות בפועל</div>
                </div>
                <div style="flex:1; background: var(--bg-input); border-radius: var(--radius-sm); padding: 1rem; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <span style="font-size: 1.6rem; font-weight: 800; color: ${isOver ? 'var(--danger)' : 'var(--text-primary)'};">${hasBudget ? budget : '—'}</span>
                        <button class="btn-budget-edit" onclick="editRoleBudget('${escapedName}', '${escapedRole}'); openRoleModal('${escapedName}', '${escapedRole}');" title="שנה תקציב">+</button>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">תקציב שעות</div>
                </div>
                <div style="flex:1; background: var(--bg-input); border-radius: var(--radius-sm); padding: 1rem; text-align: center;">
                    <div style="font-size: 1.6rem; font-weight: 800;">${workers.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">עובדים</div>
                </div>
            </div>

            ${hasBudget ? `
            <div style="margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">
                    <span>${totalHours.toFixed(1)} / ${budget}</span>
                    <span>${percent.toFixed(0)}%</span>
                </div>
                <div class="stage-bar-container" style="height: 10px;">
                    <div class="stage-bar" style="width: ${percent}%; background: ${barColor};"></div>
                </div>
                ${isOver ? '<div style="color: var(--danger); font-size: 0.85rem; font-weight: 700; margin-top: 0.4rem;">חריגה בתקציב שעות!</div>' : ''}
            </div>
            ` : ''}

            ${workers.length > 0 ? `
            <div style="border-top: 1px solid var(--border); padding-top: 1rem;">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-secondary);">עובדים במקצוע</h4>
                ${workers.map(w => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: var(--bg-input); border-radius: var(--radius-sm); margin-bottom: 0.4rem;">
                        <div>
                            <strong style="font-size: 0.9rem;">${w.name}</strong>
                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-right: 0.5rem;">${w.days} ימים</span>
                        </div>
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary-light);">${w.hours.toFixed(1)} שעות</span>
                    </div>
                `).join('')}
            </div>
            ` : '<div class="empty-state">אין עובדים רשומים במקצוע זה</div>'}
        </div>
    `;

    modal.classList.remove('hidden');
}

// ========== רינדור פרויקטים ==========
function getRoleHours() {
    const roleHours = {};
    data.workerTypes.forEach(role => { roleHours[role] = 0; });

    const checkins = supabaseAttendance.filter(e => e.type === 'checkin');
    const checkouts = supabaseAttendance.filter(e => e.type === 'checkout');

    checkins.forEach(ci => {
        const co = checkouts.find(c => c.worker_id === ci.worker_id && c.date === ci.date);
        if (co) {
            const hours = (new Date(co.time) - new Date(ci.time)) / (1000 * 60 * 60);
            if (hours > 0 && hours < 24) {
                const role = ci.role;
                if (roleHours[role] !== undefined) {
                    roleHours[role] += hours;
                } else {
                    roleHours[role] = hours;
                }
            }
        }
    });

    return roleHours;
}

async function renderProjects() {
    const container = document.getElementById('projectsList');
    const budget = data.stageBudgetHours || 250;

    let projects = [];
    try {
        projects = await supabaseSelectAll('projects');
    } catch (e) {
        console.log('Error loading projects:', e.message);
    }

    if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="empty-state">אין פרויקטים. לחץ "הוסף פרויקט" כדי להתחיל.</div>';
        return;
    }

    container.innerHTML = projects.map(project => {
        // Filter attendance for this project only
        const projAttendance = supabaseAttendance.filter(e => e.project === project.name);
        const projCheckins = projAttendance.filter(e => e.type === 'checkin');
        const projCheckouts = projAttendance.filter(e => e.type === 'checkout');

        // Calculate role hours for this project
        const roleHours = {};
        data.workerTypes.forEach(r => { roleHours[r] = 0; });

        projCheckins.forEach(ci => {
            const co = projCheckouts.find(c => c.worker_id === ci.worker_id && c.date === ci.date);
            if (co) {
                const hours = (new Date(co.time) - new Date(ci.time)) / (1000 * 60 * 60);
                if (hours > 0 && hours < 24) {
                    if (roleHours[ci.role] !== undefined) roleHours[ci.role] += hours;
                    else roleHours[ci.role] = hours;
                }
            }
        });

        const totalHours = Object.values(roleHours).reduce((s, h) => s + h, 0);
        const totalWorkers = new Set(projAttendance.map(e => e.worker_id)).size;
        const today = new Date().toLocaleDateString('he-IL');
        const activeNow = projCheckins.filter(ci => {
            if (ci.date !== today) return false;
            return !projCheckouts.some(co => co.worker_id === ci.worker_id && co.date === today);
        }).length;

        const roleBudgets = getRoleBudgets(project.name);

        const rolesHtml = data.workerTypes.map(role => {
            const hours = roleHours[role] || 0;
            const roleBudget = roleBudgets[role] || 0;
            const hasBudget = roleBudget > 0;
            const percent = hasBudget ? Math.min((hours / roleBudget) * 100, 100) : 0;
            const isOver = hasBudget && hours > roleBudget;
            const barColor = isOver ? 'var(--danger)' : 'var(--primary)';
            const escapedName = project.name.replace(/'/g, "\\'");
            const escapedRole = role.replace(/'/g, "\\'");

            return `
                <div class="stage-row">
                    <div class="stage-name stage-name-clickable" onclick="openRoleModal('${escapedName}', '${escapedRole}')">${role}</div>
                    <div class="stage-bar-container">
                        ${hasBudget ? `<div class="stage-bar" style="width: ${percent}%; background: ${barColor};"></div>` : ''}
                    </div>
                    <div class="stage-hours">
                        ${hasBudget ? `<span ${isOver ? 'style="color: var(--danger); font-weight: 700;"' : ''}>${hours.toFixed(1)} / ${roleBudget}${isOver ? ' <span class="stage-over">חריגה!</span>' : ''}</span>` : '—'}
                    </div>
                    <button class="btn-budget-edit" onclick="event.stopPropagation(); editRoleBudget('${escapedName}', '${escapedRole}')" title="הגדר תקציב שעות">+</button>
                </div>
            `;
        }).join('');

        return `
            <div class="project-card project-card-full">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3>${project.name}</h3>
                        <div class="project-meta">
                            ${project.location ? project.location + ' | ' : ''}
                            ${project.active ? '<span class="badge badge-active">פעיל</span>' : '<span class="badge badge-inactive">לא פעיל</span>'}
                        </div>
                        ${project.description ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">${project.description}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-outline btn-small" onclick="toggleProject(${project.id})">${project.active ? 'השהה' : 'הפעל'}</button>
                        <button class="btn btn-danger btn-small" onclick="deleteProject(${project.id})">מחק</button>
                    </div>
                </div>
                <div class="project-stats">
                    <div class="project-stat">
                        <span class="project-stat-num">${totalWorkers}</span>
                        <span class="project-stat-label">עובדים</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-num">${activeNow}</span>
                        <span class="project-stat-label">נוכחים כרגע</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-num">${totalHours.toFixed(1)}</span>
                        <span class="project-stat-label">סה"כ שעות</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-num">${projAttendance.length}</span>
                        <span class="project-stat-label">רשומות</span>
                    </div>
                </div>
                <div class="stages-budget-section">
                    <h4 class="stages-budget-title">שעות בפועל לפי מקצוע</h4>
                    <div class="stages-budget-list">
                        ${rolesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function addProject(e) {
    e.preventDefault();
    const name = document.getElementById('newProjectName').value.trim();
    const location = document.getElementById('newProjectLocation').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();

    try {
        await supabaseInsert('projects', {
            name: name,
            location: location,
            description: description,
            active: true
        });
        closeModal('addProjectModal');
        showToast(`הפרויקט "${name}" נוסף בהצלחה`, 'success');
        renderProjects();
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectLocation').value = '';
        document.getElementById('newProjectDesc').value = '';
    } catch (err) {
        showToast('שגיאה: ' + err.message, 'error');
    }
}

async function toggleProject(id) {
    try {
        const projects = await supabaseSelectAll('projects');
        const project = projects.find(p => p.id === id);
        if (!project) return;
        const res = await fetch(`${SUPABASE_REST}/projects?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            },
            body: JSON.stringify({ active: !project.active })
        });
        if (!res.ok) throw new Error('שגיאה בעדכון');
        showToast(`הפרויקט ${!project.active ? 'הופעל' : 'הושהה'}`, 'info');
        renderProjects();
    } catch (err) {
        showToast('שגיאה: ' + err.message, 'error');
    }
}

async function deleteProject(id) {
    if (!verifyAdminPassword()) return;
    if (!confirm('האם למחוק את הפרויקט?')) return;
    try {
        await supabaseDelete('projects', id);
        showToast('הפרויקט נמחק', 'info');
        renderProjects();
    } catch (err) {
        showToast('שגיאה: ' + err.message, 'error');
    }
}

// ========== ניהול מערכת ==========
function renderManage() {
    // Worker types
    const typesList = document.getElementById('workerTypesList');
    typesList.innerHTML = data.workerTypes.map(function(type) {
        return '<span class="tag">' + type + '<button class="remove-tag" onclick="removeWorkerType(\'' + type + '\')">&times;</button></span>';
    }).join('');

    // Work stages / tasks
    const stagesList = document.getElementById('workStagesList');
    if (stagesList) {
        stagesList.innerHTML = data.workStages.map(function(stage) {
            return '<span class="tag">' + stage + '<button class="remove-tag" onclick="removeWorkStage(\'' + stage + '\')">&times;</button></span>';
        }).join('');
    }
}

function addWorkerType() {
    const input = document.getElementById('newWorkerType');
    const type = input.value.trim();
    if (!type) return;

    if (data.workerTypes.includes(type)) {
        showToast('סוג עובד כבר קיים', 'error');
        return;
    }

    data.workerTypes.push(type);
    saveData();
    input.value = '';
    renderManage();
    showToast(`סוג "${type}" נוסף`, 'success');
}

function removeWorkerType(type) {
    const inUse = data.workers.some(w => w.type === type);
    if (inUse) {
        showToast('לא ניתן למחוק - סוג בשימוש על ידי עובדים', 'error');
        return;
    }

    data.workerTypes = data.workerTypes.filter(t => t !== type);
    saveData();
    renderManage();
    showToast(`סוג "${type}" הוסר`, 'info');
}

function changePassword() {
    const current = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;

    if (current !== data.adminPass) {
        showToast('סיסמה נוכחית שגויה', 'error');
        return;
    }

    if (newPass.length < 4) {
        showToast('סיסמה חדשה חייבת להכיל לפחות 4 תווים', 'error');
        return;
    }

    data.adminPass = newPass;
    saveData();
    document.getElementById('currentPass').value = '';
    document.getElementById('newPass').value = '';
    showToast('הסיסמה שונתה בהצלחה', 'success');
}

// ========== ייצוא נתונים ==========
function verifyAdminPassword(action) {
    const pass = prompt('הכנס סיסמת מנהל לאישור:');
    if (!pass) return false;
    if (pass !== data.adminPass) {
        showToast('סיסמה שגויה - הפעולה בוטלה', 'error');
        return false;
    }
    return true;
}

async function deleteWorkerRecord(id) {
    if (!verifyAdminPassword()) return;
    if (!confirm('האם אתה בטוח שברצונך להסיר עובד זה?')) return;
    try {
        await supabaseDelete('workers', id);
        showToast('העובד הוסר בהצלחה', 'success');
        renderWorkers();
    } catch (err) {
        showToast('שגיאה בהסרה: ' + err.message, 'error');
    }
}

async function deleteAttendanceRecord(ids) {
    if (!verifyAdminPassword()) return;
    if (!confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) return;
    try {
        for (const id of ids) {
            await supabaseDelete('attendance', id);
        }
        showToast('הרשומה נמחקה בהצלחה', 'success');
        await loadAttendance();
        renderLogs();
    } catch (err) {
        showToast('שגיאה במחיקה: ' + err.message, 'error');
    }
}

async function autoDailyExport() {
    const today = new Date().toISOString().slice(0, 10);
    const lastExport = localStorage.getItem('lastDailyExport');
    if (lastExport === today) return;

    await loadAttendance();
    if (supabaseAttendance.length === 0) return;

    const todayHe = new Date().toLocaleDateString('he-IL');

    // Pair checkins with checkouts
    const checkins = supabaseAttendance.filter(e => e.type === 'checkin');
    const checkouts = supabaseAttendance.filter(e => e.type === 'checkout');

    let csv = '\uFEFF';
    csv += 'תאריך,מס עובד,שם עובד,תפקיד,שעת כניסה,שעת יציאה,שעות בפועל,מה בוצע\n';

    checkins.forEach(ci => {
        const co = checkouts.find(c => c.worker_id === ci.worker_id && c.date === ci.date);
        const name = (ci.full_name || '-').replace(/"/g, '""');
        const role = (ci.role || '-').replace(/"/g, '""');
        const ciTime = ci.time ? new Date(ci.time) : null;
        const coTime = co && co.time ? new Date(co.time) : null;
        const ciDisplay = ciTime ? ciTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
        const coDisplay = coTime ? coTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
        const hours = (ciTime && coTime) ? ((coTime - ciTime) / (1000 * 60 * 60)) : 0;
        const hoursDisplay = hours > 0 && hours < 24 ? hours.toFixed(2) : '-';
        const workDone = (co && co.work_done || '-').replace(/"/g, '""');

        csv += `${ci.date || '-'},${ci.worker_id},"${name}","${role}",${ciDisplay},${coDisplay},${hoursDisplay},"${workDone}"\n`;
    });

    // Add checkouts without matching checkin
    checkouts.forEach(co => {
        const hasCheckin = checkins.some(ci => ci.worker_id === co.worker_id && ci.date === co.date);
        if (!hasCheckin) {
            const name = (co.full_name || '-').replace(/"/g, '""');
            const role = (co.role || '-').replace(/"/g, '""');
            const coTime = co.time ? new Date(co.time) : null;
            const coDisplay = coTime ? coTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
            const workDone = (co.work_done || '-').replace(/"/g, '""');

            csv += `${co.date || '-'},${co.worker_id},"${name}","${role}",-,${coDisplay},-,"${workDone}"\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דוח_יומי_${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    localStorage.setItem('lastDailyExport', today);
    showToast('דוח יומי הורד אוטומטית', 'success');
}

function exportData() {
    if (supabaseAttendance.length === 0) {
        showToast('אין נתונים לייצוא', 'error');
        return;
    }

    const checkins = supabaseAttendance.filter(e => e.type === 'checkin');
    const checkouts = supabaseAttendance.filter(e => e.type === 'checkout');

    let csv = '\uFEFF';
    csv += 'תאריך,מס עובד,שם עובד,תפקיד,שעת כניסה,שעת יציאה,שעות בפועל,מה בוצע\n';

    checkins.forEach(ci => {
        const co = checkouts.find(c => c.worker_id === ci.worker_id && c.date === ci.date);
        const name = (ci.full_name || '-').replace(/"/g, '""');
        const role = (ci.role || '-').replace(/"/g, '""');
        const ciTime = ci.time ? new Date(ci.time) : null;
        const coTime = co && co.time ? new Date(co.time) : null;
        const ciDisplay = ciTime ? ciTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
        const coDisplay = coTime ? coTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
        const hours = (ciTime && coTime) ? ((coTime - ciTime) / (1000 * 60 * 60)) : 0;
        const hoursDisplay = hours > 0 && hours < 24 ? hours.toFixed(2) : '-';
        const workDone = (co && co.work_done || '-').replace(/"/g, '""');

        csv += `${ci.date || '-'},${ci.worker_id},"${name}","${role}",${ciDisplay},${coDisplay},${hoursDisplay},"${workDone}"\n`;
    });

    checkouts.forEach(co => {
        const hasCheckin = checkins.some(ci => ci.worker_id === co.worker_id && ci.date === co.date);
        if (!hasCheckin) {
            const name = (co.full_name || '-').replace(/"/g, '""');
            const role = (co.role || '-').replace(/"/g, '""');
            const coTime = co.time ? new Date(co.time) : null;
            const coDisplay = coTime ? coTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}) : '-';
            const workDone = (co.work_done || '-').replace(/"/g, '""');

            csv += `${co.date || '-'},${co.worker_id},"${name}","${role}",-,${coDisplay},-,"${workDone}"\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דוח_נוכחות_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showToast('הקובץ הורד בהצלחה', 'success');
}

// ========== מודלים ==========
function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    updateWorkerFormSelects();
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    // Reset add worker modal title
    const header = document.querySelector('#addWorkerModal .modal-header h3');
    if (header) header.textContent = 'הוספת עובד חדש';
    const idInput = document.getElementById('newWorkerId');
    if (idInput) idInput.disabled = false;

    const form = document.querySelector('#addWorkerModal form');
    if (form) form.onsubmit = function(e) { addWorker(e); };
}

// ========== Toast הודעות ==========
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;

    // Remove hidden and trigger show
    toast.classList.remove('hidden');
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// ========== פונקציות עזר ==========
function generateId() {
    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function formatTime(date) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function getProjectName(projectId) {
    const project = data.projects.find(p => p.id === projectId);
    return project ? project.name : 'לא ידוע';
}

// ========== אתחול ==========
document.addEventListener('DOMContentLoaded', () => {
    initData();

    // Set today's date in filter
    const dateInput = document.getElementById('logFilterDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
});

// ========== יומן עבודה ==========
let workLogs = [];
let wlProjectsCache = [];
let wlWorkersCache = [];

async function loadWorkLogs() {
    try {
        workLogs = await supabaseSelectAll('work_logs') || [];
    } catch (e) {
        workLogs = JSON.parse(localStorage.getItem('workLogs') || '[]');
    }
}

async function renderWorkLog() {
    await loadWorkLogs();

    const dateInput = document.getElementById('wlDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    try {
        wlProjectsCache = await supabaseSelectAll('projects') || [];
    } catch (e) {
        wlProjectsCache = data.projects;
    }

    const projSelect = document.getElementById('wlProject');
    projSelect.innerHTML = '<option value="">בחר פרויקט</option>' +
        wlProjectsCache.filter(p => p.active).map(p =>
            '<option value="' + p.name + '">' + p.name + '</option>'
        ).join('');

    try {
        wlWorkersCache = await supabaseSelectAll('workers') || [];
    } catch (e) {
        wlWorkersCache = data.workers.map(w => ({ full_name: w.name, role: w.type, project: '' }));
    }

    renderWorkLogHistory();
}

// כשבוחרים פרויקט - מסננים מקצועות ועובדים
function onWorkLogProjectChange() {
    const project = document.getElementById('wlProject').value;
    const roleSelect = document.getElementById('wlRole');
    const roles = new Set();

    if (project) {
        supabaseAttendance.filter(e => e.project === project)
            .forEach(e => { if (e.role) roles.add(e.role); });
        wlWorkersCache.forEach(w => {
            if (w.project === project || !w.project) {
                if (w.role) roles.add(w.role);
            }
        });
    }

    if (roles.size === 0) {
        data.workerTypes.forEach(r => roles.add(r));
    }

    const rolesArr = Array.from(roles).sort();
    roleSelect.innerHTML = '<option value="">בחר מקצוע</option>' +
        rolesArr.map(r => '<option value="' + r + '">' + r + '</option>').join('');

    onWorkLogRoleChange();
}

// כשבוחרים מקצוע - מסננים עובדים ומשימות
function onWorkLogRoleChange() {
    const project = document.getElementById('wlProject').value;
    const role = document.getElementById('wlRole').value;
    const workerSelect = document.getElementById('wlWorker');
    let filteredWorkers = wlWorkersCache.slice();

    if (role) {
        filteredWorkers = filteredWorkers.filter(w => w.role === role);
    }

    if (project) {
        const projWorkerNames = new Set();
        supabaseAttendance
            .filter(e => e.project === project && (!role || e.role === role))
            .forEach(e => projWorkerNames.add(e.full_name));
        filteredWorkers.forEach(w => projWorkerNames.add(w.full_name));

        const namesArr = Array.from(projWorkerNames).sort();
        workerSelect.innerHTML = '<option value="">בחר עובד</option>' +
            namesArr.map(n => '<option value="' + n + '">' + n + '</option>').join('');
    } else {
        workerSelect.innerHTML = '<option value="">בחר עובד</option>' +
            filteredWorkers.map(w => '<option value="' + w.full_name + '">' + w.full_name + '</option>').join('');
    }

    updateWorkLogTasks();
}

function updateWorkLogTasks() {
    const role = (document.getElementById('wlRole') || {}).value || '';
    const taskSelect = document.getElementById('wlTask');

    const roleTaskMap = {
        'טפסן': ['תפסנות', 'תבניות', 'ממ"ד', 'תיקרה'],
        'ברזלן': ['ברזל רצפה', 'ברזל קירות ועמודים', 'ברזל', 'בדיקת ברזל קונסטרוקטור', 'הזמנת ברזל'],
        'בטונאי': ['בטון רזה', 'יציקת בטון ברצפה'],
        'אינסטלטור': ['אינסטלטור'],
        'חשמלאי': ['חשמלאי'],
        'מיזוג': ['מיזוג', 'מערכות נוספות'],
        'מודד': ['מודד', 'ישור השטח לגובה'],
        'מנהל עבודה': ['מנהל עבודה', 'בקרת איכות'],
        'מנהל פרויקט': ['מנהל פרויקט', 'בקרת איכות'],
        'מהנדס': ['מהנדס', 'בדיקת ברזל קונסטרוקטור', 'בקרת איכות'],
        'מפעיל מנוף': ['מנופים'],
        'מפעיל טרקטור': ['חפירה טרקטור', 'הכנת שטח', 'ישור השטח לגובה'],
        'משאבות בטון': ['משאבות בטון', 'יציקת בטון ברצפה'],
        'עובד כללי': ['הכנת שטח', 'קלקר', 'ניילון', 'יישור קוצים', 'איטום', 'ציוד', 'חומרי גלם', 'כלים']
    };

    const tasks = (role && roleTaskMap[role]) ? roleTaskMap[role] : data.workStages;
    taskSelect.innerHTML = '<option value="">בחר משימה</option>' +
        tasks.map(s => '<option value="' + s + '">' + s + '</option>').join('');
}

function selectWorkLogStatus(btn) {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('wlStatus').value = btn.dataset.status;
}

// ========== תמונות ==========
function previewWorkLogImages(input) {
    const preview = document.getElementById('wlImagePreview');
    preview.innerHTML = '';
    Array.from(input.files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = '<img src="' + e.target.result + '" alt="img"><button type="button" class="image-remove-btn" onclick="removeWorkLogImage(' + i + ')">&times;</button>';
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeWorkLogImage(index) {
    const input = document.getElementById('wlImages');
    const dt = new DataTransfer();
    Array.from(input.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    input.files = dt.files;
    previewWorkLogImages(input);
}

function fileToBase64(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// ========== שמירת דיווח ==========
async function submitWorkLog(e) {
    e.preventDefault();

    const imageFiles = document.getElementById('wlImages').files;
    const images = [];
    for (let i = 0; i < imageFiles.length; i++) {
        const base64 = await fileToBase64(imageFiles[i]);
        images.push({ name: imageFiles[i].name, data: base64 });
    }

    const entry = {
        date: document.getElementById('wlDate').value,
        project: document.getElementById('wlProject').value,
        role: document.getElementById('wlRole').value,
        task: document.getElementById('wlTask').value,
        hours: parseFloat(document.getElementById('wlHours').value),
        worker: document.getElementById('wlWorker').value || 'לא צוין',
        status: document.getElementById('wlStatus').value,
        note: document.getElementById('wlNote').value || '',
        images: JSON.stringify(images),
        created_at: new Date().toISOString()
    };

    try {
        await supabaseInsert('work_logs', entry);
        showToast('הדיווח נשמר בהצלחה!', 'success');
        if (confirm('לשמור כ-PDF?')) saveSingleWorkLogPDF(entry);
    } catch (err) {
        const logs = JSON.parse(localStorage.getItem('workLogs') || '[]');
        entry.id = Date.now();
        logs.push(entry);
        localStorage.setItem('workLogs', JSON.stringify(logs));
        showToast('הדיווח נשמר (מקומית)', 'success');
        if (confirm('לשמור כ-PDF?')) saveSingleWorkLogPDF(entry);
    }

    document.getElementById('wlHours').value = '';
    document.getElementById('wlNote').value = '';
    document.getElementById('wlImages').value = '';
    document.getElementById('wlImagePreview').innerHTML = '';

    await loadWorkLogs();
    renderWorkLogHistory();
}

// ========== היסטוריית דיווחים ==========
async function renderWorkLogHistory() {
    const filterProject = (document.getElementById('wlFilterProject') || {}).value || '';
    const filterDate = (document.getElementById('wlFilterDate') || {}).value || '';

    const filterProjSelect = document.getElementById('wlFilterProject');
    if (filterProjSelect && filterProjSelect.options.length <= 1) {
        filterProjSelect.innerHTML = '<option value="">כל הפרויקטים</option>' +
            wlProjectsCache.map(p =>
                '<option value="' + p.name + '"' + (p.name === filterProject ? ' selected' : '') + '>' + p.name + '</option>'
            ).join('');
    }

    let filtered = workLogs.slice().sort((a, b) =>
        new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
    );

    if (filterProject) filtered = filtered.filter(l => l.project === filterProject);
    if (filterDate) filtered = filtered.filter(l => l.date === filterDate);

    const tbody = document.getElementById('workLogTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">אין דיווחים</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        const statusClass = log.status === 'תקוע' ? 'badge-stuck' : log.status === 'חלקי' ? 'badge-partial' : 'badge-active';
        const dateDisplay = log.date ? new Date(log.date).toLocaleDateString('he-IL') : '-';
        let hasImages = false;
        try { hasImages = log.images && JSON.parse(log.images).length > 0; } catch(e) {}

        return '<tr>' +
            '<td>' + dateDisplay + '</td>' +
            '<td><strong>' + (log.project || '-') + '</strong></td>' +
            '<td>' + (log.task || '-') + '<br><small style="color:var(--text-muted)">' + (log.role || '') + '</small></td>' +
            '<td><strong>' + (log.hours || 0) + '</strong></td>' +
            '<td>' + (log.worker || '-') + '</td>' +
            '<td><span class="badge ' + statusClass + '">' + (log.status || '-') + '</span></td>' +
            '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">' + (log.note || '-') + (hasImages ? ' 📷' : '') + '</td>' +
            '<td><button class="btn-delete" onclick="deleteWorkLog(' + log.id + ')" title="מחק">🗑</button></td>' +
            '</tr>';
    }).join('');
}

async function deleteWorkLog(id) {
    if (!verifyAdminPassword()) return;
    if (!confirm('למחוק דיווח זה?')) return;
    try {
        await supabaseDelete('work_logs', id);
        showToast('הדיווח נמחק', 'info');
    } catch (err) {
        const logs = JSON.parse(localStorage.getItem('workLogs') || '[]');
        localStorage.setItem('workLogs', JSON.stringify(logs.filter(l => l.id !== id)));
        showToast('הדיווח נמחק', 'info');
    }
    await loadWorkLogs();
    renderWorkLogHistory();
}

// ========== ייצוא PDF ==========
function exportWorkLogPDF() {
    const filterProject = (document.getElementById('wlFilterProject') || {}).value || '';
    const filterDate = (document.getElementById('wlFilterDate') || {}).value || '';

    let filtered = workLogs.slice().sort((a, b) =>
        new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
    );
    if (filterProject) filtered = filtered.filter(l => l.project === filterProject);
    if (filterDate) filtered = filtered.filter(l => l.date === filterDate);

    if (filtered.length === 0) {
        showToast('אין דיווחים לייצוא', 'error');
        return;
    }

    const title = filterProject ? 'דוח יומן עבודה - ' + filterProject : 'דוח יומן עבודה';
    const dateStr = new Date().toLocaleDateString('he-IL');
    const totalHours = filtered.reduce((sum, l) => sum + (l.hours || 0), 0);
    const workerCount = new Set(filtered.map(l => l.worker)).size;

    const rows = filtered.map(log => {
        const dateDisplay = log.date ? new Date(log.date).toLocaleDateString('he-IL') : '-';
        const sc = log.status === 'תקוע' ? 'status-stuck' : log.status === 'חלקי' ? 'status-partial' : 'status-advanced';
        return '<tr><td>' + dateDisplay + '</td><td>' + (log.project||'-') + '</td><td>' + (log.role||'-') + '</td><td>' + (log.task||'-') + '</td><td><strong>' + (log.hours||0) + '</strong></td><td>' + (log.worker||'-') + '</td><td class="' + sc + '">' + (log.status||'-') + '</td><td>' + (log.note||'-') + '</td></tr>';
    }).join('');

    const html = '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>' + title + '</title>' +
        '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,Tahoma,Arial,sans-serif;padding:30px;direction:rtl}' +
        '.header{text-align:center;margin-bottom:25px;border-bottom:3px solid #1e3a5f;padding-bottom:15px}' +
        '.header h1{font-size:22px;color:#1e3a5f}.header h2{font-size:18px;color:#333;margin-top:5px}' +
        '.header p{color:#666;font-size:13px;margin-top:5px}' +
        '.summary{display:flex;gap:20px;margin-bottom:20px}' +
        '.summary-item{flex:1;background:#f0f4f8;padding:12px;border-radius:8px;text-align:center}' +
        '.summary-item .num{font-size:24px;font-weight:800;color:#1e3a5f}' +
        '.summary-item .label{font-size:12px;color:#666}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:20px}' +
        'th{background:#1e3a5f;color:#fff;padding:10px 8px;font-size:13px}' +
        'td{padding:8px;border-bottom:1px solid #ddd;font-size:12px}' +
        'tr:nth-child(even){background:#f8f9fa}' +
        '.status-stuck{color:#dc3545;font-weight:700}' +
        '.status-partial{color:#fd7e14;font-weight:700}' +
        '.status-advanced{color:#28a745;font-weight:700}' +
        '.footer{text-align:center;color:#999;font-size:11px;margin-top:20px;border-top:1px solid #ddd;padding-top:10px}</style></head>' +
        '<body><div class="header"><h1>SKELETON CONSTRUCTION</h1><h2>' + title + '</h2><p>תאריך הפקה: ' + dateStr + '</p></div>' +
        '<div class="summary"><div class="summary-item"><div class="num">' + filtered.length + '</div><div class="label">דיווחים</div></div>' +
        '<div class="summary-item"><div class="num">' + totalHours.toFixed(1) + '</div><div class="label">סה"כ שעות</div></div>' +
        '<div class="summary-item"><div class="num">' + workerCount + '</div><div class="label">עובדים</div></div></div>' +
        '<table><thead><tr><th>תאריך</th><th>פרויקט</th><th>מקצוע</th><th>משימה</th><th>שעות</th><th>מבצע</th><th>סטטוס</th><th>הערה</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<div class="footer">SKELETON CONSTRUCTION - מערכת פיקוח פרויקטים</div></body></html>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
}

// ========== ניהול משימות ==========
function addWorkStage() {
    const input = document.getElementById('newWorkStage');
    const stage = input.value.trim();
    if (!stage) return;

    if (data.workStages.includes(stage)) {
        showToast('משימה כבר קיימת', 'error');
        return;
    }

    data.workStages.push(stage);
    saveData();
    input.value = '';
    renderManage();
    showToast('משימה "' + stage + '" נוספה', 'success');
}

function removeWorkStage(stage) {
    if (!confirm('למחוק את המשימה "' + stage + '"?')) return;
    data.workStages = data.workStages.filter(function(s) { return s !== stage; });
    saveData();
    renderManage();
    showToast('משימה "' + stage + '" הוסרה', 'info');
}

// ========== ארכיון PDF ==========
function saveSingleWorkLogPDF(entry) {
    const dateDisplay = entry.date ? new Date(entry.date).toLocaleDateString('he-IL') : '-';
    const sc = entry.status === 'תקוע' ? 'color:#dc3545;font-weight:700' : entry.status === 'חלקי' ? 'color:#fd7e14;font-weight:700' : 'color:#28a745;font-weight:700';

    let imagesHtml = '';
    try {
        const imgs = JSON.parse(entry.images || '[]');
        if (imgs.length > 0) {
            imagesHtml = '<div style="margin-top:15px;"><h4 style="margin-bottom:8px;">תמונות מצורפות</h4><div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                imgs.map(function(img) { return '<img src="' + img.data + '" style="max-width:200px;max-height:150px;border:1px solid #ddd;border-radius:4px;">'; }).join('') +
                '</div></div>';
        }
    } catch(e) {}

    const html = '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>דיווח עבודה - ' + (entry.project||'') + ' - ' + dateDisplay + '</title>' +
        '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,Tahoma,Arial,sans-serif;padding:30px;direction:rtl;max-width:800px;margin:0 auto}' +
        '.header{text-align:center;margin-bottom:20px;border-bottom:3px solid #1e3a5f;padding-bottom:12px}' +
        '.header h1{font-size:20px;color:#1e3a5f}.header h2{font-size:16px;color:#333;margin-top:4px}.header p{color:#666;font-size:12px;margin-top:4px}' +
        '.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}' +
        '.detail-item{background:#f0f4f8;padding:12px;border-radius:8px}.detail-label{font-size:11px;color:#666;display:block;margin-bottom:4px}' +
        '.detail-value{font-size:15px;font-weight:700;color:#1e3a5f}' +
        '.note-section{background:#f8f9fa;padding:15px;border-radius:8px;border:1px solid #e2e8f0;margin-top:12px}' +
        '.note-section h4{font-size:13px;color:#666;margin-bottom:6px}' +
        '.footer{text-align:center;color:#999;font-size:10px;margin-top:25px;border-top:1px solid #ddd;padding-top:8px}' +
        '@media print{body{padding:15px}}</style></head>' +
        '<body>' +
        '<div class="header"><h1>SKELETON CONSTRUCTION</h1><h2>דיווח עבודה</h2><p>' + dateDisplay + '</p></div>' +
        '<div class="detail-grid">' +
        '<div class="detail-item"><span class="detail-label">פרויקט</span><span class="detail-value">' + (entry.project||'-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">מקצוע</span><span class="detail-value">' + (entry.role||'-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">משימה</span><span class="detail-value">' + (entry.task||'-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">שעות</span><span class="detail-value">' + (entry.hours||0) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">מבצע</span><span class="detail-value">' + (entry.worker||'-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">סטטוס</span><span class="detail-value" style="' + sc + '">' + (entry.status||'-') + '</span></div>' +
        '</div>' +
        (entry.note ? '<div class="note-section"><h4>הערות</h4><p>' + entry.note + '</p></div>' : '') +
        imagesHtml +
        '<div class="footer">SKELETON CONSTRUCTION - מערכת פיקוח פרויקטים</div>' +
        '</body></html>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() { printWindow.print(); }, 500);
}

async function renderPDFArchive() {
    await loadWorkLogs();

    const filterProject = (document.getElementById('archiveFilterProject') || {}).value || '';
    const filterFrom = (document.getElementById('archiveFilterFrom') || {}).value || '';
    const filterTo = (document.getElementById('archiveFilterTo') || {}).value || '';

    // Update project filter
    const filterProjSelect = document.getElementById('archiveFilterProject');
    if (filterProjSelect && filterProjSelect.options.length <= 1) {
        filterProjSelect.innerHTML = '<option value="">כל הפרויקטים</option>' +
            wlProjectsCache.map(function(p) {
                return '<option value="' + p.name + '">' + p.name + '</option>';
            }).join('');
    }

    let filtered = workLogs.slice().sort(function(a, b) {
        return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
    });

    if (filterProject) filtered = filtered.filter(function(l) { return l.project === filterProject; });
    if (filterFrom) filtered = filtered.filter(function(l) { return l.date >= filterFrom; });
    if (filterTo) filtered = filtered.filter(function(l) { return l.date <= filterTo; });

    const container = document.getElementById('pdfArchiveList');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">אין דיווחים</div>';
        return;
    }

    // Group by date
    const grouped = {};
    filtered.forEach(function(log) {
        const key = log.date || 'ללא תאריך';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(log);
    });

    let html = '';
    Object.keys(grouped).sort().reverse().forEach(function(date) {
        const dateDisplay = date !== 'ללא תאריך' ? new Date(date).toLocaleDateString('he-IL') : date;
        const logs = grouped[date];
        const totalHours = logs.reduce(function(sum, l) { return sum + (l.hours || 0); }, 0);

        html += '<div class="archive-date-group">';
        html += '<div class="archive-date-header"><span class="archive-date">' + dateDisplay + '</span><span class="archive-date-info">' + logs.length + ' דיווחים | ' + totalHours.toFixed(1) + ' שעות</span></div>';

        logs.forEach(function(log) {
            var statusClass = log.status === 'תקוע' ? 'badge-stuck' : log.status === 'חלקי' ? 'badge-partial' : 'badge-active';
            var hasImages = false;
            try { hasImages = log.images && JSON.parse(log.images).length > 0; } catch(e) {}

            html += '<div class="archive-item">' +
                '<div class="archive-item-info">' +
                '<strong>' + (log.project||'-') + '</strong> | ' +
                '<span class="badge badge-type">' + (log.role||'-') + '</span> | ' +
                (log.task||'-') + ' | ' +
                '<strong>' + (log.hours||0) + ' שעות</strong> | ' +
                (log.worker||'-') + ' | ' +
                '<span class="badge ' + statusClass + '">' + (log.status||'-') + '</span>' +
                (hasImages ? ' 📷' : '') +
                '</div>' +
                '<button class="btn btn-outline btn-small" onclick="saveSingleWorkLogPDF(workLogs.find(function(l){return l.id==' + log.id + '}))">📄 PDF</button>' +
                '</div>';
        });

        html += '</div>';
    });

    container.innerHTML = html;
}

function exportAllWorkLogsPDF() {
    exportWorkLogPDF();
}

// Override renderManage to also load archive
var _originalRenderManage = renderManage;
renderManage = function() {
    _originalRenderManage();
    renderPDFArchive();
};


// ============================================================
// דשבורד ניתוח - Analysis Dashboard
// ============================================================

async function renderAnalytics() {
    await loadWorkLogs();

    var projects = [];
    try {
        projects = await supabaseSelectAll('projects') || [];
    } catch (e) {
        projects = data.projects || [];
    }

    var container = document.getElementById('analyticsContent');
    if (!container) return;

    var filterVal = (document.getElementById('analyticsProjectFilter') || {}).value || '';
    var filterHtml = '<div class="analytics-filter-bar">' +
        '<label class="analytics-filter-label">סינון לפי פרויקט:</label>' +
        '<select id="analyticsProjectFilter" onchange="renderAnalytics()" class="analytics-filter-select">' +
        '<option value="">כל הפרויקטים</option>';
    for (var pi = 0; pi < projects.length; pi++) {
        var p = projects[pi];
        if (p.active) {
            filterHtml += '<option value="' + p.name + '"' + (p.name === filterVal ? ' selected' : '') + '>' + p.name + '</option>';
        }
    }
    filterHtml += '</select></div>';

    var filteredLogs = workLogs.slice();
    var filteredAttendance = supabaseAttendance.slice();
    var filteredProjects = projects.filter(function(p) { return p.active; });

    if (filterVal) {
        filteredLogs = filteredLogs.filter(function(l) { return l.project === filterVal; });
        filteredAttendance = filteredAttendance.filter(function(e) { return e.project === filterVal; });
        filteredProjects = filteredProjects.filter(function(p) { return p.name === filterVal; });
    }

    var activeProjects = projects.filter(function(p) { return p.active; });
    var totalProjects = projects.length;
    var activeCount = filterVal ? filteredProjects.length : activeProjects.length;

    var now = new Date();
    var weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    var weeklyHours = 0;
    var totalBudgetHours = 0;

    for (var i = 0; i < filteredLogs.length; i++) {
        var logDate = new Date(filteredLogs[i].date);
        if (logDate >= weekStart && logDate <= now) {
            weeklyHours += (parseFloat(filteredLogs[i].hours) || 0);
        }
    }

    var checkins = filteredAttendance.filter(function(e) { return e.type === 'checkin'; });
    var checkouts = filteredAttendance.filter(function(e) { return e.type === 'checkout'; });
    for (var ci = 0; ci < checkins.length; ci++) {
        var ckin = checkins[ci];
        var ckinDate = new Date(ckin.time || ckin.date);
        if (ckinDate >= weekStart && ckinDate <= now) {
            var co = null;
            for (var coi = 0; coi < checkouts.length; coi++) {
                if (checkouts[coi].worker_id === ckin.worker_id && checkouts[coi].date === ckin.date) {
                    co = checkouts[coi];
                    break;
                }
            }
            if (co) {
                var hrs = (new Date(co.time) - new Date(ckin.time)) / (1000 * 60 * 60);
                if (hrs > 0 && hrs < 24) {
                    weeklyHours += hrs;
                }
            }
        }
    }

    for (var bp = 0; bp < filteredProjects.length; bp++) {
        var budgets = getRoleBudgets(filteredProjects[bp].name);
        for (var bk in budgets) {
            if (budgets.hasOwnProperty(bk)) {
                totalBudgetHours += (parseFloat(budgets[bk]) || 0);
            }
        }
    }

    var completedTasks = 0;
    var stuckTasks = 0;
    var totalTasks = filteredLogs.length;

    for (var ti = 0; ti < filteredLogs.length; ti++) {
        var logStatus = filteredLogs[ti].status || '';
        if (logStatus === 'הושלם' || logStatus === 'מתקדם') {
            completedTasks++;
        }
        if (logStatus === 'תקוע') {
            stuckTasks++;
        }
    }

    // ===== STATS CARDS =====
    var statsHtml = '<div class="analytics-stats-row">';

    statsHtml += '<div class="analytics-stat-card">' +
        '<div class="analytics-stat-icon" style="background: rgba(37, 99, 235, 0.15); color: var(--primary);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
        '</div>' +
        '<div class="analytics-stat-info">' +
        '<div class="analytics-stat-value">' + activeCount + '</div>' +
        '<div class="analytics-stat-label">פרויקטים פעילים</div>' +
        '<div class="analytics-stat-sub">מתוך ' + totalProjects + ' פרויקטים</div>' +
        '</div></div>';

    var weeklyPct = totalBudgetHours > 0 ? Math.round((weeklyHours / totalBudgetHours) * 100) : 0;
    statsHtml += '<div class="analytics-stat-card">' +
        '<div class="analytics-stat-icon" style="background: rgba(16, 185, 129, 0.15); color: var(--success);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '</div>' +
        '<div class="analytics-stat-info">' +
        '<div class="analytics-stat-value">' + weeklyHours.toFixed(1) + '</div>' +
        '<div class="analytics-stat-label">שעות שבועיות</div>' +
        '<div class="analytics-stat-sub">תקציב: ' + totalBudgetHours.toFixed(0) + ' שעות</div>' +
        '</div></div>';

    statsHtml += '<div class="analytics-stat-card">' +
        '<div class="analytics-stat-icon" style="background: rgba(139, 92, 246, 0.15); color: var(--purple);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '</div>' +
        '<div class="analytics-stat-info">' +
        '<div class="analytics-stat-value">' + completedTasks + '</div>' +
        '<div class="analytics-stat-label">משימות שהושלמו</div>' +
        '<div class="analytics-stat-sub">מתוך ' + totalTasks + ' משימות</div>' +
        '</div></div>';

    statsHtml += '<div class="analytics-stat-card' + (stuckTasks > 0 ? ' analytics-stat-danger' : '') + '">' +
        '<div class="analytics-stat-icon" style="background: rgba(239, 68, 68, 0.15); color: var(--danger);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '</div>' +
        '<div class="analytics-stat-info">' +
        '<div class="analytics-stat-value">' + stuckTasks + '</div>' +
        '<div class="analytics-stat-label">משימות תקועות</div>' +
        '<div class="analytics-stat-sub">' + (stuckTasks > 0 ? 'דורשות טיפול!' : 'אין משימות תקועות') + '</div>' +
        '</div></div>';

    statsHtml += '</div>';

    // ===== CATEGORY BREAKDOWN =====
    var roleData = {};

    for (var ri = 0; ri < filteredLogs.length; ri++) {
        var log = filteredLogs[ri];
        var role = log.role || 'לא מוגדר';
        if (!roleData[role]) {
            roleData[role] = { hours: 0, tasks: 0, budget: 0 };
        }
        roleData[role].hours += (parseFloat(log.hours) || 0);
        roleData[role].tasks += 1;
    }

    for (var ai = 0; ai < checkins.length; ai++) {
        var ck = checkins[ai];
        var aRole = ck.role || 'לא מוגדר';
        if (!roleData[aRole]) {
            roleData[aRole] = { hours: 0, tasks: 0, budget: 0 };
        }
        var aco = null;
        for (var acoi = 0; acoi < checkouts.length; acoi++) {
            if (checkouts[acoi].worker_id === ck.worker_id && checkouts[acoi].date === ck.date) {
                aco = checkouts[acoi];
                break;
            }
        }
        if (aco) {
            var aHrs = (new Date(aco.time) - new Date(ck.time)) / (1000 * 60 * 60);
            if (aHrs > 0 && aHrs < 24) {
                roleData[aRole].hours += aHrs;
            }
        }
    }

    for (var rpi = 0; rpi < filteredProjects.length; rpi++) {
        var rBudgets = getRoleBudgets(filteredProjects[rpi].name);
        for (var rk in rBudgets) {
            if (rBudgets.hasOwnProperty(rk)) {
                if (!roleData[rk]) {
                    roleData[rk] = { hours: 0, tasks: 0, budget: 0 };
                }
                roleData[rk].budget += (parseFloat(rBudgets[rk]) || 0);
            }
        }
    }

    var roleKeys = Object.keys(roleData).sort(function(a, b) {
        var aOver = roleData[a].budget > 0 && roleData[a].hours > roleData[a].budget ? 1 : 0;
        var bOver = roleData[b].budget > 0 && roleData[b].hours > roleData[b].budget ? 1 : 0;
        if (bOver !== aOver) return bOver - aOver;
        return roleData[b].hours - roleData[a].hours;
    });

    var catHtml = '<div class="analytics-section">' +
        '<div class="analytics-section-header">' +
        '<h3>פילוח לפי קטגוריה</h3>' +
        '</div>' +
        '<div class="analytics-category-list">';

    if (roleKeys.length === 0) {
        catHtml += '<div class="empty-state">אין נתונים להציג</div>';
    }

    for (var rki = 0; rki < roleKeys.length; rki++) {
        var rName = roleKeys[rki];
        var rd = roleData[rName];
        var hasBudget = rd.budget > 0;
        var pct = hasBudget ? Math.round((rd.hours / rd.budget) * 100) : 0;
        var barWidth = hasBudget ? Math.min(pct, 100) : (rd.hours > 0 ? 50 : 0);
        var barColor = '#22c55e';
        if (hasBudget) {
            if (pct > 100) {
                barColor = '#ef4444';
            } else if (pct >= 80) {
                barColor = '#f59e0b';
            }
        }
        var isOver = hasBudget && pct > 100;

        catHtml += '<div class="analytics-category-item' + (isOver ? ' analytics-over-budget' : '') + '">' +
            '<div class="analytics-category-header">' +
            '<div class="analytics-category-name">' +
            (isOver ? '<span class="analytics-warning-icon">⚠️</span> ' : '') +
            '<span class="analytics-role-badge">' + rName + '</span>' +
            '</div>' +
            '<div class="analytics-category-meta">' +
            '<span class="analytics-category-tasks">' + rd.tasks + ' משימות</span>' +
            '<span class="analytics-category-hours">' + rd.hours.toFixed(1) + (hasBudget ? ' / ' + rd.budget.toFixed(0) : '') + ' שעות</span>' +
            (hasBudget ? '<span class="analytics-category-pct" style="color: ' + barColor + ';">' + pct + '%</span>' : '') +
            '</div>' +
            '</div>' +
            '<div class="analytics-progress-track">' +
            '<div class="analytics-progress-bar" style="width: ' + barWidth + '%; background: ' + barColor + ';"></div>' +
            (isOver ? '<div class="analytics-progress-overflow" style="width: ' + Math.min(pct - 100, 100) + '%; background: rgba(239, 68, 68, 0.3);"></div>' : '') +
            '</div>' +
            '</div>';
    }

    catHtml += '</div></div>';

    // ===== TASKS REQUIRING ATTENTION =====
    var attentionItems = [];

    for (var ali = 0; ali < filteredLogs.length; ali++) {
        var aLog = filteredLogs[ali];
        var aLogStatus = aLog.status || '';
        var aLogRole = aLog.role || '';
        var aLogProject = aLog.project || '';
        var aLogHours = parseFloat(aLog.hours) || 0;

        var isStuck = (aLogStatus === 'תקוע');

        var roleBudget = 0;
        var roleUsed = 0;
        var aBudgets = getRoleBudgets(aLogProject);
        if (aBudgets[aLogRole]) {
            roleBudget = parseFloat(aBudgets[aLogRole]) || 0;
            for (var sui = 0; sui < workLogs.length; sui++) {
                if (workLogs[sui].project === aLogProject && workLogs[sui].role === aLogRole) {
                    roleUsed += (parseFloat(workLogs[sui].hours) || 0);
                }
            }
        }
        var isOverBudget = (roleBudget > 0 && roleUsed > roleBudget);
        var isNearBudget = (roleBudget > 0 && roleUsed >= roleBudget * 0.85 && !isOverBudget);

        if (isStuck || isOverBudget || isNearBudget) {
            attentionItems.push({
                task: aLog.task || 'לא צוין',
                project: aLogProject,
                role: aLogRole,
                status: aLogStatus,
                hours: aLogHours,
                roleUsed: roleUsed,
                roleBudget: roleBudget,
                isStuck: isStuck,
                isOverBudget: isOverBudget,
                isNearBudget: isNearBudget,
                date: aLog.date || ''
            });
        }
    }

    var seenAttention = {};
    var uniqueAttention = [];
    for (var uai = 0; uai < attentionItems.length; uai++) {
        var aKey = attentionItems[uai].task + '|' + attentionItems[uai].project + '|' + attentionItems[uai].role;
        if (!seenAttention[aKey]) {
            seenAttention[aKey] = true;
            uniqueAttention.push(attentionItems[uai]);
        }
    }

    var attHtml = '<div class="analytics-section">' +
        '<div class="analytics-section-header">' +
        '<h3>משימות שדורשות תשומת לב</h3>' +
        '<span class="analytics-attention-count">' + uniqueAttention.length + ' פריטים</span>' +
        '</div>' +
        '<div class="analytics-attention-list">';

    if (uniqueAttention.length === 0) {
        attHtml += '<div class="analytics-attention-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
            '<p>אין משימות שדורשות תשומת לב כרגע</p></div>';
    }

    for (var ati = 0; ati < uniqueAttention.length; ati++) {
        var item = uniqueAttention[ati];
        var statusClass = item.isStuck ? 'analytics-status-stuck' : (item.isOverBudget ? 'analytics-status-over' : 'analytics-status-near');
        var statusText = item.isStuck ? 'תקוע' : (item.isOverBudget ? 'חריגת תקציב' : 'קרוב לתקציב');

        attHtml += '<div class="analytics-attention-item">' +
            (item.isOverBudget ? '<div class="analytics-attention-warning"></div>' : '') +
            '<div class="analytics-attention-content">' +
            '<div class="analytics-attention-top">' +
            '<span class="analytics-attention-task">' + item.task + '</span>' +
            '<span class="analytics-status-badge ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="analytics-attention-details">' +
            '<span class="analytics-attention-project">' + item.project + '</span>' +
            '<span class="analytics-role-badge analytics-role-sm">' + item.role + '</span>' +
            (item.roleBudget > 0 ? '<span class="analytics-attention-hours' + (item.isOverBudget ? ' analytics-hours-over' : '') + '">' + item.roleUsed.toFixed(1) + ' / ' + item.roleBudget.toFixed(0) + ' שעות</span>' : '') +
            '</div>' +
            '</div>' +
            '</div>';
    }

    attHtml += '</div></div>';

    // ===== COMBINE ALL =====
    container.innerHTML = '<div class="analytics-dashboard">' +
        '<div class="analytics-header">' +
        '<h2>דשבורד ניתוח</h2>' +
        filterHtml +
        '</div>' +
        statsHtml +
        catHtml +
        attHtml +
        '</div>';
}
