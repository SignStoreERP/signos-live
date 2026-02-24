/**
 * PURE PHYSICS ENGINE: PVC Signs (v1.6.2)
 * Bug Fix: Corrected split array index for dimension parsing.
 */
function calculatePVC(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const reqShort = Math.min(inputs.w, inputs.h);
    const reqLong = Math.max(inputs.w, inputs.h);
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const thickStr = inputs.thickness === '6mm' ? '6' : '3';
    
    let bestFitArea = Infinity;
    let bestP1 = null, bestP10 = null, bestLabel = "";

    // Bounding Box Search
    Object.keys(data).forEach(key => {
        if (key.startsWith(`RET_PVC${thickStr}_`) && key.endsWith(`_${sideStr}_1`)) {
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
        let signMinPrice = inputs.thickness === '3mm' ? parseFloat(data.PVC3_T1_Min || 33.00) : parseFloat(data.PVC6_T1_Min || 33.00);

        if (inputs.thickness === '3mm') {
            if (sqft <= parseFloat(data.PVC3_T2_Max || 5.99)) baseSqFtRate = parseFloat(data.PVC3_T2_Rate || 13.20);
            else if (sqft <= parseFloat(data.PVC3_T3_Max || 11.99)) baseSqFtRate = parseFloat(data.PVC3_T3_Rate || 8.40);
            else baseSqFtRate = parseFloat(data.PVC3_T4_Rate || 7.80);
        } else {
            if (sqft <= parseFloat(data.PVC6_T2_Max || 5.99)) baseSqFtRate = parseFloat(data.PVC6_T2_Rate || 22.00);
            else if (sqft <= parseFloat(data.PVC6_T3_Max || 11.99)) baseSqFtRate = parseFloat(data.PVC6_T3_Rate || 14.00);
            else baseSqFtRate = parseFloat(data.PVC6_T4_Rate || 13.00);
        }

        let rawBase = baseSqFtRate * sqft;
        if (rawBase < signMinPrice) rawBase = signMinPrice;
        if (inputs.sides === 2) rawBase *= (1 + parseFloat(data.Retail_Adder_DS_Mult || 0.50));
        
        const discPct = inputs.qty >= t1Qty ? parseFloat(data.Tier_1_Disc || 0.05) : 0;
        baseUnitPrice = rawBase * (1 - discPct);

        tierLog.push(
            { q: 1, base: rawBase, unit: rawBase },
            { q: t1Qty, base: rawBase, unit: rawBase * (1 - parseFloat(data.Tier_1_Disc || 0.05)) }
        );
    }

    let retailPrint = baseUnitPrice * inputs.qty;
    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30.00);
    else if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50.00);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    
    let lamDeduction = 0;
    if (typeof inputs.lam !== 'undefined' && !inputs.lam) {
        lamDeduction = retailPrint * 0.10;
    }

    const grandTotalRaw = (retailPrint - lamDeduction) + routerFee + feeDesign;
    const minOrder = bestP1 !== null ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    tierLog.forEach(t => t.unit = (t.unit * t.q + routerFee) / t.q);

    // --- 2. COST ENGINE ---
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const rawSheetCost = inputs.thickness === '3mm' ? parseFloat(data.Cost_Stock_3mm_4x8 || 29.09) : parseFloat(data.Cost_Stock_6mm_4x8 || 58.37);

    const costSubstrate = (totalSqFt / 32) * rawSheetCost * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachFB = parseFloat(data.Rate_Machine_Flatbed || 10);

    const costPrepressPrint = (parseFloat(data.Time_Prepress_Print || 10) / 60) * rateOp;
    const costMachSetupPrint = ((parseFloat(data.Time_Setup_Printer || 5) + parseFloat(data.Time_Handling || 5)) / 60) * rateOp;
    const printHrs = ((totalSqFt / 2) / parseFloat(data.Machine_Speed_LF_Hr || 25)) * inputs.sides;
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachFB;

    let cutHrs = 0, cutMach = 0, cutLabor = 0, costPrepressCNC = 0, costMachSetupCNC = 0;
    if (inputs.shape === 'Rectangle') {
        const roundMins = inputs.rounded ? parseFloat(data.Time_Round_Setup || 5) + (inputs.qty * 4 * parseFloat(data.Time_Round_Corner || 0.5)) : 0;
        cutHrs = (parseFloat(data.Time_Shear_Setup || 5) + (inputs.qty * parseFloat(data.Time_Shear_Cut || 1)) + roundMins) / 60;
        cutLabor = cutHrs * rateShop;
    } else {
        costPrepressCNC = (parseFloat(data.Time_Prepress_CNC || 15) / 60) * rateCNC;
        costMachSetupCNC = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC;
        cutHrs = (totalSqFt * (inputs.shape === 'Easy' ? parseFloat(data.Time_CNC_Easy_SqFt || 1) : parseFloat(data.Time_CNC_Complex_SqFt || 2))) / 60;
        cutMach = cutHrs * parseFloat(data.Rate_Machine_CNC || 10);
        cutLabor = cutHrs * rateCNC * attnRatio;
    }

    const subTotal = costSubstrate + costInk + costPrepressPrint + costMachSetupPrint + costPrintOp + costPrintMach + costPrepressCNC + costMachSetupCNC + cutMach + cutLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: ((retailPrint - lamDeduction) + routerFee) / inputs.qty, printTotal: retailPrint - lamDeduction, routerFee: routerFee, designFee: feeDesign,
            grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder, tiers: tierLog, yieldLabel: bestLabel ? `Yield Box: ${bestLabel}` : "Area Curve"
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: { rawSubstrate: costSubstrate, rawInk: costInk, costPrepressPrint: costPrepressPrint, costMachSetupPrint: costMachSetupPrint, costPrintLabor: costPrintOp, costPrintMach: costPrintMach, costPrepressCNC: costPrepressCNC, costMachSetupCNC: costMachSetupCNC, costCutMach: cutMach, costCutLabor: cutLabor, riskCost: riskBuffer, wastePct: (wastePct - 1) * 100, riskPct: (riskFactor - 1) * 100 }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}
