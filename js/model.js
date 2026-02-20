import { NICE_SCALES, MAX_CHART_KNOTS, RADAR_RANGES, DEFAULT_RADAR_RANGE_INDEX } from './draw.js';

function bestFitScaleIndex(maxSpeed) {
    for (let i = NICE_SCALES.length - 1; i >= 0; i--) {
        if (maxSpeed * NICE_SCALES[i].value <= MAX_CHART_KNOTS) return i;
    }
    return 0;
}

export function createModel() {
    return {
        ownShip: { course: 0, speed: 12 },
        orientationMode: 'north-up',
        currentTargetIndex: 0,
        triangleScaleIndex: null,
        triangleScaleManual: false,
        radarRangeIndex: DEFAULT_RADAR_RANGE_INDEX,
        radarRangeManual: false,
        avoidance: { active: false, course: 0, speed: 0, distance: 3 },
        targets: [
            { bearing1: 45, distance1: 8, time1: '12:00', bearing2: 50, distance2: 6, time2: '12:12' },
            { bearing1: 90, distance1: 10, time1: '14:00', bearing2: 95, distance2: 8, time2: '14:15' },
            { bearing1: 180, distance1: 12, time1: '16:30', bearing2: 185, distance2: 9, time2: '16:48' },
            { bearing1: 270, distance1: 7, time1: '09:15', bearing2: 275, distance2: 5, time2: '09:25' },
            { bearing1: 315, distance1: 9, time1: '11:00', bearing2: 320, distance2: 7, time2: '11:14' },
        ],
        _listeners: [],

        get currentTarget() {
            return this.targets[this.currentTargetIndex];
        },

        subscribe(fn) {
            this._listeners.push(fn);
        },

        notify() {
            for (const fn of this._listeners) fn();
        },

        autoFitTriangleScale(results) {
            if (!this.triangleScaleManual && results) {
                const maxSpeed = Math.max(this.ownShip.speed, results.trueTarget.speed);
                this.triangleScaleIndex = bestFitScaleIndex(maxSpeed);
            }
        },

        resetTriangleScale() {
            this.triangleScaleManual = false;
            this.triangleScaleIndex = null;
        },

        resetRadarRange() {
            this.radarRangeManual = false;
        },

        autoFitRadarRange(results) {
            if (this.radarRangeManual || !results) return;
            const maxDist = Math.max(
                Math.sqrt(results.pos1.x ** 2 + results.pos1.y ** 2),
                Math.sqrt(results.pos2.x ** 2 + results.pos2.y ** 2)
            );
            const idx = RADAR_RANGES.findIndex(r => r.range >= maxDist);
            this.radarRangeIndex = idx >= 0 ? idx : RADAR_RANGES.length - 1;
        },

        stepRadarRange(delta) {
            const maxIndex = RADAR_RANGES.length - 1;
            this.radarRangeIndex = Math.max(0, Math.min(maxIndex, this.radarRangeIndex + delta));
            this.radarRangeManual = true;
            this.notify();
        },

        setOwnCourse(value) {
            this.ownShip.course = value;
            this.resetTriangleScale();
            this.resetRadarRange();
            this.notify();
        },

        setOwnSpeed(value) {
            this.ownShip.speed = value;
            this.resetTriangleScale();
            this.resetRadarRange();
            this.notify();
        },

        setOrientationMode(mode) {
            this.orientationMode = mode;
            this.notify();
        },

        selectTarget(index) {
            this.currentTargetIndex = index;
            this.resetTriangleScale();
            this.resetRadarRange();
            this.notify();
        },

        updateCurrentTarget(field, value) {
            this.targets[this.currentTargetIndex][field] = value;
            this.resetTriangleScale();
            this.resetRadarRange();
            this.notify();
        },

        stepTriangleScale(delta) {
            const maxIndex = NICE_SCALES.length - 1;
            const current = this.triangleScaleIndex ?? 0;
            this.triangleScaleIndex = Math.max(0, Math.min(maxIndex, current + delta));
            this.triangleScaleManual = true;
            this.notify();
        },

        setAvoidance(course, speed) {
            this.avoidance.active = true;
            this.avoidance.course = course;
            this.avoidance.speed = speed;
            this.notify();
        },

        setAvoidanceDistance(d) {
            this.avoidance.distance = d;
            this.notify();
        },

        exitAvoidance() {
            this.avoidance.active = false;
            this.notify();
        },
    };
}
