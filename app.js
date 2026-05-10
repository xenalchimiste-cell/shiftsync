// ShiftSync App Logic - 100% Local Version (Pro Mobile Optimized)

const state = {
    currentDate: new Date(),
    shifts: JSON.parse(localStorage.getItem('shifts')) || []
};

// DOM Elements
const monthDisplay = document.getElementById('current-month');
const dayDisplay = document.getElementById('current-day');
const calendarGrid = document.getElementById('calendar-grid');
const shiftsList = document.getElementById('shifts-list');
const modal = document.getElementById('shift-modal');
const addBtn = document.getElementById('add-shift-btn');
const closeBtn = document.getElementById('close-modal');
const shiftForm = document.getElementById('shift-form');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const testNotifyBtn = document.getElementById('test-notify-btn');

// Initialize
function init() {
    renderCalendar();
    renderShifts();
    updateHeader();
    
    setInterval(checkReminders, 60000);
    checkReminders();
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js', { scope: './' })
            .then(reg => {
                console.log('Service Worker Registered', reg);
                // Ensure the service worker is active
                if (reg.active) {
                    console.log('Service Worker Active');
                }
            })
            .catch(err => console.log('SW registration failed', err));
    }

    // Navigation events
    prevMonthBtn.onclick = () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        updateHeader();
        renderCalendar();
    };
    
    nextMonthBtn.onclick = () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        updateHeader();
        renderCalendar();
    };

    testNotifyBtn.onclick = () => {
        requestPermissionAndTest();
    };
}

function updateHeader() {
    const options = { month: 'long', year: 'numeric' };
    monthDisplay.textContent = state.currentDate.toLocaleDateString('fr-FR', options);
    
    const dayOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    dayDisplay.textContent = new Date().toLocaleDateString('fr-FR', dayOptions);
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    let offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        calendarGrid.appendChild(cell);
    }

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = d;
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        if (today.getDate() === d && today.getMonth() === month && today.getFullYear() === year) {
            cell.classList.add('current');
        }
        
        if (state.shifts.some(s => s.date === cellDateStr)) {
            cell.classList.add('has-shift');
        }
        
        cell.onclick = () => openModal(cellDateStr);
        calendarGrid.appendChild(cell);
    }
}

function renderShifts() {
    shiftsList.innerHTML = '';
    const sortedShifts = [...state.shifts]
        .filter(s => new Date(`${s.date}T${s.start}`) >= new Date().setHours(0, 0, 0, 0))
        .sort((a, b) => new Date(`${a.date}T${a.start}`) - new Date(`${b.date}T${b.start}`));

    if (sortedShifts.length === 0) {
        shiftsList.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Aucun horaire prévu</p>';
        return;
    }

    sortedShifts.forEach(shift => {
        const dateObj = new Date(shift.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const duration = calculateDuration(shift.start, shift.end);
        
        const card = document.createElement('div');
        card.className = 'shift-card';
        card.innerHTML = `
            <div class="shift-info">
                <h3>${shift.note || 'Service'}</h3>
                <p>${dateStr}</p>
            </div>
            <div class="shift-time">
                <div class="time-range">${shift.start} — ${shift.end}</div>
                <div class="duration">${duration}</div>
                <button class="btn-delete" onclick="deleteShift(${shift.id})">
                    <span class="icon">&times;</span>
                </button>
            </div>
        `;
        shiftsList.appendChild(card);
    });
}

function deleteShift(id) {
    if (confirm('Supprimer cet horaire ?')) {
        state.shifts = state.shifts.filter(s => s.id !== id);
        localStorage.setItem('shifts', JSON.stringify(state.shifts));
        renderCalendar();
        renderShifts();
    }
}

function calculateDuration(start, end) {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

// Modal logic
function openModal(dateStr = '') {
    if (dateStr) document.getElementById('shift-date').value = dateStr;
    modal.classList.add('active');
    
    // Simple permission request attempt
    if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function closeModal() {
    modal.classList.remove('active');
    shiftForm.reset();
}

addBtn.onclick = () => openModal();
closeBtn.onclick = closeModal;

window.onclick = (e) => {
    if (e.target === modal) closeModal();
}

shiftForm.onsubmit = (e) => {
    e.preventDefault();
    
    const newShift = {
        id: Date.now(),
        date: document.getElementById('shift-date').value,
        start: document.getElementById('start-time').value,
        end: document.getElementById('end-time').value,
        note: document.getElementById('shift-note').value,
        reminded: false
    };
    
    state.shifts.push(newShift);
    localStorage.setItem('shifts', JSON.stringify(state.shifts));
    
    renderCalendar();
    renderShifts();
    closeModal();
    checkReminders();
};

// Robust Notification Logic
function requestPermissionAndTest() {
    // On iOS, Notification might be hidden in the window but available in the service worker
    const supportsNotifications = ('Notification' in window) || (navigator.serviceWorker && 'showNotification' in ServiceWorkerRegistration.prototype);

    if (!supportsNotifications) {
        alert("Ton iPhone doit être mis à jour (iOS 16.4+) et l'app ajoutée à l'écran d'accueil.");
        return;
    }

    const permissionRequest = window.Notification ? Notification.requestPermission() : Promise.resolve('granted');

    permissionRequest.then(permission => {
        if (permission === 'granted') {
            showNotification({ note: 'Test de ShiftSync', start: 'Maintenant' }, true);
        } else {
            alert("Permission refusée. Va dans Réglages > Notifications > ShiftSync pour l'activer.");
        }
    });
}

function checkReminders() {
    if (window.Notification && Notification.permission !== 'granted') return;

    const now = new Date();
    let updated = false;

    state.shifts.forEach(shift => {
        // Date du shift
        const [year, month, day] = shift.date.split('-').map(Number);
        const shiftStart = new Date(year, month - 1, day, ...shift.start.split(':').map(Number));
        
        // Date du rappel (la veille à 20:30)
        const reminderDate = new Date(year, month - 1, day - 1, 20, 30, 0);

        // Si on a dépassé l'heure du rappel ET qu'on n'a pas encore passé l'heure du shift
        if (now >= reminderDate && now < shiftStart && !shift.reminded) {
            showNotification(shift);
            shift.reminded = true;
            updated = true;
        }
    });
    
    if (updated) {
        localStorage.setItem('shifts', JSON.stringify(state.shifts));
    }
}

function showNotification(shift, isTest = false) {
    let title, body;
    
    if (isTest) {
        title = 'Test ShiftSync ✅';
        body = 'Ceci est un test de rappel persistant avec le nouveau vibreur.';
    } else {
        const [year, month, day] = shift.date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const fullDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        
        title = `🚨 Rappel : Travail le ${day}/${month}`;
        body = `Le ${fullDate} : ton service commence à ${shift.start} (jusqu'à ${shift.end}).`;
    }
    
    const options = {
        body: body,
        icon: 'icons/icon-512.png',
        badge: 'icons/icon-192.png',
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40], // Vibreur plus agressif
        tag: isTest ? 'test' : 'shift-' + shift.id,
        renotify: true,
        requireInteraction: true, // Garde la notification affichée
        silent: false,
        data: {
            url: window.location.href
        }
    };

    // iPhone requires using the Service Worker for notifications
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
        }).catch(() => {
            // Fallback for desktop
            if (window.Notification && Notification.permission === 'granted') {
                new Notification(title, options);
            }
        });
    }
}

// Initialize
init();
