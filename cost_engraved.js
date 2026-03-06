/**
 * PURE PHYSICS ENGINE: ADA Quoter (v1.2)
 * Unified Rapid Calculator Engine with Specific Nominal Materials & True Unit Pricing.
 */
function calculateEngraved(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = window.ENGRAVED_CONFIG.constants.find(x => x.key === k)?.desc || "";
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    const ret = [];
    const cst = [];
    const R = (label, total, formula) => { if(total !== 0) ret.push({label, total, formula}); return total; };
    const L = (label, total, formula) => { if(total !== 0) cst.push({label, total, formula}); return total; };

    let hasTactile = false;
    let isReverse = false;
    let totalBrailleLines = 0;
    let hasCNC = false;
    let solidLayerCount = 0;

    // Analyze Stack based on precise Nominal Strings
    inputs.layers.forEach(layer => {
        const mat = layer.material;
        if (mat.includes('Tactile')) { hasTactile = true; if (layer.hasBraille) totalBrailleLines += (inputs.brailleLines || 1); }
        if (mat.includes('Reverse Etch')) isReverse = true;
        if (mat.includes('PVC') || mat.includes('Acrylic')) hasCNC = true;
        solidLayerCount++;
    });

    // --- 1. RETAIL ENGINE ---
    let physicalSignRetail = 0;

    if (hasTactile) {
        // ADA LOGIC: Square-Inch Tiered Curve
        let baseRate = parseFloat(data.ADA_T3_Rate || 1.35);
        let activeTierKey = 'ADA_T3_Rate';

        if (sqin <= parseFloat(data.ADA_T1_Max || 25)) {
            baseRate = parseFloat(data.ADA_T1_Rate || 2.10);
            activeTierKey = 'ADA_T1_Rate';
        }
        else if (sqin <= parseFloat(data.ADA_T2_Max || 64)) {
            baseRate = parseFloat(data.ADA_T2_Rate || 1.80);
            activeTierKey = 'ADA_T2_Rate';
        }

        physicalSignRetail += R(`Base ADA Sign`, (baseRate * sqin) * inputs.qty, `Qty * ${sqin.toFixed(1)} SqIn * ${V(activeTierKey)}`);

        // Apply layer adders
        let appliedFirstCore = false;
        inputs.layers.forEach(layer => {
            const mat = layer.material;
            if (mat.includes('ADA Core') && !mat.includes('Etch')) {
                // First core is included in ADA Base
                if (!appliedFirstCore) appliedFirstCore = true;
                else physicalSignRetail += R(`Extra Core Substrate`, (sqin * parseFloat(data.Retail_Adder_116_Core || 0.10)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_116_Core')}`);
            }
            if (mat.includes('PVC Backer')) physicalSignRetail += R(`Rigid Backer (3mm PVC)`, (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.10)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_PVC_Backer')}`);
            if (mat.includes('Clear Acrylic')) physicalSignRetail += R(`Rigid Backer (Acrylic)`, (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.15)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_Acr_Backer')}`);
        });
    } else {
        // NAMEPLATE LOGIC: Fixed Square-Inch Base Rates
        inputs.layers.forEach(layer => {
            const mat = layer.material;
            if (mat === '1/16" ADA Core Front Etch') physicalSignRetail += R(`Front Etch Nameplate`, (sqin * parseFloat(data.Retail_Price_Mattes_116 || 0.55)) * inputs.qty, `Qty * SqIn * ${V('Retail_Price_Mattes_116')}`);
            else if (mat === '1/16" ADA Core Reverse Etch + Paint') physicalSignRetail += R(`Reverse Etch Nameplate (1/16")`, (sqin * parseFloat(data.Retail_Price_Ultra_116 || 0.65)) * inputs.qty, `Qty * SqIn * ${V('Retail_Price_Ultra_116')}`);
            else if (mat.includes('PVC Backer')) physicalSignRetail += R(`Rigid Backer (3mm PVC)`, (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.10)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_PVC_Backer')}`);
            else if (mat.includes('Clear Acrylic')) physicalSignRetail += R(`Rigid Backer (Acrylic)`, (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.15)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_Acr_Backer')}`);
        });
    }

    if (totalBrailleLines > 0) {
        physicalSignRetail += R(`Raster Braille (Extra)`, totalBrailleLines * inputs.qty * parseFloat(data.Retail_Adder_Braille_Line || 10.00), `Lines * ${V('Retail_Adder_Braille_Line')}`);
    }

    // --- DYNAMIC VOLUME DISCOUNTS ---
    let discPct = 0;
    let activeTierQty = 0;
    let i = 1;
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        if (inputs.qty >= tQty) { discPct = tDisc; activeTierQty = tQty; }
        i++;
    }
    if (discPct > 0) R(`Volume Discount (${activeTierQty}+)`, -(physicalSignRetail * discPct), `-${(discPct * 100).toFixed(0)}% off Base Elements`);

    let grandTotalRaw = ret.reduce((sum, item) => sum + item.total, 0);
    const minOrder = hasTactile ? parseFloat(data.Retail_Min_Order || 50) : parseFloat(data.Retail_Min_Order_Nameplate || data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;
    
    // TRUE Unit Price calculated strictly off raw cost before shop minimum is enforced
    const actualUnitPrice = grandTotalRaw / inputs.qty;

    // INJECT SHOP MINIMUM SURCHARGE INTO LEDGER
    if (isMinApplied) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum ($${minOrder.toFixed(2)}) - Subtotal`);
    };

    // --- 2. COST ENGINE ---
    const sheetSqIn = 24 * 48;
    const wastePct = parseFloat(data.Waste_Factor || 1.15);

    inputs.layers.forEach(layer => {
        const mat = layer.material;
        if (mat.includes('Tactile')) L(`Tactile Applique`, (totalSqin * (parseFloat(data.Cost_Sub_Tactile || 55)/sheetSqIn)) * wastePct, `(Total SqIn * ${V('Cost_Sub_Tactile')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
        if (mat.includes('1/16" ADA Core')) L(`1/16" Core Material`, (totalSqin * (parseFloat(data.Cost_Sub_ADA_Core_116 || 50)/sheetSqIn)) * wastePct, `(Total SqIn * ${V('Cost_Sub_ADA_Core_116')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
        if (mat.includes('1/8" ADA Core')) L(`1/8" Core Material`, (totalSqin * (parseFloat(data.Cost_Sub_ADA_Core_18 || 70)/sheetSqIn)) * wastePct, `(Total SqIn * ${V('Cost_Sub_ADA_Core_18')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
        if (mat.includes('PVC Backer')) L(`3mm PVC Material`, (totalSqin * (parseFloat(data.Cost_Sub_PVC || 29.09)/4608)) * wastePct, `(Total SqIn * ${V('Cost_Sub_PVC')} / ${C('C_4608', '4608')}) * ${V('Waste_Factor')}`);
        if (mat.includes('Clear Acrylic')) L(`3/16" Acr Material`, (totalSqin * (parseFloat(data.Cost_Sub_Acrylic || 91.65)/4608)) * wastePct, `(Total SqIn * ${V('Cost_Sub_Acrylic')} / ${C('C_4608', '4608')}) * ${V('Waste_Factor')}`);
    });

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Engraver Prepress`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} * ${V('Rate_Operator')}`);
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    L(`Engraver Machine Run`, (runMins / 60) * parseFloat(data.Rate_Machine_Engraver || 10), `Total SqIn * ${V('Time_Engrave_SqIn')} * ${V('Rate_Machine_Engraver')}`);

    if (totalBrailleLines > 0) {
        const totalBeads = inputs.qty * totalBrailleLines * 10;
        L(`Braille Beads`, totalBeads * parseFloat(data.Cost_Raster_Bead || 0.01) * wastePct, `Total Beads * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
        L(`Braille Insertion`, (totalBeads * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (isReverse) {
        L(`Paint Material`, totalSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct, `Total SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
        const paintMins = parseFloat(data.Time_Paint_Setup || 20) + (totalSqin * parseFloat(data.Time_Paint_SqIn || 0.10));
        L(`Paint Fill Labor`, (paintMins / 60) * shopRate, `(${V('Time_Paint_Setup')} + Total SqIn * ${V('Time_Paint_SqIn')}) * ${V('Rate_Shop_Labor')}`);
    }

    let tapeLayers = solidLayerCount > 1 ? (solidLayerCount - 1) : 0;
    if (inputs.mounting === 'Foam Tape') tapeLayers++;
    if (tapeLayers > 0) {
        L(`Assembly Tape (Foam)`, (totalSqin * (parseFloat(data.Cost_Hem_Tape || 0.08)/144) * tapeLayers) * wastePct, `(Total SqIn * Tape Cost / ${C('C_144', '144')} * ${tapeLayers} Lyr) * ${V('Waste_Factor')}`);
        L(`Assembly & Stacking Labor`, ((inputs.qty * tapeLayers * 2) / 60) * shopRate, `Qty * ${tapeLayers} Lyr * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (hasCNC) {
        L(`CNC Prepress & Setup`, (25 / 60) * rateOp, `25 Mins * ${V('Rate_Operator')}`);
        L(`CNC Machine Run`, ((totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * parseFloat(data.Rate_Machine_CNC || 10), `(Total SqIn / ${C('C_144', '144')}) * ${V('Time_CNC_Easy_SqFt')} * ${V('Rate_Machine_CNC')}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: actualUnitPrice, grandTotal: grandTotal, breakdown: ret, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

// FULLY UNIFIED CONFIG FOR ADMIN SANDBOX
window.ENGRAVED_CONFIG = {
    tab: 'PROD_ADA_Signs', engine: calculateEngraved,
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 8 },
        { id: 'h', label: 'Height', type: 'number', def: 8 },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    retails: [ 
        { key: 'ADA_T1_Rate', label: 'ADA Tier 1 ($)' },
        { key: 'ADA_T2_Rate', label: 'ADA Tier 2 ($)' },
        { key: 'ADA_T3_Rate', label: 'ADA Tier 3 ($)' },
        { key: 'Retail_Price_Mattes_116', label: 'NP Front ($/Sqin)' },
        { key: 'Retail_Price_Ultra_116', label: 'NP Rev 1/16 ($/Sqin)' },
        { key: 'Retail_Price_Ultra_18', label: 'NP Rev 1/8 ($/Sqin)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Qty' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { key: 'Retail_Adder_116_Core', label: 'Extra Core ($/Sqin)' },
        { key: 'Retail_Adder_PVC_Backer', label: 'PVC Backer ($/Sqin)' },
        { key: 'Retail_Adder_Acr_Backer', label: 'Acr Backer ($/Sqin)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [ 
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' }, 
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'Cost_Paint_SqIn', label: 'Paint ($/SqIn)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop/Paint Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'Setup / Preflight' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/Sqin)' },
        { key: 'Time_Paint_Setup', label: 'Paint Setup (Mins)' },
        { key: 'Time_Paint_SqIn', label: 'Paint (Min/Sqin)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet (Rowmark ADA Core/Tactile).' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet (PVC/Acrylic Backers).' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' },
        { key: 'C_005', val: '0.05 Mins', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2 Mins', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};