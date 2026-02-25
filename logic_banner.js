/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vinyl Banners
 * Pure Area-Curve Lookup Math (Strict Blue Sheet 13oz Targets)
 */
function calculateBanner(inputs, data) {
    // "Round up to nearest whole number for sq ft" per Blue Sheet notes
    const sqft = Math.ceil((inputs.w * inputs.h) / 144); 
    let baseRate = 0;

    // 1. Blue Sheet Area Curve Logic
    const is1ft = (inputs.w === 12 || inputs.h === 12);
    
    if (is1ft) {
        baseRate = parseFloat(data.BAN13_T1_Rate) || 6.50;
    } else if (sqft < 10) {
        baseRate = parseFloat(data.BAN13_T2_Rate) || 6.00;
    } else {
        baseRate = parseFloat(data.BAN13_T3_Rate) || 5.00;
    }

    // 2. Base Unit Price & Per-Banner Minimum ($25 per Blue Sheet)
    let unitPrint = baseRate * sqft;
    if (unitPrint < 25) {
        unitPrint = 25;
    }

    // 3. Double Sided (Exact 2x Multiplier per Blue Sheet)
    if (inputs.sides === 2) {
        unitPrint *= 2;
    }

    let retailPrint = unitPrint * inputs.qty;

    // 4. Volume Discount (10+ Qty = 5% Off)
    if (inputs.qty >= 10) {
        retailPrint *= 0.95;
    }

    // 5. Global Shop Minimum Guard ($50)
    const minOrder = parseFloat(data.Retail_Min_Order) || 50;
    let grandTotal = Math.max(retailPrint, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            grandTotal: grandTotal,
            isMinApplied: retailPrint < minOrder
        },
        cost: { total: 0 } 
    };
}
