// SignOS Core System v1.2
// Handles: IP Telemetry, Host Tracking, Session Security, Global Navigation, and Environment Detection

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";

// 1. ENVIRONMENT DETECTION (The "Twin-Engine" Logic)
// True if running on 'signos-app' repo or Localhost. False if 'signos-live'.
const IS_DEV_ENV = window.location.href.includes('signos-app') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. GLOBAL TELEMETRY
let clientIP = "Unknown";
const currentHost = window.location.hostname;

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 3. SESSION SECURITY (The Bouncer)
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 4. GLOBAL LOGOUT
function logout() {
    const u = sessionStorage.getItem('signos_user');
    fetch(`${SCRIPT_URL}?req=log_event&action=LOGOUT&user=${u}&ip=${clientIP}&host=${currentHost}`, {mode: 'no-cors'});
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 5. NAVIGATION
function goBack() {
    // If Admin, default to Dev mode in Dev Env. If Sales, default to Sales mode.
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    
    if (role === 'PROD') mode = 'production';
    else if (role === 'ADMIN') mode = IS_DEV_ENV ? 'dev' : 'admin';
    
    window.location.href = `menu.html?mode=${mode}`;
}
