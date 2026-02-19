// cost_acm.js - Physics & BOM Engine (ACM Signs - Strict Backend Reference)
function calculateCost(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const waste = parseFloat(data.Waste_Factor || 1.20);
    const margin = parseFloat(data.Constraint_Margin || 0);

    // 1. Dynamic Stock Yield Engine (Driven by Backend)
    const stocks = [];
    if (inputs.thickness === "3mm") {
        if (data.Cost_Stock_3mm_4x8) stocks.push({ id: "4x8", w: parseFloat(data.Stock_4x8_W || 48), h: parseFloat(data.Stock_4x8_H || 96), cost: parseFloat(data.Cost_Stock_3mm_4x8) });
        if (data.Cost_Stock_3mm_4x10) stocks.push({ id: "4x10", w: parseFloat(data.Stock_4x10_W || 48), h: parseFloat(data.Stock_4x10_H || 120), cost: parseFloat(data.Cost_Stock_3mm_4x10) });
        if (data.Cost_Stock_3mm_5x10) stocks.push({ id: "5x10", w: parseFloat(data.Stock_5x10_W || 60), h: parseFloat(data.Stock_5x10_H || 120), cost: parseFloat(data.Cost_Stock_3mm_5x10) });
    } else {
        if (data.Cost_Stock_6mm_4x8) stocks.push({ id: "4x8", w: parseFloat(data.Stock_4x8_W || 48), h: parseFloat(data.Stock_4x8_H || 96), cost: parseFloat(data.Cost_Stock_6mm_4x8) });
        if (data.Cost_Stock_6mm_5x10) stocks.push({ id: "5x10", w: parseFloat(data.Stock_5x10_W || 60), h: parseFloat(data.Stock_5x10_H || 120), cost: parseFloat(data.Cost_Stock_6mm_5x10) });
    }

    // Absolute Constraint Check
    const maxW = parseFloat(data.Constraint_Max_W || 60);
    const maxH = parseFloat(data.Constraint_Max_H || 120);
    const minInput = Math.min(inputs.w, inputs.h);
    const maxInput = Math.max(inputs.w, inputs.h);
    
    let bestStock = { id: "Oversized", cost: Infinity, sheets: 0 };

    if (minInput <= maxW && maxInput <= maxH) {
        stocks.forEach(stk => {
            const effW = stk.w - (margin * 2); 
            const effH = stk.h - (margin * 2);
            
            // Test both rotation fits
            const fit1 = Math.floor(effW / inputs.w) * Math.floor(effH / inputs.h);
            const fit2 = Math.floor(effW / inputs.h) * Math.floor(effH / inputs.w);
            const yieldPerSheet = Math.max(fit1, fit2);

            if (yieldPerSheet > 0) {
                const sheets = Math.ceil(inputs.qty / yieldPerSheet);
                const totalCost = sheets * stk.cost;
                if (totalCost < bestStock.cost) {
                    bestStock = { id: stk.id, cost: totalCost, sheets: sheets };
                }
            }
        });
    }

    const costMat = bestStock.cost !== Infinity ? (bestStock.cost * waste) : 0;

    // 2. Ink & Laminate
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;
    const costLam = totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36) * waste;

    // 3. Print Physics
    const bedW = 64;
    let fitPerRow = 0; let feedLen = 0;
    const fit1 = Math.floor(bedW / inputs.w); const fit2 = Math.floor(bedW / inputs.h);
    if (fit1 > 0 && fit1 >= fit2) { fitPerRow = fit1; feedLen = inputs.h; }
    else if (fit2 > 0) { fitPerRow = fit2; feedLen = inputs.w; }
    
    const totalFeedInches = Math.ceil(inputs.qty / (fitPerRow || 1)) * feedLen;
    const printHrs = ((totalFeedInches / 12) / parseFloat(data.Speed_Print_LF || 25)) * inputs.sides;
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Flatbed || 45);

    // 4. Cutting Labor
    let costCutMach = 0; let cutHrs = 0;
    if (inputs.shape === 'Rectangle') {
        cutHrs = (parseFloat(data.Time_Shear_Base || 5) + (inputs.qty * parseFloat(data.Time_Shear_Add || 3))) / 60;
    } else {
        const timePerUnit = inputs.shape === 'Easy' ? 3 : 8;
        cutHrs = (inputs.qty * timePerUnit) / 60;
        costCutMach = cutHrs * parseFloat(data.Rate_Machine_CNC || 35);
    }

    // 5. General Labor
    const opHrs = printHrs + cutHrs + (parseFloat(data.Time_Handling || 5) / 60);
    const costOp = opHrs * parseFloat(data.Rate_Operator || 25);
    
    const setupHrs = parseFloat(data.Time_Setup_Job || 10) / 60;
    const costSetup = setupHrs * parseFloat(data.Rate_Operator || 25);

    const totalCost = costMat + costInk + costLam + costPrintMach + costCutMach + costOp + costSetup;

    return {
        bom: { stock: bestStock, sheets: bestStock.sheets, inkSqFt: totalSqFt },
        time: { printHrs, cutHrs, setupHrs },
        financials: { total: totalCost }
    };
}
