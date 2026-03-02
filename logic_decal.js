/**
 * ULTRA-SIMPLE RETAIL ENGINE: Decals & Stickers
 * Pure SqFt Lookup + Expanded Material Base Rates
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === 'Cast') baseRate = parseFloat(data.Retail_Price_Cast_SqFt) || 14.00;
    else if (inputs.material === 'Clear') baseRate = parseFloat(data.Retail_Price_Clear_SqFt) || 10.00;
    else if (inputs.material === 'Translucent') baseRate = parseFloat(data.Retail_Price_Trans_SqFt) || 10.00;
    else if (inputs.material === 'Reflective') baseRate = parseFloat(data.Retail_Price_Reflective_SqFt) || 15.00;
    else if (inputs.material === 'Drywall') baseRate = parseFloat(data.Retail_Price_Wall_Smooth_SqFt) || 10.00;
    else if (inputs.material === 'Textured') baseRate = parseFloat(data.Retail_Price_Wall_Text_SqFt) || 15.00;
    else if (inputs.material === 'Perf') baseRate = parseFloat(data.Retail_Price_Perf_SqFt) || 12.00;
    else baseRate = parseFloat(data.Retail_Price_Cal_SqFt) || 8.00; // Standard fallback

    let unitPrint = baseRate * sqft;
    let retailPrint = unitPrint * inputs.qty;

    // 2. Volume Discounts
    let discPct = 0;
    let currentBestTier = 0;
    let i = 1;
    const tierLog = [];

    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc });
        if (inputs.qty >= tQty) currentBestTier = tDisc;
        i++;
    }

    discPct = currentBestTier;
    retailPrint *= (1 - discPct);

    // 3. Finishing Adders
    let retailContour = 0;
    let retailWeed = 0;
    let retailMask = 0;

    if (inputs.shape !== 'Rectangle' && inputs.shape !== 'Square') {
        retailContour = retailPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25);
        if (inputs.weeding === 'Complex' || inputs.shape === 'Contour Complex') {
            retailWeed = totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.50);
        }
    }

    if (inputs.masking === 'Yes' || inputs.mask) {
        retailMask = totalSqFt * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00); 
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailContour + retailWeed + retailMask + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // Format UI Tiers for Simulator
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trContour = (inputs.shape !== 'Rectangle' && inputs.shape !== 'Square') ? (trPrint * parseFloat(data.Retail_Cut_Contour_Add || 0.25)) : 0;
        const trWeed = (inputs.weeding === 'Complex' || inputs.shape === 'Contour Complex') ? (sqft * t.q * parseFloat(data.Retail_Weed_Complex || 2.50)) : 0;
        const trMask = (inputs.masking === 'Yes' || inputs.mask) ? (sqft * t.q * parseFloat(data.Retail_Adder_Mask_SqFt || 1.00)) : 0;
        const total = Math.max(trPrint + trContour + trWeed + trMask + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    return {
        retail: {
            unitPrice: (retailPrint + retailContour + retailWeed + retailMask) / inputs.qty,
            printTotal: retailPrint,
            contourFee: retailContour,
            weedFee: retailWeed,
            maskFee: retailMask,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: simTiers,
            baseRate: baseRate
        },
        cost: { total: 0 }
    };
}
