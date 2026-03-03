// signos-view-svg.js (v3.2 Layered CorelDraw Pipeline)
function renderPhysicsToScreen(manifest, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const DPI = 72; // Standard SVG Coordinate System (Points per Inch)
    const containerW = container.parentElement.clientWidth || 400;
    const maxAllowedH = 160;

    // Scale the 72DPI SVG down to fit the UI preview box
    const scale = Math.min((containerW * 0.9) / manifest.width, maxAllowedH / manifest.height);
    
    container.style.width = `${manifest.width * scale}px`;
    container.style.height = `${manifest.height * scale}px`;

    // Inject physical <rect> and <path> tags with metadata ID's attached
    container.innerHTML = `
        <svg id="live-production-preview" width="100%" height="100%"
            viewBox="0 0 ${manifest.width * DPI} ${manifest.height * DPI}"
            xmlns="http://www.w3.org/2000/svg"
            data-width-in="${manifest.width}" data-height-in="${manifest.height}"
            style="display: block;">
            
            <!-- Physical Substrate Backer -->
            <rect id="${manifest.substrateLayerName}" width="${manifest.width * DPI}" height="${manifest.height * DPI}" fill="${manifest.substrateColor}" />
            
            <!-- Scaled Ink Paths -->
            <g id="production_art" transform="scale(${DPI})">
                ${manifest.objects.map(obj => `
                    <path id="${obj.name}" d="${obj.d}" fill="${manifest.textColor}" transform="translate(${obj.x}, ${obj.y})" />
                `).join('')}
            </g>
        </svg>
    `;
}
