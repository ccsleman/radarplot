import { polarToCartesian } from '../calculator.js';
import { formatMinutes } from '../constants.js';
import { COLORS, getCanvasLogical } from '../draw.js';
import {
    computeOwnPosition, computeTargetPosition,
    computeAvoidanceOwnPosition, computeTimeline,
    computeBoundingBox, computeBearingAndDistance, lerpAngle,
} from './compute.js';
import { drawBoatHull, drawWake } from './boat.js';
import { drawMiniRadar } from './mini-radar.js';
import { buildFlashEvents, triggerFlashes, anyFlashActive, drawFlashes } from './flash.js';
import { drawGrid, drawNorthArrow, drawLiveDistance } from './hud.js';

const ANIM_DURATION_SEC = 8;
const HEADING_TRANSITION_FRAC = 0.03;

function createNmToPixel(scene) {
    return (nmX, nmY) => {
        const { bbox, pixelsPerNM, canvasW, canvasH } = scene;
        const cx = (bbox.minX + bbox.maxX) / 2;
        const cy = (bbox.minY + bbox.maxY) / 2;
        return {
            px: canvasW / 2 + (nmX - cx) * pixelsPerNM,
            py: canvasH / 2 - (nmY - cy) * pixelsPerNM,
        };
    };
}

export function createAnimationController() {
    let scene = null;
    let nmToPixel = () => ({ px: 0, py: 0 });
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

    function updateSliderUI() {
        if (!controls || !scene) return;
        const { tStart, tEnd } = scene.timeline;
        const range = tEnd - tStart;
        if (range <= 0) return;
        const fraction = (simTime - tStart) / range;
        controls.slider.value = Math.round(fraction * 1000);

        controls.timeLabel.textContent = `P2+${formatMinutes(simTime * 60)}`;
    }

    function updateControlsUI() {
        if (!controls) return;
        controls.playBtn.innerHTML = playing ? '&#9208;' : '&#9654;';
    }

    function drawFrame(wallNow) {
        const canvas = scene.canvas;
        const ctx = canvas.getContext('2d');
        const { canvasW, canvasH } = scene;

        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, canvasW, canvasH);

        drawGrid(ctx, scene, nmToPixel);
        drawNorthArrow(ctx, canvasW, canvasH);

        const t = simTime;
        const { ownVelocity, targetVelocity, pos2, ownCourse, targetCourse } = scene;

        const ownPos = computeOwnPosition(ownVelocity, t);
        const targetPos = computeTargetPosition(pos2, targetVelocity, t);
        const ownPx = nmToPixel(ownPos.x, ownPos.y);
        const targetPx = nmToPixel(targetPos.x, targetPos.y);

        let avoidPos = null;
        let avoidCourseNow = ownCourse;
        if (scene.avoidVelocity) {
            avoidPos = computeAvoidanceOwnPosition(
                ownVelocity, scene.avoidVelocity, scene.tManeuver, t
            );
            avoidCourseNow = t <= scene.tManeuver ? ownCourse : scene.avoidCourse;
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

        const avoidDistNM = (avoidBD && t > scene.tManeuver) ? avoidBD.distance : null;
        drawLiveDistance(ctx, canvasH, mainBD.distance, avoidDistNM);

        const radarR = Math.min(Math.max(Math.min(canvasW, canvasH) * 0.14, 30), 110);
        const margin = radarR + 30;
        const showRadars = canvasW >= margin * 2 && canvasH >= margin * 2;

        if (showRadars) {
            drawMiniRadar(ctx, {
                cx: margin, cy: margin, radius: radarR,
                targetBearing: mainBD.bearing, targetDist: mainBD.distance,
                heading: ownCourse, speed: scene.ownSpeed,
                orientationMode: scene.orientationMode, alpha: 1,
            });

            if (scene.avoidVelocity) {
                const avoidAlpha = t > scene.tManeuver ? 1 : 0.45;

                let radarHeading = avoidCourseNow;
                const duration = scene.timeline.tEnd * HEADING_TRANSITION_FRAC;
                const elapsed = t - scene.tManeuver;
                if (elapsed > 0 && elapsed < duration) {
                    radarHeading = lerpAngle(ownCourse, scene.avoidCourse, elapsed / duration);
                }

                let avoidSpeedNow = t <= scene.tManeuver ? scene.ownSpeed : scene.avoidSpeed;
                if (elapsed > 0 && elapsed < duration) {
                    avoidSpeedNow = scene.ownSpeed + (scene.avoidSpeed - scene.ownSpeed) * (elapsed / duration);
                }

                drawMiniRadar(ctx, {
                    cx: canvasW - margin, cy: margin, radius: radarR,
                    targetBearing: avoidBD.bearing, targetDist: avoidBD.distance,
                    heading: radarHeading, speed: avoidSpeedNow,
                    orientationMode: scene.orientationMode,
                    alpha: avoidAlpha, label: '\u00C9vitement',
                });
            }
        }

        drawFlashes(ctx, flashEvents, wallNow);
    }

    function tick(wallNow) {
        if (!scene) return;

        if (playing) {
            if (wallStart === null) wallStart = wallNow;
            const wallElapsed = (wallNow - wallStart) / 1000;
            const fraction = Math.min(wallElapsed / ANIM_DURATION_SEC, 1);
            simTime = scene.timeline.tStart + fraction * (scene.timeline.tEnd - scene.timeline.tStart);

            triggerFlashes(flashEvents, simTime, wallNow);

            if (fraction >= 1) {
                playing = false;
                simTime = scene.timeline.tEnd;
                updateControlsUI();
            }
        }

        drawFrame(wallNow);
        updateSliderUI();

        if (playing || anyFlashActive(flashEvents, wallNow)) {
            animFrameId = requestAnimationFrame(tick);
        } else {
            animFrameId = null;
        }
    }

    function startLoop() {
        if (animFrameId) return;
        animFrameId = requestAnimationFrame(tick);
    }

    return {
        setControls(elements) {
            controls = elements;
        },

        togglePlayback() {
            if (!scene) return;
            if (playing) {
                playing = false;
            } else {
                if (simTime >= scene.timeline.tEnd) {
                    simTime = 0;
                    wallStart = null;
                    flashEvents.forEach(ev => ev.wallStart = null);
                } else if (wallStart !== null) {
                    const fraction = (simTime - scene.timeline.tStart) /
                        (scene.timeline.tEnd - scene.timeline.tStart);
                    wallStart = performance.now() - fraction * ANIM_DURATION_SEC * 1000;
                }
                playing = true;
                startLoop();
            }
            updateControlsUI();
        },

        seekTo(fraction) {
            if (!scene) return;
            playing = false;
            wallStart = null;
            flashEvents.forEach(ev => ev.wallStart = null);
            simTime = scene.timeline.tStart + fraction * (scene.timeline.tEnd - scene.timeline.tStart);

            for (const ev of flashEvents) {
                if (simTime >= ev.simT && simTime < ev.simT + 0.01) {
                    ev.wallStart = performance.now();
                }
            }

            updateControlsUI();
            drawFrame(performance.now());
            updateSliderUI();
        },

        update(canvas, model, results, avoidanceResults) {
            resetPlayback();

            if (!results || results.cpa.tcpaMinutes <= 0) {
                scene = null;
                const ctx = canvas.getContext('2d');
                const logical = getCanvasLogical(canvas);
                if (logical) {
                    ctx.clearRect(0, 0, logical.width, logical.height);
                    ctx.fillStyle = COLORS.background;
                    ctx.fillRect(0, 0, logical.width, logical.height);
                }
                updateControlsUI();
                return;
            }

            const logical = getCanvasLogical(canvas);
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
                computeTargetPosition(pos2, targetVelocity, timeline.tEnd),
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

            scene = {
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
                cpaAvoidDistance,
            };

            nmToPixel = createNmToPixel(scene);
            flashEvents = buildFlashEvents(scene, nmToPixel);

            updateControlsUI();
            drawFrame(performance.now());
            updateSliderUI();
        },
    };
}
