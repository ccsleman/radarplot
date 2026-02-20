import { DEG_TO_RAD } from '../constants.js';
import { COLORS } from '../draw.js';

const MINI_RADAR_RANGE_NM = 6;
const MINI_RADAR_RINGS = 4;

export function drawMiniRadar(ctx, config) {
    const { cx, cy, radius, targetBearing, targetDist, heading, speed, orientationMode, alpha, label } = config;
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
