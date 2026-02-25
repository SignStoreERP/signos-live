/**
 * ULTRA-SIMPLE RETAIL ENGINE: Yard Signs
 * Pure Fixed-Tier Lookup Math + No Setup or Design Fees
 */
function calculateYardSign(inputs, data) {
    // 1. Base Print Lookup
    let baseRate = parseFloat(data.Retail_Price_Sign_SS) || 0;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;
    
    // Apply 10+ Discount if reached
    if (inputs.qty >= t1Qty) {
        baseRate = parseFloat(data.Tier_1_Price) || 0;
    }

    // Double Sided Adder (Not discounted per original logic)
    let dsAdder = 0;
    if (inputs.sides === 2) {
        dsAdder = parseFloat(data.Retail_Price_Sign_DS) || 0;
    }

    const unitPrint = baseRate + dsAdder;
    const retailPrint = unitPrint * inputs.qty;

    // 2. Hardware (Stakes) Lookup
    let stakeTotal = 0;
    if (inputs.stakes) {
        let stakePrice = parseFloat(data.Retail_Stake_T1_Price) || 0;
        const t2Qty = parseFloat(data.Retail_Stake_T2_Qty) || 50;
        const t3Qty = parseFloat(data.Retail_Stake_T3_Qty) || 100;

        // Apply Stake Quantity Breaks
        if (inputs.qty >= t3Qty) stakePrice = parseFloat(data.Retail_Stake_T3_Price) || 0;
        else if (inputs.qty >= t2Qty) stakePrice = parseFloat(data.Retail_Stake_T2_Price) || 0;

        stakeTotal = stakePrice * inputs.qty;
    }

    // 3. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 0;
    let grandTotalRaw = retailPrint + stakeTotal;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            stakeTotal: stakeTotal,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
