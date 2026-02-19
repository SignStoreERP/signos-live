// retail_acm.js - Market Pricing Engine (ACM Signs - Strictly Backend Driven)
function calculateRetail(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const prefix = inputs.thickness === "3mm" ? "ACM3" : "ACM6";
    
    // 1. Dynamic Curve Logic (Reads directly from Backend)
    let curveRate = 0;
    let curveMin = 0;
    let tierIndex = 1;

    // Loop through the tiers from the sheet until we find the appropriate SqFt bracket
    while(data[`${prefix}_T${tierIndex}_Max`]) {
        const maxSqft = parseFloat(data[`${prefix}_T${tierIndex}_Max`]);
        if (sqft <= maxSqft) {
            curveRate = parseFloat(data[`${prefix}_T${tierIndex}_Rate`]);
            curveMin = parseFloat(data[`${prefix}_T${tierIndex}_Min`] || 0);
            break; 
        }
        tierIndex++;
    }
    
    // 2. Base Product Calculation
    let unitBase = Math.max(sqft * curveRate, curveMin);

    // 3. Material Multipliers (From Backend)
    if (inputs.sides === 2) {
        unitBase *= (1 + parseFloat(data.Retail_Adder_DS_Mult || 0.5));
    }
    
    if (inputs.color === 'Black' && inputs.thickness === '6mm') {
        unitBase *= parseFloat(data.Retail_Adder_Black_Mult || 2.0);
    }

    // 4. Volume Discounts (Localized to Product Tab)
    let discPct = 0;
    let i = 1;
    const tierLog = [];

    // FIXED: Now correctly scans for "Tier_X_Qty" and "Tier_X_Disc"
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPct = parseFloat(data[`Tier_${i}_Disc`] || 0);
        
        if (inputs.qty >= tQty) discPct = tPct;
        
        const discountedUnit = unitBase * (1 - tPct);
        tierLog.push({ q: tQty, pct: tPct, unit: discountedUnit });
        i++;
    }

    const appliedUnit = unitBase * (1 - discPct);
    const printTotal = appliedUnit * inputs.qty;

    // 5. Flat Fees
    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30.00);
    if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50.00);

    // 6. Shop Minimums
    const grandTotalRaw = printTotal + routerFee;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: printTotal,
        routerFee: routerFee,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
