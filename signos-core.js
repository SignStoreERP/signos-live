// SignOS Core System v1.4
// Handles: IP Telemetry, Host Tracking, Session Security, Global Navigation, and Environment Detection

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";

// 1. ENVIRONMENT DETECTION (The "Twin-Engine" Logic)
const IS_DEV_ENV = window.location.href.includes('signos-app') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. GLOBAL TELEMETRY
let clientIP = "Unknown";
const currentHost = window.location.hostname;

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 3. SESSION SECURITY
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

// 5. NAVIGATION (Updated for SUPER)
function goBack() {
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    
    if (role === 'PROD') mode = 'production';
    // SUPER and ADMIN default to 'dev' mode if they are on the Dev Repo
    else if (role === 'ADMIN' || role === 'SUPER') mode = IS_DEV_ENV ? 'dev' : 'admin';
    
    window.location.href = `menu.html?mode=${mode}`;
}

// 6. GLOBAL FEEDBACK INJECTION
window.addEventListener('load', function() {
    const user = sessionStorage.getItem('signos_user');
    // Don't show on login page or if not logged in
    if (!user || window.location.pathname.includes('index.html')) return;

    injectFeedbackUI();
});

function injectFeedbackUI() {
    // 1. The Button
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="text-xl">📣</span>';
    btn.className = "fixed bottom-4 right-4 bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:scale-110 transition z-50 flex items-center justify-center w-12 h-12";
    btn.title = "Report Bug / Request Feature";
    btn.onclick = openFeedback;
    document.body.appendChild(btn);

    // 2. The Modal (Hidden)
    const modalHTML = `
    <div id="glb-feedback-modal" class="fixed inset-0 bg-black/80 z-[1] hidden flex items-center justify-center p-4">
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
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Location (Context)</label>
                    <input type="text" id="fb-context" class="w-full border p-2 rounded text-xs bg-gray-100 text-gray-500 cursor-not-allowed" readonly>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issue / Idea Title</label>
                    <input type="text" id="fb-title" class="w-full border p-2 rounded text-sm font-bold placeholder-gray-300" placeholder="Brief summary...">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Details</label>
                    <textarea id="fb-desc" class="w-full border p-2 rounded text-sm h-24 placeholder-gray-300" placeholder="Describe what happened or what you need..."></textarea>
                </div>
                <button onclick="submitFeedback()" id="btn-fb-send" class="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded text-xs tracking-widest transition">SUBMIT TICKET</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openFeedback() {
    // Auto-capture current filename
    const page = window.location.pathname.split('/').pop() || 'Home';
    document.getElementById('fb-context').value = page;
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

    btn.innerText = "SENDING...";
    btn.disabled = true;

    try {
        // Send to API
        const url = `${SCRIPT_URL}?req=add_roadmap&user=${user}&cat=${type}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}&prio=Med&target=APP&source=User&context=${ctx}`;
        await fetch(url);
        
        alert("Ticket Submitted! Thank you.");
        document.getElementById('glb-feedback-modal').classList.add('hidden');
        document.getElementById('fb-title').value = "";
        document.getElementById('fb-desc').value = "";
    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        btn.innerText = "SUBMIT TICKET";
        btn.disabled = false;
    }
}

