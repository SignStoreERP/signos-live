// SignOS Core System v1.7.1
// Features: Twin-Engine Env, IP Telemetry, Island Header, Feedback Modal

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";
const IS_DEV_ENV = window.location.href.includes('signos-app') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

let clientIP = "Unknown";
const currentHost = window.location.hostname;

// 1. IP Telemetry
fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 2. Session Security
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 3. Global Logout
function logout() {
    const u = sessionStorage.getItem('signos_user');
    fetch(`${SCRIPT_URL}?req=log_event&action=LOGOUT&user=${u}&ip=${clientIP}&host=${currentHost}`, {mode: 'no-cors'});
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 4. Global Navigation
function goBack() {
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    if (role === 'PROD') mode = 'production';
    else if (role === 'ADMIN' || role === 'SUPER') mode = IS_DEV_ENV ? 'dev' : 'admin';
    window.location.href = `menu.html?mode=${mode}`;
}

// 5. UI Injection (Island Mode + Status)
function injectHeader(title, showMenu = true) {
    const u = sessionStorage.getItem('signos_user') || 'GUEST';
    const r = sessionStorage.getItem('signos_role') || 'VIEW';
    
    // Target the main card to keep the "Island" look
    const container = document.getElementById('main-card') || document.querySelector('.max-w-md') || document.body;
    const isCard = container !== document.body;
    const stickyClass = isCard ? "" : "sticky top-0 z-50 shadow-md";
    
    const html = `
    <div class="bg-gray-900 text-white px-4 py-3 flex justify-between items-center border-b border-gray-800 ${stickyClass} shrink-0">
        <div class="flex flex-col leading-tight">
            <span class="text-gray-400 text-[10px] uppercase tracking-wider">SignOS ERP</span>
            <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">${title}</span>
                <div class="flex items-center gap-1 ml-2 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                    <span id="status-dot" class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    <span id="status-text" class="text-[9px] font-mono text-gray-300">CONNECTING</span>
                </div>
            </div>
            <span id="version-display" class="text-[9px] text-gray-500 font-mono hidden">v0.0</span>
        </div>
        <div class="flex items-center gap-3">
            <div class="hidden md:block text-right mr-2">
                <div class="text-[9px] text-gray-400 uppercase">User</div>
                <div class="font-bold text-xs">${u} <span class="bg-gray-800 px-1 rounded text-blue-400 border border-gray-700">${r}</span></div>
            </div>
            ${showMenu ? `<button onclick="goBack()" class="text-gray-300 hover:text-white text-xs font-bold border border-gray-600 px-3 py-1.5 rounded transition">MENU</button>` : ''}
            <button onclick="logout()" class="text-red-400 hover:text-white text-[10px] font-bold border border-red-900/50 bg-red-900/10 px-3 py-1.5 rounded transition">EXIT</button>
        </div>
    </div>`;
    
    container.insertAdjacentHTML('afterbegin', html);
}

// 6. Feedback Modal Logic
window.addEventListener('load', function() {
    const user = sessionStorage.getItem('signos_user');
    if (!user || window.location.pathname.includes('index.html')) return;
    injectFeedbackUI();
});

function injectFeedbackUI() {
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="text-xl">📣</span>';
    btn.className = "fixed bottom-4 right-4 bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:scale-110 transition z-50 flex items-center justify-center w-12 h-12";
    btn.title = "Report Bug / Request Feature";
    btn.onclick = openFeedback;
    document.body.appendChild(btn);

    const modalHTML = `
    <div id="glb-feedback-modal" class="fixed inset-0 bg-black/80 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="bg-gray-900 text-white px-4 py-3 flex justify-between items-center">
                <h3 class="font-bold text-sm">Submit Feedback</h3>
                <button onclick="document.getElementById('glb-feedback-modal').classList.add('hidden')" class="text-gray-400 hover:text-white">✕</button>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label>
                    <div class="flex gap-2">
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Bug" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-red-600 peer-checked:text-white font-bold">Bug</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Feature" class="peer sr-only" checked><div class="text-center text-xs border rounded p-2 peer-checked:bg-blue-600 peer-checked:text-white font-bold">Feature</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Content" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-purple-600 peer-checked:text-white font-bold">Content</div></label>
                    </div>
                </div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Context</label><input type="text" id="fb-context" class="w-full border p-2 rounded text-xs bg-gray-100 text-gray-500" readonly></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label><input type="text" id="fb-title" class="w-full border p-2 rounded text-sm font-bold" placeholder="Summary..."></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Details</label><textarea id="fb-desc" class="w-full border p-2 rounded text-sm h-24" placeholder="Details..."></textarea></div>
                <button onclick="submitFeedback()" id="btn-fb-send" class="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded text-xs tracking-widest transition">SUBMIT TICKET</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openFeedback() {
    document.getElementById('fb-context').value = window.location.pathname.split('/').pop() || 'Home';
    document.getElementById('glb-feedback-modal').classList.remove('hidden');
}

async function submitFeedback() {
    const user = sessionStorage.getItem('signos_user');
    const type = document.querySelector('input[name="fb-type"]:checked').value;
    const ctx = document.getElementById('fb-context').value;
    const title = document.getElementById('fb-title').value;
    const desc = document.getElementById('fb-desc').value;
    const btn = document.getElementById('btn-fb-send');

    if(!title) { alert("Title required"); return; }
    btn.innerText = "SENDING..."; btn.disabled = true;

    try {
        await fetch(`${SCRIPT_URL}?req=add_roadmap&user=${user}&cat=${type}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}&prio=Med&target=APP&source=User&context=${ctx}`, {mode: 'no-cors'});
        alert("Ticket Submitted!");
        document.getElementById('glb-feedback-modal').classList.add('hidden');
        document.getElementById('fb-title').value = ""; document.getElementById('fb-desc').value = "";
    } catch(e) { alert("Error: " + e.message); } 
    finally { btn.innerText = "SUBMIT TICKET"; btn.disabled = false; }
}
