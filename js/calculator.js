const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function timeToMinutes(timeString) {
    if (!timeString) return NaN;
    const parts = timeString.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
}

export function polarToCartesian(bearingDeg, distance) {
    const rad = bearingDeg * DEG_TO_RAD;
    return {
        x: distance * Math.sin(rad),
        y: distance * Math.cos(rad)
    };
}

export function cartesianToPolar(x, y) {
    return {
        bearing: (Math.atan2(x, y) * RAD_TO_DEG + 360) % 360,
        distance: Math.sqrt(x * x + y * y)
    };
}

export function relativeMotion(pos1, pos2, deltaTimeHours) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const displacement = Math.sqrt(dx * dx + dy * dy);
    return {
        course: (Math.atan2(dx, dy) * RAD_TO_DEG + 360) % 360,
        speed: displacement / deltaTimeHours,
        dx,
        dy
    };
}

export function closestPointOfApproach(pos1, dx, dy) {
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
        const distance = Math.sqrt(pos1.x * pos1.x + pos1.y * pos1.y);
        return { distance, point: { x: pos1.x, y: pos1.y }, t: 0 };
    }
    const t = -(pos1.x * dx + pos1.y * dy) / lengthSq;
    const point = {
        x: pos1.x + t * dx,
        y: pos1.y + t * dy
    };
    const distance = Math.sqrt(point.x * point.x + point.y * point.y);
    return { distance, point, t };
}

export function tcpaFromObservation(t, deltaTimeHours) {
    return (t - 1) * deltaTimeHours;
}

export function trueMotion(ownCourse, ownSpeed, relativeCourse, relativeSpeed) {
    const own = polarToCartesian(ownCourse, ownSpeed);
    const rel = polarToCartesian(relativeCourse, relativeSpeed);
    return cartesianToPolar(own.x + rel.x, own.y + rel.y);
}

export function formatAspect(aspectDeg) {
    const a = ((aspectDeg % 360) + 360) % 360;
    const angle = a <= 180 ? a : 360 - a;
    const sideName = a <= 180 ? 'Tribord' : 'B\u00e2bord';
    const sidelight = a <= 180 ? `${sideName} (vert)` : `${sideName} (rouge)`;
    const sternlight = `${sideName} (blanc)`;

    if (angle < 2)               return "De l'avant - (rouge et vert)";
    if (angle < 22.5)            return `De l'avant - ${sidelight}`;
    if (angle < 67.5)            return `Sur l'avant du travers - ${sidelight}`;
    if (angle < 112.5)           return `Par le travers - ${sidelight}`;
    if (angle < 157.5)           return `Sur l'arri\u00e8re du travers - ${sternlight}`;
    if (angle < 178)             return `De l'arri\u00e8re - ${sternlight}`;
    return "De l'arri\u00e8re - (blanc)";
}

export function computeAvoidanceResults(results, newCourse, newSpeed, avoidanceDistance) {
    const { pos2, relative } = results;

    const dx = relative.dx;
    const dy = relative.dy;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return null;

    const a = lenSq;
    const b = 2 * (pos2.x * dx + pos2.y * dy);
    const c = pos2.x * pos2.x + pos2.y * pos2.y - avoidanceDistance * avoidanceDistance;
    const disc = b * b - 4 * a * c;
    const maneuverNeeded = disc >= 0;

    let s = 0;
    if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        const s1 = (-b - sqrtDisc) / (2 * a);
        const s2 = (-b + sqrtDisc) / (2 * a);
        if (s1 >= -1e-9) s = Math.max(0, s1);
        else if (s2 >= -1e-9) s = Math.max(0, s2);
    }


    const maneuverPoint = {
        x: pos2.x + s * dx,
        y: pos2.y + s * dy
    };

    const trueVel = polarToCartesian(results.trueTarget.course, results.trueTarget.speed);
    const newOwnVel = polarToCartesian(newCourse, newSpeed);
    const newRelVel = { x: trueVel.x - newOwnVel.x, y: trueVel.y - newOwnVel.y };
    const newRelPolar = cartesianToPolar(newRelVel.x, newRelVel.y);

    const rawCpa = closestPointOfApproach(maneuverPoint, newRelVel.x, newRelVel.y);
    const clampedT = Math.max(0, rawCpa.t);
    const cpaPoint = clampedT === rawCpa.t
        ? rawCpa.point
        : { x: maneuverPoint.x, y: maneuverPoint.y };
    const cpaDistance = clampedT === rawCpa.t
        ? rawCpa.distance
        : Math.sqrt(maneuverPoint.x * maneuverPoint.x + maneuverPoint.y * maneuverPoint.y);
    const cpaBearing = cartesianToPolar(cpaPoint.x, cpaPoint.y).bearing;

    const p1p2Dist = Math.sqrt(lenSq);
    const deltaTime = p1p2Dist / relative.speed;
    const timeToManeuverHours = s * deltaTime;
    const totalTcpaHours = timeToManeuverHours + clampedT;

    return {
        maneuverNeeded,
        maneuverPoint,
        relative: {
            course: newRelPolar.bearing,
            speed: newRelPolar.distance,
            dx: newRelVel.x,
            dy: newRelVel.y
        },
        cpa: {
            distance: cpaDistance,
            point: cpaPoint,
            bearing: cpaBearing,
            tcpaMinutes: totalTcpaHours * 60
        },
        prediction: {
            x: maneuverPoint.x + newRelVel.x,
            y: maneuverPoint.y + newRelVel.y
        }
    };
}

export function computeResults(target, ownShip) {
    const pos1 = polarToCartesian(target.bearing1, target.distance1);
    const pos2 = polarToCartesian(target.bearing2, target.distance2);

    const t1 = timeToMinutes(target.time1);
    const t2 = timeToMinutes(target.time2);
    const deltaTime = (t2 - t1) / 60;

    if (isNaN(t1) || isNaN(t2) || deltaTime <= 0) return null;

    const relative = relativeMotion(pos1, pos2, deltaTime);
    const cpa = closestPointOfApproach(pos1, relative.dx, relative.dy);
    const tcpaHours = tcpaFromObservation(cpa.t, deltaTime);
    const trueTarget = trueMotion(ownShip.course, ownShip.speed, relative.course, relative.speed);
    const cpaBearing = cartesianToPolar(cpa.point.x, cpa.point.y).bearing;
    const bearingTargetToOwnAtP2 = (target.bearing2 + 180) % 360;
    const aspect = (bearingTargetToOwnAtP2 - trueTarget.bearing + 360) % 360;

    return {
        pos1,
        pos2,
        relative,
        cpa: {
            distance: cpa.distance,
            point: cpa.point,
            bearing: cpaBearing,
            tcpaMinutes: tcpaHours * 60
        },
        trueTarget: {
            course: trueTarget.bearing,
            speed: trueTarget.distance
        },
        aspect,
        aspectLabel: formatAspect(aspect),
        prediction: {
            x: pos2.x + relative.dx / deltaTime,
            y: pos2.y + relative.dy / deltaTime
        }
    };
}
