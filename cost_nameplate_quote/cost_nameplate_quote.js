/**
 * PURE PHYSICS ENGINE: Rapid Nameplate Quoter (v1.1)
 * Streamlined engine for single-layer flat or painted nameplates/sliders.
 */
function calculateNameplateQuote(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = window.NAMEPLATE_CONFIG.constants?.find(x => x.key === k)?.desc || "";
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    const ret = [];
    const cst = [];
    const R = (label, total, formula) => { if(total !== 0) ret.push({label, total, unit: total/inputs.qty, formula}); return total; };
    const L = (label, total, formula) => { if(total !== 0) cst.push({label, total, formula}); return total; };

    // --- 1. RETAIL ENGINE ---
    let baseRate = parseFloat(data.Retail_Price_Mattes_116 || 0.55);
    let baseKey = 'Retail_Price_Mattes_116';
    let productName = '1/16" Front Engraved';
    let isRev = false;

    if (inputs.product === 'Rev116') {
        baseRate = parseFloat(data.Retail_Price_Ultra_116 || 0.65);
        baseKey = 'Retail_Price_Ultra_116';
        productName = '1/16" Reverse Engraved';
        isRev = true;
    } else if (inputs.product === 'Rev18') {
        baseRate = parseFloat(data.Retail_Price_Ultra_18 || 0.85);
        baseKey = 'Retail_Price_Ultra_18';
        productName = '1/8" Reverse Engraved';
        isRev = true;
    }

    // Base Print
    let rawBaseTotal = baseRate * totalSqin;
    R(`Base Plate (${productName})`, rawBaseTotal, `Qty * ${sqin.toFixed(1)} SqIn * ${V(baseKey)}`);

    // Explicit Tier Discount
    let tier1Qty = parseFloat(data.Tier_1_Qty || 10);
    if (inputs.qty >= tier1Qty) {
        let discPct = parseFloat(data.Tier_1_Disc || 0.05);
        let discAmt = rawBaseTotal * discPct;
        R(`Volume Discount (${(discPct * 100).toFixed(0)}%)`, -discAmt, `Subtotal * ${V('Tier_1_Disc')}`);
    }

    let feeSetup = parseFloat(data.Retail_Fee_Setup || 0); // Defaulting to 0 per instructions
    if (feeSetup > 0) R(`File Setup Fee`, feeSetup, V('Retail_Fee_Setup'));

    // Separate Raw Price from Minimums
    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const actualUnitPriceRaw = grandTotalRaw / inputs.qty;
    
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const isMinApplied = grandTotalRaw < minOrder;
    
    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `${V('Retail_Min_Order')} - Subtotal`);
    const grandTotal = Math.max(grandTotalRaw, minOrder);


    // --- 2. COST ENGINE ---
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateEngraver = parseFloat(data.Rate_Machine_Engraver || 10);

    let matCostKey = inputs.product === 'Rev18' ? 'Cost_Sub_ADA_Core_18' : 'Cost_Sub_ADA_Core_116';
    let matCost = inputs.product === 'Rev18' ? parseFloat(data.Cost_Sub_ADA_Core_18 || 70) : parseFloat(data.Cost_Sub_ADA_Core_116 || 50);

    L(`Rowmark Substrate`, (totalSqin * (matCost / 1152)) * wastePct, `(Total SqIn * ${V(matCostKey)} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);

    L(`Engraver Prepress`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * ${V('Rate_Operator')}`);

    let runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    L(`Engraver Run Time`, (runMins / 60) * rateEngraver, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * ${V('Rate_Machine_Engraver')}`);

    if (isRev) {
        L(`Paint Fill Material`, totalSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct, `Total SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
        let paintMins = parseFloat(data.Time_Paint_Setup || 20) + (totalSqin * parseFloat(data.Time_Paint_SqIn || 0.1));
        L(`Paint Labor (Mix & Fill)`, (paintMins / 60) * rateShop, `(${V('Time_Paint_Setup')} Mins + (SqIn * ${V('Time_Paint_SqIn')})) * ${V('Rate_Shop_Labor')}`);
    }

    if (inputs.mounting === 'Foam Tape') {
        let tapeCost = parseFloat(data.Cost_Hem_Tape || 0.08);
        L(`Mounting Tape (Foam VHB)`, (totalSqin * (tapeCost/144)) * wastePct, `(Total SqIn * ${V('Cost_Hem_Tape')} / ${C('C_144', '144')}) * ${V('Waste_Factor')}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: actualUnitPriceRaw, grandTotal: grandTotal, breakdown: ret, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.NAMEPLATE_CONFIG = {
    tab: 'PROD_Nameplates', engine: calculateNameplateQuote,
    retails: [
        { key: 'Retail_Price_Mattes_116', label: '1/16" Front ($/Sqin)' },
        { key: 'Retail_Price_Ultra_116', label: '1/16" Rev ($/Sqin)' },
        { key: 'Retail_Price_Ultra_18', label: '1/8" Rev ($/Sqin)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' },
        { key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' }
    ],
    costs: [
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Stock ($/Sht)' },
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Stock ($/Sht)' },
        { key: 'Cost_Paint_SqIn', label: 'Paint ($/SqIn)' },
        { key: 'Cost_Hem_Tape', label: 'Tape ($/Roll)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'Preflight (Mins)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load Item (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Mins/Sqin)' },
        { key: 'Time_Paint_Setup', label: 'Paint Setup (Mins)' },
        { key: 'Time_Paint_SqIn', label: 'Paint (Mins/Sqin)' },
        { key: 'Waste_Factor', label: 'Waste Factor' },
        { key: 'Factor_Risk', label: 'Risk Factor' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (Half Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet.' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' }
    ]
};
