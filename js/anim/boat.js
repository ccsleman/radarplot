import { DEG_TO_RAD } from '../constants.js';

const WAKE_LENGTH_PX = 30;
const HULL_LENGTH_PX = 20;

export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function makeGradient(ctx, x1, y1, x2, y2, colorStart, colorEnd) {
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    return grad;
}

export function drawBoatHull(ctx, px, py, headingDeg, color, alpha) {
    const s = HULL_LENGTH_PX;
    const rad = headingDeg * DEG_TO_RAD;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rad);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.18, -s * 0.38, s * 0.25, -s * 0.15, s * 0.25, s * 0.05);
    ctx.lineTo(s * 0.22, s * 0.35);
    ctx.lineTo(s * 0.18, s * 0.5);
    ctx.lineTo(-s * 0.18, s * 0.5);
    ctx.lineTo(-s * 0.22, s * 0.35);
    ctx.lineTo(-s * 0.25, s * 0.05);
    ctx.bezierCurveTo(-s * 0.25, -s * 0.15, -s * 0.18, -s * 0.38, 0, -s * 0.5);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
}

export function drawWake(ctx, px, py, headingDeg, color, alpha) {
    const rad = headingDeg * DEG_TO_RAD;
    const dx = -Math.sin(rad);
    const dy = Math.cos(rad);

    const startX = px + dx * HULL_LENGTH_PX * 0.45;
    const startY = py + dy * HULL_LENGTH_PX * 0.45;
    const endX = startX + dx * WAKE_LENGTH_PX;
    const endY = startY + dy * WAKE_LENGTH_PX;

    const colorRgba = hexToRgba(color, 0.5 * alpha);
    const colorTransparent = hexToRgba(color, 0);

    ctx.strokeStyle = makeGradient(ctx, startX, startY, endX, endY, colorRgba, colorTransparent);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}
