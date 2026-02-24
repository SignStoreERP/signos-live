/**
 * PURE PHYSICS ENGINE: Vinyl Banners (v10.4)
 * Uses Math.ceil() for Yield Bounding Boxes.
 */
function calculateBanner(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const minDim = Math.min(inputs.w, inputs.h);
    const isOversize = minDim > parseFloat(data.Constraint_Max_Width_Inhouse || 62);

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    // Yield Math: Round up to nearest foot
    const minFt = Math.ceil(Math.min(inputs.w, inputs.h) / 12);
    const maxFt = Math.ceil(Math.max(inputs.w, inputs.h) / 12);
    const wStr = minFt < 10 ? `0${minFt}` : `${minFt}`;
    const hStr = maxFt < 10 ? `0${maxFt}` : `${maxFt}`;
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const blueKey = `RET_BAN_${wStr}${hStr}_${sideStr}`;

    let baseRate = 0;
    let matLabel = "13oz Scrim";
    let retailPrint = 0;
    let tierLog = [];

    // Bounding Box Lookup
    if (inputs.material === '13oz' && data[`${blueKey}_1`]) {
        // MATCH: Apply Yield Envelope
        const p1 = parseFloat(data[`${blueKey}_1`]);
        const p10 = parseFloat(data[`${blueKey}_10`]);
        const appliedBase = inputs.qty >= 10 ? p10 : p1;
        
        retailPrint = appliedBase * inputs.qty;
        baseRate = p1 / sqft; // For display purposes
        
        tierLog.push(
            { q: 1, base: baseRate, d: 0, unitBase: p1 },
            { q: 10, base: baseRate, d: 0, unitBase: p10 }
        );
    } else {
        // NO MATCH: Oversize / Special Material Fallback
        if (inputs.material === '13oz') {
            if (minDim <= 12) baseRate = parseFloat(data.BAN13_T1_Rate || 6.50);
            else if (sqft < parseFloat(data.BAN13_T2_Max || 10)) baseRate = parseFloat(data.BAN13_T2_Rate || 6.00);
            else baseRate = parseFloat(data.BAN13_T3_Rate || 5.00);
        } else if (inputs.material === '15oz') {
            matLabel = "15oz Smooth Blockout"; baseRate = parseFloat(data.Retail_Price_Base_15oz || 6.50);
        } else if (inputs.material === '18oz') {
            matLabel = "18oz Heavy Blockout"; baseRate = parseFloat(data.Retail_Price_Base_18oz || 8.00);
        } else if (inputs.material === 'Mesh') {
            matLabel = "8oz Mesh"; baseRate = parseFloat(data.Retail_Price_Base_Mesh || 7.00);
        }

        if (inputs.sides === 2) baseRate += parseFloat(data.Retail_Adder_DS_SqFt || 3.00);

        let discPct = 0, currentBestTier = 0, i = 1;
        while(data[`Tier_${i}_Qty`]) {
            const tQty = parseFloat(data[`Tier_${i}_Qty`]);
            const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
            tierLog.push({ q: tQty, d: tDisc, unitBase: (baseRate * (1-tDisc)) * sqft });
            if (inputs.qty >= tQty) currentBestTier = tDisc;
            i++;
        }
        retailPrint = (baseRate * (1 - currentBestTier)) * totalSqFt;
    }

    // Finishing Adders
    let retailPockets = 0;
    if (inputs.pockets) retailPockets = ((inputs.w / 12) * 2) * inputs.qty * parseFloat(data.Retail_Fin_PolePkt_LF || 3.00);
    let retailSlits = 0;
    if (inputs.windSlits) retailSlits = totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1.00);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetup = inputs.setupPerFile ? (parseFloat(data.Retail_Fee_Setup || 15) * inputs.files) : parseFloat(data.Retail_Fee_Setup || 15);

    const grandTotalRaw = retailPrint + retailPockets + retailSlits + feeDesign + feeSetup;
    const minOrder = data[`${blueKey}_1`] ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // Format UI Tiers
    const simTiers = tierLog.map(t => {
        const trPrint = t.unitBase * t.q;
        const trPocket = inputs.pockets ? ((inputs.w/12)*2 * t.q * parseFloat(data.Retail_Fin_PolePkt_LF || 3)) : 0;
        const trSlits = inputs.windSlits ? ((sqft * t.q) * parseFloat(data.Retail_Price_WindSlits_SqFt || 1)) : 0;
        const total = Math.max(trPrint + trPocket + trSlits + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - (t.d||0)), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const prodW = inputs.hems ? inputs.w + 2 : inputs.w;
    const prodH = inputs.hems ? inputs.h + 2 : inputs.h;
    const prodSqFt = (prodW * prodH) / 144;
    const totalProdSqFt = prodSqFt * inputs.qty;

    let costVinylRaw = 0;
    if (inputs.material === '13oz') costVinylRaw = parseFloat(data.Cost_Media_13oz || 0.26);
    else if (inputs.material === '15oz') costVinylRaw = parseFloat(data.Cost_Media_15oz || 0.46);
    else if (inputs.material === '18oz') costVinylRaw = parseFloat(data.Cost_Media_18oz || 0.39);
    else costVinylRaw = parseFloat(data.Cost_Media_Mesh || 0.33);

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const costMedia = totalProdSqFt * costVinylRaw * wastePct;
    const costInk = totalProdSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;
    const perimLF = ((inputs.w + inputs.h) * 2) / 12 * inputs.qty;
    const costTape = inputs.hems ? (perimLF * parseFloat(data.Cost_Hem_Tape || 0.08)) * wastePct : 0;

    let costGrom = 0, gromCount = 0;
    if (inputs.grommets) {
        gromCount = Math.max(Math.ceil(perimLF / 2), 4 * inputs.qty);
        costGrom = gromCount * parseFloat(data.Cost_Grommet || 0.13) * wastePct;
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const costSetup = ((parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 2)) / 60) * rateOp;

    const printHrs = totalProdSqFt / parseFloat(data.Speed_Print_Roll || 150) * inputs.sides;
    const costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Print || 5);

    const finishHrs = ((inputs.hems ? perimLF * 0.5 : 0) + (inputs.grommets ? gromCount * 1.0 : 0) + (inputs.windSlits ? totalSqFt * 0.1 : 0) + (inputs.pockets ? (inputs.w/12)*2 * inputs.qty * 2 : 0) + (perimLF * 0.25)) / 60;
    const costFinish = finishHrs * rateShop;

    const subTotal = costMedia + costInk + costTape + costGrom + costSetup + costPrintOp + costPrintMach + costFinish;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: {
            unitPrice: (retailPrint + retailPockets + retailSlits) / inputs.qty,
            printTotal: retailPrint, pocketTotal: retailPockets, slitTotal: retailSlits,
            setupFee: feeSetup, designFee: feeDesign, grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder,
            isOversize: isOversize, tiers: simTiers, baseRate: baseRate, matLabel: matLabel, yieldLabel: data[`${blueKey}_1`] ? `Yield Box: ${minFt}'x${maxFt}'` : "Area Curve"
        },
        cost: { total: subTotal * riskFactor, breakdown: { rawMedia: costMedia, unitMedia: costVinylRaw, rawInk: costInk, rawTape: costTape, rawGrom: costGrom, costSetup: costSetup, costPrint: costPrintOp + costPrintMach, costFinish: costFinish, riskCost: subTotal * (riskFactor - 1), wastePct: (wastePct - 1) * 100, riskPct: (riskFactor - 1) * 100 } },
        metrics: { margin: (grandTotal - (subTotal * riskFactor)) / grandTotal }
    };
}
