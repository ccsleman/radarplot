import { DEG_TO_RAD, MIN_MOVEMENT_SPEED } from './constants.js';
import { COLORS, RADAR_RANGES, setupCanvas, getCanvasLogical, drawArrowHead, drawPolarGrid } from './draw.js';

function createViewTransform(centerX, centerY, scale, rotation) {
    const c = rotation * DEG_TO_RAD;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    return {
        centerX, centerY, scale, rotation,
        toCanvas(nmX, nmY) {
            return {
                x: centerX + (nmX * cosC - nmY * sinC) * scale,
                y: centerY - (nmY * cosC + nmX * sinC) * scale,
            };
        },
    };
}

function drawHeadingLine(ctx, vt, maxRadius, headingDeg) {
    const rad = (headingDeg - vt.rotation) * DEG_TO_RAD;
    const endX = vt.centerX + maxRadius * Math.sin(rad);
    const endY = vt.centerY - maxRadius * Math.cos(rad);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vt.centerX, vt.centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}

function drawTargetPositions(ctx, vt, results) {
    const p1 = vt.toCanvas(results.pos1.x, results.pos1.y);
    const p2 = vt.toCanvas(results.pos2.x, results.pos2.y);

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

function drawCPAMarker(ctx, vt, cpaPoint, label, alpha = 1) {
    const cpa = vt.toCanvas(cpaPoint.x, cpaPoint.y);

    ctx.globalAlpha = alpha;

    ctx.fillStyle = COLORS.cpa;
    ctx.beginPath();
    ctx.arc(cpa.x, cpa.y, alpha < 1 ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.cpa;
    ctx.lineWidth = alpha < 1 ? 1.5 : 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(vt.centerX, vt.centerY);
    ctx.lineTo(cpa.x, cpa.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.cpa;
    ctx.font = `bold ${alpha < 1 ? 11 : 12}px Share Tech Mono`;
    ctx.textAlign = 'left';
    ctx.fillText(label, cpa.x + 12, cpa.y - 12);

    ctx.globalAlpha = 1;
}

function drawPredictionDash(ctx, vt, fromPoint, toPoint, alpha = 1) {
    const from = vt.toCanvas(fromPoint.x, fromPoint.y);
    const pred = vt.toCanvas(toPoint.x, toPoint.y);

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pred.x, pred.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(pred.x, pred.y, 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
}

export function resizeCanvas(canvas) {
    setupCanvas(canvas);
}

export function renderCanvas(canvas, model, results, avoidanceResults) {
    const ctx = canvas.getContext('2d');
    const { width, height } = getCanvasLogical(canvas);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 40;
    const { range, rings } = RADAR_RANGES[model.radarRangeIndex];
    const scale = maxRadius / range;
    const rotation = model.orientationMode === 'head-up' ? model.ownShip.course : 0;
    const vt = createViewTransform(centerX, centerY, scale, rotation);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    const nmPerRing = range / rings;
    const radarRingLabel = (i) => `${(i * nmPerRing) % 1 === 0 ? (i * nmPerRing) : (i * nmPerRing).toFixed(1)} NM`;
    drawPolarGrid(ctx, centerX, centerY, maxRadius, rings, radarRingLabel);
    drawHeadingLine(ctx, vt, maxRadius, model.ownShip.course);

    if (results) {
        drawTargetPositions(ctx, vt, results);
        if (results.relative.speed > MIN_MOVEMENT_SPEED) {
            drawPredictionDash(ctx, vt, results.pos2, results.prediction);
            drawCPAMarker(ctx, vt, results.cpa.point, 'CPA');
        }

        if (avoidanceResults && avoidanceResults.maneuverNeeded !== false
            && avoidanceResults.relative.speed > MIN_MOVEMENT_SPEED) {
            drawPredictionDash(ctx, vt, avoidanceResults.maneuverPoint, avoidanceResults.prediction, 0.45);
            drawCPAMarker(ctx, vt, avoidanceResults.cpa.point, 'CPA\'', 0.45);
        }
    }
}
