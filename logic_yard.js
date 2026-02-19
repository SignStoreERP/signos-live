/**
 * PURE PHYSICS ENGINE: Yard Signs (v2.1)
 * Added support for Labor Attendance Ratio in Sandbox
 */

function calculateYardSign(inputs, data) {

    // --- 1. RETAIL ENGINE ---
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 15.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 3.00);
    const stakePrice = parseFloat(data.Retail_Price_Stake || 2.50);

    // Tier Logic
    let appliedBase = baseSS;
    let i = 1;
    const tierLog = [];
    
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPrice = parseFloat(data[`Tier_${i}_Price`] || 0);
        
        if (inputs.qty >= tQty) appliedBase = tPrice;
        
        const rowUnit = tPrice + (inputs.sides===2?adderDS:0) + (inputs.hasStakes?stakePrice:0);
        tierLog.push({ q: tQty, base: tPrice, unit: rowUnit });
        i++;
    }

    const isCustom = (appliedBase === 0);

    const unitPrint = appliedBase + (inputs.sides === 2 ? adderDS : 0);
    const totalPrint = unitPrint * inputs.qty;
    const unitStake = inputs.hasStakes ? stakePrice : 0;
    const totalStake = unitStake * inputs.qty;

    // Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15.00);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45.00);
    
    const totalSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const totalDesign = inputs.incDesign ? (feeDesignBase * inputs.files) : 0;

    const grandTotalRaw = totalPrint + totalStake + totalSetup + totalDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    // --- 2. COST ENGINE (IN-HOUSE) ---
    const bulkTrigger = parseFloat(data.Bulk_Qty_Trigger || 1100);
    let blankCost = parseFloat(data.Cost_Blank_Standard || 0.91);
    if (inputs.qty >= bulkTrigger) blankCost = parseFloat(data.Cost_Blank_Bulk || 0.79);

    const waste = parseFloat(data.Waste_Factor || 1.05);
    const totalMat = (blankCost * waste) * inputs.qty;

    const areaSqFt = (24*18)/144;
    const totalArea = areaSqFt * inputs.sides * inputs.qty;
    const totalInk = totalArea * parseFloat(data.Cost_Ink_Base || 0.16);

    const costStakeUnit = inputs.hasStakes ? parseFloat(data.Cost_Stake || 0.65) : 0;
    const totalStakeCost = costStakeUnit * inputs.qty;

    // Production Time & Labor
    const bedCap = parseFloat(data.Printer_Bed_Capacity || 3);
    const speed = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const lfPerSet = 2.0; 
    
    const totalRunHrs = ((lfPerSet / bedCap / speed) * inputs.sides) * inputs.qty;
    
    // COSTS
    const costMachine = totalRunHrs * parseFloat(data.Rate_Machine || 45);
    
    // NEW: Attendance Ratio Support
    // If key missing, defaults to 1.0 (100% attendance / constant monitoring)
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 1.0);
    const costOp = totalRunHrs * parseFloat(data.Rate_Operator || 25) * attnRatio;

    // Setup uses full attention (Ratio 1.0 always)
    const setupHrs = (parseFloat(data.Time_Setup_Base||15) + (parseFloat(data.Time_Setup_Adder||2) * inputs.files)) / 60;
    const costSetup = setupHrs * parseFloat(data.Rate_Operator || 25);

    const totalCost = totalMat + totalInk + totalStakeCost + costMachine + costOp + costSetup;

    return {
        retail: {
            unitPrice: (totalPrint + totalStake) / inputs.qty,
            printTotal: totalPrint,
            stakeTotal: totalStake,
            setupFee: totalSetup,
            designFee: totalDesign,
            grandTotal: grandTotal,
            isCustom: isCustom,
            isMinApplied: isMinApplied,
            tiers: tierLog
        },
        cost: {
            total: totalCost
        },
        metrics: {
            margin: (grandTotal - totalCost) / grandTotal
        }
    };
}
