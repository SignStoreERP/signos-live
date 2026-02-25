/**
 * ULTRA-SIMPLE RETAIL ENGINE: PVC Signs
 * Pure Area-Curve Lookup Math + Laminate Deductions
 */
function calculatePVC(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Fixed Area Curve Lookup
    if (inputs.thickness === '3mm') {
        if (sqft <= (parseFloat(data.PVC3_T1_Max) || 2.99)) { 
            baseRate = parseFloat(data.PVC3_T1_Rate) || 44; 
            minSignPrice = parseFloat(data.PVC3_T1_Min) || 33; 
        }
        else if (sqft <= (parseFloat(data.PVC3_T2_Max) || 5.99)) baseRate = parseFloat(data.PVC3_T2_Rate) || 13.2;
        else if (sqft <= (parseFloat(data.PVC3_T3_Max) || 11.99)) baseRate = parseFloat(data.PVC3_T3_Rate) || 8.4;
        else baseRate = parseFloat(data.PVC3_T4_Rate) || 7.8;
    } else {
        if (sqft <= (parseFloat(data.PVC6_T1_Max) || 2.99)) { 
            baseRate = parseFloat(data.PVC6_T1_Rate) || 44; 
            minSignPrice = parseFloat(data.PVC6_T1_Min) || 33; 
        }
        else if (sqft <= (parseFloat(data.PVC6_T2_Max) || 5.99)) baseRate = parseFloat(data.PVC6_T2_Rate) || 22;
        else if (sqft <= (parseFloat(data.PVC6_T3_Max) || 11.99)) baseRate = parseFloat(data.PVC6_T3_Rate) || 14;
        else baseRate = parseFloat(data.PVC6_T4_Rate) || 13;
    }

    // Evaluate base per-sign print price
    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder (+50%)
    if (inputs.sides === 2) {
        unitPrint *= (1 + (parseFloat(data.Retail_Adder_DS_Mult) || 0.5));
    }

    // 3. No Laminate Deduction (-10%)
    if (inputs.laminate === 'None') {
        unitPrint *= (1 - (parseFloat(data.Retail_Lam_Deduct) || 0.1));
    }

    let retailPrint = unitPrint * inputs.qty;

    // 4. Volume Discount (10+ Qty Break)
    if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 10)) {
        retailPrint *= (1 - (parseFloat(data.Tier_1_Disc) || 0.05));
    }

    // 5. Router Fee
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy) || 30;
    else if (inputs.shape === 'CNC Complex' || inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard) || 50;

    // 6. Shop Minimum Guard
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
