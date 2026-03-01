export function createModel() {
    return {
        ownShip: { course: 0, speed: 12 },
        orientationMode: 'north-up',
        currentTargetIndex: 0,
        dataVersion: 0,
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

        setOwnCourse(value) {
            this.ownShip.course = value;
            this.dataVersion++;
            this.notify();
        },

        setOwnSpeed(value) {
            this.ownShip.speed = value;
            this.dataVersion++;
            this.notify();
        },

        setOrientationMode(mode) {
            this.orientationMode = mode;
            this.notify();
        },

        selectTarget(index) {
            this.currentTargetIndex = index;
            this.dataVersion++;
            this.notify();
        },

        updateCurrentTarget(field, value) {
            this.targets[this.currentTargetIndex][field] = value;
            this.dataVersion++;
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
