/**
 * SignOS Log Analyzer Logic (v2.25)
 * Feature: Auto-loads 'Active Session' logs by default (Live Injection).
 * Includes: Safety check for search filter to prevent crashes if UI is missing.
 */

let rawData = [];
let displayData = [];
let currentSort = { key: 'time', dir: 'desc' };
let activeFilters = { users: [], roles: [], actions: [], targets: [], ips: [] };

// --- HELPER: FIND TABLE BODY ---
function getTableBody() {
    return document.getElementById('table-body') || document.getElementById('log-body');
}

// --- INIT ---
window.onload = function() {
    const u = sessionStorage.getItem('signos_user');
    
    if(document.getElementById('auth-user')) {
        document.getElementById('auth-user').innerText = u || "GUEST";
    }
    
    // Local File Loader
    const fileInput = document.getElementById('file-input');
    if(fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0]; 
            if (!file) return;
            
            document.getElementById('current-file-name').innerText = "Local: " + file.name;
            const reader = new FileReader();
            reader.onload = (e) => parseLogs(e.target.result);
            reader.readAsText(file);
        });
    }

    loadArchiveList();
};

function goBack() { window.history.back(); }

// --- API FETCHING ---

async function loadArchiveList() {
    const list = document.getElementById('archive-list');
    if(!list) return;
    
    list.innerHTML = '<div class="text-center py-4"><div class="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>';

    try {
        const response = await fetch(`${SCRIPT_URL}?req=get_archive_index`);
        let data = await response.json();
        
        if (!data) data = [];

        // --- NEW: INJECT LIVE OPTION AT TOP ---
        const liveItem = { 
            date: "NOW", 
            name: "⚡ Active Session Logs", 
            type: "LIVE", 
            count: "Live", 
            file_id: "LIVE" 
        };
        
        // Force Live Item to the top of the array (Index 0)
        data.unshift(liveItem);
        // -------------------------------

        list.innerHTML = ""; 

        data.forEach((item, index) => {
            const div = document.createElement('div');
            // Highlight the first item (Live) by default
            div.className = `archive-item p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${index === 0 ? 'active' : ''}`;
            
            div.onclick = () => loadLogContent(item, div);
            
            // Custom badge for Live vs Archive
            const badgeClass = item.type === 'LIVE' 
                ? 'bg-green-100 text-green-600 border-green-200' 
                : (item.type === 'AUTO' ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600');

            div.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-xs text-gray-700">${item.date}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded border ${badgeClass}">${item.type}</span>
                </div>
                <div class="text-[10px] text-gray-400 truncate">${item.name}</div>
                <div class="text-[9px] text-gray-300 mt-1">${item.count || '0'} rows</div>
            `;
            list.appendChild(div);
        });

        // Auto-load the first item (which is now LIVE)
        if(data.length > 0) loadLogContent(data[0], list.firstChild);

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="text-xs text-red-500 text-center py-4">Error loading index</div>`;
    }
}

async function loadLogContent(item, element) {
    document.querySelectorAll('.archive-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    document.getElementById('current-file-name').innerText = item.name;
    
    const tbody = getTableBody();
    if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">Loading data...</td></tr>';

    try {
        let content = "";
        
        // CHECK IF LIVE REQUEST
        if (item.type === "LIVE" || (item.file_id && item.file_id === "LIVE")) {
             const res = await fetch(`${SCRIPT_URL}?req=get_live_logs`);
             const json = await res.json();
             if(json.status === "success") {
                 parseLiveArray(json.logs);
                 return;
             }
        } else {
            // ARCHIVE REQUEST
            const response = await fetch(`${SCRIPT_URL}?req=get_log_content&file_id=${item.file_id}`);
            const data = await response.json();
            content = data.content;
        }

        if (content) parseLogs(content);

    } catch (e) {
        console.error(e);
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-red-400">Failed to load logs.</td></tr>';
    }
}

// --- PARSING ENGINE ---

function parseLiveArray(data) {
    const tbody = getTableBody();
    if(!data || data.length < 2) {
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">No active logs found today.</td></tr>';
        return;
    }
    
    const rows = data.slice(1); // Skip Header
    
    rawData = rows.map(r => ({
        time: r[0] ? new Date(r[0]).toLocaleString() : "N/A",
        ip: r[1],
        user: r[2],
        role: r[3],
        action: r[4],
        target: r[5],
        meta: r[6]
    }));
    
    populateFilters();
    applyFilters();
}

function parseLogs(content) {
    if (!content) return;

    let lines = content.split('\n').filter(l => l.trim() !== "");

    // 1. FILTER GARBAGE
    lines = lines.filter(l => !l.startsWith("===="));

    // 2. REMOVE HEADER
    if (lines.length > 0 && lines[0].startsWith("Timestamp")) {
        lines.shift();
    }

    const tbody = getTableBody();
    if(lines.length === 0) {
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">Log file is empty.</td></tr>';
        return;
    }

    // 3. DETECT DELIMITER
    const firstLine = lines[0];
    const separator = firstLine.includes(" | ") ? " | " : ",";

    rawData = lines.map(line => {
        let parts;
        if (separator === ",") {
             parts = line.split(",");
        } else {
             parts = line.split(" | ");
        }

        if (parts.length < 5) return null;

        return {
            time: parts[0] || "N/A",
            ip: parts[1] || "Unknown",
            user: parts[2] || "Guest",
            role: parts[3] || "N/A",
            action: parts[4] || "VIEW",
            target: parts[5] || "N/A",
            meta: parts.slice(6).join(separator) || "{}"
        };
    }).filter(x => x); 

    populateFilters();
    applyFilters();
}

// --- SCANNER & FILTERS ---

function populateFilters() {
    const getUnique = (key) => [...new Set(rawData.map(item => item[key]))].sort();

    renderFilterChips('filter-users', getUnique('user'), 'users');
    renderFilterChips('filter-roles', getUnique('role'), 'roles');
    renderFilterChips('filter-actions', getUnique('action'), 'actions');
    renderFilterChips('filter-targets', getUnique('target'), 'targets');
    renderFilterChips('filter-ips', getUnique('ip'), 'ips');
}

function renderFilterChips(containerId, values, filterKey) {
    const container = document.getElementById(containerId);
    if (!container) return; 

    container.innerHTML = '';
    values.forEach(val => {
        const btn = document.createElement('button');
        btn.innerText = val;
        btn.className = "filter-chip bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded text-[10px] font-bold mr-2 mb-2 hover:bg-blue-50";
        
        btn.onclick = () => {
            const idx = activeFilters[filterKey].indexOf(val);
            if (idx > -1) {
                activeFilters[filterKey].splice(idx, 1);
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-slate-50', 'text-slate-600');
            } else {
                activeFilters[filterKey].push(val);
                btn.classList.remove('bg-slate-50', 'text-slate-600');
                btn.classList.add('bg-blue-600', 'text-white');
            }
            applyFilters();
        };
        container.appendChild(btn);
    });
}

// --- SORTING & RENDERING ---

function setSort(key) {
    if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.dir = 'asc';
    }
    applyFilters();
}

function applyFilters() {
    // Search Filter Safety Check
    const searchInput = document.getElementById('filter-search');
    const search = searchInput ? searchInput.value.toLowerCase() : "";

    displayData = rawData.filter(row => {
        const matchUser = activeFilters.users.length === 0 || activeFilters.users.includes(row.user);
        const matchRole = activeFilters.roles.length === 0 || activeFilters.roles.includes(row.role);
        const matchAction = activeFilters.actions.length === 0 || activeFilters.actions.includes(row.action);
        const matchTarget = activeFilters.targets.length === 0 || activeFilters.targets.includes(row.target);
        const matchIp = activeFilters.ips.length === 0 || activeFilters.ips.includes(row.ip);
        
        const matchSearch = !search || JSON.stringify(row).toLowerCase().includes(search);
        
        return matchUser && matchRole && matchAction && matchTarget && matchIp && matchSearch;
    });

    // Sort
    displayData.sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        if (currentSort.key === 'time') {
            valA = new Date(valA);
            valB = new Date(valB);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
}

function renderTable() {
    const tbody = getTableBody();
    if(!tbody) return;
    
    tbody.innerHTML = '';

    if (displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">No matching records found.</td></tr>';
        return;
    }

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "log-row border-b border-gray-50";
        tr.onclick = () => openModal(row);

        if (row.action.includes('ORDER') || row.action.includes('SUBMIT')) tr.classList.add('log-checkout');
        if (row.user === 'GUEST' && row.action.includes('AUTH')) tr.classList.add('log-error');
        if (row.action.includes('AUTH') && row.role !== 'N/A') tr.classList.add('log-auth');

        let metaShort = row.meta;
        if(metaShort && metaShort.length > 50) metaShort = metaShort.substring(0, 47) + "...";
        
        const cell = (val) => `<span class="hover:text-blue-600 font-medium">${val}</span>`;

        tr.innerHTML = `
            <td class="p-3 text-gray-600 whitespace-nowrap text-xs">${cell(row.time)}</td>
            <td class="p-3 font-bold text-gray-800 text-xs">${row.user}</td>
            <td class="p-3"><span class="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded font-bold text-gray-600">${row.role}</span></td>
            <td class="p-3 font-bold text-xs whitespace-nowrap"><span class="text-blue-600">${row.action}</span></td>
            <td class="p-3 text-gray-500 text-xs whitespace-nowrap">${cell(row.target)}</td>
            <td class="p-3 text-gray-400 font-mono text-[10px] whitespace-nowrap">${cell(row.ip)}</td>
            <td class="p-3 text-gray-400 font-mono text-[9px] truncate max-w-xs hover:text-gray-600 transition" title='${row.meta}'>${metaShort}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL LOGIC ---

function openModal(row) {
    if(document.getElementById('m-time')) document.getElementById('m-time').innerText = row.time;
    if(document.getElementById('m-ip')) document.getElementById('m-ip').innerText = row.ip;
    if(document.getElementById('m-user')) document.getElementById('m-user').innerText = row.user;
    if(document.getElementById('m-role')) document.getElementById('m-role').innerText = row.role;
    if(document.getElementById('m-action')) document.getElementById('m-action').innerText = row.action;
    if(document.getElementById('m-target')) document.getElementById('m-target').innerText = row.target;

    try {
        const metaObj = JSON.parse(row.meta);
        if(document.getElementById('m-meta')) document.getElementById('m-meta').innerText = JSON.stringify(metaObj, null, 2);
    } catch(e) {
        if(document.getElementById('m-meta')) document.getElementById('m-meta').innerText = row.meta;
    }

    const modal = document.getElementById('detail-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-active');
    }
}

function closeModal() {
    const modal = document.getElementById('detail-modal');
    if(modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-active');
}
