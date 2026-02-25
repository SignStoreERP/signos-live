/**
 * ULTRA-SIMPLE RETAIL ENGINE: Decals & Stickers
 * Pure SqFt Lookup + Material Specific Base Rates
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === 'Cast') baseRate = parseFloat(data.Retail_Price_Cast_SqFt) || 14.00;
    else if (inputs.material === 'Clear') baseRate = parseFloat(data.Retail_Price_Clear_SqFt) || 10.00;
    else if (inputs.material === 'Translucent') baseRate = parseFloat(data.Retail_Price_Trans_SqFt) || 10.00;
    else if (inputs.material === 'Reflective') baseRate = parseFloat(data.Retail_Price_Reflective_SqFt) || 15.00;
    else baseRate = parseFloat(data.Retail_Price_Standard_SqFt) || 8.00; // Standard fallback

    let unitPrint = baseRate * sqft;
    let retailPrint = unitPrint * inputs.qty;

    // 2. Volume Discounts
    let discPct = 0;
    if (inputs.qty >= (parseFloat(data.Tier_3_Qty) || 500)) discPct = parseFloat(data.Tier_3_Disc) || 0.20;
    else if (inputs.qty >= (parseFloat(data.Tier_2_Qty) || 100)) discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    else if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 50)) discPct = parseFloat(data.Tier_1_Disc) || 0.05;

    retailPrint *= (1 - discPct);

    // 3. Shop Minimum
    const minOrder = parseFloat(data.Retail_Min_Order) || 35;
    let grandTotal = Math.max(retailPrint, minOrder);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, grandTotal: grandTotal, isMinApplied: retailPrint < minOrder },
        cost: { total: 0 } 
    };
}
