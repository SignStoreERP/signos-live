/**
 * ULTRA-SIMPLE RETAIL ENGINE: Cut Vinyl Lettering
 * Specific support for 751, 951, and 8500.
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === '951') {
        baseRate = parseFloat(data.Retail_Price_951) || 22.00;
    } else if (inputs.material === '8500') {
        baseRate = parseFloat(data.Retail_Price_8500) || 20.00;
    } else {
        baseRate = parseFloat(data.Retail_Price_751) || 18.00; // 751 Default
    }

    let unitPrint = baseRate * sqft;
    let retailPrint = unitPrint * inputs.qty;

    // 2. Volume Discounts (Tiers 1 & 2)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 50;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    retailPrint *= (1 - discPct);

    // 3. Weeding Complexity Adder
    let retailWeed = 0;
    if (inputs.weeding === 'Complex') {
        const weedAdder = parseFloat(data.Retail_Weed_Complex_Add) || 5.00;
        retailWeed = weedAdder * sqft * inputs.qty;
    }

    // 4. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 45;
    let grandTotalRaw = retailPrint + retailWeed;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            weedTotal: retailWeed,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
