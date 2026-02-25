/**
 * ULTRA-SIMPLE RETAIL ENGINE: ACM Signs
 * Pure Area-Curve Lookup Math + Multipliers
 */
function calculateACM(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Fixed Area Curve Lookup
    if (inputs.thickness === '3mm') {
        if (sqft <= (parseFloat(data.ACM3_T1_Max) || 2.99)) { 
            baseRate = parseFloat(data.ACM3_T1_Rate) || 24; 
            minSignPrice = parseFloat(data.ACM3_T1_Min) || 25; 
        }
        else if (sqft <= (parseFloat(data.ACM3_T2_Max) || 5.99)) baseRate = parseFloat(data.ACM3_T2_Rate) || 18;
        else if (sqft <= (parseFloat(data.ACM3_T3_Max) || 11.99)) baseRate = parseFloat(data.ACM3_T3_Rate) || 16;
        else if (sqft <= (parseFloat(data.ACM3_T4_Max) || 31.99)) baseRate = parseFloat(data.ACM3_T4_Rate) || 15;
        else baseRate = parseFloat(data.ACM3_T5_Rate) || 14;
    } else {
        if (sqft <= (parseFloat(data.ACM6_T1_Max) || 2.99)) { 
            baseRate = parseFloat(data.ACM6_T1_Rate) || 35.33; 
            minSignPrice = parseFloat(data.ACM6_T1_Min) || 26.50; 
        }
        else if (sqft <= (parseFloat(data.ACM6_T2_Max) || 5.99)) baseRate = parseFloat(data.ACM6_T2_Rate) || 20.50;
        else if (sqft <= (parseFloat(data.ACM6_T3_Max) || 11.99)) baseRate = parseFloat(data.ACM6_T3_Rate) || 18.50;
        else if (sqft <= (parseFloat(data.ACM6_T4_Max) || 31.99)) baseRate = parseFloat(data.ACM6_T4_Rate) || 17.50;
        else baseRate = parseFloat(data.ACM6_T5_Rate) || 16.50;
    }

    // Evaluate base per-sign print price
    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder (+50%)
    if (inputs.sides === 2) {
        unitPrint *= (1 + (parseFloat(data.Retail_Adder_DS_Mult) || 0.5));
    }

    // 3. Black ACM Adder (Double Price)
    if (inputs.color === 'Black') {
        unitPrint *= (parseFloat(data.Retail_Adder_Black_Mult) || 2);
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
