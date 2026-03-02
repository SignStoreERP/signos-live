/**
 * PURE PHYSICS ENGINE: Decals & Stickers (v2.1 - Dual Track)
 * Implements Arlon 3210 premium laminate fixes, Roll Physics, and Pre-Mask Logic.
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const perimeterLF = ((inputs.w + inputs.h) * 2 / 12) * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;
    if (inputs.material === 'Cast') baseRate = parseFloat(data.Retail_Price_Cast_SqFt) || 14.00;
    else if (inputs.material === 'Clear') baseRate = parseFloat(data.Retail_Price_Clear_SqFt) || 10.00;
    else if (inputs.material === 'Translucent') baseRate = parseFloat(data.Retail_Price_Trans_SqFt) || 10.00;
    else if (inputs.material === 'Reflective') baseRate = parseFloat(data.Retail_Price_Reflective_SqFt) || 15.00;
    else if (inputs.material === 'Drywall') baseRate = parseFloat(data.Retail_Price_Wall_Smooth_SqFt) || 10.00;
    else if (inputs.material === 'Textured') baseRate = parseFloat(data.Retail_Price_Wall_Text_SqFt) || 15.00;
    else if (inputs.material === 'Perf') baseRate = parseFloat(data.Retail_Price_Perf_SqFt) || 12.00;
    else baseRate = parseFloat(data.Retail_Price_Cal_SqFt) || 8.00; // Standard fallback

    let unitPrint = baseRate * sqft;
    let retailPrint = unitPrint * inputs.qty;

    let discPct = 0;
    let currentBestTier = 0;
    let i = 1;
    const tierLog = [];

    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc });
        if (inputs.qty >= tQty) currentBestTier = tDisc;
        i++;
    }

    discPct = currentBestTier;
    retailPrint *= (1 - discPct);

    let retailContour = 0;
    let retailWeed = 0;
    let retailMask = 0;

    if (inputs.shape !== 'Rectangle' && inputs.shape !== 'Square') {
        retailContour = retailPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25);
        if (inputs.weeding === 'Complex' || inputs.shape === 'Contour Complex') {
            retailWeed = totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.50);
        }
    }

    if (inputs.masking === 'Yes' || inputs.mask) {
        retailMask = totalSqFt * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00); 
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailContour + retailWeed + retailMask + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trContour = (inputs.shape !== 'Rectangle' && inputs.shape !== 'Square') ? (trPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25)) : 0;
        const trWeed = (inputs.weeding === 'Complex' || inputs.shape === 'Contour Complex') ? (sqft * t.q * parseFloat(data.Retail_Weed_Complex || 2.50)) : 0;
        const trMask = (inputs.masking === 'Yes' || inputs.mask) ? (sqft * t.q * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00)) : 0;
        const total = Math.max(trPrint + trContour + trWeed + trMask + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.20);
    let costVinylRaw = 0;
    let costLamRaw = 0;

    // THE FIX: Laminate Routing Matrix based on production documentation
    if (inputs.material === 'Cast') {
        costVinylRaw = parseFloat(data.Cost_Vin_Cast || 1.30); // 3M IJ180
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Cast || 0.96) : 0; // 3M 8518
    } else if (inputs.material === 'Clear') {
        costVinylRaw = parseFloat(data.Cost_Vin_Clear || 0.24); // Oracal 3640
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Premium || 0.67) : 0; // Arlon 3210
    } else if (inputs.material === 'Translucent') {
        costVinylRaw = parseFloat(data.Cost_Vin_Trans || 1.00); // Oracal 3850
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Premium || 0.67) : 0; // Arlon 3210
    } else if (inputs.material === 'Reflective') {
        costVinylRaw = parseFloat(data.Cost_Vin_Reflective || 2.00); // Oralite 5400
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Premium || 0.67) : 0; // Arlon 3210
    } else if (inputs.material === 'Drywall') {
        costVinylRaw = parseFloat(data.Cost_Vin_Wall || 0.59); // GF 226
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Premium || 0.67) : 0; // Arlon 3210 Premium
    } else if (inputs.material === 'Textured') {
        costVinylRaw = parseFloat(data.Cost_Vin_Wall_Textured || 1.14); // 3M IJ8624
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Textured || 1.16) : 0; // 3M 8524
    } else if (inputs.material === 'Perf') {
        costVinylRaw = parseFloat(data.Cost_Vinyl_Perf || 0.65); // Window Perf
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Perf || 0.25) : 0; // Optically Clear
    } else {
        // Standard Material
        costVinylRaw = parseFloat(data.Cost_Vin_Cal || 0.21); // Arlon 4500GLX / Oracal 3641
        costLamRaw = inputs.lam ? parseFloat(data.Cost_Lam_Premium || 0.67) : 0; // The fix: Arlon 3210
    }

    const costVinyl = totalSqFt * costVinylRaw * wastePct;
    const costLam = totalSqFt * costLamRaw * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateMachPrint = parseFloat(data.Rate_Machine_Print || 5);
    const rateMachCut = parseFloat(data.Rate_Machine_Cut || 5);

    const setupMins = parseFloat(data.Time_Setup_Job || 15);
    const costSetup = (setupMins / 60) * rateOp;

    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalSqFt / speedPrint;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    let lamHrs = 0, costLamOp = 0;
    if (inputs.lam) {
        const speedLam = parseFloat(data.Speed_Lam_Roll || 300);
        lamHrs = totalSqFt / speedLam;
        costLamOp = lamHrs * rateShop; // 100% attendance required to feed roll
    }

    let cutHrs = 0, costCutOp = 0, costCutMach = 0;
    let weedHrs = 0, costWeedOp = 0;

    if (inputs.shape === 'Square' || inputs.shape === 'Rectangle') {
        const timeHandMins = perimeterLF * parseFloat(data.Time_Cut_Hand || 0.25);
        cutHrs = timeHandMins / 60;
        costCutOp = cutHrs * rateShop;
    } else {
        const speedCutHr = parseFloat(data.Speed_Cut_Graphtec || 50);
        cutHrs = totalSqFt / speedCutHr;
        costCutMach = cutHrs * rateMachCut;
        costCutOp = cutHrs * rateOp * 0.25;

        const weedSpeed = (inputs.weeding === 'Complex' || inputs.shape === 'Contour Complex') ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
        weedHrs = (totalSqFt * weedSpeed) / 60;
        costWeedOp = weedHrs * rateShop;
    }

    let costTape = 0, costMaskOp = 0;
    if (inputs.mask || inputs.masking === 'Yes') {
        costTape = totalSqFt * parseFloat(data.Cost_Transfer_Tape || 0.15) * wastePct;
        const maskSpeed = parseFloat(data.Time_Mask_SqFt || 1);
        const maskHrs = (totalSqFt * maskSpeed) / 60;
        costMaskOp = maskHrs * rateShop;
    }

    const subTotal = costVinyl + costLam + costInk + costSetup + costPrintOp + costPrintMach + costLamOp + costCutOp + costCutMach + costWeedOp + costTape + costMaskOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + retailContour + retailWeed + retailMask) / inputs.qty,
            printTotal: retailPrint,
            contourFee: retailContour,
            weedFee: retailWeed,
            maskFee: retailMask,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: simTiers,
            baseRate: baseRate
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: {
                rawVinyl: costVinyl,
                unitVinyl: costVinylRaw,
                rawLam: costLam,
                unitLam: costLamRaw,
                rawTape: costTape,
                totalInk: costInk,
                costSetup: costSetup,
                costPrint: costPrintOp + costPrintMach,
                costLamRun: costLamOp,
                costCut: costCutOp + costCutMach,
                costWeed: costWeedOp,
                costMask: costMaskOp,
                riskCost: riskBuffer,
                wastePct: (wastePct - 1) * 100,
                riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.DECAL_CONFIG = {
    tab: 'PROD_Decals',
    engine: calculateDecal,
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 4 },
        { id: 'h', label: 'Height', type: 'number', def: 4 },
        { id: 'material', label: 'Material', type: 'select', opts: [
            {v:'Standard', t:'General Purpose'},
            {v:'Cast', t:'Vehicle Wrap (Cast)'},
            {v:'Clear', t:'Clear'},
            {v:'Translucent', t:'Translucent'},
            {v:'Reflective', t:'Reflective'},
            {v:'Drywall', t:'Drywall (Smooth)'},
            {v:'Textured', t:'Textured Wall'},
            {v:'Perf', t:'Window Perf'}
        ] },
        { id: 'lam', label: 'Laminate', type: 'toggle', def: true },
        { id: 'shape', label: 'Cut Method', type: 'select', opts: [{v:'Square', t:'Square / Hand Cut'}, {v:'Contour Simple', t:'Kiss Cut (Simple)'}, {v:'Contour Complex', t:'Kiss Cut (Complex)'}] },
        { id: 'mask', label: 'Apply Pre-Mask', type: 'toggle', def: false },
        { id: 'files', label: 'Files', type: 'number', def: 1 },
        { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
        { heading: 'Material Tiers ($/SqFt)', key: 'Retail_Price_Cal_SqFt', label: 'Standard Rate ($)' },
        { key: 'Retail_Price_Cast_SqFt', label: 'Cast Rate ($)' },
        { key: 'Retail_Price_Clear_SqFt', label: 'Clear Rate ($)' },
        { key: 'Retail_Price_Trans_SqFt', label: 'Translucent Rate ($)' },
        { key: 'Retail_Price_Reflective_SqFt', label: 'Reflective Rate ($)' },
        { key: 'Retail_Price_Wall_Smooth_SqFt', label: 'Drywall Rate ($)' },
        { key: 'Retail_Price_Wall_Text_SqFt', label: 'Textured Rate ($)' },
        { key: 'Retail_Price_Perf_SqFt', label: 'Window Perf Rate ($)' },
        { heading: 'Finishing Markups', key: 'Retail_Cut_Contour_Add', label: 'Contour Markup (1.x)' },
        { key: 'Retail_Weed_Complex', label: 'Complex Weed ($/SqFt)' },
        { key: 'Retail_Adder_Mask_SqFt', label: 'Pre-Mask Adder ($/SqFt)' },
        { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
        { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
        { heading: 'Materials', key: 'Cost_Vin_Cal', label: 'Standard Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Premium', label: 'Arlon 3210 Lam ($/SqFt)' },
        { key: 'Cost_Vin_Cast', label: 'IJ180 Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Cast', label: '3M 8518 ($/SqFt)' },
        { key: 'Cost_Vin_Clear', label: 'Clear Vinyl ($/SqFt)' },
        { key: 'Cost_Vin_Trans', label: 'Translucent ($/SqFt)' },
        { key: 'Cost_Vin_Reflective', label: 'Reflective ($/SqFt)' },
        { key: 'Cost_Vin_Wall', label: 'GF226 Vinyl ($/SqFt)' },
        { key: 'Cost_Vin_Wall_Textured', label: 'IJ8624 Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Textured', label: '8524 Lam ($/SqFt)' },
        { key: 'Cost_Vinyl_Perf', label: 'Window Perf ($/SqFt)' },
        { key: 'Cost_Lam_Perf', label: 'Optic Clear Lam ($/SqFt)' },
        { key: 'Cost_Transfer_Tape', label: 'App Tape ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { heading: 'Production', key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Printer Mach ($/Hr)' },
        { key: 'Rate_Machine_Cut', label: 'Plotter Mach ($/Hr)' },
        { key: 'Speed_Print_Roll', label: 'Print Spd (SqFt/hr)' },
        { key: 'Speed_Lam_Roll', label: 'Lam Spd (SqFt/hr)' },
        { key: 'Speed_Cut_Graphtec', label: 'Plot Spd (SqFt/hr)' },
        { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
        { key: 'Time_Cut_Hand', label: 'Hand Cut (Mins/LF)' },
        { key: 'Time_Weed_Simple', label: 'Weed Simple (Mins/SqFt)' },
        { key: 'Time_Weed_Complex', label: 'Weed Complex (Mins/SqFt)' },
        { key: 'Time_Mask_SqFt', label: 'Masking (Mins/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste (1.x)' },
        { key: 'Factor_Risk', label: 'Risk (1.x)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    renderReceipt: function(data, fmt) {
        let retailHTML = `
        <div>
            <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
            <div class="space-y-1 text-xs text-gray-700">
                <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
                ${data.retail.contourFee > 0 ? `<div class="flex justify-between text-orange-700"><span>Contour Cut Adder:</span> <span>${fmt(data.retail.contourFee)}</span></div>` : ''}
                ${data.retail.weedFee > 0 ? `<div class="flex justify-between text-pink-700"><span>Complex Weeding Adder:</span> <span>${fmt(data.retail.weedFee)}</span></div>` : ''}
                ${data.retail.maskFee > 0 ? `<div class="flex justify-between text-teal-700"><span>Pre-Mask Adder:</span> <span>${fmt(data.retail.maskFee)}</span></div>` : ''}
                <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
                ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
                <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
            </div>
        </div>
        `;

        let costHTML = `
        <div class="mt-6">
            <h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
            <div class="space-y-1 text-xs text-gray-700">`;

        if (data.cost.breakdown) {
            const b = data.cost.breakdown;
            costHTML += `
                <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Vinyl Material (@ ${fmt(b.unitVinyl)}/sf):</span> <span>${fmt(b.rawVinyl)}</span></div>
                ${b.rawLam > 0 ? `<div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Laminate Material (@ ${fmt(b.unitLam)}/sf):</span> <span>${fmt(b.rawLam)}</span></div>` : ''}
                ${b.rawTape > 0 ? `<div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Transfer Tape:</span> <span>${fmt(b.rawTape)}</span></div>` : ''}
                <div class="flex justify-between"><span>Ink:</span> <span>${fmt(b.totalInk)}</span></div>
                <div class="flex justify-between"><span>Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
                <div class="flex justify-between"><span>Print Run:</span> <span>${fmt(b.costPrint)}</span></div>
                ${b.costLamRun > 0 ? `<div class="flex justify-between"><span>Laminating Labor:</span> <span>${fmt(b.costLamRun)}</span></div>` : ''}
                <div class="flex justify-between"><span>Cutting Run:</span> <span>${fmt(b.costCut)}</span></div>
                ${b.costWeed > 0 ? `<div class="flex justify-between"><span>Weeding Labor:</span> <span>${fmt(b.costWeed)}</span></div>` : ''}
                ${b.costMask > 0 ? `<div class="flex justify-between"><span>Masking Labor:</span> <span>${fmt(b.costMask)}</span></div>` : ''}
                
                <div class="border-t border-gray-200 mt-2 pt-1"></div>
                <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
                <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>(Included Above)</span></div>
                <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
            `;
        }

        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};
