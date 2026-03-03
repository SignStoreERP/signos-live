/**
 * SignOS UI Component Builder (v1.2)
 * Agnostic generators for Swatches, Grids, and Shared Frontend Components
 */

window.SignOS_UI = {
    
    // Builds a dynamic color grid for Paint, Rowmark, or Vinyl
    buildColorGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if(!grid) return;
        grid.innerHTML = '';

        // Optional Custom Manual Entry Button
        if(config.showCustom) {
            const customBtn = document.createElement('button');
            customBtn.className = "w-full py-1.5 mb-1 rounded border border-gray-300 bg-white text-[10px] font-bold text-gray-600 shadow-sm hover:border-orange-500 transition focus:outline-none uppercase shrink-0";
            customBtn.innerText = "+ Custom Match...";
            customBtn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-orange-500');
                customBtn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-orange-500', 'border-transparent');
                if(config.onCustom) config.onCustom();
            };
            grid.appendChild(customBtn);
        }

        const fragment = document.createDocumentFragment();
        
        config.data.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `w-8 h-8 rounded border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none relative group overflow-hidden shrink-0 ${config.btnClass || ''}`;

            let bgStyle = '';
            let title = '';
            let searchData = '';

            // Map data based on the substrate type requested
            if (config.type === 'rowmark') {
                let cap = item.Cap_Hex || '#000000';
                let core = item.Core_Hex || '#FFFFFF';
                bgStyle = config.isReverse ? cap : `linear-gradient(135deg, ${cap} 50%, ${core} 50%)`;
                
                // Formats the tooltip to match your exact requested label
                let thick = item.Thickness || '1/16"';
                let coreTxt = config.isReverse ? 'Clear' : (item.Core_Color || 'Unknown');
                title = `[${item.Item_Code}] ${item.Cap_Color} Face / ${coreTxt} Text (${thick})`;
                
                searchData = title.toLowerCase();
                btn.dataset.code = item.Item_Code; // Adds an invisible tag so the system can target specific defaults
            } 
            else if (config.type === 'paint' || config.type === 'vinyl') {
                bgStyle = item.Hex_Code || '#FFFFFF';
                let code = item.Code || item.Color_Code || '';
                let name = item.Name || item.Display_Name || '';
                title = `${name} (${code})`;
                searchData = title.toLowerCase();
                if(config.type === 'paint') btn.classList.add('rounded-full'); // Paint gets circles
            }

            btn.style.background = bgStyle;
            btn.title = title;
            btn.dataset.search = searchData;

            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };

            fragment.appendChild(btn);
        });
        
        grid.appendChild(fragment);
    },

    _clearActive: function(grid, ringClass) {
        Array.from(grid.children).forEach(b => b.classList.remove('ring-2', 'ring-offset-1', ringClass, 'border-transparent'));
    },

   // Global Search Filter for generated grids
    filterGrid: function(containerId, searchInputId) {
        // ... existing filterGrid code ...
    }, // <-- Make sure there is a comma here!

    // --- GLOBAL LOADER OVERLAYS ---
    showLoader: function(containerId, message = "Connecting to Source Data...") {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Force container to relative so the absolute overlay stays inside it
        if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';

        let overlay = document.getElementById(containerId + '-loader');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = containerId + '-loader';
            overlay.className = "absolute inset-0 z-50 bg-gray-900/90 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-300 rounded-xl";
            container.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="animate-spin rounded-full h-8 w-8 border-4 border-gray-600 border-t-blue-500 mb-3"></div>
            <span class="text-[9px] font-black text-blue-400 uppercase tracking-widest animate-pulse mt-3 text-center leading-relaxed">${message}</span>
        `;
        overlay.classList.remove('hidden');
    },

    hideLoader: function(containerId, isError = false, errorMsg = "⚠️ Connection Failed") {
        const overlay = document.getElementById(containerId + '-loader');
        if (!overlay) return;

        if (isError) {
            overlay.innerHTML = `<span class="text-[10px] font-black text-red-500 uppercase tracking-widest">${errorMsg}</span>`;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
};



