/**
 * ULTRA-SIMPLE RETAIL ENGINE: Acrylic Signs
 * Pure Fixed-Tier Lookup Math + No Setup or Design Fees
 */
function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    let baseSqFtRate = 0;
    const thick = String(inputs.thickness);

    // 1. Fixed Tier Lookup (Strictly from Backend)
    if (thick.includes('1/4') || thick.includes('0.25') || thick.includes('.25')) {
        if (totalSqFt <= (parseFloat(data.ACR_14_T1_Max) || 0)) baseSqFtRate = parseFloat(data.ACR_14_T1_Rate) || 0;
        else if (totalSqFt <= (parseFloat(data.ACR_14_T2_Max) || 0)) baseSqFtRate = parseFloat(data.ACR_14_T2_Rate) || 0;
        else baseSqFtRate = parseFloat(data.ACR_14_T3_Rate) || 0;
    } 
    else if (thick.includes('1/2') || thick.includes('0.5') || thick.includes('.5')) {
        if (totalSqFt <= (parseFloat(data.ACR_12_T1_Max) || 0)) baseSqFtRate = parseFloat(data.ACR_12_T1_Rate) || 0;
        else baseSqFtRate = parseFloat(data.ACR_12_T2_Rate) || 0;
    } 
    else if (thick.includes('3/4') || thick.includes('0.75') || thick.includes('.75')) {
        if (totalSqFt <= (parseFloat(data.ACR_34_T1_Max) || 0)) baseSqFtRate = parseFloat(data.ACR_34_T1_Rate) || 0;
        else baseSqFtRate = parseFloat(data.ACR_34_T2_Rate) || 0;
    } 
    else if (thick.includes('1') || thick.includes('1.0')) {
        if (totalSqFt <= (parseFloat(data.ACR_1IN_T1_Max) || 0)) baseSqFtRate = parseFloat(data.ACR_1IN_T1_Rate) || 0;
        else baseSqFtRate = parseFloat(data.ACR_1IN_T2_Rate) || 0;
    }

    const retailPrint = baseSqFtRate * totalSqFt;

    // 2. Simple Flat Fees
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy) || 0;
    else if (inputs.shape === 'CNC Complex' || inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard) || 0;

    const minOrder = parseFloat(data.Retail_Min_Order) || 0;
    
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
