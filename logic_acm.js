/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.9.2)
 * Features: "Active Sheet" Visualization & Formatted BoM
 */
function calculateACM(inputs, data) {
    // --- 1. RETAIL ENGINE ---
    const sqFt = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqFt * inputs.qty;

    // Pricing Factors
    const baseRate = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_Base || 16.50) 
        : parseFloat(data.Retail_Price_3mm_Base || 14.00);

    const dsAdder = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_DS || 8.25) 
        : parseFloat(data.Retail_Price_3mm_DS || 7.00);

    let retMaterial = baseRate * sqFt;
    if (inputs.sides === 2) retMaterial += (dsAdder * sqFt);

    const lamRate = parseFloat(data.Retail_Price_Lam || 8.00);
    const retLam = (inputs.lam !== "None") ? (lamRate * sqFt) : 0;

    let retFinish = 0;
    const roundRate = parseFloat(data.Retail_Price_Rounded || 5.00);
    const contourPct = parseFloat(data.Retail_Adder_Contour_Pct || 0.35);

    if (inputs.shape === "Contour") {
        retFinish = retMaterial * contourPct;
    } else if (inputs.rounded) {
        retFinish = roundRate;
    }

    const unitPrice = retMaterial + retLam + retFinish;
    const totalProduct = unitPrice * inputs.qty;

    // Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const feeDesign = inputs.incDesign ? (inputs.designPerFile ? (feeDesignBase * inputs.files) : feeDesignBase) : 0;

    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = totalProduct + feeSetup + feeDesign;
    const grandTotal = Math.max(grandTotalRaw, minOrder + feeSetup + feeDesign);

    // --- 2. COST ENGINE (VISUAL NESTING) ---
    function generateSVG(layout, limitQty) {
        if (!layout) return "";

        const sw = layout.sheetW;
        const sh = layout.sheetH;

        // Styling
        const style = {
            sheetFill: "#ffffff",
            sheetStroke: "#475569", 
            partFill: "rgba(37, 99, 235, 0.2)", 
            partStroke: "#2563eb",
            dimText: "#64748b"
        };

        // VISUALIZATION LOGIC: 
        // If there is a remainder, show ONLY the remainder (Open Sheet).
        // If remainder is 0, show a Full Sheet.
        const remainder = limitQty % layout.perSheet;
        const itemsOnActiveSheet = (remainder === 0) ? layout.perSheet : remainder;

        let rects = "";
        let count = 0;
        outerLoop:
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                if (count >= itemsOnActiveSheet) break outerLoop;

                const x = c * layout.partW;
                const y = r * layout.partH;
                const label = `${layout.rotated ? inputs.h : inputs.w}x${layout.rotated ? inputs.w : inputs.h}`;
                const showLabel = (layout.partW > 5 && layout.partH > 5);

                rects += `<g transform="translate(${x}, ${y})">
                    <rect width="${layout.partW}" height="${layout.partH}" 
                          fill="${style.partFill}" 
                          stroke="${style.partStroke}" 
                          stroke-width="0.1" />
                    ${showLabel ? 
                        `<text x="${layout.partW/2}" y="${layout.partH/2}" 
                               font-family="sans-serif" font-size="1.5" 
                               fill="${style.partStroke}" text-anchor="middle" 
                               dominant-baseline="middle" font-weight="bold" opacity="0.9">${label}</text>` 
                    : ''}
                </g>`;
                count++;
            }
        }

        // Add Dimensions text
        const dims = `<text x="${sw/2}" y="-2" font-family="sans-serif" font-size="2" fill="${style.dimText}" text-anchor="middle">${sw}"</text>
                      <text x="-2" y="${sh/2}" font-family="sans-serif" font-size="2" fill="${style.dimText}" text-anchor="middle" transform="rotate(-90, -2, ${sh/2})">${sh}"</text>`;

        return `<svg viewBox="-5 -5 ${sw+10} ${sh+10}" preserveAspectRatio="xMidYMid meet" 
                     style="width:100%; height:100%; display:block; overflow:visible;">
            ${dims}
            <rect width="${sw}" height="${sh}" fill="${style.sheetFill}" stroke="${style.sheetStroke}" stroke-width="0.5" vector-effect="non-scaling-stroke" />
            ${rects}
        </svg>`;
    }

    function findBestStock(w, h, qty, thick) {
        const stocks = [
            { name: "4'x8'", sw: 48, sh: 96, cost: parseFloat(data[`Cost_Stock_${thick}_4x8`] || 52) },
            { name: "4'x10'", sw: 48, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_4x10`] || 69) },
            { name: "5'x10'", sw: 60, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_5x10`] || 75) }
        ];

        let best = { cost: Infinity, name: "N/A", sheets: 0, layout: null, stats: {} };

        stocks.forEach(stock => {
            // Rotation 1
            const colsA = Math.floor(stock.sw / w);
            const rowsA = Math.floor(stock.sh / h);
            const yieldA = colsA * rowsA;

            // Rotation 2
            const colsB = Math.floor(stock.sw / h);
            const rowsB = Math.floor(stock.sh / w);
            const yieldB = colsB * rowsB;

            const maxYield = Math.max(yieldA, yieldB);

            if (maxYield > 0) {
                const sheetsNeeded = Math.ceil(qty / maxYield);
                const totalRunCost = sheetsNeeded * stock.cost;

                if (totalRunCost < best.cost) {
                    const isRotated = yieldB > yieldA;
                    
                    // Stats
                    const remainder = qty % maxYield;
                    const itemsOnLast = (remainder === 0) ? maxYield : remainder;
                    const fullSheets = (remainder === 0) ? (qty / maxYield) : Math.floor(qty / maxYield);
                    const partialSheets = (remainder === 0) ? 0 : 1;
                    
                    // Waste Calc (True Area)
                    const usedArea = itemsOnLast * ((isRotated ? h : w) * (isRotated ? w : h));
                    const totalSheetArea = stock.sw * stock.sh;
                    const wastePct = ((1 - (usedArea / totalSheetArea)) * 100).toFixed(0);

                    best = {
                        cost: totalRunCost,
                        name: stock.name,
                        sheets: sheetsNeeded,
                        stats: {
                            formattedStock: `(x${sheetsNeeded}) ${stock.name}`, // New Format
                            full: fullSheets,
                            partial: partialSheets,
                            waste: wastePct
                        },
                        layout: {
                            sheetW: stock.sw,
                            sheetH: stock.sh,
                            partW: isRotated ? h : w,
                            partH: isRotated ? w : h,
                            cols: isRotated ? colsB : colsA,
                            rows: isRotated ? rowsB : rowsA,
                            perSheet: maxYield,
                            rotated: isRotated
                        }
                    };
                }
            }
        });
        return best;
    }

    const optStock = findBestStock(inputs.w, inputs.h, inputs.qty, inputs.thickness);
    const maxLen = 120; const maxWid = 60; 
    const isOversized = (Math.max(inputs.w, inputs.h) > maxLen || Math.min(inputs.w, inputs.h) > maxWid);
    if (isOversized) { optStock.name = "OVERSIZED"; optStock.cost = 0; }

    // Generate SVG (Using Logic: Remainder OR Full)
    optStock.svg = generateSVG(optStock.layout, inputs.qty);

    // Costing
    const waste = parseFloat(data.Waste_Factor || 1.2);
    const totalMatBoard = optStock.cost * waste; 
    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
    const costLam = (inputs.lam !== "None") ? (totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36)) : 0;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateMach = parseFloat(data.Rate_Machine_Print || 45);
    const rateCNC = parseFloat(data.Rate_Machine_CNC || 35);

    let cutTime = 0;
    let machineRate = 0;
    if (inputs.shape === "Contour") {
        cutTime = parseFloat(data.Time_Setup_CNC || 10) + (parseFloat(data.Time_Cut_Contour || 8) * inputs.qty);
        machineRate = rateCNC;
    } else {
        const shearTime = parseFloat(data.Time_Shear_Base || 5) + (parseFloat(data.Time_Shear_Add || 3) * inputs.qty);
        const roundTime = inputs.rounded ? (parseFloat(data.Time_Round_Corn || 2) * inputs.qty) : 0;
        cutTime = shearTime + roundTime;
    }

    const printTimeHrs = (inputs.h / 12 * inputs.qty) / parseFloat(data.Speed_Print_LF || 25);
    const costLabor = ((printTimeHrs * 60) + cutTime) * (rateOp/60);
    const costMachine = (printTimeHrs * rateMach) + ((cutTime/60) * machineRate);
    const totalCost = totalMatBoard + inkCost + costLam + costLabor + costMachine;

    // --- 3. VENDED ENGINE ---
    const vendKey = `S365_${inputs.thickness}_${inputs.sides===2?'DS':'SS'}_SqFt`;
    const vendRate = parseFloat(data[vendKey] || 7.20);
    let vendTotal = (totalSqFt * vendRate);
    
    if (inputs.shape === "Contour") vendTotal *= (1 + parseFloat(data.S365_Contour_Pct || 0.1));
    else if (inputs.rounded) vendTotal += (inputs.qty * parseFloat(data.S365_Rounded_Fee || 5));
    if (inputs.lam === "Gloss") vendTotal += (inputs.qty * parseFloat(data.S365_Gloss_Rate || 4));

    let shipCost = parseFloat(data.Ship_T1_Rate || 10);
    if (inputs.w > 24 || inputs.h > 24) shipCost = parseFloat(data.Ship_T2_Rate || 15);
    if (inputs.w > 36 || inputs.h > 36) shipCost = parseFloat(data.Ship_T3_Rate || 35);
    if (inputs.w > 46 || inputs.h > 46) shipCost = parseFloat(data.Ship_T4_Rate_Low || 50);
    if (totalSqFt > 100) shipCost = parseFloat(data.Ship_Freight_Cost || 199);

    return {
        retail: {
            unitPrice: unitPrice,
            grandTotal: grandTotal,
            breakdown: { material: retMaterial, laminate: retLam, finish: retFinish },
            fees: { setup: feeSetup, design: feeDesign },
            isMinApplied: grandTotalRaw < (minOrder + feeSetup + feeDesign),
            isOversized: isOversized
        },
        cost: {
            total: totalCost,
            unit: totalCost / inputs.qty,
            stock: optStock
        },
        vended: {
            total: vendTotal + shipCost,
            unit: (vendTotal + shipCost) / inputs.qty,
            shipping: shipCost
        },
        metrics: {
            marginInHouse: (grandTotal - totalCost) / grandTotal,
            marginVended: (grandTotal - (vendTotal + shipCost)) / grandTotal
        }
    };
}
