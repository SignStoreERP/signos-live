/**
 * PURE PHYSICS ENGINE: Cut Vinyl Lettering (v2.3 - Dual Track)
 * Un-groups materials to provide specific Simulator options for 751, 951, 8500, and 8800.
 */

function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // Route Application to Specific Pricing Tier
    let baseRate = 0;
    let costVinylRaw = 0;
    let matLabel = "";

    if (inputs.material === 'Flat') {
        baseRate = parseFloat(data.Retail_Price_751 || 18);
        costVinylRaw = parseFloat(data.Cost_Vinyl_751 || 0.95);
        matLabel = "Oracal 751";
    } else if (inputs.material === 'Vehicle') {
        baseRate = parseFloat(data.Retail_Price_951 || 22);
        costVinylRaw = parseFloat(data.Cost_Vinyl_951 || 1.25);
        matLabel = "Oracal 951";
    } else if (inputs.material === 'Backlit_8500') {
        baseRate = parseFloat(data.Retail_Price_8500 || 20);
        costVinylRaw = parseFloat(data.Cost_Vinyl_8500 || 1.25);
        matLabel = "Oracal 8500";
    } else if (inputs.material === 'Backlit_8800') {
        baseRate = parseFloat(data.Retail_Price_8800 || 25);
        costVinylRaw = parseFloat(data.Cost_Vinyl_8800 || 1.60);
        matLabel = "Oracal 8800";
    }

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
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
    let retailWeed = 0;
    if (inputs.complexity === 'Complex') {
        retailWeed = totalSqFt * parseFloat(data.Retail_Weed_Complex_Add || 5.00);
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 60) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailWeed + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 45);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trWeed = inputs.complexity === 'Complex' ? (sqft * t.q * parseFloat(data.Retail_Weed_Complex_Add || 5.00)) : 0;
        const total = Math.max(trPrint + trWeed + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.20);
    const costTapeRaw = parseFloat(data.Cost_Transfer_Tape || 0.15);
    
    const costVinyl = totalSqFt * costVinylRaw * wastePct;
    const costTape = totalSqFt * costTapeRaw * wastePct;

    // Labor & Machines
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateMachCut = parseFloat(data.Rate_Machine_Cut || 5);

    // Setup
    const setupMins = parseFloat(data.Time_Setup_Job || 15);
    const costSetup = (setupMins / 60) * rateOp;

    // Plotter Cut Run
    const speedCutHr = parseFloat(data.Speed_Cut_Graphtec || 50);
    const cutHrs = totalSqFt / speedCutHr;
    const costCutMach = cutHrs * rateMachCut;
    const costCutOp = cutHrs * rateOp * 0.25; // 25% attendance

    // Weeding & Masking (Manual Shop Labor)
    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(data.Time_Weed_Complex || 10) : parseFloat(data.Time_Weed_Simple || 2);
    const weedHrs = (totalSqFt * weedSpeed) / 60;
    const costWeedOp = weedHrs * rateShop;

    const maskSpeed = parseFloat(data.Time_Mask_SqFt || 1); 
    const maskHrs = (totalSqFt * maskSpeed) / 60;
    const costMaskOp = maskHrs * rateShop;

    const subTotal = costVinyl + costTape + costSetup + costCutOp + costCutMach + costWeedOp + costMaskOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + retailWeed) / inputs.qty,
            printTotal: retailPrint,
            weedFee: retailWeed,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: simTiers,
            baseRate: baseRate,     
            matLabel: matLabel      
        },
        cost: {
            total: subTotal,
            breakdown: {
                rawVinyl: costVinyl,
                unitVinyl: costVinylRaw, 
                rawTape: costTape,
                costSetup: costSetup,
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
window.CUT_CONFIG = {
    tab: 'PROD_Cut_Vinyl',
    engine: calculateCutVinyl,
    controls: [
      { id: 'w', label: 'Width', type: 'number', def: 12 },
      { id: 'h', label: 'Height', type: 'number', def: 6 },
      { id: 'material', label: 'Application', type: 'select', opts: [{v:'Flat', t:'Flat App (751)'}, {v:'Vehicle', t:'Vehicle (951)'}, {v:'Backlit_8500', t:'Backlit Std (8500)'}, {v:'Backlit_8800', t:'Backlit Prem (8800)'}] },
      { id: 'complexity', label: 'Weeding', type: 'select', opts: [{v:'Simple', t:'Simple (Large)'}, {v:'Complex', t:'Complex (Small/Serifs)'}] },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Material Rates ($/SqFt)', key: 'Retail_Price_751', label: '751 Rate ($)' },
      { key: 'Retail_Price_951', label: '951 Rate ($)' },
      { key: 'Retail_Price_8500', label: '8500 Rate ($)' },
      { key: 'Retail_Price_8800', label: '8800 Rate ($)' },
      { heading: 'Finishing Markups', key: 'Retail_Weed_Complex_Add', label: 'Complex Weed ($/SqFt)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
      { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
      { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
      { key: 'Cost_Vinyl_751', label: '751 Cost ($/SqFt)' },
      { key: 'Cost_Vinyl_951', label: '951 Cost ($/SqFt)' },
      { key: 'Cost_Vinyl_8500', label: '8500 Cost ($/SqFt)' },
      { key: 'Cost_Vinyl_8800', label: '8800 Cost ($/SqFt)' },
      { key: 'Cost_Transfer_Tape', label: 'App Tape ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
      { key: 'Rate_Machine_Cut', label: 'Plotter Mach ($/Hr)' },
      { key: 'Speed_Cut_Graphtec', label: 'Plot Spd (SqFt/hr)' },
      { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
      { key: 'Time_Weed_Simple', label: 'Weed Simple (Mins/SqFt)' },
      { key: 'Time_Weed_Complex', label: 'Weed Complex (Mins/SqFt)' },
      { key: 'Time_Mask_SqFt', label: 'Masking (Mins/SqFt)' },
      { key: 'Waste_Factor', label: 'Waste (1.x)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Based on base material rate x sqft."><span class="cursor-help border-b border-dotted border-gray-400">Vinyl Base (${data.retail.matLabel} @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.weedFee > 0 ? `<div class="flex justify-between text-pink-700"><span>Complex Weeding Adder:</span> <span>${fmt(data.retail.weedFee)}</span></div>` : ''}
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
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400">Vinyl Material (${data.retail.matLabel} @ ${fmt(b.unitVinyl)}/sf):</span> <span>${fmt(b.rawVinyl)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Transfer Tape:</span> <span>${fmt(b.rawTape)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Plotter Run:</span> <span>${fmt(b.costCut)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Weeding Labor:</span> <span>${fmt(b.costWeed)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Masking Labor:</span> <span>${fmt(b.costMask)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
