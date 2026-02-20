export {
    computeOwnPosition,
    computeTargetPosition,
    computeAvoidanceOwnPosition,
    computeTimeline,
    lerpAngle,
    computeBearingAndDistance,
    computeBoundingBox,
} from './anim/compute.js';

import { setCanvasLogical } from './draw.js';
import { createAnimationController } from './anim/controller.js';

const controller = createAnimationController();

export function resizeAnimationCanvas(canvas) {
    const panel = canvas.parentElement;
    const cssWidth = panel.getBoundingClientRect().width - 32;
    const preferredHeight = Math.round(cssWidth * 3 / 5);

    const panelStyle = getComputedStyle(panel);
    const panelPadding = parseFloat(panelStyle.paddingTop) + parseFloat(panelStyle.paddingBottom);
    const panelBorder = parseFloat(panelStyle.borderTopWidth) + parseFloat(panelStyle.borderBottomWidth);
    const panelMarginTop = parseFloat(panelStyle.marginTop);

    let chromeHeight = panelPadding + panelBorder + panelMarginTop;
    for (const child of panel.children) {
        if (child === canvas) continue;
        chromeHeight += child.getBoundingClientRect().height;
        const childStyle = getComputedStyle(child);
        chromeHeight += parseFloat(childStyle.marginTop) + parseFloat(childStyle.marginBottom);
    }

    const maxCanvasHeight = window.innerHeight - chromeHeight;
    const cssHeight = Math.max(150, Math.min(preferredHeight, maxCanvasHeight));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    setCanvasLogical(canvas, { width: cssWidth, height: cssHeight });
}

export function setAnimationControls(elements) {
    controller.setControls(elements);
}

export function togglePlayback() {
    controller.togglePlayback();
}

export function seekTo(fraction) {
    controller.seekTo(fraction);
}

export function updateAnimation(canvas, model, results, avoidanceResults) {
    controller.update(canvas, model, results, avoidanceResults);
}
