/**
 * ULTRA-SIMPLE RETAIL ENGINE: Foam Core Boards
 * Pure Area-Curve Lookup Math + DS Multiplier
 */
function calculateFoam(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Fixed Area Curve Lookup (FOM3)
    if (sqft <= (parseFloat(data.FOM3_T1_Max) || 3.99)) {
        baseRate = parseFloat(data.FOM3_T1_Rate) || 8.33;
        minSignPrice = parseFloat(data.FOM3_T1_Min) || 25;
    } else if (sqft <= (parseFloat(data.FOM3_T2_Max) || 15.99)) {
        baseRate = parseFloat(data.FOM3_T2_Rate) || 8;
    } else if (sqft <= (parseFloat(data.FOM3_T3_Max) || 31.99)) {
        baseRate = parseFloat(data.FOM3_T3_Rate) || 7;
    } else {
        baseRate = parseFloat(data.FOM3_T4_Rate) || 6;
    }

    // Evaluate base per-sign print price
    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder (+50%)
    if (inputs.sides === 2) {
        unitPrint *= (1 + (parseFloat(data.Retail_Adder_DS_Mult) || 0.5));
    }

    let retailPrint = unitPrint * inputs.qty;

    // 3. Volume Discount (10+ Qty Break)
    if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 10)) {
        retailPrint *= (1 - (parseFloat(data.Tier_1_Disc) || 0.05));
    }

    // 4. Router Fee (If custom shapes are needed)
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy) || 30;
    else if (inputs.shape === 'CNC Complex' || inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard) || 50;

    // 5. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 50;
    let grandTotalRaw = retailPrint + routerFee;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
