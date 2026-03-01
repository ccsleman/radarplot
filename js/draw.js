import { DEG_TO_RAD } from './constants.js';
import { polarToCartesian } from './calculator.js';

const canvasLogical = new WeakMap();

export function setCanvasLogical(canvas, logical) {
    canvasLogical.set(canvas, logical);
}

export function getCanvasLogical(canvas) {
    return canvasLogical.get(canvas);
}

export const NICE_SCALES = [
    { value: 1/5, label: '1/5' },
    { value: 1/4, label: '1/4' },
    { value: 1/3, label: '1/3' },
    { value: 1/2, label: '1/2' },
    { value: 1,   label: '1' },
    { value: 2,   label: '2' },
    { value: 3,   label: '3' },
    { value: 4,   label: '4' },
];
export const RING_COUNT = 6;
export const BASE_KTS_PER_RING = 2;
export const MAX_CHART_KNOTS = RING_COUNT * BASE_KTS_PER_RING;

export const RADAR_RANGES = [
    { range: 3,  rings: 3, label: '3 NM' },
    { range: 6,  rings: 3, label: '6 NM' },
    { range: 12, rings: 4, label: '12 NM' },
    { range: 24, rings: 4, label: '24 NM' },
    { range: 48, rings: 4, label: '48 NM' },
];
export const DEFAULT_RADAR_RANGE_INDEX = 3;

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
};

export function bearingToCanvasOffset(bearingDeg, magnitude, pixelScale, rotationDeg) {
    const nm = polarToCartesian(bearingDeg, magnitude);
    const c = rotationDeg * DEG_TO_RAD;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    return {
        dx: (nm.x * cosC - nm.y * sinC) * pixelScale,
        dy: -(nm.y * cosC + nm.x * sinC) * pixelScale,
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

    const logical = { width: cssWidth, height: cssHeight };
    setCanvasLogical(canvas, logical);
    return logical;
}

export function drawTriangleGrid(ctx, centerX, centerY, maxRadius) {
    const detail = maxRadius > 180 ? 'full' : maxRadius > 110 ? 'medium' : 'small';
    const isFull = detail === 'full';

    const ringCount = RING_COUNT;
    const totalUnits = MAX_CHART_KNOTS;
    const ringStep = maxRadius / ringCount;
    const pxPerUnit = maxRadius / totalUnits;

    const ringSkip = detail === 'small' ? 2 : 1;
    const radialStep = isFull ? 10 : detail === 'medium' ? 10 : 30;
    const innerRadius = radialStep > 10 ? 0 : ringStep * ringSkip;
    const tickStep = 1;
    const showSubTicks = isFull;
    const degLabelStep = isFull ? 10 : detail === 'medium' ? 10 : 30;
    const rulerFont = isFull ? '10px Share Tech Mono' : detail === 'medium' ? '9px Share Tech Mono' : '8px Share Tech Mono';
    const degFont = isFull ? '12px Orbitron' : detail === 'medium' ? '11px Orbitron' : '9px Orbitron';
    const boldRings = new Set([2, 3]);

    ctx.strokeStyle = COLORS.grid;
    for (let i = ringSkip; i <= ringCount; i += ringSkip) {
        const radius = ringStep * i;
        ctx.lineWidth = boldRings.has(i) ? 1.8 : 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let angle = 0; angle < 360; angle += radialStep) {
        if (angle === 90) continue;
        const rad = angle * DEG_TO_RAD;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        ctx.beginPath();
        ctx.moveTo(centerX + innerRadius * dx, centerY + innerRadius * dy);
        ctx.lineTo(centerX + maxRadius * dx, centerY + maxRadius * dy);
        ctx.stroke();
    }

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    const intTickHalf = 5;
    const subTickHalf = 2.5;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let u = 0; u <= totalUnits; u += tickStep) {
        const x = centerX + u * pxPerUnit;
        ctx.beginPath();
        ctx.moveTo(x, centerY - intTickHalf);
        ctx.lineTo(x, centerY + intTickHalf);
        ctx.stroke();

        if (showSubTicks && u < totalUnits) {
            for (let s = 1; s <= 4; s++) {
                const sx = x + s * 0.2 * pxPerUnit;
                ctx.beginPath();
                ctx.moveTo(sx, centerY - subTickHalf);
                ctx.lineTo(sx, centerY + subTickHalf);
                ctx.stroke();
            }
        }
    }

    ctx.font = rulerFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = centerY - intTickHalf - 2;
    const pad = 2;
    const rulerFontSize = isFull ? 11 : detail === 'medium' ? 10 : 9;
    for (let u = 0; u <= totalUnits - 1; u += tickStep) {
        const x = centerX + u * pxPerUnit;
        const text = `${u}`;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(x - tw / 2 - pad, labelY - rulerFontSize - pad, tw + pad * 2, rulerFontSize + 1 + pad * 2);
        ctx.fillStyle = COLORS.gridLabel;
        ctx.fillText(text, x, labelY);
    }

    {
        const outerTickLen = 5;
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let angle = 0; angle < 360; angle += 2) {
            // Suppress minor rim ticks where a major radial line exists at current detail level.
            if (angle % radialStep === 0) continue;
            const rad = angle * DEG_TO_RAD;
            const dx = Math.sin(rad);
            const dy = -Math.cos(rad);
            ctx.beginPath();
            ctx.moveTo(centerX + maxRadius * dx, centerY + maxRadius * dy);
            ctx.lineTo(centerX + (maxRadius - outerTickLen) * dx, centerY + (maxRadius - outerTickLen) * dy);
            ctx.stroke();
        }
    }

    ctx.fillStyle = COLORS.angleLabel;
    ctx.font = degFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelR = maxRadius + (isFull ? 20 : 16);
    const degW = ctx.measureText('\u00B0').width;
    for (let angle = 0; angle < 360; angle += degLabelStep) {
        const rad = angle * DEG_TO_RAD;
        const sinA = Math.sin(rad);
        const leftFactor = Math.max(0, -sinA);
        const xOffset = degW / 2 - leftFactor * leftFactor * degW;
        ctx.fillText(`${angle}\u00B0`, centerX + labelR * sinA + xOffset, centerY - labelR * Math.cos(rad));
    }
}

export function drawPolarGrid(ctx, centerX, centerY, maxRadius, ringCount, ringLabelFn, options = {}) {
    const { minorAngleStep } = options;
    const innerRadius = minorAngleStep ? maxRadius / ringCount : 0;
    const radialStep = minorAngleStep || 30;

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

    for (let angle = 0; angle < 360; angle += radialStep) {
        const rad = angle * DEG_TO_RAD;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        ctx.beginPath();
        ctx.moveTo(centerX + innerRadius * dx, centerY + innerRadius * dy);
        ctx.lineTo(centerX + maxRadius * dx, centerY + maxRadius * dy);
        ctx.stroke();
    }

    ctx.fillStyle = COLORS.angleLabel;
    ctx.font = '12px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const degW = ctx.measureText('\u00B0').width;
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = angle * DEG_TO_RAD;
        const labelR = maxRadius + 20;
        const sinA = Math.sin(rad);
        const leftFactor = Math.max(0, -sinA);
        const xOffset = degW / 2 - leftFactor * leftFactor * degW;
        ctx.fillText(`${angle}\u00B0`, centerX + labelR * sinA + xOffset, centerY - labelR * Math.cos(rad));
    }
}
