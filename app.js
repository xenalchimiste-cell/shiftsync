// ShiftSync App Logic

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

// Initialize
function init() {
    renderCalendar();
    renderShifts();
    updateHeader();
    requestNotificationPermission();
    checkReminders();
    
    // Check reminders every hour if app is open
    setInterval(checkReminders, 3600000);
    
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
    
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('SW registration failed', err));
    }
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
    
    // Add day headers
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    // Offset for Monday start
    let offset = firstDay === 0 ? 6 : firstDay - 1;
    
    // Previous month padding
    for (let i = 0; i < offset; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        calendarGrid.appendChild(cell);
    }

    // Days of month
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
    
    // Sort shifts by date and time
    const sortedShifts = [...state.shifts]
        .filter(s => new Date(`${s.date}T${s.start}`) >= new Date().setHours(0,0,0,0))
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
    if (diff < 0) diff += 24 * 60; // Handle overnight shifts
    
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

// Modal logic
function openModal(dateStr = '') {
    if (dateStr) document.getElementById('shift-date').value = dateStr;
    modal.classList.add('active');
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
    
    // Immediate check for reminders if added for tomorrow
    checkReminders();
};

// Notification Logic
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    state.shifts.forEach(shift => {
        const shiftStart = new Date(`${shift.date}T${shift.start}`);
        
        // If shift starts in less than 24h and we haven't reminded yet
        if (shiftStart > now && shiftStart <= twentyFourHoursFromNow && !shift.reminded) {
            showNotification(shift);
            shift.reminded = true;
        }
    });
    
    localStorage.setItem('shifts', JSON.stringify(state.shifts));
}

function showNotification(shift) {
    const options = {
        body: `Votre service "${shift.note || 'Travail'}" commence demain à ${shift.start}.`,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200]
    };
    
    new Notification('Rappel ShiftSync 🔔', options);
}

// Initialize on load
init();
