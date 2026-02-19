import { polarToCartesian } from './calculator.js';

export const NICE_SCALES = [
    { value: 1/4, label: '1/4' },
    { value: 1/3, label: '1/3' },
    { value: 1/2, label: '1/2' },
    { value: 1,   label: '1' },
    { value: 2,   label: '2' },
    { value: 3,   label: '3' },
    { value: 4,   label: '4' },
];
export const RING_COUNT = 4;
export const BASE_KTS_PER_RING = 5;

export const COLORS = {
    background: '#0a1929',
    grid: 'rgba(74, 144, 226, 0.2)',
    gridLabel: 'rgba(148, 184, 216, 0.6)',
    angleLabel: 'rgba(148, 184, 216, 0.8)',
    ownShip: '#00ff41',
    target: '#ffa500',
    relative: '#4a90e2',
    trueVector: '#ff3b3b',
    cpa: '#a855f7',
    white: '#ffffff',
    triangleTitle: 'rgba(148, 184, 216, 0.8)'
};

export function bearingToCanvasOffset(bearingDeg, magnitude, pixelScale, rotationDeg) {
    const nm = polarToCartesian(bearingDeg, magnitude);
    const c = rotationDeg * Math.PI / 180;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    return {
        dx: (nm.x * cosC - nm.y * sinC) * pixelScale,
        dy: -(nm.y * cosC + nm.x * sinC) * pixelScale
    };
}

export function drawArrowHead(ctx, fromX, fromY, toX, toY, color, size) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

export function setupCanvas(canvas) {
    const container = canvas.parentElement;
    const cssWidth = container.getBoundingClientRect().width - 32;
    const cssHeight = cssWidth;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { width: cssWidth, height: cssHeight };
}

export function drawPolarGrid(ctx, centerX, centerY, maxRadius, ringCount, ringLabelFn) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let i = 1; i <= ringCount; i++) {
        const radius = (maxRadius / ringCount) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = COLORS.gridLabel;
        ctx.font = '10px Share Tech Mono';
        ctx.textAlign = 'left';
        ctx.fillText(ringLabelFn(i), centerX + 5, centerY - radius + 5);
    }

    for (let angle = 0; angle < 360; angle += 30) {
        const rad = angle * Math.PI / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);

        ctx.strokeStyle = COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + maxRadius * dx, centerY + maxRadius * dy);
        ctx.stroke();

        const labelR = maxRadius + 20;
        ctx.fillStyle = COLORS.angleLabel;
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(`${angle}\u00B0`, centerX + labelR * dx, centerY + labelR * dy);
    }
}
