import { DEG_TO_RAD, RAD_TO_DEG, normalizeBearing } from './constants.js';
import {
    COLORS, NICE_SCALES, RING_COUNT, BASE_KTS_PER_RING,
    setupCanvas, getCanvasLogical, bearingToCanvasOffset, drawArrowHead, drawPolarGrid,
} from './draw.js';

const MAX_CHART_KNOTS = RING_COUNT * BASE_KTS_PER_RING;

let triangleState = null;

function scaleLabel(scaleIndex) {
    return `\u00C9chelle : ${NICE_SCALES[scaleIndex].label}`;
}

export function renderScaleLabel(el, scaleIndex) {
    if (scaleIndex !== null) {
        el.textContent = scaleLabel(scaleIndex);
    }
}

function createTriangleTransform(centerX, centerY, pixelsPerKnot, rotation) {
    return { centerX, centerY, pixelsPerKnot, rotation };
}

function drawOwnShipVector(ctx, tt, model) {
    if (model.ownShip.speed <= 0) return { x: tt.centerX, y: tt.centerY };

    const offset = bearingToCanvasOffset(model.ownShip.course, model.ownShip.speed, tt.pixelsPerKnot, tt.rotation);
    const endX = tt.centerX + offset.dx;
    const endY = tt.centerY + offset.dy;

    ctx.strokeStyle = COLORS.ownShip;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tt.centerX, tt.centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    drawArrowHead(ctx, tt.centerX, tt.centerY, endX, endY, COLORS.ownShip, 12);

    ctx.fillStyle = COLORS.ownShip;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`${model.ownShip.speed.toFixed(1)} kts`, endX + 8, endY);

    return { x: endX, y: endY };
}

function drawRelativeVector(ctx, tt, fromX, fromY, results) {
    const offset = bearingToCanvasOffset(results.relative.course, results.relative.speed, tt.pixelsPerKnot, tt.rotation);
    const endX = fromX + offset.dx;
    const endY = fromY + offset.dy;

    ctx.strokeStyle = COLORS.relative;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    drawArrowHead(ctx, fromX, fromY, endX, endY, COLORS.relative, 12);

    ctx.fillStyle = COLORS.relative;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    const midX = (fromX + endX) / 2;
    const midY = (fromY + endY) / 2;
    ctx.fillText(`Relatif ${results.relative.speed.toFixed(1)} kts`, midX + 5, midY - 5);

    return { x: endX, y: endY };
}

function drawTrueTargetVector(ctx, centerX, centerY, targetEnd, results) {
    ctx.strokeStyle = COLORS.trueVector;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(targetEnd.x, targetEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowHead(ctx, centerX, centerY, targetEnd.x, targetEnd.y, COLORS.trueVector, 12);

    ctx.fillStyle = COLORS.trueVector;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'right';
    ctx.fillText(`Vrai ${results.trueTarget.speed.toFixed(1)} kts`, targetEnd.x - 8, targetEnd.y);
}

function drawOriginDot(ctx, centerX, centerY) {
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
}

export function resizeTriangleCanvas(canvas) {
    setupCanvas(canvas);
}

function drawAvoidanceVectors(ctx, tt, targetEnd, model, avoidanceResults) {
    const offset = bearingToCanvasOffset(model.avoidance.course, model.avoidance.speed, tt.pixelsPerKnot, tt.rotation);
    const newOwnEndX = tt.centerX + offset.dx;
    const newOwnEndY = tt.centerY + offset.dy;

    ctx.globalAlpha = 0.4;

    ctx.strokeStyle = COLORS.ownShip;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(tt.centerX, tt.centerY);
    ctx.lineTo(newOwnEndX, newOwnEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowHead(ctx, tt.centerX, tt.centerY, newOwnEndX, newOwnEndY, COLORS.ownShip, 10);

    ctx.fillStyle = COLORS.ownShip;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`${model.avoidance.speed.toFixed(1)} kts`, newOwnEndX + 8, newOwnEndY);

    ctx.strokeStyle = COLORS.relative;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(newOwnEndX, newOwnEndY);
    ctx.lineTo(targetEnd.x, targetEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowHead(ctx, newOwnEndX, newOwnEndY, targetEnd.x, targetEnd.y, COLORS.relative, 10);

    ctx.fillStyle = COLORS.relative;
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    const midX = (newOwnEndX + targetEnd.x) / 2;
    const midY = (newOwnEndY + targetEnd.y) / 2;
    ctx.fillText(`Relatif' ${avoidanceResults.relative.speed.toFixed(1)} kts`, midX + 5, midY - 5);

    ctx.globalAlpha = 1.0;
}

/* ── Drag interaction ── */

const HIT_RADIUS = 20;

function canvasCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function canvasToCourseSpeed(st, mx, my) {
    const relX = mx - st.centerX;
    const relY = my - st.centerY;
    const c = st.rotation * DEG_TO_RAD;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    const nmX = (relX * cosC - relY * sinC) / st.pixelsPerKnot;
    const nmY = (-relX * sinC - relY * cosC) / st.pixelsPerKnot;
    const course = normalizeBearing(Math.atan2(nmX, nmY) * RAD_TO_DEG);
    const speed = Math.max(0, Math.sqrt(nmX * nmX + nmY * nmY));
    return { course, speed };
}

function isNearTip(st, mx, my) {
    const dx = mx - st.tipX;
    const dy = my - st.tipY;
    return dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS;
}

function isNearAvoidanceTip(st, mx, my, model) {
    const offset = bearingToCanvasOffset(model.avoidance.course, model.avoidance.speed, st.pixelsPerKnot, st.rotation);
    const tipX = st.centerX + offset.dx;
    const tipY = st.centerY + offset.dy;
    const dx = mx - tipX;
    const dy = my - tipY;
    return dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS;
}

export function setupTriangleInteraction(canvas, model) {
    let dragging = false;

    function onPointerDown(e) {
        const pos = canvasCoords(canvas, e);
        const st = triangleState;
        if (!st) return;

        const nearTip = model.avoidance.active
            ? isNearAvoidanceTip(st, pos.x, pos.y, model)
            : isNearTip(st, pos.x, pos.y);
        if (!nearTip) return;

        dragging = true;
        canvas.style.cursor = 'grabbing';
        if (e.cancelable) e.preventDefault();

        if (!model.avoidance.active) {
            const cs = canvasToCourseSpeed(st, pos.x, pos.y);
            if (cs) model.setAvoidance(cs.course, cs.speed);
        }
    }

    function onPointerMove(e) {
        const pos = canvasCoords(canvas, e);
        const st = triangleState;
        if (dragging) {
            if (e.cancelable) e.preventDefault();
            if (st) {
                const cs = canvasToCourseSpeed(st, pos.x, pos.y);
                if (cs) model.setAvoidance(cs.course, cs.speed);
            }
            return;
        }
        if (!st) return;
        const nearTip = model.avoidance.active
            ? isNearAvoidanceTip(st, pos.x, pos.y, model)
            : isNearTip(st, pos.x, pos.y);
        canvas.style.cursor = nearTip ? 'grab' : 'crosshair';
    }

    function onPointerUp() {
        if (dragging) {
            dragging = false;
            canvas.style.cursor = 'crosshair';
        }
    }

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
}

/* ── Rendering ── */

export function renderTriangle(canvas, model, results, avoidanceResults) {
    const ctx = canvas.getContext('2d');
    const { width, height } = getCanvasLogical(canvas);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 40;
    const rotation = model.orientationMode === 'head-up' ? model.ownShip.course : 0;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    const ringLabel = (i) => `${i * BASE_KTS_PER_RING} kts`;
    drawPolarGrid(ctx, centerX, centerY, maxRadius, RING_COUNT, ringLabel);

    ctx.fillStyle = COLORS.triangleTitle;
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('TRIANGLE DES VITESSES', centerX, 25);

    if (!results) {
        triangleState = null;
        drawOriginDot(ctx, centerX, centerY);
        return;
    }

    const scaleFactor = NICE_SCALES[model.triangleScaleIndex]?.value ?? 1;
    const pixelsPerKnot = scaleFactor * maxRadius / MAX_CHART_KNOTS;
    const tt = createTriangleTransform(centerX, centerY, pixelsPerKnot, rotation);

    const ownEnd = drawOwnShipVector(ctx, tt, model);
    const targetEnd = drawRelativeVector(ctx, tt, ownEnd.x, ownEnd.y, results);
    drawTrueTargetVector(ctx, centerX, centerY, targetEnd, results);

    if (model.avoidance.active && avoidanceResults) {
        drawAvoidanceVectors(ctx, tt, targetEnd, model, avoidanceResults);
    }

    drawOriginDot(ctx, centerX, centerY);

    triangleState = {
        tipX: ownEnd.x,
        tipY: ownEnd.y,
        centerX,
        centerY,
        pixelsPerKnot,
        rotation,
    };
}
