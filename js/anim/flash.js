import { COLORS } from '../draw.js';
import { hexToRgba } from './boat.js';
import {
    computeOwnPosition, computeTargetPosition,
    computeAvoidanceOwnPosition, computeBearingAndDistance
} from './compute.js';

const CPA_FLASH_DURATION_SEC = 1.5;

export function buildFlashEvents(scene, nmToPixel) {
    const { ownVelocity, targetVelocity, pos2, timeline } = scene;
    const events = [];

    const ownAtCpa = computeOwnPosition(ownVelocity, timeline.tCpa);
    const targetAtCpa = computeTargetPosition(pos2, targetVelocity, timeline.tCpa);
    events.push({
        simT: timeline.tCpa,
        wallStart: null,
        label: `CPA : ${scene.cpaDistance.toFixed(1)} NM`,
        color: COLORS.cpa,
        p1: () => nmToPixel(ownAtCpa.x, ownAtCpa.y),
        p2: () => nmToPixel(targetAtCpa.x, targetAtCpa.y)
    });

    if (scene.avoidVelocity) {
        const ownAtManeuver = computeOwnPosition(ownVelocity, scene.tManeuver);
        const targetAtManeuver = computeTargetPosition(pos2, targetVelocity, scene.tManeuver);
        const maneuverDist = computeBearingAndDistance(ownAtManeuver, targetAtManeuver).distance;

        events.push({
            simT: scene.tManeuver,
            wallStart: null,
            label: `Man\u0153uvre : ${maneuverDist.toFixed(1)} NM`,
            color: COLORS.ownShip,
            p1: () => nmToPixel(ownAtManeuver.x, ownAtManeuver.y),
            p2: () => nmToPixel(targetAtManeuver.x, targetAtManeuver.y)
        });

        const avoidOwnAtCpa = computeAvoidanceOwnPosition(
            ownVelocity, scene.avoidVelocity, scene.tManeuver, scene.tCpaAvoid
        );
        const targetAtCpaAvoid = computeTargetPosition(pos2, targetVelocity, scene.tCpaAvoid);
        events.push({
            simT: scene.tCpaAvoid,
            wallStart: null,
            label: `CPA' : ${scene.cpaAvoidDistance.toFixed(1)} NM`,
            color: COLORS.cpa,
            p1: () => nmToPixel(avoidOwnAtCpa.x, avoidOwnAtCpa.y),
            p2: () => nmToPixel(targetAtCpaAvoid.x, targetAtCpaAvoid.y)
        });
    }

    return events;
}

export function triggerFlashes(flashEvents, simTime, wallNow) {
    for (const ev of flashEvents) {
        if (ev.wallStart === null && simTime >= ev.simT) {
            ev.wallStart = wallNow;
        }
    }
}

export function anyFlashActive(flashEvents, wallNow) {
    return flashEvents.some(ev =>
        ev.wallStart !== null && (wallNow - ev.wallStart) / 1000 <= CPA_FLASH_DURATION_SEC
    );
}

export function drawFlashes(ctx, flashEvents, wallNow) {
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
