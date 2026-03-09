/**
 * PURE PHYSICS ENGINE: ADA Quoter (v3.3)
 * Pre-Built Bundles, Explicit Add-ons, Volume Discounts, and Interactive Ledger Equations.
 */
function calculateEngraved(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = window.ENGRAVED_CONFIG.constants?.find(x => x.key === k)?.desc || "";
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    const ret = [];
    const cst = [];
    // Only push to ledger if value is not 0 to prevent empty line items (like a $0 volume discount)
    const R = (label, total, formula) => { if(total !== 0) ret.push({label, total, unit: total/inputs.qty, formula}); return total; };
    const L = (label, total, formula) => { if(total !== 0) cst.push({label, total, formula}); return total; };

    // --- MATERIAL DICTIONARY ---
    const sheet1152 = 1152;
    const sheet4608 = 4608;
    const matDict = {
        '1/32': { cost: parseFloat(data.Cost_Sub_Tactile || 55), yield: sheet1152, name: '1/32" Tactile', costKey: 'Cost_Sub_Tactile' },
        '1/16': { cost: parseFloat(data.Cost_Sub_ADA_Core_116 || 50), yield: sheet1152, name: '1/16" Core', costKey: 'Cost_Sub_ADA_Core_116' },
        '1/8': { cost: parseFloat(data.Cost_Sub_ADA_Core_18 || 70), yield: sheet1152, name: '1/8" Core', costKey: 'Cost_Sub_ADA_Core_18' },
        '3mm': { cost: parseFloat(data.Cost_Sub_PVC || 29.09), yield: sheet4608, name: '3mm PVC Backer', costKey: 'Cost_Sub_PVC' },
        '3/16': { cost: parseFloat(data.Cost_Sub_Acrylic || 91.65), yield: sheet4608, name: '3/16" Clear Acrylic', costKey: 'Cost_Sub_Acrylic' },
        '1/32_CLR': { cost: parseFloat(data.ADA_APP_132_CLR || 58.12), yield: sheet1152, name: '1/32" Clear Lens', costKey: 'ADA_APP_132_CLR' }
    };

    // --- 1. RETAIL ENGINE ---
    let baseRate = parseFloat(data.Retail_Price_ADA_Basic_AB || 1.60);
    let baseKey = 'Retail_Price_ADA_Basic_AB';
    let productName = "Basic 1/8\" ADA";
    
    if (inputs.product === 'BasicA') { baseRate = parseFloat(data.Retail_Price_ADA_Basic_AB || 1.60); baseKey = 'Retail_Price_ADA_Basic_AB'; productName = "Basic 1/8\" ADA"; }
    else if (inputs.product === 'BasicB') { baseRate = parseFloat(data.Retail_Price_ADA_Basic_AB || 1.60); baseKey = 'Retail_Price_ADA_Basic_AB'; productName = "Basic Backer ADA"; }
    else if (inputs.product === 'BasicClear') { baseRate = parseFloat(data.Retail_Price_ADA_Basic_Clear || 1.80); baseKey = 'Retail_Price_ADA_Basic_Clear'; productName = "Basic Clear ADA"; }

    R(`Base Product: ${productName}`, baseRate * totalSqin, `Qty * ${sqin.toFixed(1)} SqIn * ${V(baseKey)}`);

    let hasPaperWindow = false;
    let hasEngravedWindow = false;
    let extraMats = [];
    let forcedBacker = false;

    // Process Explicit Add-ons
    inputs.addons.forEach(a => {
        if (a.type === 'Window_Paper') {
            hasPaperWindow = true;
            let rRate = parseFloat(data.Retail_Price_Window_Paper || 0.40);
            R(`Add-on: Window for Paper Slider`, rRate * totalSqin, `Qty * ${sqin.toFixed(1)} SqIn * ${V('Retail_Price_Window_Paper')}`);
        } else if (a.type === 'Window_Engraved') {
            hasEngravedWindow = true;
            let rRate = parseFloat(data.Retail_Price_Window_Engraved || 0.20);
            R(`Add-on: Window w/ 1/16" Engraved Slider`, rRate * totalSqin, `Qty * ${sqin.toFixed(1)} SqIn * ${V('Retail_Price_Window_Engraved')}`);
        } else if (a.type) {
            extraMats.push(a.type);
            let mat = matDict[a.type];
            if (mat) {
                let costPerSqIn = mat.cost / mat.yield;
                let retailPerSqIn = costPerSqIn * 3;
                let yieldKey = mat.yield === 1152 ? 'C_1152' : 'C_4608';
                R(`Add-on: Extra ${mat.name}`, retailPerSqIn * totalSqin, `( ${V(mat.costKey)} / ${C(yieldKey, mat.yield)} ) * 3x Markup`);
            }
        }
    });

    // Handle Structural Compatability (Basic A doesn't have a backer for the window pocket)
    if (inputs.product === 'BasicA' && (hasPaperWindow || hasEngravedWindow)) {
        if (!extraMats.includes('3mm') && !extraMats.includes('3/16')) {
            forcedBacker = true;
            let mat = matDict['3mm'];
            let retailPerSqIn = (mat.cost / mat.yield) * 3;
            R(`Forced 3mm Backer (Window Routing Req.)`, retailPerSqIn * totalSqin, `( ${V('Cost_Sub_PVC')} / ${C('C_4608', '4608')} ) * 3x Markup`);
            extraMats.push('3mm'); 
        }
    }

    // Apply Volume Discount BEFORE Shop Minimum
    let subTotalBeforeDisc = ret.reduce((sum, item) => sum + item.total, 0);
    let tier1Qty = parseFloat(data.Tier_1_Qty || 10);
    let discountAmount = 0;

    if (inputs.qty >= tier1Qty) {
        let discPct = parseFloat(data.Tier_1_Disc || 0.05);
        discountAmount = subTotalBeforeDisc * discPct;
        R(`Volume Discount (${(discPct * 100).toFixed(0)}%)`, -discountAmount, `Subtotal * ${V('Tier_1_Disc')}`);
    }

    let grandTotalRaw = subTotalBeforeDisc - discountAmount;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const actualUnitPrice = grandTotalRaw / inputs.qty;

    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `${V('Retail_Min_Order')} - Subtotal`);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 10);
    const cncRate = parseFloat(data.Rate_Machine_CNC || 10);

    // Build Material Stack for Costing
    let baseMats = [];
    if (inputs.product === 'BasicA') baseMats = ['1/32', '1/8'];
    else if (inputs.product === 'BasicB') baseMats = ['1/32', '1/16', '3mm'];
    else if (inputs.product === 'BasicClear') baseMats = ['1/32', '1/16', '3/16'];

    let allMats = [...baseMats, ...extraMats];

    allMats.forEach(matKey => {
        let mat = matDict[matKey];
        let yieldKey = mat.yield === 1152 ? 'C_1152' : 'C_4608';
        if(mat) L(`Material: ${mat.name}`, (totalSqin * (mat.cost / mat.yield)) * wastePct, `(Total SqIn * ${V(mat.costKey)} / ${C(yieldKey, mat.yield)}) * ${V('Waste_Factor')}`);
    });

    // Base Engraver Math
    L(`Engraver Prepress`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Machine Run`, ((totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25)) / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * ${V('Rate_Machine_Engraver')}`);

    // Base Braille Math
    const totalBeads = inputs.qty * 10; 
    L(`Braille Beads`, totalBeads * parseFloat(data.Cost_Raster_Bead || 0.01) * wastePct, `10 Beads/Sign * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
    L(`Braille Insertion`, (totalBeads * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);

    // Window Add-on Physics
    if (hasPaperWindow) {
        let lensMat = matDict['1/32_CLR'];
        L(`Paper Lens Material (1/32" Clear)`, (totalSqin * (lensMat.cost / lensMat.yield)) * wastePct, `Full Size Lens * ${V('Waste_Factor')}`);
        allMats.push('1/32_CLR'); 
    } 
    if (hasEngravedWindow) {
        let sh = inputs.addons.find(a => a.type === 'Window_Engraved')?.sliderH || 2;
        let sliderSqin = inputs.w * sh * inputs.qty;
        let slMat = matDict['1/16'];
        
        L(`Slider Substrate (1/16" Core)`, (sliderSqin * (slMat.cost / slMat.yield)) * wastePct, `Slider SqIn * ${V('Cost_Sub_ADA_Core_116')} / ${C('C_1152', '1152')}`);
        L(`Slider Paint Fill Material`, sliderSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct, `Slider SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
        
        let slEngraveMins = sliderSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
        L(`Slider Engrave Run`, (slEngraveMins / 60) * engraveRate, `Slider SqIn * ${V('Time_Engrave_SqIn')}`);
        
        let slPaintMins = parseFloat(data.Time_Paint_Setup || 20) + (sliderSqin * parseFloat(data.Time_Paint_SqIn || 0.10));
        L(`Slider Paint Fill Labor`, (slPaintMins / 60) * shopRate, `(${V('Time_Paint_Setup')} Mins + SqIn * ${V('Time_Paint_SqIn')}) * ${V('Rate_Shop_Labor')}`);
    }

    // CNC Routing
    let hasCNC = allMats.includes('3mm') || allMats.includes('3/16') || hasPaperWindow || hasEngravedWindow;
    if (hasCNC) {
        L(`CNC Prepress & Setup`, (25 / 60) * rateOp, `25 Mins * ${V('Rate_Operator')}`);
        L(`CNC Machine Run`, ((totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * cncRate, `(SqIn / 144) * ${V('Time_CNC_Easy_SqFt')} * ${V('Rate_Machine_CNC')}`);
    }

    // Assembly Tape & Labor 
    let tapeLayers = allMats.length > 1 ? (allMats.length - 1) : 0;
    if (inputs.mounting === 'Foam Tape') tapeLayers++;
    
    if (tapeLayers > 0) {
        L(`Assembly Tape (${tapeLayers}x Layers)`, (totalSqin * (parseFloat(data.Cost_Hem_Tape || 0.08)/144) * tapeLayers) * wastePct, `(SqIn * ${V('Cost_Hem_Tape')} / 144 * ${tapeLayers} Lyr) * ${V('Waste_Factor')}`);
        L(`Assembly & Press Labor`, ((inputs.qty * tapeLayers * 2) / 60) * shopRate, `Qty * ${tapeLayers} Lyr * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: actualUnitPrice, grandTotal: grandTotal, breakdown: ret, isMinApplied: isMinApplied, forcedBacker: forcedBacker },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ENGRAVED_CONFIG = {
    tab: 'PROD_ADA_Signs', engine: calculateEngraved,
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 8 },
        { id: 'h', label: 'Height', type: 'number', def: 8 }
    ],
    retails: [ 
        { key: 'Retail_Price_ADA_Basic_AB', label: 'Basic ADA ($/Sqin)' },
        { key: 'Retail_Price_ADA_Basic_Clear', label: 'Acr ADA ($/Sqin)' },
        { key: 'Retail_Price_Window_Paper', label: 'Paper Window ($/Sqin)' },
        { key: 'Retail_Price_Window_Engraved', label: 'Engraved Slider ($/Sqin)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [ 
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' }, 
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'ADA_APP_132_CLR', label: '1/32" Clear Lens ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Cost_Paint_SqIn', label: 'Paint ($/SqIn)' },
        { key: 'Cost_Hem_Tape', label: 'Tape ($/Roll)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'File Preflight (Mins)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load Item (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Mins/Sqin)' },
        { key: 'Time_Paint_Setup', label: 'Paint Setup (Mins)' },
        { key: 'Time_Paint_SqIn', label: 'Paint (Mins/Sqin)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Time (Mins/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Factor' },
        { key: 'Factor_Risk', label: 'Risk Factor' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet.' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet.' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' },
        { key: 'C_005', val: '0.05', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};
