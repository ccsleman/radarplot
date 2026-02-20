import { createModel } from './model.js';
import { displayToTrue } from './bearings.js';
import { computeTargetTracking, computeAvoidanceWithFallback } from './calculator.js';
import { renderForm } from './view-form.js';
import { renderCanvas, resizeCanvas } from './view-canvas.js';
import { renderTriangle, resizeTriangleCanvas, renderScaleLabel, setupTriangleInteraction } from './view-triangle.js';
import { resizeAnimationCanvas, updateAnimation, setAnimationControls, togglePlayback, seekTo } from './view-animation.js';

const model = createModel();
const radarCanvas = document.getElementById('radarCanvas');
const triangleCanvas = document.getElementById('triangleCanvas');
const animationCanvas = document.getElementById('animationCanvas');
const scaleLabelEl = document.getElementById('scaleLabel');

const animPlayBtn = document.getElementById('animPlayBtn');
const animSlider = document.getElementById('animSlider');
const animTimeLabel = document.getElementById('animTimeLabel');

setAnimationControls({ playBtn: animPlayBtn, slider: animSlider, timeLabel: animTimeLabel });
animPlayBtn.addEventListener('click', togglePlayback);
animSlider.addEventListener('input', () => seekTo(animSlider.value / 1000));

function render() {
    const results = computeTargetTracking(model.currentTarget, model.ownShip);
    const avoidanceResults = computeAvoidanceWithFallback(results, model.avoidance, model.currentTarget.distance2);
    model.autoFitTriangleScale(results);

    renderForm(model, results, avoidanceResults);
    renderCanvas(radarCanvas, model, results, avoidanceResults);
    renderTriangle(triangleCanvas, model, results, avoidanceResults);
    updateAnimation(animationCanvas, model, results, avoidanceResults);
    renderScaleLabel(scaleLabelEl, model.triangleScaleIndex);
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

setupTriangleInteraction(triangleCanvas, model);

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
    model.notify();
});
