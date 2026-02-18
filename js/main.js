import { createModel } from './model.js';
import { displayToTrue } from './bearings.js';
import { computeResults, computeAvoidanceResults } from './calculator.js';
import { renderForm } from './view-form.js';
import { renderCanvas, resizeCanvas } from './view-canvas.js';
import { renderTriangle, resizeTriangleCanvas, bestFitScaleIndex, scaleLabel } from './view-triangle.js';
import { bearingToCanvasOffset as bearingToCanvasOffsetImport } from './draw.js';

const model = createModel();
const radarCanvas = document.getElementById('radarCanvas');
const triangleCanvas = document.getElementById('triangleCanvas');
const scaleLabelEl = document.getElementById('scaleLabel');
const avoidanceOverlay = document.getElementById('avoidanceOverlay');
const avoidanceDistInput = document.getElementById('avoidanceDistance');

function render() {
    const results = computeResults(model.currentTarget, model.ownShip);

    let avoidanceResults = null;
    if (model.avoidance.active && results) {
        const clampedDist = Math.min(model.avoidance.distance, model.currentTarget.distance2);
        avoidanceResults = computeAvoidanceResults(
            results,
            model.avoidance.course,
            model.avoidance.speed,
            clampedDist
        );
        if (!avoidanceResults) {
            avoidanceResults = computeAvoidanceResults(
                results,
                model.avoidance.course,
                model.avoidance.speed,
                model.currentTarget.distance2
            );
        }
    }

    if (!model.triangleScaleManual && results) {
        const maxSpeed = Math.max(model.ownShip.speed, results.trueTarget.speed);
        model.triangleScaleIndex = bestFitScaleIndex(maxSpeed);
    }

    renderForm(model, results, avoidanceResults);
    renderCanvas(radarCanvas, model, results, avoidanceResults);
    renderTriangle(triangleCanvas, model, results, avoidanceResults);

    if (model.triangleScaleIndex !== null) {
        scaleLabelEl.textContent = scaleLabel(model.triangleScaleIndex);
    }

    avoidanceOverlay.style.display = model.avoidance.active ? 'flex' : 'none';
    if (model.avoidance.active && document.activeElement !== avoidanceDistInput) {
        avoidanceDistInput.value = model.avoidance.distance;
    }
}

model.subscribe(render);

function bindInput(id, handler) {
    document.getElementById(id).addEventListener('input', handler);
}

bindInput('ownCourse', (e) => model.setOwnCourse(parseFloat(e.target.value) || 0));
bindInput('ownSpeed', (e) => model.setOwnSpeed(parseFloat(e.target.value) || 0));

bindInput('bearing1', (e) => {
    const display = parseFloat(e.target.value) || 0;
    model.updateCurrentTarget('bearing1', displayToTrue(display, model.ownShip.course, model.orientationMode));
});

bindInput('bearing2', (e) => {
    const display = parseFloat(e.target.value) || 0;
    model.updateCurrentTarget('bearing2', displayToTrue(display, model.ownShip.course, model.orientationMode));
});

bindInput('distance1', (e) => model.updateCurrentTarget('distance1', parseFloat(e.target.value) || 0));
bindInput('distance2', (e) => model.updateCurrentTarget('distance2', parseFloat(e.target.value) || 0));
bindInput('time1', (e) => model.updateCurrentTarget('time1', e.target.value));
bindInput('time2', (e) => model.updateCurrentTarget('time2', e.target.value));

document.getElementById('northUpBtn').addEventListener('click', () => model.setOrientationMode('north-up'));
document.getElementById('headUpBtn').addEventListener('click', () => model.setOrientationMode('head-up'));

document.querySelectorAll('.target-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => model.selectTarget(i));
});

document.getElementById('scaleUp').addEventListener('click', () => model.stepTriangleScale(1));
document.getElementById('scaleDown').addEventListener('click', () => model.stepTriangleScale(-1));

bindInput('avoidanceDistance', (e) => model.setAvoidanceDistance(parseFloat(e.target.value) || 3));
document.getElementById('avoidanceExit').addEventListener('click', () => model.exitAvoidance());

/* ── Drag interaction on triangle canvas ── */

const RAD_TO_DEG = 180 / Math.PI;
const HIT_RADIUS = 20;
let dragging = false;

function canvasCoords(e) {
    const rect = triangleCanvas.getBoundingClientRect();
    if (e.touches) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function canvasToCourseSpeed(mx, my) {
    const st = triangleCanvas._triangleState;
    if (!st) return null;
    const relX = mx - st.centerX;
    const relY = my - st.centerY;
    const c = st.rotation * Math.PI / 180;
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);
    const nmX = (relX * cosC - relY * sinC) / st.pixelsPerKnot;
    const nmY = (-relX * sinC - relY * cosC) / st.pixelsPerKnot;
    const course = (Math.atan2(nmX, nmY) * RAD_TO_DEG + 360) % 360;
    const speed = Math.max(0, Math.sqrt(nmX * nmX + nmY * nmY));
    return { course, speed };
}

function isNearTip(mx, my) {
    const st = triangleCanvas._triangleState;
    if (!st) return false;
    const dx = mx - st.tipX;
    const dy = my - st.tipY;
    return dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS;
}

function onPointerDown(e) {
    const pos = canvasCoords(e);
    const st = triangleCanvas._triangleState;
    if (!st) return;

    const checkTip = model.avoidance.active
        ? isNearAvoidanceTip(pos.x, pos.y, st)
        : isNearTip(pos.x, pos.y);
    if (!checkTip) return;

    dragging = true;
    triangleCanvas.style.cursor = 'grabbing';
    if (e.cancelable) e.preventDefault();

    if (!model.avoidance.active) {
        const cs = canvasToCourseSpeed(pos.x, pos.y);
        if (cs) model.setAvoidance(cs.course, cs.speed);
    }
}

function isNearAvoidanceTip(mx, my, st) {
    const offset = bearingToCanvasOffsetImport(model.avoidance.course, model.avoidance.speed, st.pixelsPerKnot, st.rotation);
    const tipX = st.centerX + offset.dx;
    const tipY = st.centerY + offset.dy;
    const dx = mx - tipX;
    const dy = my - tipY;
    return dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS;
}

function onPointerMove(e) {
    const pos = canvasCoords(e);
    if (dragging) {
        if (e.cancelable) e.preventDefault();
        const cs = canvasToCourseSpeed(pos.x, pos.y);
        if (cs) model.setAvoidance(cs.course, cs.speed);
        return;
    }
    const st = triangleCanvas._triangleState;
    if (!st) return;
    const nearTip = model.avoidance.active
        ? isNearAvoidanceTip(pos.x, pos.y, st)
        : isNearTip(pos.x, pos.y);
    triangleCanvas.style.cursor = nearTip ? 'grab' : 'crosshair';
}

function onPointerUp() {
    if (dragging) {
        dragging = false;
        triangleCanvas.style.cursor = 'crosshair';
    }
}

triangleCanvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

triangleCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
window.addEventListener('touchmove', onPointerMove, { passive: false });
window.addEventListener('touchend', onPointerUp);

/* ── Resize / Init ── */

function handleResize() {
    resizeCanvas(radarCanvas);
    resizeTriangleCanvas(triangleCanvas);
    render();
}

window.addEventListener('resize', handleResize);

window.addEventListener('load', () => {
    resizeCanvas(radarCanvas);
    resizeTriangleCanvas(triangleCanvas);
    model.notify();
});
