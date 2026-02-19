import { polarToCartesian } from './calculator.js';
import { COLORS } from './draw.js';

const DEG_TO_RAD = Math.PI / 180;
const ANIM_DURATION_SEC = 8;
const POST_CPA_FRACTION = 0.25;
const BBOX_PADDING = 0.15;
const WAKE_LENGTH_PX = 30;
const HULL_LENGTH_PX = 20;
const CPA_FLASH_DURATION_SEC = 1.5;
const HEADING_TRANSITION_FRAC = 0.03;

// ── Pure computation functions (exported for testing) ──

export function computeOwnPosition(ownVelocity, t) {
    return { x: ownVelocity.x * t, y: ownVelocity.y * t };
}

export function computeTargetPosition(pos2, targetVelocity, t) {
    return { x: pos2.x + targetVelocity.x * t, y: pos2.y + targetVelocity.y * t };
}

export function computeAvoidanceOwnPosition(ownVelocity, avoidVelocity, tManeuver, t) {
    if (t <= tManeuver) {
        return computeOwnPosition(ownVelocity, t);
    }
    const atManeuver = computeOwnPosition(ownVelocity, tManeuver);
    const dt = t - tManeuver;
    return { x: atManeuver.x + avoidVelocity.x * dt, y: atManeuver.y + avoidVelocity.y * dt };
}

export function computeTimeline(tcpaMinutes, tcpaAvoidMinutes) {
    const tCpa = tcpaMinutes / 60;
    const tCpaAvoid = tcpaAvoidMinutes != null ? tcpaAvoidMinutes / 60 : null;
    const lastCpa = tCpaAvoid != null ? Math.max(tCpa, tCpaAvoid) : tCpa;
    const tEnd = lastCpa * (1 + POST_CPA_FRACTION);
    return { tStart: 0, tCpa, tEnd };
}

export function lerpAngle(fromDeg, toDeg, t) {
    let diff = ((toDeg - fromDeg) % 360 + 540) % 360 - 180;
    return (fromDeg + diff * t + 360) % 360;
}

export function computeBearingAndDistance(ownPos, targetPos) {
    const dx = targetPos.x - ownPos.x;
    const dy = targetPos.y - ownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return { bearing, distance: dist };
}

export function computeBoundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const pad = Math.max(dx, dy) * BBOX_PADDING;
    return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad
    };
}

// ── Internal animation state ──

let state = null;
let playing = false;
let wallStart = null;
let simTime = 0;
let animFrameId = null;
let flashEvents = [];
let controls = null;

function resetPlayback() {
    playing = false;
    simTime = 0;
    wallStart = null;
    flashEvents = [];
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

// ── Canvas setup ──

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

    canvas._logical = { width: cssWidth, height: cssHeight };
}

// ── Coordinate transforms ──

function nmToPixel(nmX, nmY) {
    if (!state) return { px: 0, py: 0 };
    const { bbox, pixelsPerNM, canvasW, canvasH } = state;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    return {
        px: canvasW / 2 + (nmX - cx) * pixelsPerNM,
        py: canvasH / 2 - (nmY - cy) * pixelsPerNM
    };
}

// ── Grid drawing ──

function chooseGridInterval(pixelsPerNM, canvasSize) {
    const niceIntervals = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
    const minPixelSpacing = 60;
    for (const interval of niceIntervals) {
        if (interval * pixelsPerNM >= minPixelSpacing) return interval;
    }
    return niceIntervals[niceIntervals.length - 1];
}

function drawGrid(ctx) {
    const { bbox, pixelsPerNM, canvasW, canvasH } = state;
    const interval = chooseGridInterval(pixelsPerNM, Math.min(canvasW, canvasH));

    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const visibleHalfW = (canvasW / 2) / pixelsPerNM;
    const visibleHalfH = (canvasH / 2) / pixelsPerNM;
    const visMinX = cx - visibleHalfW;
    const visMaxX = cx + visibleHalfW;
    const visMinY = cy - visibleHalfH;
    const visMaxY = cy + visibleHalfH;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.gridLabel;
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'left';

    const startX = Math.floor(visMinX / interval) * interval;
    const startY = Math.floor(visMinY / interval) * interval;

    for (let nmX = startX; nmX <= visMaxX; nmX += interval) {
        const { px } = nmToPixel(nmX, 0);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvasH);
        ctx.stroke();
    }

    for (let nmY = startY; nmY <= visMaxY; nmY += interval) {
        const { py } = nmToPixel(0, nmY);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvasW, py);
        ctx.stroke();

        ctx.fillText(`${nmY.toFixed(1)} NM`, 6, py - 3);
    }
}

function drawNorthArrow(ctx) {
    const { canvasW, canvasH } = state;
    const ax = canvasW - 30;
    const ay = canvasH - 25;
    const len = 22;

    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay + len / 2);
    ctx.lineTo(ax, ay - len / 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.moveTo(ax, ay - len / 2 - 4);
    ctx.lineTo(ax - 5, ay - len / 2 + 4);
    ctx.lineTo(ax + 5, ay - len / 2 + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 13px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('N', ax, ay - len / 2 - 8);
}

// ── Mini radar overlay ──

const MINI_RADAR_RANGE_NM = 6;
const MINI_RADAR_RINGS = 4;

function drawMiniRadar(ctx, cx, cy, radius, targetBearing, targetDist, heading, speed, orientationMode, alpha, label) {
    const rotation = orientationMode === 'head-up' ? heading : 0;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(10, 25, 41, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.8;
    for (let i = 1; i <= MINI_RADAR_RINGS; i++) {
        const r = (radius / MINI_RADAR_RINGS) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    const headingRad = (heading - rotation) * DEG_TO_RAD;
    const hlX = cx + radius * Math.sin(headingRad);
    const hlY = cy - radius * Math.cos(headingRad);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hlX, hlY);
    ctx.stroke();

    const pixelsPerNM = radius / MINI_RADAR_RANGE_NM;
    const blipBearingRad = (targetBearing - rotation) * DEG_TO_RAD;
    const blipR = targetDist * pixelsPerNM;
    const blipX = cx + blipR * Math.sin(blipBearingRad);
    const blipY = cy - blipR * Math.cos(blipBearingRad);

    ctx.fillStyle = COLORS.trueVector;
    ctx.beginPath();
    ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gridLabel;
    if (label) {
        ctx.font = 'bold 10px Share Tech Mono';
        ctx.fillText(`${label} \u2013 ${MINI_RADAR_RANGE_NM} NM`, cx, cy - radius - 6);
    } else {
        ctx.font = '9px Share Tech Mono';
        ctx.fillText(`${MINI_RADAR_RANGE_NM} NM`, cx, cy - radius - 6);
    }

    let labelY = cy + radius + 14;
    ctx.font = '10px Share Tech Mono';
    ctx.fillText(`Cap : ${Math.round(heading)}\u00B0`, cx, labelY);
    labelY += 13;
    ctx.fillText(`Vit : ${speed.toFixed(1)} kts`, cx, labelY);
}

// ── Boat hull glyph ──

function drawBoatHull(ctx, px, py, headingDeg, color, alpha) {
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

// ── Wake line ──

function drawWake(ctx, px, py, headingDeg, color, alpha) {
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

function hexToRgba(hex, alpha) {
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

// ── Flash events ──

function buildFlashEvents() {
    if (!state) return;
    const { ownVelocity, targetVelocity, pos2, timeline } = state;
    flashEvents = [];

    const ownAtCpa = computeOwnPosition(ownVelocity, timeline.tCpa);
    const targetAtCpa = computeTargetPosition(pos2, targetVelocity, timeline.tCpa);
    flashEvents.push({
        simT: timeline.tCpa,
        wallStart: null,
        label: `CPA : ${state.cpaDistance.toFixed(1)} NM`,
        color: COLORS.cpa,
        p1: () => nmToPixel(ownAtCpa.x, ownAtCpa.y),
        p2: () => nmToPixel(targetAtCpa.x, targetAtCpa.y)
    });

    if (state.avoidVelocity) {
        const ownAtManeuver = computeOwnPosition(ownVelocity, state.tManeuver);
        const targetAtManeuver = computeTargetPosition(pos2, targetVelocity, state.tManeuver);
        const maneuverDist = computeBearingAndDistance(ownAtManeuver, targetAtManeuver).distance;

        flashEvents.push({
            simT: state.tManeuver,
            wallStart: null,
            label: `Manœuvre : ${maneuverDist.toFixed(1)} NM`,
            color: COLORS.ownShip,
            p1: () => nmToPixel(ownAtManeuver.x, ownAtManeuver.y),
            p2: () => nmToPixel(targetAtManeuver.x, targetAtManeuver.y)
        });

        const avoidOwnAtCpa = computeAvoidanceOwnPosition(
            ownVelocity, state.avoidVelocity, state.tManeuver, state.tCpaAvoid
        );
        const targetAtCpaAvoid = computeTargetPosition(pos2, targetVelocity, state.tCpaAvoid);
        flashEvents.push({
            simT: state.tCpaAvoid,
            wallStart: null,
            label: `CPA' : ${state.cpaAvoidDistance.toFixed(1)} NM`,
            color: COLORS.cpa,
            p1: () => nmToPixel(avoidOwnAtCpa.x, avoidOwnAtCpa.y),
            p2: () => nmToPixel(targetAtCpaAvoid.x, targetAtCpaAvoid.y)
        });
    }
}

function triggerFlashes(wallNow) {
    for (const ev of flashEvents) {
        if (ev.wallStart === null && simTime >= ev.simT) {
            ev.wallStart = wallNow;
        }
    }
}

function anyFlashActive(wallNow) {
    return flashEvents.some(ev =>
        ev.wallStart !== null && (wallNow - ev.wallStart) / 1000 <= CPA_FLASH_DURATION_SEC
    );
}

function drawFlashes(ctx, wallNow) {
    for (const ev of flashEvents) {
        if (ev.wallStart === null) continue;
        const elapsed = (wallNow - ev.wallStart) / 1000;
        if (elapsed > CPA_FLASH_DURATION_SEC) continue;

        const progress = elapsed / CPA_FLASH_DURATION_SEC;
        const maxRadius = 40;
        const radius = maxRadius * progress;
        const alpha = 1 - progress;

        const a = ev.p1();
        const b = ev.p2();
        const midX = (a.px + b.px) / 2;
        const midY = (a.py + b.py) / 2;

        ctx.strokeStyle = hexToRgba(ev.color, alpha * 0.8);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(midX, midY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(ev.color, alpha * 0.5);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = hexToRgba('#ffffff', alpha);
        ctx.font = 'bold 12px Share Tech Mono';
        ctx.textAlign = 'center';
        ctx.fillText(ev.label, midX, midY - radius - 6);
    }
}

// ── Live distance display ──

function drawLiveDistance(ctx, distNM, avoidDistNM) {
    const { canvasH } = state;
    const x = 10;
    const lineH = 18;
    const rows = avoidDistNM !== null ? 2 : 1;
    const boxW = 130;
    const y = canvasH - 10 - lineH * (rows - 1);

    ctx.fillStyle = 'rgba(10, 25, 41, 0.8)';
    ctx.fillRect(x - 6, y - 14, boxW + 12, lineH * rows + 4);

    ctx.font = '12px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Dist : ${distNM.toFixed(2)} NM`, x, y);

    if (avoidDistNM !== null) {
        ctx.fillStyle = 'rgba(224, 242, 255, 0.6)';
        ctx.fillText(`Dist' : ${avoidDistNM.toFixed(2)} NM`, x, y + lineH);
    }
}

// ── Frame drawing ──

function drawFrame(wallNow) {
    const canvas = state.canvas;
    const ctx = canvas.getContext('2d');
    const { canvasW, canvasH } = state;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawGrid(ctx);
    drawNorthArrow(ctx);

    const t = simTime;
    const { ownVelocity, targetVelocity, pos2, ownCourse, targetCourse } = state;

    const ownPos = computeOwnPosition(ownVelocity, t);
    const targetPos = computeTargetPosition(pos2, targetVelocity, t);
    const ownPx = nmToPixel(ownPos.x, ownPos.y);
    const targetPx = nmToPixel(targetPos.x, targetPos.y);

    let avoidPos = null;
    let avoidCourseNow = ownCourse;
    if (state.avoidVelocity) {
        avoidPos = computeAvoidanceOwnPosition(
            ownVelocity, state.avoidVelocity, state.tManeuver, t
        );
        avoidCourseNow = t <= state.tManeuver ? ownCourse : state.avoidCourse;
        const avoidPx = nmToPixel(avoidPos.x, avoidPos.y);
        drawWake(ctx, avoidPx.px, avoidPx.py, avoidCourseNow, COLORS.ownShip, 0.25);
        drawBoatHull(ctx, avoidPx.px, avoidPx.py, avoidCourseNow, COLORS.ownShip, 0.25);
    }

    drawWake(ctx, ownPx.px, ownPx.py, ownCourse, COLORS.ownShip, 1);
    drawBoatHull(ctx, ownPx.px, ownPx.py, ownCourse, COLORS.ownShip, 1);

    drawWake(ctx, targetPx.px, targetPx.py, targetCourse, COLORS.trueVector, 1);
    drawBoatHull(ctx, targetPx.px, targetPx.py, targetCourse, COLORS.trueVector, 1);

    const mainBD = computeBearingAndDistance(ownPos, targetPos);

    let avoidBD = null;
    if (avoidPos) {
        avoidBD = computeBearingAndDistance(avoidPos, targetPos);
    }

    const avoidDistNM = (avoidBD && t > state.tManeuver) ? avoidBD.distance : null;
    drawLiveDistance(ctx, mainBD.distance, avoidDistNM);

    const radarR = Math.min(Math.max(Math.min(canvasW, canvasH) * 0.14, 30), 110);
    const margin = radarR + 30;
    const showRadars = canvasW >= margin * 2 && canvasH >= margin * 2;

    if (showRadars) {
        drawMiniRadar(ctx, margin, margin, radarR,
            mainBD.bearing, mainBD.distance, ownCourse,
            state.ownSpeed, state.orientationMode, 1, null);

        if (state.avoidVelocity) {
            const avoidAlpha = t > state.tManeuver ? 1 : 0.45;

            let radarHeading = avoidCourseNow;
            const duration = state.timeline.tEnd * HEADING_TRANSITION_FRAC;
            const elapsed = t - state.tManeuver;
            if (elapsed > 0 && elapsed < duration) {
                radarHeading = lerpAngle(ownCourse, state.avoidCourse, elapsed / duration);
            }

            let avoidSpeedNow = t <= state.tManeuver ? state.ownSpeed : state.avoidSpeed;
            if (elapsed > 0 && elapsed < duration) {
                avoidSpeedNow = state.ownSpeed + (state.avoidSpeed - state.ownSpeed) * (elapsed / duration);
            }

            drawMiniRadar(ctx, canvasW - margin, margin, radarR,
                avoidBD.bearing, avoidBD.distance, radarHeading,
                avoidSpeedNow, state.orientationMode,
                avoidAlpha, '\u00C9vitement');
        }
    }

    drawFlashes(ctx, wallNow);
}

// ── Animation loop ──

function tick(wallNow) {
    if (!state) return;

    if (playing) {
        if (wallStart === null) wallStart = wallNow;
        const wallElapsed = (wallNow - wallStart) / 1000;
        const fraction = Math.min(wallElapsed / ANIM_DURATION_SEC, 1);
        simTime = state.timeline.tStart + fraction * (state.timeline.tEnd - state.timeline.tStart);

        triggerFlashes(wallNow);

        if (fraction >= 1) {
            playing = false;
            simTime = state.timeline.tEnd;
            updateControlsUI();
        }
    }

    drawFrame(wallNow);
    updateSliderUI();

    if (playing || anyFlashActive(wallNow)) {
        animFrameId = requestAnimationFrame(tick);
    } else {
        animFrameId = null;
    }
}

function startLoop() {
    if (animFrameId) return;
    animFrameId = requestAnimationFrame(tick);
}

// ── Controls ──

function updateSliderUI() {
    if (!controls || !state) return;
    const { tStart, tEnd } = state.timeline;
    const range = tEnd - tStart;
    if (range <= 0) return;
    const fraction = (simTime - tStart) / range;
    controls.slider.value = Math.round(fraction * 1000);

    const simHours = simTime;
    if (simHours >= 1) {
        const h = Math.floor(simHours);
        const m = Math.round((simHours - h) * 60);
        controls.timeLabel.textContent = `P2+${h}h${String(m).padStart(2, '0')}min`;
    } else {
        const m = Math.round(simHours * 60);
        controls.timeLabel.textContent = `P2+${m} min`;
    }
}

function updateControlsUI() {
    if (!controls) return;
    controls.playBtn.innerHTML = playing ? '&#9208;' : '&#9654;';
}

export function setAnimationControls(elements) {
    controls = elements;
}

export function togglePlayback() {
    if (!state) return;
    if (playing) {
        playing = false;
    } else {
        if (simTime >= state.timeline.tEnd) {
            simTime = 0;
            wallStart = null;
            flashEvents.forEach(ev => ev.wallStart = null);
        } else if (wallStart !== null) {
            const fraction = (simTime - state.timeline.tStart) /
                (state.timeline.tEnd - state.timeline.tStart);
            wallStart = performance.now() - fraction * ANIM_DURATION_SEC * 1000;
        }
        playing = true;
        startLoop();
    }
    updateControlsUI();
}

export function seekTo(fraction) {
    if (!state) return;
    playing = false;
    wallStart = null;
    flashEvents.forEach(ev => ev.wallStart = null);
    simTime = state.timeline.tStart + fraction * (state.timeline.tEnd - state.timeline.tStart);

    for (const ev of flashEvents) {
        if (simTime >= ev.simT && simTime < ev.simT + 0.01) {
            ev.wallStart = performance.now();
        }
    }

    updateControlsUI();
    drawFrame(performance.now());
    updateSliderUI();
}

// ── Main update (called from render) ──

export function updateAnimation(canvas, model, results, avoidanceResults) {
    resetPlayback();

    if (!results || results.cpa.tcpaMinutes <= 0) {
        state = null;
        const ctx = canvas.getContext('2d');
        const logical = canvas._logical;
        if (logical) {
            ctx.clearRect(0, 0, logical.width, logical.height);
            ctx.fillStyle = COLORS.background;
            ctx.fillRect(0, 0, logical.width, logical.height);
        }
        updateControlsUI();
        return;
    }

    const logical = canvas._logical;
    if (!logical) return;

    const ownVelocity = polarToCartesian(model.ownShip.course, model.ownShip.speed);
    const targetVelocity = polarToCartesian(results.trueTarget.course, results.trueTarget.speed);
    const pos2 = results.pos2;

    let avoidVelocity = null;
    let tManeuver = 0;
    let avoidCourse = 0;
    let tCpaAvoid = 0;
    let cpaAvoidDistance = 0;

    if (avoidanceResults && avoidanceResults.maneuverNeeded) {
        avoidCourse = model.avoidance.course;
        avoidVelocity = polarToCartesian(avoidCourse, model.avoidance.speed);
        tManeuver = avoidanceResults.timeToManeuverHours;
        tCpaAvoid = avoidanceResults.cpa.tcpaMinutes / 60;
        cpaAvoidDistance = avoidanceResults.cpa.distance;
    }

    const tcpaAvoidMinutes = avoidVelocity ? avoidanceResults.cpa.tcpaMinutes : null;
    const timeline = computeTimeline(results.cpa.tcpaMinutes, tcpaAvoidMinutes);

    const trajectoryPoints = [
        computeOwnPosition(ownVelocity, timeline.tStart),
        computeOwnPosition(ownVelocity, timeline.tEnd),
        computeTargetPosition(pos2, targetVelocity, timeline.tStart),
        computeTargetPosition(pos2, targetVelocity, timeline.tEnd)
    ];

    if (avoidVelocity) {
        trajectoryPoints.push(
            computeAvoidanceOwnPosition(ownVelocity, avoidVelocity, tManeuver, timeline.tEnd)
        );
    }

    const bbox = computeBoundingBox(trajectoryPoints);
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    const scaleX = logical.width / bboxW;
    const scaleY = logical.height / bboxH;
    const pixelsPerNM = Math.min(scaleX, scaleY);

    state = {
        canvas,
        canvasW: logical.width,
        canvasH: logical.height,
        bbox,
        pixelsPerNM,
        ownVelocity,
        targetVelocity,
        pos2,
        ownCourse: model.ownShip.course,
        ownSpeed: model.ownShip.speed,
        targetCourse: results.trueTarget.course,
        orientationMode: model.orientationMode,
        timeline,
        avoidVelocity,
        avoidCourse,
        avoidSpeed: model.avoidance.speed,
        tManeuver,
        cpaDistance: results.cpa.distance,
        tCpaAvoid,
        cpaAvoidDistance
    };

    buildFlashEvents();

    updateControlsUI();
    drawFrame(performance.now());
    updateSliderUI();
}
