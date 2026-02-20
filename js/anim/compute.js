import { RAD_TO_DEG, normalizeBearing } from '../constants.js';

const POST_CPA_FRACTION = 0.25;
const BBOX_PADDING = 0.15;

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
    return normalizeBearing(fromDeg + diff * t);
}

export function computeBearingAndDistance(ownPos, targetPos) {
    const dx = targetPos.x - ownPos.x;
    const dy = targetPos.y - ownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bearing = normalizeBearing(Math.atan2(dx, dy) * RAD_TO_DEG);
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
