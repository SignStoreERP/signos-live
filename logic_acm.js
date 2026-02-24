/**
 * PURE PHYSICS ENGINE: ACM Signs (v3.5)
 * Bug Fix: Corrected split array index for dimension parsing.
 */
function calculateACM(inputs, data) {
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
        if (key.startsWith(`RET_ACM${thickStr}_`) && key.endsWith(`_${sideStr}_1`)) {
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
        let baseSqFtRate = inputs.thickness === '6mm' ? 16.50 : 14.00;
        let signMinPrice = 0;
        let t = 1;
        const prefix = `ACM${thickStr}`;

        while (data[`${prefix}_T${t}_Max`]) {
            if (sqft <= parseFloat(data[`${prefix}_T${t}_Max`])) {
                baseSqFtRate = parseFloat(data[`${prefix}_T${t}_Rate`]);
                signMinPrice = parseFloat(data[`${prefix}_T${t}_Min`] || 0);
                break;
            }
            t++;
        }

        let rawBase = baseSqFtRate * sqft;
        if (rawBase < signMinPrice) rawBase = signMinPrice;
        if (inputs.sides === 2) rawBase += (rawBase * parseFloat(data.Retail_Adder_DS_Mult || 0.5));
        
        const discPct = inputs.qty >= t1Qty ? parseFloat(data.Tier_1_Disc || 0.05) : 0;
        baseUnitPrice = rawBase * (1 - discPct);

        tierLog.push(
            { q: 1, base: rawBase, unit: rawBase },
            { q: t1Qty, base: rawBase, unit: rawBase * (1 - parseFloat(data.Tier_1_Disc || 0.05)) }
        );
    }

    if (inputs.color === 'Black' && inputs.thickness === '6mm') {
        const blkMult = parseFloat(data.Retail_Adder_Black_Mult || 2);
        baseUnitPrice *= blkMult;
        tierLog.forEach(t => t.unit *= blkMult);
    }

    let retailPrint = baseUnitPrice * inputs.qty;
    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'Easy' ? parseFloat(data.Retail_Fee_Router_Easy || 30) : parseFloat(data.Retail_Fee_Router_Hard || 50);
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + routerFee + feeSetup + feeDesign;
    const minOrder = bestP1 !== null ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    tierLog.forEach(t => t.unit = (t.unit * t.q + routerFee) / t.q);

    // --- 2. COST ENGINE ---
    const wasteFactor = parseFloat(data.Waste_Factor || 1.15);
    const stockSheets = inputs.thickness === '6mm'
        ? [{w: 48, h: 96, cost: parseFloat(data.Cost_Stock_6mm_4x8 || 72.10)}, {w: 60, h: 120, cost: parseFloat(data.Cost_Stock_6mm_5x10 || 132.39)}]
        : [{w: 48, h: 96, cost: parseFloat(data.Cost_Stock_3mm_4x8 || 52.09)}, {w: 48, h: 120, cost: parseFloat(data.Cost_Stock_3mm_4x10 || 69.44)}, {w: 60, h: 120, cost: parseFloat(data.Cost_Stock_3mm_5x10 || 75.75)}];

    let lowestCost = Infinity;
    stockSheets.forEach(sheet => {
        const sheetsNeeded = Math.ceil((sqft * inputs.qty * wasteFactor) / ((sheet.w * sheet.h)/144));
        if (sheetsNeeded * sheet.cost < lowestCost) lowestCost = sheetsNeeded * sheet.cost;
    });

    const rawMat = lowestCost;
    const wasteCost = rawMat - (rawMat / wasteFactor);
    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    const speedLF = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const ratePrintMach = parseFloat(data.Rate_Machine_Flatbed || 10);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const printHrs = (totalSqFt / 4) / speedLF;
    const costPrintMach = printHrs * ratePrintMach;
    const costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);

    let costCutSetup = 0, costCutLabor = 0, costCutMach = 0, costRound = 0, runHrsCNC = 0;
    if (inputs.shape === 'Rectangle') {
        costCutSetup = (parseFloat(data.Time_Shear_Setup || 5) / 60) * rateOp;
        costCutLabor = ((parseFloat(data.Time_Shear_Cut || 1) * inputs.qty) / 60) * rateOp;
        if (inputs.rounded) {
            costRound = ((parseFloat(data.Time_Round_Setup || 5) + (parseFloat(data.Time_Round_Corner || 0.5) * 4 * inputs.qty)) / 60) * rateOp;
        }
    } else {
        const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
        runHrsCNC = ((inputs.shape === 'Easy' ? parseFloat(data.Time_CNC_Easy_SqFt || 1) : parseFloat(data.Time_CNC_Complex_SqFt || 2)) * totalSqFt) / 60;
        costCutSetup = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC;
        costCutMach = runHrsCNC * parseFloat(data.Rate_Machine_CNC || 10);
        costCutLabor = runHrsCNC * rateCNC * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    }

    const subTotal = rawMat + totalInk + costPrintMach + costPrintOp + costCutSetup + costCutLabor + costCutMach + costRound;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee) / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, designFee: feeDesign,
            grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder, tiers: tierLog, yieldLabel: bestLabel ? `Yield Box: ${bestLabel}` : "Area Curve"
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: { rawBlanks: rawMat, wasteCost: wasteCost, wastePct: (wasteFactor - 1) * 100, totalInk: totalInk, costSetup: costCutSetup, costCut: costCutLabor + costCutMach, costRound: costRound, runHrs: runHrsCNC + printHrs, costMachine: costPrintMach + costCutMach, costOp: costPrintOp + costCutLabor + costRound, riskCost: riskBuffer, riskPct: (riskFactor - 1) * 100 }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}
