/**
 * PURE PHYSICS ENGINE: Decals & Stickers (v2.0 - Dual Track)
 * Implements 3-Stage Roll Physics, Contour Weeding, and Pre-Mask Logic.
 */

function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const perimeterLF = ((inputs.w + inputs.h) * 2 / 12) * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const baseRate = inputs.material === 'Cast' 
        ? parseFloat(data.Retail_Price_Cast_SqFt || 14) 
        : parseFloat(data.Retail_Price_Cal_SqFt || 8);

    // Volume Tiers
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

    let retailPrint = (baseRate * (1 - discPct)) * totalSqFt;

    // Finishing Adders
    let retailContour = 0;
    let retailWeed = 0;
    let retailMask = 0;
    
    if (inputs.shape !== 'Square') {
        retailContour = retailPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25);
        if (inputs.shape === 'Contour Complex') {
            retailWeed = totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.50);
        }
    }
    
    if (inputs.mask) {
        retailMask = totalSqFt * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00); // Standard $1/sqft retail adder for tape
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailContour + retailWeed + retailMask + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trContour = inputs.shape !== 'Square' ? (trPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25)) : 0;
        const trWeed = inputs.shape === 'Contour Complex' ? (sqft * t.q * parseFloat(data.Retail_Weed_Complex || 2.50)) : 0;
        const trMask = inputs.mask ? (sqft * t.q * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00)) : 0;
        const total = Math.max(trPrint + trContour + trWeed + trMask + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.20);

    // Material Costs
    const costVinylRaw = inputs.material === 'Cast' ? parseFloat(data.Cost_Vin_Cast || 1.30) : parseFloat(data.Cost_Vin_Cal || 0.21);
    const costLamRaw = inputs.lam ? (inputs.material === 'Cast' ? parseFloat(data.Cost_Lam_Cast || 0.96) : parseFloat(data.Cost_Lam_Cal || 0.36)) : 0;
    
    const costVinyl = totalSqFt * costVinylRaw * wastePct;
    const costLam = totalSqFt * costLamRaw * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);

    // Labor & Machines
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateMachPrint = parseFloat(data.Rate_Machine_Print || 5);
    const rateMachCut = parseFloat(data.Rate_Machine_Cut || 5);

    // Setup
    const setupMins = parseFloat(data.Time_Setup_Job || 15);
    const costSetup = (setupMins / 60) * rateOp;

    // Stage 1: Print
    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalSqFt / speedPrint;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    // Stage 2: Laminate
    let lamHrs = 0;
    let costLamOp = 0;
    if (inputs.lam) {
        const speedLam = parseFloat(data.Speed_Lam_Roll || 300);
        lamHrs = totalSqFt / speedLam;
        costLamOp = lamHrs * rateShop; // 100% attendance required to feed roll
    }

    // Stage 3: Cut & Weed
    let cutHrs = 0, costCutOp = 0, costCutMach = 0;
    let weedHrs = 0, costWeedOp = 0;

    if (inputs.shape === 'Square') {
        const timeHandMins = perimeterLF * parseFloat(data.Time_Cut_Hand || 0.25);
        cutHrs = timeHandMins / 60;
        costCutOp = cutHrs * rateShop;
    } else {
        const speedCutHr = parseFloat(data.Speed_Cut_Graphtec || 50);
        cutHrs = totalSqFt / speedCutHr;
        costCutMach = cutHrs * rateMachCut;
        costCutOp = cutHrs * rateOp * 0.25; 

        const weedSpeed = inputs.shape === 'Contour Complex' ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
        weedHrs = (totalSqFt * weedSpeed) / 60;
        costWeedOp = weedHrs * rateShop;
    }
    
    // Stage 4: Masking (App Tape)
    let costTape = 0, costMaskOp = 0;
    if (inputs.mask) {
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
            tiers: simTiers
        },
        cost: {
            total: subTotal,
            breakdown: {
                rawVinyl: costVinyl,
                rawLam: costLam,
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
        metrics: { margin: (grandTotal - subTotal) / grandTotal }
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
      { id: 'material', label: 'Material', type: 'select', opts: [{v:'Cal', t:'Standard (Cal)'}, {v:'Cast', t:'Premium (Cast)'}] },
      { id: 'lam', label: 'Laminate', type: 'toggle', def: true },
      { id: 'shape', label: 'Cut Method', type: 'select', opts: [{v:'Square', t:'Square / Hand Cut'}, {v:'Contour Simple', t:'Kiss Cut (Simple)'}, {v:'Contour Complex', t:'Kiss Cut (Complex)'}] },
      { id: 'mask', label: 'Apply Pre-Mask', type: 'toggle', def: false },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Material Tiers ($/SqFt)', key: 'Retail_Price_Cal_SqFt', label: 'Calendered Rate ($)' },
      { key: 'Retail_Price_Cast_SqFt', label: 'Cast Rate ($)' },
      { heading: 'Finishing Markups', key: 'Retail_Cut_Contour_Add', label: 'Contour Markup (%)' },
      { key: 'Retail_Weed_Complex', label: 'Complex Weed ($/SqFt)' },
      { key: 'Retail_Adder_Mask_SqFt', label: 'Pre-Mask Adder ($/SqFt)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
      { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
      { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
      { key: 'Cost_Vin_Cal', label: 'IJ35C Vinyl ($/SqFt)' },
      { key: 'Cost_Lam_Cal', label: 'Oraguard 210 ($/SqFt)' },
      { key: 'Cost_Vin_Cast', label: 'IJ180 Vinyl ($/SqFt)' },
      { key: 'Cost_Lam_Cast', label: '3M 8518 ($/SqFt)' },
      { key: 'Cost_Transfer_Tape', label: 'App Tape ($/SqFt)' },
      { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
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
        <div>
          <h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
          <div class="space-y-1 text-xs text-gray-700">`;
      if (data.cost.breakdown) {
        const b = data.cost.breakdown;
        costHTML += `
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Vinyl Material:</span> <span>${fmt(b.rawVinyl)}</span></div>
            ${b.rawLam > 0 ? `<div class="flex justify-between"><span>Laminate Material:</span> <span>${fmt(b.rawLam)}</span></div>` : ''}
            ${b.rawTape > 0 ? `<div class="flex justify-between"><span>Transfer Tape:</span> <span>${fmt(b.rawTape)}</span></div>` : ''}
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
