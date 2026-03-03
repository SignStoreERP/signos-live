// signos-export-v2.js (v3.1 CorelDraw Pipeline)
function downloadProductionSVG() {
    const svgEl = document.getElementById('live-production-preview');
    if (!svgEl) return alert("Build a sign first!");

    // Extract the raw physical dimensions we hid in data-attributes
    const w = parseFloat(svgEl.getAttribute('data-width-in'));
    const h = parseFloat(svgEl.getAttribute('data-height-in'));

    // Extract the exact inner contents (the rect and the scaled text paths)
    const innerContent = svgEl.innerHTML;

    // Build a perfectly clean, CorelDraw-friendly SVG wrapper
    const cleanSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * 72} ${h * 72}" xmlns="http://www.w3.org/2000/svg">
    ${innerContent}
</svg>`;

    const blob = new Blob([cleanSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_PROD_Nameplate_${w}x${h}.svg`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function downloadBulkProductionSVG() {
    if (!currentManifests || currentManifests.length === 0) return alert("Build a batch first!");

    const DPI = 72; 
    const sheetW = 48; // 48 inches wide
    const sheetH = 24; // 24 inches tall
    const gap = 0.25;  // 1/4 inch gap between signs
    const margin = 0.25; // 1/4 inch border margin

    let svgContent = '';
    let currentX = margin;
    let currentY = margin;
    let totalSigns = 0;

    currentManifests.forEach((item, index) => {
        if(!item.manifest) return;
        const man = item.manifest;

        for(let q = 0; q < item.qty; q++) {
            // If the next sign pushes past the 48" width, carriage return to the next row!
            if (currentX + man.width > sheetW - margin) {
                currentX = margin;
                currentY += man.height + gap;
            }

            // Build this specific sign's group and translate it to the current X/Y coordinate
            let signGroup = `
            <!-- Sign #${index+1} | Copy ${q+1} -->
            <g id="${man.substrateLayerName}_S${index+1}_Q${q+1}" transform="translate(${currentX * DPI}, ${currentY * DPI})">
                <rect width="${man.width * DPI}" height="${man.height * DPI}" fill="${man.substrateColor}" stroke="#000000" stroke-width="0.5"/>
                <g transform="scale(${DPI})">
                    ${man.objects.map(obj => `
                        <path id="${obj.name}" d="${obj.d}" fill="${man.textColor}" transform="translate(${obj.x}, ${obj.y})" />
                    `).join('')}
                </g>
            </g>`;

            svgContent += signGroup;

            // Move the X coordinate over for the next sign
            currentX += man.width + gap;
            totalSigns++;
        }
    });

    // FIX: Using .at(0) instead of square brackets to safely check the height!
    const firstManifest = currentManifests.at(0).manifest;
    if (currentY + firstManifest.height > sheetH - margin) {
        alert("Note: This batch requires more than one 48x24 sheet. The overflowing signs will be located below the artboard boundary in CorelDraw.");
    }

    // Wrap the entire nested layout in a strict 48x24 production artboard
    const cleanSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${sheetW}in" height="${sheetH}in" viewBox="0 0 ${sheetW * DPI} ${sheetH * DPI}" xmlns="http://www.w3.org/2000/svg">
    <!-- 48x24 Sheet Boundary Reference -->
    <rect width="${sheetW * DPI}" height="${sheetH * DPI}" fill="none" stroke="red" stroke-width="2"/>
    ${svgContent}
</svg>`;

    const blob = new Blob([cleanSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_BULK_CutSheet_48x24_${totalSigns}qty.svg`;
    a.click();
    URL.revokeObjectURL(url);
}
