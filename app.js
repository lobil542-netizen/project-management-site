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
    if (tabName === 'overview') renderOverview();
}

// ========== כניסת מנהל ==========
function adminLoginSubmit(e) {
    e.preventDefault();
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    if (user === data.adminUser && pass === data.adminPass) {
        showScreen('adminDashboard');
        showToast('ברוך הבא, מנהל!', 'success');
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
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">טוען...</td></tr>`;

    try {
        const workers = await supabaseSelectAll('workers');

        if (!workers || workers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state">אין עובדים רשומים</td></tr>`;
        } else {
            tbody.innerHTML = workers.sort((a, b) => a.worker_number - b.worker_number).map(worker => {
                const regDate = worker.created_at ? new Date(worker.created_at).toLocaleDateString('he-IL') : '-';
                return `
                <tr>
                    <td><strong>${worker.worker_number}</strong></td>
                    <td>${worker.full_name}</td>
                    <td><span class="badge badge-type">${worker.role}</span></td>
                    <td>${regDate}</td>
                </tr>`;
            }).join('');
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">שגיאה בטעינה: ${e.message}</td></tr>`;
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

    // Calculate hours per worker
    const workerHours = {};

    checkins.forEach(ci => {
        const key = ci.worker_id;
        if (!workerHours[key]) {
            workerHours[key] = { name: ci.full_name, role: ci.role, workerId: ci.worker_id, totalHours: 0 };
        }
        const matchingCheckout = checkouts.find(co =>
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

    if (workers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">אין נתוני שעות לחודש זה</td></tr>`;
    } else {
        tbody.innerHTML = workers.map(w => {
            const done = w.totalHours;
            const target = 250;
            const remaining = Math.max(0, target - done);
            const pct = Math.min(100, (done / target) * 100);
            let color = '#059669';
            if (pct < 25) color = '#dc2626';
            else if (pct < 50) color = '#f97316';
            else if (pct < 75) color = '#eab308';

            return `
            <tr>
                <td><strong>${w.workerId}</strong></td>
                <td>${w.name}</td>
                <td><span class="badge badge-type">${w.role}</span></td>
                <td><strong>${done.toFixed(1)}</strong></td>
                <td>250</td>
                <td>${remaining.toFixed(1)}</td>
                <td>
                    <div class="progress-bar">
                        <div class="fill" style="width: ${pct}%; background: ${color};">${pct.toFixed(0)}%</div>
                    </div>
                </td>
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
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">אין רשומות נוכחות</td></tr>`;
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
                <td>${log.projectName || '-'}</td>
                <td>${log.checkinTime ? formatTime(new Date(log.checkinTime)) : '-'}</td>
                <td>${log.checkoutTime ? formatTime(new Date(log.checkoutTime)) : '<span class="badge badge-active">עדיין באתר</span>'}</td>
                <td>${log.totalHours ? log.totalHours.toFixed(2) : '-'}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${log.workDescription || ''}">${log.workDescription || '-'}</td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${log.notes || ''}">${log.notes || '-'}</td>
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

// ========== רינדור פרויקטים ==========
function getStageHours(projectId) {
    const projectLogs = data.logs.filter(l => l.projectId === projectId && l.totalHours && l.selectedStages);
    const stageHours = {};

    data.workStages.forEach(stage => { stageHours[stage] = 0; });

    projectLogs.forEach(log => {
        if (log.selectedStages && log.selectedStages.length > 0) {
            // Divide hours equally among selected stages
            const hoursPerStage = log.totalHours / log.selectedStages.length;
            log.selectedStages.forEach(stage => {
                if (stageHours[stage] !== undefined) {
                    stageHours[stage] += hoursPerStage;
                }
            });
        }
    });

    return stageHours;
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    const budget = data.stageBudgetHours || 250;

    if (data.projects.length === 0) {
        container.innerHTML = '<div class="empty-state">אין פרויקטים. לחץ "הוסף פרויקט" כדי להתחיל.</div>';
        return;
    }

    container.innerHTML = data.projects.map(project => {
        const projectWorkers = data.workers.filter(w => w.projectId === project.id);
        const projectLogs = data.logs.filter(l => l.projectId === project.id);
        const totalHours = projectLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
        const activeNow = data.logs.filter(l => l.projectId === project.id && !l.checkoutTime).length;
        const stageHours = getStageHours(project.id);

        const stagesHtml = data.workStages.map(stage => {
            const hours = stageHours[stage] || 0;
            const percent = Math.min((hours / budget) * 100, 100);
            const isOver = hours > budget;
            const barColor = isOver ? 'var(--danger)' : 'var(--primary)';
            const textColor = isOver ? 'color: var(--danger); font-weight: 700;' : '';

            return `
                <div class="stage-row">
                    <div class="stage-name">${stage}</div>
                    <div class="stage-bar-container">
                        <div class="stage-bar" style="width: ${percent}%; background: ${barColor};"></div>
                    </div>
                    <div class="stage-hours" style="${textColor}">
                        ${hours.toFixed(1)} / ${budget}
                        ${isOver ? ' <span class="stage-over">חריגה!</span>' : ''}
                    </div>
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
                        <button class="btn btn-outline btn-small" onclick="toggleProject('${project.id}')">${project.active ? 'השהה' : 'הפעל'}</button>
                        <button class="btn btn-danger btn-small" onclick="deleteProject('${project.id}')">מחק</button>
                    </div>
                </div>
                <div class="project-stats">
                    <div class="project-stat">
                        <span class="project-stat-num">${projectWorkers.length}</span>
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
                        <span class="project-stat-num">${projectLogs.length}</span>
                        <span class="project-stat-label">רשומות</span>
                    </div>
                </div>
                <div class="stages-budget-section">
                    <h4 class="stages-budget-title">תקציב שעות לפי תת-קטגוריה (${budget} שעות לכל אחד)</h4>
                    <div class="stages-budget-list">
                        ${stagesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addProject(e) {
    e.preventDefault();
    const name = document.getElementById('newProjectName').value.trim();
    const location = document.getElementById('newProjectLocation').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();

    const project = {
        id: 'proj_' + Date.now(),
        name,
        location,
        description,
        createdAt: new Date().toISOString(),
        active: true
    };

    data.projects.push(project);
    saveData();
    closeModal('addProjectModal');
    showToast(`הפרויקט "${name}" נוסף בהצלחה`, 'success');
    renderProjects();

    // Clear form
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectLocation').value = '';
    document.getElementById('newProjectDesc').value = '';
}

function toggleProject(id) {
    const project = data.projects.find(p => p.id === id);
    if (project) {
        project.active = !project.active;
        saveData();
        renderProjects();
        showToast(`הפרויקט ${project.active ? 'הופעל' : 'הושהה'}`, 'info');
    }
}

function deleteProject(id) {
    const project = data.projects.find(p => p.id === id);
    if (!project) return;

    const workersInProject = data.workers.filter(w => w.projectId === id);
    if (workersInProject.length > 0) {
        showToast('לא ניתן למחוק פרויקט עם עובדים משויכים', 'error');
        return;
    }

    if (confirm(`האם למחוק את הפרויקט "${project.name}"?`)) {
        data.projects = data.projects.filter(p => p.id !== id);
        saveData();
        renderProjects();
        showToast('הפרויקט נמחק', 'info');
    }
}

// ========== ניהול מערכת ==========
function renderManage() {
    // Worker types
    const typesList = document.getElementById('workerTypesList');
    typesList.innerHTML = data.workerTypes.map(type => `
        <span class="tag">
            ${type}
            <button class="remove-tag" onclick="removeWorkerType('${type}')">&times;</button>
        </span>
    `).join('');
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
async function deleteAttendanceRecord(ids) {
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

function exportData() {
    if (data.logs.length === 0 && supabaseAttendance.length === 0) {
        showToast('אין נתונים לייצוא', 'error');
        return;
    }

    // BOM for UTF-8 Excel support
    let csv = '\uFEFF';
    csv += 'תאריך,עובד,תפקיד,סוג,שעה,מה בוצע\n';

    // Export Supabase attendance data
    supabaseAttendance.forEach(entry => {
        const type = entry.type === 'checkin' ? 'כניסה' : 'יציאה';
        const name = (entry.full_name || '-').replace(/"/g, '""');
        const role = (entry.role || '-').replace(/"/g, '""');
        const workDone = (entry.work_done || '-').replace(/"/g, '""');
        const timeDisplay = entry.time_display || '';
        const date = entry.date || '';

        csv += `${date},"${name}","${role}","${type}",${timeDisplay},"${workDone}"\n`;
    });

    // Also export local logs
    data.logs.forEach(log => {
        const checkin = formatTime(new Date(log.checkinTime));
        const checkout = log.checkoutTime ? formatTime(new Date(log.checkoutTime)) : '';
        const desc = (log.workDescription || '-').replace(/"/g, '""');

        csv += `${log.date},"${log.workerName}","${log.workerType}","כניסה",${checkin},""\n`;
        if (log.checkoutTime) {
            csv += `${log.date},"${log.workerName}","${log.workerType}","יציאה",${checkout},"${desc}"\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
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
