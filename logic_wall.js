/**
 * ULTRA-SIMPLE RETAIL ENGINE: Interior Wall Wraps
 * Supports GF226 Smooth vs 3M IJ8624 Textured vs Perf
 */
function calculateWall(inputs, data) {
    let totalRetailPrint = 0;
    let totalInstall = 0;
    let totalSqFt = 0;

    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const area = sqft * inputs.qty;
        totalSqFt += area;

        // Apply distinct material rates
        let printUnit = 0;
        let installUnit = 0;
        
        if (p.material === 'textured') {
            printUnit = parseFloat(data.Retail_Price_Wall_Text_SqFt) || 15.00;
            installUnit = parseFloat(data.Retail_Install_Wall_Text_SqFt) || 5.00;
        } else if (p.material.startsWith('perf')) {
            printUnit = parseFloat(data.Retail_Price_Perf_SqFt) || 12.00; 
            installUnit = parseFloat(data.Retail_Install_Wall_Smooth_SqFt) || 3.00;
        } else {
            printUnit = parseFloat(data.Retail_Price_Wall_Smooth_SqFt) || 10.00;
            installUnit = parseFloat(data.Retail_Install_Wall_Smooth_SqFt) || 3.00;
        }

        totalRetailPrint += (printUnit * area);
        if (inputs.install === 'Yes') totalInstall += (installUnit * area);
    });

    // Volume Discounts 
    let discPct = 0;
    if (inputs.qty >= (parseFloat(data.Tier_2_Qty) || 5)) discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    else if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 3)) discPct = parseFloat(data.Tier_1_Disc) || 0.05;

    totalRetailPrint *= (1 - discPct);

    const minOrder = parseFloat(data.Retail_Min_Order) || 150;
    let grandTotalRaw = totalRetailPrint + totalInstall;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: totalRetailPrint,
            installTotal: totalInstall,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            displaySqFt: totalSqFt
        },
        cost: { total: 0 } 
    };
}
