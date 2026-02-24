/**
 * PURE PHYSICS ENGINE: Foam Core Boards (v1.3)
 * Bug Fix: Corrected split array index for dimension parsing.
 */
function calculateFoam(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const reqShort = Math.min(inputs.w, inputs.h);
    const reqLong = Math.max(inputs.w, inputs.h);
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    
    let bestFitArea = Infinity;
    let bestP1 = null, bestP10 = null, bestLabel = "";

    // Bounding Box Search
    Object.keys(data).forEach(key => {
        if (key.startsWith(`RET_FOM316_`) && key.endsWith(`_${sideStr}_1`)) {
            const dimStr = key.split('_')[2]; 
            const stdShort = parseInt(dimStr.substring(0, 2), 10);
            const stdLong = parseInt(dimStr.substring(2), 10);
            const stdArea = stdShort * stdLong;

            if (reqShort <= stdShort && reqLong <= stdLong && stdArea < bestFitArea) {
                bestFitArea = stdArea;
                bestP1 = parseFloat(data[key]);
                bestP10 = parseFloat(data[key.replace(/_1$/, '_10')]) || bestP1;
                bestLabel = `${stdShort}x${stdLong}`;
            }
        }
    });

    let baseUnitPrice = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    const tierLog = [];

    if (bestP1 !== null) {
        baseUnitPrice = inputs.qty >= t1Qty ? bestP10 : bestP1;
        tierLog.push({ q: 1, base: bestP1, unit: bestP1 }, { q: t1Qty, base: bestP10, unit: bestP10 });
    } else {
        let baseSqFtRate = 0;
        if (sqft <= parseFloat(data.FOM3_T1_Max || 3.99)) baseSqFtRate = parseFloat(data.FOM3_T1_Rate || 8.33);
        else if (sqft <= parseFloat(data.FOM3_T2_Max || 15.99)) baseSqFtRate = parseFloat(data.FOM3_T2_Rate || 8.00);
        else if (sqft <= parseFloat(data.FOM3_T3_Max || 31.99)) baseSqFtRate = parseFloat(data.FOM3_T3_Rate || 7.00);
        else baseSqFtRate = parseFloat(data.FOM3_T4_Rate || 6.00);

        let rawBase = baseSqFtRate * sqft;
        if (rawBase < parseFloat(data.FOM3_T1_Min || 25.00)) rawBase = parseFloat(data.FOM3_T1_Min || 25.00);
        if (inputs.sides === 2) rawBase *= (1 + parseFloat(data.Retail_Adder_DS_Mult || 0.50));

        const discPct = inputs.qty >= t1Qty ? parseFloat(data.Tier_1_Disc || 0.05) : 0;
        baseUnitPrice = rawBase * (1 - discPct);

        tierLog.push(
            { q: 1, base: rawBase, unit: rawBase },
            { q: t1Qty, base: rawBase, unit: rawBase * (1 - parseFloat(data.Tier_1_Disc || 0.05)) }
        );
    }

    const retailPrint = baseUnitPrice * inputs.qty;
    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const grandTotalRaw = retailPrint + feeDesign;
    const minOrder = bestP1 !== null ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const totalSqFt = sqft * inputs.qty;
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const costSubstrate = (totalSqFt / 32) * parseFloat(data.Cost_Stock_316_4x8 || 13.86) * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const costPrepressPrint = (parseFloat(data.Time_Prepress_Print || 10) / 60) * rateOp;
    const costMachSetupPrint = ((parseFloat(data.Time_Setup_Printer || 5) + parseFloat(data.Time_Handling || 5)) / 60) * rateOp;

    const printHrs = ((totalSqFt / 2) / parseFloat(data.Machine_Speed_LF_Hr || 25)) * inputs.sides;
    const costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Flatbed || 10);

    const costCutLabor = ((parseFloat(data.Time_Shear_Setup || 5) + (inputs.qty * parseFloat(data.Time_Shear_Cut || 1))) / 60) * parseFloat(data.Rate_Shop_Labor || 20);

    const subTotal = costSubstrate + costInk + costPrepressPrint + costMachSetupPrint + costPrintOp + costPrintMach + costCutLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: retailPrint / inputs.qty, printTotal: retailPrint, designFee: feeDesign, grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder, tiers: tierLog, yieldLabel: bestLabel ? `Yield Box: ${bestLabel}` : "Area Curve" },
        cost: { total: subTotal * riskFactor, breakdown: { rawSubstrate: costSubstrate, rawInk: costInk, costPrepressPrint: costPrepressPrint, costMachSetupPrint: costMachSetupPrint, costPrintLabor: costPrintOp, costPrintMach: costPrintMach, costCutLabor: costCutLabor, riskCost: subTotal * (riskFactor - 1), wastePct: (wastePct - 1) * 100, riskPct: (riskFactor - 1) * 100 } },
        metrics: { margin: (grandTotal - (subTotal * riskFactor)) / grandTotal }
    };
}
