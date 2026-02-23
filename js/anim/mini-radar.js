import { DEG_TO_RAD } from '../constants.js';
import { COLORS } from '../draw.js';

const MINI_RADAR_RANGE_NM = 6;
const MINI_RADAR_RING_NM = [2, 4];
const TAU = Math.PI * 2;

function pointFromBearing(cx, cy, radius, bearingDeg) {
    const rad = bearingDeg * DEG_TO_RAD;
    return {
        x: cx + radius * Math.sin(rad),
        y: cy - radius * Math.cos(rad),
    };
}

function drawMiniRadarGrid(ctx, cx, cy, radius, pixelPerNM) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.8;

    for (const nm of MINI_RADAR_RING_NM) {
        ctx.beginPath();
        ctx.arc(cx, cy, nm * pixelPerNM, 0, TAU);
        ctx.stroke();
    }

    for (let angle = 0; angle < 360; angle += 30) {
        const edge = pointFromBearing(cx, cy, radius, angle);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(edge.x, edge.y);
        ctx.stroke();
    }
}

export function drawMiniRadar(ctx, config) {
    const { cx, cy, radius, targetBearing, targetDist, heading, speed, orientationMode, alpha, label } = config;
    const orientationOffset = orientationMode === 'head-up' ? heading : 0;
    const displayedHeading = heading - orientationOffset;
    const displayedTargetBearing = targetBearing - orientationOffset;
    const pixelPerNM = radius / MINI_RADAR_RANGE_NM;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(10, 25, 41, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.clip();

    drawMiniRadarGrid(ctx, cx, cy, radius, pixelPerNM);

    const headingTip = pointFromBearing(cx, cy, radius, displayedHeading);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(headingTip.x, headingTip.y);
    ctx.stroke();

    const blipRadius = targetDist * pixelPerNM;
    const blipPos = pointFromBearing(cx, cy, blipRadius, displayedTargetBearing);

    ctx.fillStyle = COLORS.trueVector;
    ctx.beginPath();
    ctx.arc(blipPos.x, blipPos.y, 4, 0, TAU);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = COLORS.gridLabel;
    if (label) {
        ctx.font = 'bold 10px Share Tech Mono';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy - radius - 6);
    }

    ctx.font = '9px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`${MINI_RADAR_RANGE_NM} NM`, cx + radius + 4, cy + 3);

    ctx.textAlign = 'center';
    let labelY = cy + radius + 14;
    ctx.font = '10px Share Tech Mono';
    ctx.fillText(`Cap : ${Math.round(heading)}\u00B0`, cx, labelY);
    labelY += 13;
    ctx.fillText(`Vit : ${speed.toFixed(1)} kts`, cx, labelY);
}
