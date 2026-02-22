import { createModel } from './model.js';
import { displayToTrue } from './bearings.js';
import { computeTargetTracking, computeAvoidanceWithFallback } from './calculator.js';
import { renderForm } from './view-form.js';
import { renderCanvas, resizeCanvas, stepRadarRange, renderRadarRangeLabel } from './view-canvas.js';
import { renderTriangle, resizeTriangleCanvas, renderScaleLabel, stepTriangleScale, setupTriangleInteraction } from './view-triangle.js';
import { resizeAnimationCanvas, updateAnimation, setupAnimationInteraction } from './view-animation.js';
import { applyFragment, syncFragmentToModel } from './fragment.js';

const model = createModel();
applyFragment(model);
const radarCanvas = document.getElementById('radarCanvas');
const triangleCanvas = document.getElementById('triangleCanvas');
const animationCanvas = document.getElementById('animationCanvas');
const scaleLabelEl = document.getElementById('scaleLabel');
const radarRangeLabelEl = document.getElementById('radarRangeLabel');

setupAnimationInteraction({
    playBtn: document.getElementById('animPlayBtn'),
    slider: document.getElementById('animSlider'),
    timeLabel: document.getElementById('animTimeLabel'),
});

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

/* ── Share / Copy link ── */

const copyBtn = document.getElementById('copyLinkBtn');
const copyIcon = document.querySelector('.copy-link-icon');
const copyLabel = document.querySelector('.copy-link-label');
const copyToast = document.getElementById('copyToast');
const origIcon = copyIcon.textContent;
const origLabel = copyLabel.textContent;
let copyTimeout = null;

const useShare = navigator.share && matchMedia('(pointer: coarse)').matches;
if (useShare) copyBtn.title = 'Partager';

function showCopyConfirmation() {
    clearTimeout(copyTimeout);
    copyIcon.textContent = '\u2713';
    copyLabel.textContent = 'Lien copi\u00e9 !';
    copyToast.classList.add('visible');
    copyBtn.classList.add('confirmed');
    copyTimeout = setTimeout(() => {
        copyIcon.textContent = origIcon;
        copyLabel.textContent = origLabel;
        copyToast.classList.remove('visible');
        copyBtn.classList.remove('confirmed');
    }, 1500);
}

copyBtn.addEventListener('click', () => {
    const url = window.location.href;
    if (useShare) {
        navigator.share({ title: document.title, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(showCopyConfirmation);
    }
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
