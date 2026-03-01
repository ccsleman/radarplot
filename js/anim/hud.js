import { COLORS } from '../draw.js';

function chooseGridInterval(pixelsPerNM, canvasSize) {
    const niceIntervals = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
    const minPixelSpacing = 60;
    for (const interval of niceIntervals) {
        if (interval * pixelsPerNM >= minPixelSpacing) return interval;
    }
    return niceIntervals[niceIntervals.length - 1];
}

export function drawGrid(ctx, scene, nmToPixel) {
    const { bbox, pixelsPerNM, canvasW, canvasH } = scene;
    const interval = chooseGridInterval(pixelsPerNM, Math.min(canvasW, canvasH));

    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const visibleHalfW = (canvasW / 2) / pixelsPerNM;
    const visibleHalfH = (canvasH / 2) / pixelsPerNM;
    const visMinX = cx - visibleHalfW;
    const visMaxX = cx + visibleHalfW;
    const visMinY = cy - visibleHalfH;
    const visMaxY = cy + visibleHalfH;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.gridLabel;
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'left';

    const startX = Math.floor(visMinX / interval) * interval;
    const startY = Math.floor(visMinY / interval) * interval;

    for (let nmX = startX; nmX <= visMaxX; nmX += interval) {
        const { px } = nmToPixel(nmX, 0);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvasH);
        ctx.stroke();
    }

    for (let nmY = startY; nmY <= visMaxY; nmY += interval) {
        const { py } = nmToPixel(0, nmY);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvasW, py);
        ctx.stroke();

        ctx.fillText(`${nmY.toFixed(1)} NM`, 6, py - 3);
    }
}

export function drawNorthArrow(ctx, canvasW, canvasH) {
    const ax = canvasW - 30;
    const ay = canvasH - 25;
    const len = 22;

    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay + len / 2);
    ctx.lineTo(ax, ay - len / 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.moveTo(ax, ay - len / 2 - 4);
    ctx.lineTo(ax - 5, ay - len / 2 + 4);
    ctx.lineTo(ax + 5, ay - len / 2 + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 13px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('N', ax, ay - len / 2 - 8);
}

export function drawLiveDistance(ctx, canvasH, distNM, avoidDistNM) {
    const x = 10;
    const lineH = 18;
    const y = canvasH - 10 - lineH * (avoidDistNM !== null ? 1 : 0);

    ctx.font = '12px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Dist : ${distNM.toFixed(2)} NM`, x, y);

    if (avoidDistNM !== null) {
        ctx.fillStyle = 'rgba(224, 242, 255, 0.6)';
        ctx.fillText(`Dist' : ${avoidDistNM.toFixed(2)} NM`, x, y + lineH);
    }
}
