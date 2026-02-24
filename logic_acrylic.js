/**
 * PURE PHYSICS ENGINE: Acrylic Signs (v5.3 - Dual Track)
 * Fixed Fraction/Decimal routing, unified return variables, and robust Cost BOM.
 */

function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // Harmonize UI fractions to decimals
    let thk = inputs.thickness;
    if (thk === '1/4') thk = '0.25';
    if (thk === '1/2') thk = '0.5';
    if (thk === '3/4') thk = '0.75';
    if (thk === '1') thk = '1';

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;

    if (thk === '0.25') {
        if (totalSqFt <= parseFloat(data.ACR_14_T1_Max || 10)) baseRate = parseFloat(data.ACR_14_T1_Rate || 40);
        else if (totalSqFt <= parseFloat(data.ACR_14_T2_Max || 20)) baseRate = parseFloat(data.ACR_14_T2_Rate || 35);
        else baseRate = parseFloat(data.ACR_14_T3_Rate || 30);
    } else if (thk === '0.5') {
        if (totalSqFt <= parseFloat(data.ACR_12_T1_Max || 10)) baseRate = parseFloat(data.ACR_12_T1_Rate || 45);
        else baseRate = parseFloat(data.ACR_12_T2_Rate || 40);
    } else if (thk === '0.75') {
        if (totalSqFt <= parseFloat(data.ACR_34_T1_Max || 10)) baseRate = parseFloat(data.ACR_34_T1_Rate || 55);
        else baseRate = parseFloat(data.ACR_34_T2_Rate || 50);
    } else {
        if (totalSqFt <= parseFloat(data.ACR_1IN_T1_Max || 10)) baseRate = parseFloat(data.ACR_1IN_T1_Rate || 60);
        else baseRate = parseFloat(data.ACR_1IN_T2_Rate || 55);
    }

    // Adders
    if (inputs.method === 'direct_white') baseRate += parseFloat(data.Retail_Adder_2ndSurf || 5);
    if (inputs.method === 'direct_3layer') baseRate += parseFloat(data.Retail_Adder_Blockout || 8);

    // Apply Volume Discounts via Tier System
    let discPct = 0;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc });
        if (inputs.qty >= tQty) discPct = tDisc;
        i++;
    }

    const retailPrint = (baseRate * (1 - discPct)) * totalSqFt;

    let paintFee = 0;
    if (inputs.paint) paintFee = parseFloat(data.Retail_Fee_Paint_Setup || 65) + (totalSqFt * parseFloat(data.Retail_Adder_Paint_SqFt || 20));

    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    else if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    let hwFee = 0;
    if (inputs.standoffs) hwFee = (inputs.standoffQty || 4) * parseFloat(data.Retail_Price_Standoff || 8) * inputs.qty;

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * (inputs.files||1)) : feeSetupBase;

    const grandTotalRaw = retailPrint + paintFee + routerFee + hwFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // Format UI Tiers for Simulator & Receipt
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * totalSqFt;
        const total = Math.max(trPrint + paintFee + routerFee + hwFee + feeDesign + feeSetup, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const sheetSqFt = 32;
    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    const riskFactor = parseFloat(data.Factor_Risk || 1.10);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);

    // Substrate Cost
    let costSubstrate = 0;
    if (thk === '0.25') {
        costSubstrate = inputs.color === 'White' ? parseFloat(data.Cost_Stock_14_4x8_W || 133.27) : parseFloat(data.Cost_Stock_14_4x8_C || 120.55);
    } else if (thk === '0.5') {
        costSubstrate = inputs.color === 'White' ? parseFloat(data.Cost_Stock_12_4x8_W || 294.24) : parseFloat(data.Cost_Stock_12_4x8_C || 277.01);
    } else if (thk === '0.75') {
        costSubstrate = inputs.color === 'White' ? parseFloat(data.Cost_Stock_34_4x8_W || 424.69) : parseFloat(data.Cost_Stock_34_4x8_C || 424.17);
    } else {
        costSubstrate = inputs.color === 'White' ? parseFloat(data.Cost_Stock_1IN_4x8_W || 541.76) : parseFloat(data.Cost_Stock_1IN_4x8_C || 496.71);
    }
    
    const sheetsNeeded = Math.ceil(totalSqFt / sheetSqFt);
    const rawBlanks = sheetsNeeded * costSubstrate;
    const wasteCost = rawBlanks * (wastePct - 1);

    // Ink Cost
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);
    const totalInk = totalSqFt * inkCost * wastePct;

    // Labor Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachFlatbed = parseFloat(data.Rate_Machine_Flatbed || 10);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);

    const costPrepressPrint = (parseFloat(data.Time_Prepress_Print || 10) / 60) * rateOp;
    const costMachSetupPrint = (parseFloat(data.Time_Setup_Printer || 5) / 60) * rateOp;

    let runHrs = 0;
    if (inputs.method === 'direct_white') runHrs = totalSqFt / parseFloat(data.Speed_Print_White || 6);
    else if (inputs.method === 'direct_3layer') runHrs = totalSqFt / parseFloat(data.Speed_Print_3Layer || 3.1);
    else runHrs = totalSqFt / parseFloat(data.Speed_Print_1st || 18);

    const costPrintMach = runHrs * rateMachFlatbed;
    const costPrintLabor = runHrs * rateOp * attnRatio;

    // Routing & Finishing
    let costPrepressCNC = 0;
    let costMachSetupCNC = 0;
    let costCutMach = 0;
    let costCutLabor = 0;

    if (inputs.shape !== 'Rectangle') {
        costPrepressCNC = (parseFloat(data.Time_Prepress_CNC || 15) / 60) * rateCNC;
        costMachSetupCNC = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC;
        const cutMinsPerSqFt = inputs.shape === 'Easy' ? parseFloat(data.Time_CNC_Easy_SqFt || 1) : parseFloat(data.Time_CNC_Complex_SqFt || 2);
        const cutHrs = (totalSqFt * cutMinsPerSqFt) / 60;
        costCutMach = cutHrs * rateMachCNC;
        costCutLabor = cutHrs * rateCNC * attnRatio;
    } else {
        const cutHrs = (totalSqFt * 0.5) / 60; // 30 sec per sqft shear equivalent
        costCutLabor = cutHrs * rateOp;
    }

    let hwCost = 0;
    if (inputs.standoffs) hwCost = (inputs.standoffQty || 4) * inputs.qty * parseFloat(data.Cost_Standoff || 2.54);

    const rawSubTotal = rawBlanks + wasteCost + totalInk + costPrepressPrint + costMachSetupPrint + costPrintMach + costPrintLabor + costPrepressCNC + costMachSetupCNC + costCutMach + costCutLabor + hwCost;
    const riskCost = rawSubTotal * (riskFactor - 1);
    const totalCost = rawSubTotal + riskCost;

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            paintTotal: paintFee,
            hwTotal: hwFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            baseRate: baseRate,
            tiers: simTiers
        },
        cost: {
            total: totalCost,
            breakdown: {
                rawSubstrate: rawBlanks,
                rawInk: totalInk,
                costPrepressPrint: costPrepressPrint,
                costMachSetupPrint: costMachSetupPrint,
                costPrintMach: costPrintMach,
                costPrintLabor: costPrintLabor,
                costPrepressCNC: costPrepressCNC,
                costMachSetupCNC: costMachSetupCNC,
                costCutMach: costCutMach,
                costCutLabor: costCutLabor,
                costHardware: hwCost,
                wasteCost: wasteCost,
                wastePct: (wastePct - 1) * 100,
                riskCost: riskCost,
                riskPct: (riskFactor - 1) * 100
            }
        }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.ACRYLIC_CONFIG = {
    tab: 'PROD_Acrylic_Signs',
    engine: calculateAcrylic,
    controls: [
        { id: 'w', label: 'Width (in)', type: 'number', def: 24 },
        { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'0.25', t:'1/4"'}, {v:'0.5', t:'1/2"'}, {v:'0.75', t:'3/4"'}, {v:'1', t:'1"'}] },
        { id: 'color', label: 'Acrylic Color', type: 'select', opts: [{v:'Clear', t:'Clear'}, {v:'White', t:'White'}, {v:'Black', t:'Black'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'Easy', t:'CNC Simple'}, {v:'Complex', t:'CNC Complex'}] },
        { id: 'method', label: 'Print Method', type: 'select', opts: [{v:'standard', t:'First Surface'}, {v:'direct_white', t:'Second Surface (Reverse)'}] },
        { id: 'standoffs', label: 'Drill Holes/Hardware', type: 'toggle', def: false },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    dynamicUI: function(inputs) {
        if (inputs.thickness !== '0.25' && inputs.color === 'Black') inputs.color = 'White';
        return inputs;
    },
    retails: [
        { heading: '1/4" Area Curves', key: 'ACR_14_T1_Max', label: 'T1 Max SqFt', tooltip: 'FORMAT: 10' },
        { key: 'ACR_14_T1_Rate', label: 'T1 ($/sf)', tooltip: 'FORMAT: 40' },
        { key: 'ACR_14_T2_Max', label: 'T2 Max SqFt' },
        { key: 'ACR_14_T2_Rate', label: 'T2 ($/sf)' },
        { key: 'ACR_14_T3_Rate', label: 'T3 (>20sf)' },
        { heading: 'Multipliers & Adders', key: 'Retail_Adder_2ndSurf', label: 'Wht Ink Add ($/sf)' },
        { key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee' },
        { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee' },
        { key: 'Retail_Price_Standoff', label: 'Standoff ($/ea)' }
    ],
    costs: [
        { heading: 'Acrylic Materials', key: 'Cost_Stock_14_4x8_C', label: '1/4" Clear ($)' },
        { key: 'Cost_Stock_14_4x8_W', label: '1/4" White ($)' },
        { key: 'Cost_Stock_12_4x8_C', label: '1/2" Clear ($)' },
        { key: 'Cost_Stock_12_4x8_W', label: '1/2" White ($)' },
        { key: 'Cost_Stock_34_4x8_C', label: '3/4" Clear ($)' },
        { key: 'Cost_Stock_34_4x8_W', label: '3/4" White ($)' },
        { key: 'Cost_Stock_1IN_4x8_C', label: '1" Clear ($)' },
        { key: 'Cost_Stock_1IN_4x8_W', label: '1" White ($)' },
        { heading: 'Machine Speeds', key: 'Speed_Print_1st', label: '1-Layer FB (LF/hr)' },
        { key: 'Speed_Print_White', label: '2-Layer FB (LF/hr)' },
        { heading: 'Labor Rates ($/Hr)', key: 'Rate_Operator', label: 'Print Op' },
        { key: 'Rate_CNC_Labor', label: 'CNC Op' },
        { heading: 'Labor & Setup (Mins)', key: 'Time_Prepress_Print', label: 'Print Prepress' },
        { key: 'Time_Setup_Printer', label: 'Machine Load' },
        { key: 'Time_Prepress_CNC', label: 'CNC Prepress' },
        { key: 'Time_Setup_CNC', label: 'CNC Setup' },
        { heading: 'Overhead & Factors', key: 'Rate_Machine_Flatbed', label: 'Flatbed ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'Router ($/Hr)' },
        { key: 'Labor_Attendance_Ratio', label: 'Operator Attn (%)' },
        { key: 'Waste_Factor', label: 'Waste Buffer' }
    ],

    renderReceipt: function(data, fmt) {
        let retailHTML = `
            <div>
                <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
                <div class="space-y-1 text-xs text-gray-700">
                    <div class="flex justify-between" title="Based on Area Curves + Layer Adders."><span class="cursor-help border-b border-dotted border-gray-400">Acrylic Base (Calculated @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
                    ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-700"><span>CNC Routing Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
                    ${data.retail.hwTotal > 0 ? `<div class="flex justify-between text-blue-600"><span>Hardware/Holes:</span> <span>${fmt(data.retail.hwTotal)}</span></div>` : ''}
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
                    <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Acrylic Substrate:</span> <span>${fmt(b.rawSubstrate)}</span></div>
                    <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Ink Cost:</span> <span>${fmt(b.rawInk)}</span></div>
                    <div class="flex justify-between mt-1"><span class="border-b border-dotted border-gray-400">Print Prepress & Setup:</span> <span>${fmt(b.costPrepressPrint + b.costMachSetupPrint)}</span></div>
                    <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Flatbed Print Run:</span> <span>${fmt(b.costPrintMach + b.costPrintLabor)}</span></div>
                    ${b.costPrepressCNC > 0 ? `<div class="flex justify-between text-orange-800 mt-1"><span class="border-b border-dotted border-orange-300">CNC Toolpaths & Setup:</span> <span>${fmt(b.costPrepressCNC + b.costMachSetupCNC)}</span></div>` : ''}
                    <div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">Cutting Run:</span> <span>${fmt(b.costCutMach + b.costCutLabor)}</span></div>
                    ${b.costHardware > 0 ? `<div class="flex justify-between text-blue-600 mt-1"><span class="border-b border-dotted border-blue-300">Hardware Stock:</span> <span>${fmt(b.costHardware)}</span></div>` : ''}
                    <div class="border-t border-gray-200 mt-2 pt-1"></div>
                    <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 25}%):</span> <span>+ ${fmt(b.wasteCost)}</span></div>
                    <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 10}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
            `;
        }
        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};
