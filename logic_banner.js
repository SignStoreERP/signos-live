/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vinyl Banners
 * Implements Blue Sheet Yield Bounding Boxes (Rounding up to next 12")
 */
function calculateBanner(inputs, data) {
    // 1. Yield Math: Round up to nearest 12" increment
    const minFt = Math.ceil(Math.min(inputs.w, inputs.h) / 12);
    const maxFt = Math.ceil(Math.max(inputs.w, inputs.h) / 12);
    
    const sqft = minFt * maxFt;
    const totalSqFt = sqft * inputs.qty;

    // Format the Blue Sheet Key (e.g., RET_BAN_0205_SS)
    const wStr = minFt < 10 ? `0${minFt}` : `${minFt}`;
    const hStr = maxFt < 10 ? `0${maxFt}` : `${maxFt}`;
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const blueKey = `RET_BAN_${wStr}${hStr}_${sideStr}`;

    let baseRate = 0;
    let retailPrint = 0;

    // 2. Check Blue Sheet Exact Matches (Yield Bounding Box)
    if (data[`${blueKey}_1`]) {
        const p1 = parseFloat(data[`${blueKey}_1`]);
        const p10 = parseFloat(data[`${blueKey}_10`]);
        
        // Use Tier 10 pricing if qty >= 10, else Tier 1
        const appliedBase = inputs.qty >= 10 ? p10 : p1;
        retailPrint = appliedBase * inputs.qty;
        baseRate = p1 / sqft; // Back-calculate sqft rate for UI display
    } else {
        // 3. Fallback to Area Curves for odd/oversized dimensions
        if (minFt === 1) {
            baseRate = parseFloat(data.BAN13_T1_Rate) || 6.50;
        } else if (sqft < 10) {
            baseRate = parseFloat(data.BAN13_T2_Rate) || 6.00;
        } else {
            baseRate = parseFloat(data.BAN13_T3_Rate) || 5.00;
        }

        let unitPrint = baseRate * sqft;
        if (unitPrint < 25) unitPrint = 25; // Base Area minimum
        if (inputs.sides === 2) unitPrint *= 2;

        retailPrint = unitPrint * inputs.qty;
        if (inputs.qty >= 10) retailPrint *= 0.95; // 5% bulk discount
    }

    // 4. Finishing Adders (Pockets & Wind Slits)
    let retailPockets = 0;
    if (inputs.pockets && inputs.pockets !== 'None') {
        retailPockets = ((inputs.w / 12) * 2) * inputs.qty * parseFloat(data.Retail_Fin_PolePkt_LF || 3.00);
    }

    let retailSlits = 0;
    if (inputs.windSlits === 'Yes') {
        retailSlits = totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1.00);
    }

    // 5. Global Shop Minimum Guard ($50)
    // Note: Exact Blue Sheet matches bypass this minimum, area curves enforce it
    const minOrder = data[`${blueKey}_1`] ? 0 : (parseFloat(data.Retail_Min_Order) || 50);
    const grandTotalRaw = retailPrint + retailPockets + retailSlits;
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 }
    };
}
