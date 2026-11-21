document.addEventListener('deviceready', initApp, false);

// Fallback for browser testing
if (!window.cordova) {
    window.addEventListener('DOMContentLoaded', initApp);
}

const DEFAULT_CONTROLS = [
    { id: '1', label: 'Lights', icon: '💡', cmd: 'L1', releaseCmd: '', color: '#0284c7' },
    { id: '2', label: 'Forward', icon: '⬆️', cmd: 'F', releaseCmd: 'S', color: '#2563eb' },
    { id: '3', label: 'Horn', icon: '🔊', cmd: 'H', releaseCmd: '', color: '#7c3aed' },
    { id: '4', label: 'Left', icon: '⬅️', cmd: 'L', releaseCmd: 'S', color: '#2563eb' },
    { id: '5', label: 'Stop', icon: '🛑', cmd: 'S', releaseCmd: '', color: '#dc2626' },
    { id: '6', label: 'Right', icon: '➡️', cmd: 'R', releaseCmd: 'S', color: '#2563eb' },
    { id: '7', label: 'Slow', icon: '⚙️', cmd: '1', releaseCmd: '', color: '#475569' },
    { id: '8', label: 'Backward', icon: '⬇️', cmd: 'B', releaseCmd: 'S', color: '#2563eb' },
    { id: '9', label: 'Boost', icon: '🚀', cmd: '9', releaseCmd: '', color: '#d97706' }
];

let controls = JSON.parse(localStorage.getItem('hc05_controls')) || DEFAULT_CONTROLS;
let isConnected = false;
let isEditMode = false;

function initApp() {
    requestAndroidPermissions();
    renderControls();
    setupNavigation();
    setupBluetoothUI();
    setupEditModal();
    setupJoystick();
    setupTerminal();
}

function requestAndroidPermissions() {
    if (window.cordova && cordova.plugins && cordova.plugins.permissions) {
        const permissions = cordova.plugins.permissions;
        const list = [
            permissions.BLUETOOTH_SCAN,
            permissions.BLUETOOTH_CONNECT,
            permissions.ACCESS_FINE_LOCATION
        ];
        permissions.requestPermissions(list, () => {}, () => {});
    }
}

/* --- BLUETOOTH SERIAL LOGIC --- */
function setupBluetoothUI() {
    const btnConnect = document.getElementById('btn-connect');
    const modalDevices = document.getElementById('modal-devices');

    btnConnect.addEventListener('click', () => {
        if (isConnected) {
            disconnectDevice();
        } else {
            modalDevices.classList.remove('hidden');
            scanDevices();
        }
    });

    document.getElementById('btn-refresh-devices').addEventListener('click', scanDevices);
}

function scanDevices() {
    const listEl = document.getElementById('device-list');
    listEl.innerHTML = '<p class="hint">Scanning paired devices...</p>';

    if (!window.bluetoothSerial) {
        listEl.innerHTML = '<p class="hint">Bluetooth Serial plugin not available in browser.</p>';
        return;
    }

    bluetoothSerial.list(
        (devices) => {
            listEl.innerHTML = '';
            if (devices.length === 0) {
                listEl.innerHTML = '<p class="hint">No paired devices found. Pair HC-05 in Android Settings first.</p>';
                return;
            }
            devices.forEach(dev => {
                const item = document.createElement('div');
                item.className = 'device-item';
                item.innerHTML = `<div><strong>${dev.name || 'Unknown'}</strong><br><small>${dev.address}</small></div><span>Connect →</span>`;
                item.onclick = () => connectToDevice(dev);
                listEl.appendChild(item);
            });
        },
        (err) => {
            listEl.innerHTML = `<p class="hint">Error: ${err}. Ensure Bluetooth is ON.</p>`;
        }
    );
}

function connectToDevice(device) {
    document.getElementById('modal-devices').classList.add('hidden');
    updateStatus(false, 'Connecting...', device.name);

    bluetoothSerial.connect(
        device.address,
        () => {
            isConnected = true;
            updateStatus(true, 'Connected via SPP', device.name || 'HC-05');
            logTerminal(`[SYSTEM] Connected to ${device.name}`);

            bluetoothSerial.subscribe('\n', (data) => {
                logTerminal(`RX: ${data.trim()}`);
            });
        },
        (err) => {
            isConnected = false;
            updateStatus(false, 'Connection Failed', 'Not Connected');
            alert('Failed to connect to HC-05: ' + err);
        }
    );
}

function disconnectDevice() {
    if (window.bluetoothSerial) {
        bluetoothSerial.disconnect(() => {
            isConnected = false;
            updateStatus(false, 'Disconnected', 'Not Connected');
            logTerminal('[SYSTEM] Disconnected');
        });
    }
}

function updateStatus(connected, subtext, title) {
    const dot = document.getElementById('status-dot');
    const btn = document.getElementById('btn-connect');
    document.getElementById('device-name').textContent = title;
    document.getElementById('status-text').textContent = subtext;

    if (connected) {
        dot.className = 'dot connected';
        btn.textContent = 'Disconnect';
        btn.style.background = '#ef4444';
    } else {
        dot.className = 'dot disconnected';
        btn.textContent = 'Connect';
        btn.style.background = '';
    }
}

function sendCommand(cmd) {
    if (!cmd) return;
    logTerminal(`TX: ${cmd}`);
    if (isConnected && window.bluetoothSerial) {
        bluetoothSerial.write(cmd + '\n');
    }
}

/* --- CUSTOMIZABLE REMOTE GRID --- */
function renderControls() {
    const grid = document.getElementById('button-grid');
    grid.innerHTML = '';

    controls.forEach(ctrl => {
        const btn = document.createElement('button');
        btn.className = `remote-btn ${isEditMode ? 'editing' : ''}`;
        btn.style.backgroundColor = ctrl.color;
        btn.innerHTML = `<span class="emoji">${ctrl.icon}</span><span class="label">${ctrl.label}</span>`;

        if (isEditMode) {
            btn.onclick = () => openEditModal(ctrl);
        } else {
            // Press & Release events for RC cars
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendCommand(ctrl.cmd); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); if (ctrl.releaseCmd) sendCommand(ctrl.releaseCmd); });
            btn.addEventListener('mousedown', () => sendCommand(ctrl.cmd));
            btn.addEventListener('mouseup', () => { if (ctrl.releaseCmd) sendCommand(ctrl.releaseCmd); });
        }
        grid.appendChild(btn);
    });
}

function setupEditModal() {
    const btnEditMode = document.getElementById('btn-edit-mode');
    const banner = document.getElementById('edit-banner');
    const btnAdd = document.getElementById('btn-add-control');

    btnEditMode.addEventListener('click', () => {
        isEditMode = !isEditMode;
        btnEditMode.classList.toggle('active', isEditMode);
        banner.classList.toggle('hidden', !isEditMode);
        btnAdd.classList.toggle('hidden', !isEditMode);
        renderControls();
    });

    btnAdd.addEventListener('click', () => {
        openEditModal({ id: Date.now().toString(), label: 'New', icon: '⚡', cmd: 'A', releaseCmd: '', color: '#2563eb' });
    });

    document.getElementById('edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const updated = {
            id,
            label: document.getElementById('edit-label').value,
            icon: document.getElementById('edit-icon').value,
            cmd: document.getElementById('edit-cmd').value,
            releaseCmd: document.getElementById('edit-release-cmd').value,
            color: document.getElementById('edit-color').value
        };

        const idx = controls.findIndex(c => c.id === id);
        if (idx > -1) controls[idx] = updated;
        else controls.push(updated);

        localStorage.setItem('hc05_controls', JSON.stringify(controls));
        document.getElementById('modal-edit').classList.add('hidden');
        renderControls();
    });

    document.getElementById('btn-delete-control').addEventListener('click', () => {
        const id = document.getElementById('edit-id').value;
        controls = controls.filter(c => c.id !== id);
        localStorage.setItem('hc05_controls', JSON.stringify(controls));
        document.getElementById('modal-edit').classList.add('hidden');
        renderControls();
    });
}

function openEditModal(ctrl) {
    document.getElementById('edit-id').value = ctrl.id;
    document.getElementById('edit-label').value = ctrl.label;
    document.getElementById('edit-icon').value = ctrl.icon;
    document.getElementById('edit-cmd').value = ctrl.cmd;
    document.getElementById('edit-release-cmd').value = ctrl.releaseCmd || '';
    document.getElementById('edit-color').value = ctrl.color;
    document.getElementById('modal-edit').classList.remove('hidden');
}

/* --- VIRTUAL JOYSTICK --- */
function setupJoystick() {
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const readout = document.getElementById('joy-cmd');
    let lastDir = 'S';

    const handleMove = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const maxDist = 70;
        const dist = Math.min(Math.hypot(dx, dy), maxDist);
        const angle = Math.atan2(dy, dx);

        stick.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;

        let dir = 'S';
        if (dist > 25) {
            const deg = angle * (180 / Math.PI);
            if (deg >= -135 && deg < -45) dir = 'F';
            else if (deg >= 45 && deg < 135) dir = 'B';
            else if (deg >= -45 && deg < 45) dir = 'R';
            else dir = 'L';
        }

        if (dir !== lastDir) {
            lastDir = dir;
            readout.textContent = dir;
            sendCommand(dir);
        }
    };

    const resetStick = () => {
        stick.style.transform = 'translate(0px, 0px)';
if (lastDir !== 'S') {
lastDir = 'S';
readout.textContent = 'S';
sendCommand('S');
}
};
base.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); });
base.addEventListener('touchend', resetStick);
}
/* --- SERIAL TERMINAL & TABS --- */
function setupTerminal() {
const input = document.getElementById('terminal-input');
document.getElementById('btn-send-serial').addEventListener('click', () => {
if (input.value.trim()) {
sendCommand(input.value.trim());
input.value = '';
}
});
document.getElementById('btn-clear-serial').addEventListener('click', () => {
document.getElementById('terminal-output').innerHTML = '';
});
}
function logTerminal(msg) {
const out = document.getElementById('terminal-output');
const line = document.createElement('div');
line.textContent = msg;
out.appendChild(line);
out.scrollTop = out.scrollHeight;
}
function setupNavigation() {
document.querySelectorAll('.tab-btn').forEach(btn => {
btn.addEventListener('click', () => {
document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
btn.classList.add('active');
document.getElementById(btn.dataset.tab).classList.add('active');
});
});
document.querySelectorAll('.close-modal').forEach(btn => {
btn.addEventListener('click', () => document.getElementById(btn.dataset.target).classList.add('hidden'));
});
document.getElementById('btn-theme').addEventListener('click', () => {
document.body.classList.toggle('light-theme');
});
}
