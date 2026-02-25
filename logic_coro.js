/**
 * ULTRA-SIMPLE RETAIL ENGINE: Custom Coroplast
 * Pure Area-Curve Lookup Math + Router Fees (No Hardware)
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const thk = inputs.thickness;

    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Fixed Area Curve Lookup
    if (thk === '4mm') {
        if (sqft <= (parseFloat(data.COR4_T1_Max) || 3.99)) {
            baseRate = parseFloat(data.COR4_T1_Rate) || 8.33;
            minSignPrice = parseFloat(data.COR4_T1_Min) || 25;
        } else if (sqft <= (parseFloat(data.COR4_T2_Max) || 15.99)) {
            baseRate = parseFloat(data.COR4_T2_Rate) || 7;
        } else if (sqft <= (parseFloat(data.COR4_T3_Max) || 31.99)) {
            baseRate = parseFloat(data.COR4_T3_Rate) || 6;
        } else {
            baseRate = parseFloat(data.COR4_T4_Rate) || 5;
        }
    } else {
        if (sqft <= (parseFloat(data.COR10_T1_Max) || 3.99)) {
            baseRate = parseFloat(data.COR10_T1_Rate) || 25;
            minSignPrice = parseFloat(data.COR10_T1_Min) || 75;
        } else if (sqft <= (parseFloat(data.COR10_T2_Max) || 15.99)) {
            baseRate = parseFloat(data.COR10_T2_Rate) || 21;
        } else if (sqft <= (parseFloat(data.COR10_T3_Max) || 31.99)) {
            baseRate = parseFloat(data.COR10_T3_Rate) || 18;
        } else {
            baseRate = parseFloat(data.COR10_T4_Rate) || 15;
        }
    }

    // Evaluate base per-sign print price
    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder
    if (inputs.sides === 2) {
        const dsAdder = thk === '4mm' ? (parseFloat(data.Retail_Adder_DS_4mm) || 2.5) : (parseFloat(data.Retail_Adder_DS_10mm) || 5);
        unitPrint += (dsAdder * sqft);
    }

    let retailPrint = unitPrint * inputs.qty;

    // 3. Volume Discount (10+ Qty Break)
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;
    if (inputs.qty >= t1Qty) {
        const discPct = parseFloat(data.Tier_1_Disc) || 0.05;
        retailPrint *= (1 - discPct);
    }

    // 4. Router Fee
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy) || 30;
    else if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard) || 50;

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
