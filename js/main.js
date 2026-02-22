import { createModel } from './model.js';
import { displayToTrue } from './bearings.js';
import { computeTargetTracking, computeAvoidanceWithFallback } from './calculator.js';
import { renderForm } from './view-form.js';
import { renderCanvas, resizeCanvas, stepRadarRange, renderRadarRangeLabel } from './view-canvas.js';
import { renderTriangle, resizeTriangleCanvas, renderScaleLabel, stepTriangleScale, setupTriangleInteraction } from './view-triangle.js';
import { resizeAnimationCanvas, updateAnimation, setAnimationControls, togglePlayback, seekTo } from './view-animation.js';
import { applyFragment, syncFragmentToModel } from './fragment.js';

const model = createModel();
applyFragment(model);
const radarCanvas = document.getElementById('radarCanvas');
const triangleCanvas = document.getElementById('triangleCanvas');
const animationCanvas = document.getElementById('animationCanvas');
const scaleLabelEl = document.getElementById('scaleLabel');
const radarRangeLabelEl = document.getElementById('radarRangeLabel');

const animPlayBtn = document.getElementById('animPlayBtn');
const animSlider = document.getElementById('animSlider');
const animTimeLabel = document.getElementById('animTimeLabel');

setAnimationControls({ playBtn: animPlayBtn, slider: animSlider, timeLabel: animTimeLabel });
animPlayBtn.addEventListener('click', togglePlayback);
animSlider.addEventListener('input', () => seekTo(animSlider.value / 1000));

function render() {
    const results = computeTargetTracking(model.currentTarget, model.ownShip);
    const avoidanceResults = computeAvoidanceWithFallback(results, model.avoidance, model.currentTarget.distance2);

    renderForm(model, results, avoidanceResults);
    renderCanvas(radarCanvas, model, results, avoidanceResults);
    renderTriangle(triangleCanvas, model, results, avoidanceResults);
    updateAnimation(animationCanvas, model, results, avoidanceResults);
    renderScaleLabel(scaleLabelEl);
    renderRadarRangeLabel(radarRangeLabelEl);
}

model.subscribe(render);
model.subscribe(() => syncFragmentToModel(model));

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

document.getElementById('scaleUp').addEventListener('click', () => stepTriangleScale(1, model));
document.getElementById('scaleDown').addEventListener('click', () => stepTriangleScale(-1, model));

document.getElementById('radarRangeUp').addEventListener('click', () => stepRadarRange(1, model));
document.getElementById('radarRangeDown').addEventListener('click', () => stepRadarRange(-1, model));

bindInput('avoidanceDistance', (e) => model.setAvoidanceDistance(parseFloat(e.target.value) || 3));
document.getElementById('avoidanceExit').addEventListener('click', () => model.exitAvoidance());

setupTriangleInteraction(triangleCanvas, model);

/* ── Copy link ── */

document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const icon = document.querySelector('.copy-link-icon');
        const label = document.querySelector('.copy-link-label');
        const origIcon = icon.textContent;
        const origLabel = label.textContent;
        icon.textContent = '\u2713';
        label.textContent = 'Lien copi\u00e9 !';
        setTimeout(() => { icon.textContent = origIcon; label.textContent = origLabel; }, 1500);
    });
});

/* ── Resize / Init ── */

function handleResize() {
    resizeCanvas(radarCanvas);
    resizeTriangleCanvas(triangleCanvas);
    resizeAnimationCanvas(animationCanvas);
    render();
}

window.addEventListener('resize', handleResize);

window.addEventListener('load', () => {
    resizeCanvas(radarCanvas);
    resizeTriangleCanvas(triangleCanvas);
    resizeAnimationCanvas(animationCanvas);
    document.fonts.ready.then(() => model.notify());
});
