// cost_yard.js - Physics & BOM Engine (Matrix Aligned)
function calculateCost(inputs, data) {
    // 1. Bill of Materials (BOM)
    const bulkTrigger = parseFloat(data.Bulk_Qty_Trigger || 1100);
    let blankCost = parseFloat(data.Cost_Blank_Standard || 0.75);
    if (inputs.qty >= bulkTrigger && data.Cost_Blank_Bulk) blankCost = parseFloat(data.Cost_Blank_Bulk);
    
    // Matrix Variable: Waste_Factor
    const waste = parseFloat(data.Waste_Factor || 1.10);
    const totalMatCost = (blankCost * waste) * inputs.qty;

    const areaSqFt = (24 * 18) / 144;
    const totalArea = areaSqFt * inputs.sides * inputs.qty;
    
    // Matrix Variable: Cost_Ink_Latex
    const totalInkCost = totalArea * parseFloat(data.Cost_Ink_Latex || 0.16);

    const costStakeUnit = inputs.hasStakes ? parseFloat(data.Cost_Stake || 0.65) : 0;
    const totalStakeCost = costStakeUnit * inputs.qty;

    // 2. Production Time & Labor
    const bedCap = parseFloat(data.Printer_Bed_Capacity || 3);
    const speed = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const lfPerSet = 2.0; // 24" feed length
    const totalRunHrs = ((lfPerSet / bedCap / speed) * inputs.sides) * inputs.qty;

    // Matrix Variables: Rate_Machine_Flatbed & Rate_Operator
    const costMachine = totalRunHrs * parseFloat(data.Rate_Machine_Flatbed || 45);
    const costOp = totalRunHrs * parseFloat(data.Rate_Operator || 25);

    // Matrix Variable: Time_Setup_Job
    const setupHrs = parseFloat(data.Time_Setup_Job || 15) / 60;
    const costSetup = setupHrs * parseFloat(data.Rate_Operator || 25);

    const totalCost = totalMatCost + totalInkCost + totalStakeCost + costMachine + costOp + costSetup;

    return {
        bom: { blanks: inputs.qty, stakes: inputs.hasStakes ? inputs.qty : 0, inkSqFt: totalArea },
        time: { runHrs: totalRunHrs, setupHrs: setupHrs },
        financials: { total: totalCost }
    };
}
