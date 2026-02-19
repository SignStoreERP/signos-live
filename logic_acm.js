/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.12)
 * Updated for Sandbox Cost Drivers with Gemini Bug Fixes
 */

function calculateACM(inputs, data) {
    
    // 1. Sheet Optimization Logic (Simplified for Headless)
    // In real app, this has the SVG generation. For Headless Sim, we just need math.
    const stockSheets = [
        {name: "4x8", w: 48, h: 96, cost: parseFloat(data.Cost_Sheet_3mm || 52.09)},
        {name: "4x10", w: 48, h: 120, cost: parseFloat(data.Cost_Stock_3mm_4x10 || 69.44)},
        {name: "5x10", w: 60, h: 120, cost: parseFloat(data.Cost_Stock_3mm_5x10 || 75.75)}
    ];
    
    const signArea = inputs.w * inputs.h;
    const totalArea = signArea * inputs.qty;
    const sheetArea = 48 * 96; // Standard 4x8 reference
    const sheetsNeeded = Math.ceil(totalArea / sheetArea); // Crude approx for sim speed
    
    // --- RETAIL ---
    const baseRate = parseFloat(data.Retail_Price_3mm_Base || 14);
    const unitPrice = (baseRate * (inputs.w * inputs.h / 144));
    let retailTotal = unitPrice * inputs.qty;
    
    const setupFee = parseFloat(data.Retail_Fee_Setup || 25);
    retailTotal += setupFee;

    // --- COST ---
    const waste = parseFloat(data.Waste_Factor || 1.2);
    
    // FIX APPLIED: Added [0] index to pull the cost of the 4x8 sheet
    const costMat = (sheetsNeeded * stockSheets[0].cost); 
    
    const costLam = (totalArea / 144) * parseFloat(data.Cost_Lam_SqFt || 0.36) * waste;
    
    // Labor & Machine
    const speedPrint = parseFloat(data.Speed_Print_LF || 25); 
    const feedLen = inputs.h < 60 ? inputs.w : inputs.h; // Optimize rotation
    const runHrs = (feedLen * inputs.qty) / 12 / speedPrint;
    
    const rateMach = parseFloat(data.Rate_Machine_Print || 45);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 45);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 35);
    
    // NEW: Attendance Ratio
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 1.0);
    
    const costRunMach = runHrs * rateMach;
    const costRunOp = runHrs * rateOp * attnRatio;
    
    // CNC Time (Full Attention usually, or maybe ratio applies?)
    // Let's assume CNC needs full attention for loading/unloading
    const timeCNC = (inputs.qty * 10) / 60; // 10 mins per sheet avg
    const costCNC = timeCNC * (rateCNC + rateMachCNC);
    
    const setupHrs = parseFloat(data.Time_Setup_Base || 5) / 60;
    const costSetup = setupHrs * rateOp;

    const totalCost = costMat + costLam + costRunMach + costRunOp + costCNC + costSetup;

    // FIX APPLIED: Mapped return object values to the actual variables calculated above
    return {
        retail: {
            unitPrice: unitPrice,
            grandTotal: retailTotal,
            isOversized: false,
            breakdown: {
                material: costMat,    
                laminate: costLam,    
                finish: costCNC       
            },
            fees: {
                setup: setupFee,
                design: 0
            }
        },
        cost: {
            total: totalCost
        }
    };
}
