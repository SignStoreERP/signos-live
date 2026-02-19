function calculateRetail(inputs, data) {
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);

    // 1. Evaluate Print Pricing
    let printPrice = baseSS;
    if (inputs.qty >= parseFloat(data.Tier_1_Qty || 10)) {
        printPrice = parseFloat(data.Tier_1_Price || 23.75);
    }
    const unitPrint = printPrice + (inputs.sides === 2 ? adderDS : 0);
    const totalPrint = unitPrint * inputs.qty;

    // 2. Evaluate Stake Pricing
    let stakePrice = parseFloat(data.Retail_Stake_T1_Price || 2.00);
    if (inputs.qty >= parseFloat(data.Retail_Stake_T2_Qty || 50)) stakePrice = parseFloat(data.Retail_Stake_T2_Price || 1.75);
    if (inputs.qty >= parseFloat(data.Retail_Stake_T3_Qty || 100)) stakePrice = parseFloat(data.Retail_Stake_T3_Price || 1.50);
    const unitStake = inputs.hasStakes ? stakePrice : 0;
    const totalStake = unitStake * inputs.qty;

    // 3. Build UI Discount Table (Synthesizing Print & Stake Breaks)
    const tierLog = [];
    const breaks = [1, 5, 6];
    const baseUnitCost = baseSS + (inputs.sides === 2 ? adderDS : 0) + (inputs.hasStakes ? parseFloat(data.Retail_Stake_T1_Price||2.00) : 0);

    breaks.forEach(q => {
        let tPrint = (q >= parseFloat(data.Tier_1_Qty || 10)) ? parseFloat(data.Tier_1_Price || 23.75) : baseSS;
        let tStake = parseFloat(data.Retail_Stake_T1_Price || 2.00);
        if (q >= parseFloat(data.Retail_Stake_T2_Qty || 50)) tStake = parseFloat(data.Retail_Stake_T2_Price || 1.75);
        if (q >= parseFloat(data.Retail_Stake_T3_Qty || 100)) tStake = parseFloat(data.Retail_Stake_T3_Price || 1.50);
        
        const tUnit = tPrint + (inputs.sides === 2 ? adderDS : 0) + (inputs.hasStakes ? tStake : 0);
        const pctOff = 1 - (tUnit / baseUnitCost);
        tierLog.push({ q: q, unit: tUnit, pct: pctOff });
    });

    const grandTotalRaw = totalPrint + totalStake;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: totalPrint,
        stakeTotal: totalStake,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
