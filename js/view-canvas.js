import { COLORS, setupCanvas, drawArrowHead, drawPolarGrid } from './draw.js';

function nmToCanvas(nmX, nmY, centerX, centerY, scale, rotationDeg) {
    const c = rotationDeg * Math.PI / 180;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    return {
        x: centerX + (nmX * cosC - nmY * sinC) * scale,
        y: centerY - (nmY * cosC + nmX * sinC) * scale
    };
}

function drawHeadingLine(ctx, centerX, centerY, maxRadius, rotation, headingDeg) {
    const rad = (headingDeg - rotation) * Math.PI / 180;
    const endX = centerX + maxRadius * Math.sin(rad);
    const endY = centerY - maxRadius * Math.cos(rad);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}

function drawTargetPositions(ctx, centerX, centerY, scale, rotation, results) {
    const p1 = nmToCanvas(results.pos1.x, results.pos1.y, centerX, centerY, scale, rotation);
    const p2 = nmToCanvas(results.pos2.x, results.pos2.y, centerX, centerY, scale, rotation);

    ctx.fillStyle = COLORS.target;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '12px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText('P1', p1.x + 10, p1.y - 10);
    ctx.fillText('P2', p2.x + 10, p2.y - 10);

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    drawArrowHead(ctx, p1.x, p1.y, p2.x, p2.y, COLORS.target, 10);
}

function drawCPA(ctx, centerX, centerY, scale, rotation, results) {
    if (results.relative.speed <= 0.1) return;

    const cpa = nmToCanvas(results.cpa.point.x, results.cpa.point.y, centerX, centerY, scale, rotation);

    ctx.fillStyle = COLORS.cpa;
    ctx.beginPath();
    ctx.arc(cpa.x, cpa.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.cpa;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(cpa.x, cpa.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.cpa;
    ctx.font = 'bold 12px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText('CPA', cpa.x + 12, cpa.y - 12);
}

function drawPredictionLine(ctx, centerX, centerY, scale, rotation, results) {
    if (results.relative.speed <= 0.1) return;

    const p2 = nmToCanvas(results.pos2.x, results.pos2.y, centerX, centerY, scale, rotation);
    const pred = nmToCanvas(results.prediction.x, results.prediction.y, centerX, centerY, scale, rotation);

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(pred.x, pred.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pred.x, pred.y, 4, 0, Math.PI * 2);
    ctx.stroke();
}

function drawAvoidancePrediction(ctx, centerX, centerY, scale, rotation, avoidanceResults) {
    if (avoidanceResults.relative.speed <= 0.1) return;

    const mp = nmToCanvas(avoidanceResults.maneuverPoint.x, avoidanceResults.maneuverPoint.y, centerX, centerY, scale, rotation);
    const pred = nmToCanvas(avoidanceResults.prediction.x, avoidanceResults.prediction.y, centerX, centerY, scale, rotation);

    ctx.globalAlpha = 0.45;

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mp.x, mp.y);
    ctx.lineTo(pred.x, pred.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pred.x, pred.y, 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

function drawAvoidanceCPA(ctx, centerX, centerY, scale, rotation, avoidanceResults) {
    if (avoidanceResults.relative.speed <= 0.1) return;

    const cpa = nmToCanvas(avoidanceResults.cpa.point.x, avoidanceResults.cpa.point.y, centerX, centerY, scale, rotation);

    ctx.globalAlpha = 0.45;

    ctx.fillStyle = COLORS.cpa;
    ctx.beginPath();
    ctx.arc(cpa.x, cpa.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.cpa;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(cpa.x, cpa.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.cpa;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText('CPA\'', cpa.x + 10, cpa.y - 10);

    ctx.globalAlpha = 1.0;
}

const RADAR_RING_COUNT = 4;
const NM_PER_RING = 5;

export function resizeCanvas(canvas) {
    canvas._logical = setupCanvas(canvas);
}

export function renderCanvas(canvas, model, results, avoidanceResults) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas._logical;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 40;
    const scale = maxRadius / 20;
    const rotation = model.orientationMode === 'head-up' ? model.ownShip.course : 0;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    const radarRingLabel = (i) => `${i * NM_PER_RING} NM`;
    drawPolarGrid(ctx, centerX, centerY, maxRadius, RADAR_RING_COUNT, radarRingLabel);
    drawHeadingLine(ctx, centerX, centerY, maxRadius, rotation, model.ownShip.course);

    if (results) {
        drawTargetPositions(ctx, centerX, centerY, scale, rotation, results);
        drawPredictionLine(ctx, centerX, centerY, scale, rotation, results);
        drawCPA(ctx, centerX, centerY, scale, rotation, results);

        if (avoidanceResults) {
            drawAvoidancePrediction(ctx, centerX, centerY, scale, rotation, avoidanceResults);
            drawAvoidanceCPA(ctx, centerX, centerY, scale, rotation, avoidanceResults);
        }
    }
}
