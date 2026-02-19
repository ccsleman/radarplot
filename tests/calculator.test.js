import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    timeToMinutes,
    polarToCartesian,
    cartesianToPolar,
    relativeMotion,
    closestPointOfApproach,
    tcpaFromObservation,
    trueMotion,
    computeResults,
    computeAvoidanceResults
} from '../js/calculator.js';

const EPSILON = 1e-9;

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, message || `expected ${expected}, got ${actual}`);
}

function assertCloseLoose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, message || `expected ~${expected}, got ${actual}`);
}

describe('timeToMinutes', () => {
    it('converts noon', () => {
        assert.strictEqual(timeToMinutes('12:00'), 720);
    });

    it('converts midnight', () => {
        assert.strictEqual(timeToMinutes('00:00'), 0);
    });

    it('converts end of day', () => {
        assert.strictEqual(timeToMinutes('23:59'), 1439);
    });

    it('returns NaN for empty string', () => {
        assert.ok(isNaN(timeToMinutes('')));
    });

    it('returns NaN for null', () => {
        assert.ok(isNaN(timeToMinutes(null)));
    });
});

describe('polarToCartesian', () => {
    it('bearing 0 (north) points along +y', () => {
        const p = polarToCartesian(0, 10);
        assertClose(p.x, 0);
        assertClose(p.y, 10);
    });

    it('bearing 90 (east) points along +x', () => {
        const p = polarToCartesian(90, 10);
        assertClose(p.x, 10);
        assertClose(p.y, 0);
    });

    it('bearing 180 (south) points along -y', () => {
        const p = polarToCartesian(180, 10);
        assertClose(p.x, 0);
        assertClose(p.y, -10);
    });

    it('bearing 270 (west) points along -x', () => {
        const p = polarToCartesian(270, 10);
        assertClose(p.x, -10);
        assertClose(p.y, 0);
    });

    it('bearing 45 splits evenly between x and y', () => {
        const p = polarToCartesian(45, Math.SQRT2);
        assertClose(p.x, 1);
        assertClose(p.y, 1);
    });

    it('zero distance returns origin', () => {
        const p = polarToCartesian(123, 0);
        assertClose(p.x, 0);
        assertClose(p.y, 0);
    });
});

describe('cartesianToPolar', () => {
    it('north', () => {
        const r = cartesianToPolar(0, 10);
        assertClose(r.bearing, 0);
        assertClose(r.distance, 10);
    });

    it('east', () => {
        const r = cartesianToPolar(10, 0);
        assertClose(r.bearing, 90);
        assertClose(r.distance, 10);
    });

    it('south', () => {
        const r = cartesianToPolar(0, -10);
        assertClose(r.bearing, 180);
        assertClose(r.distance, 10);
    });

    it('west', () => {
        const r = cartesianToPolar(-10, 0);
        assertClose(r.bearing, 270);
        assertClose(r.distance, 10);
    });
});

describe('polarToCartesian and cartesianToPolar are inverses', () => {
    const cases = [
        { bearing: 0, distance: 5 },
        { bearing: 45, distance: 10 },
        { bearing: 90, distance: 1 },
        { bearing: 135, distance: 7 },
        { bearing: 180, distance: 3 },
        { bearing: 225, distance: 12 },
        { bearing: 270, distance: 8 },
        { bearing: 315, distance: 6 },
        { bearing: 359, distance: 4 },
    ];

    for (const { bearing, distance } of cases) {
        it(`round-trips bearing=${bearing}, distance=${distance}`, () => {
            const { x, y } = polarToCartesian(bearing, distance);
            const result = cartesianToPolar(x, y);
            assertCloseLoose(result.bearing, bearing, 1e-6);
            assertCloseLoose(result.distance, distance, 1e-6);
        });
    }
});

describe('relativeMotion', () => {
    it('computes course and speed for known displacement', () => {
        const pos1 = { x: 0, y: 10 };
        const pos2 = { x: 0, y: 5 };
        const result = relativeMotion(pos1, pos2, 1);
        assertClose(result.course, 180);
        assertClose(result.speed, 5);
    });

    it('computes eastward motion', () => {
        const pos1 = { x: 0, y: 0 };
        const pos2 = { x: 6, y: 0 };
        const result = relativeMotion(pos1, pos2, 0.5);
        assertClose(result.course, 90);
        assertClose(result.speed, 12);
    });
});

describe('closestPointOfApproach', () => {
    it('returns near-zero distance for collision course', () => {
        const pos1 = { x: 0, y: 10 };
        const dx = 0;
        const dy = -5;
        const result = closestPointOfApproach(pos1, dx, dy);
        assertCloseLoose(result.distance, 0, 1e-6);
        assertClose(result.point.x, 0);
        assertClose(result.point.y, 0);
        assertClose(result.t, 2);
    });

    it('computes known CPA for target passing abeam', () => {
        const pos1 = { x: -5, y: 5 };
        const dx = 10;
        const dy = 0;
        const result = closestPointOfApproach(pos1, dx, dy);
        assertClose(result.distance, 5);
        assertClose(result.point.x, 0);
        assertClose(result.point.y, 5);
        assertClose(result.t, 0.5);
    });

    it('returns t < 1 when CPA is in the past', () => {
        const pos1 = { x: 5, y: 5 };
        const dx = 5;
        const dy = 0;
        const result = closestPointOfApproach(pos1, dx, dy);
        assert.ok(result.t < 1, `expected t < 1, got ${result.t}`);
    });

    it('handles zero motion', () => {
        const pos1 = { x: 3, y: 4 };
        const result = closestPointOfApproach(pos1, 0, 0);
        assertClose(result.distance, 5);
        assertClose(result.t, 0);
    });
});

describe('tcpaFromObservation', () => {
    it('returns positive hours when CPA is in the future', () => {
        assert.strictEqual(tcpaFromObservation(2, 0.5), 0.5);
    });

    it('returns zero when CPA is at second observation', () => {
        assert.strictEqual(tcpaFromObservation(1, 0.5), 0);
    });

    it('returns negative hours when CPA is in the past', () => {
        assert.strictEqual(tcpaFromObservation(0.5, 1), -0.5);
    });
});

describe('trueMotion', () => {
    it('stationary target: true motion equals negative of own ship motion', () => {
        const own = polarToCartesian(0, 10);
        const result = trueMotion(0, 10, 180, 10);
        assertCloseLoose(result.distance, 0, 1e-6);
    });

    it('computes known vector triangle', () => {
        const result = trueMotion(0, 10, 90, 10);
        assertCloseLoose(result.distance, Math.sqrt(200), 1e-6);
        assertCloseLoose(result.bearing, 45, 1e-6);
    });
});

describe('computeResults', () => {
    it('returns null for invalid time interval', () => {
        const target = { bearing1: 45, distance1: 8, time1: '12:12', bearing2: 50, distance2: 6, time2: '12:00' };
        const ownShip = { course: 0, speed: 12 };
        assert.strictEqual(computeResults(target, ownShip), null);
    });

    it('returns results for valid input', () => {
        const target = { bearing1: 45, distance1: 8, time1: '12:00', bearing2: 50, distance2: 6, time2: '12:12' };
        const ownShip = { course: 0, speed: 12 };
        const results = computeResults(target, ownShip);
        assert.ok(results !== null);
        assert.ok(results.relative.speed > 0);
        assert.ok(results.trueTarget.speed >= 0);
        assert.ok(results.cpa.distance >= 0);
        assert.ok(typeof results.cpa.bearing === 'number');
        assert.ok(results.cpa.bearing >= 0 && results.cpa.bearing < 360);
        assert.ok(typeof results.aspect === 'number');
        assert.ok(results.aspect >= 0 && results.aspect < 360);
        assert.ok(typeof results.aspectLabel === 'string');
        assert.ok(results.aspectLabel.length > 0);
    });

    it('returns null for empty time strings', () => {
        const target = { bearing1: 45, distance1: 8, time1: '', bearing2: 50, distance2: 6, time2: '12:12' };
        const ownShip = { course: 0, speed: 12 };
        assert.strictEqual(computeResults(target, ownShip), null);
    });

    it('prediction extrapolates P2 by 1 hour of relative motion', () => {
        const target = { bearing1: 0, distance1: 10, time1: '12:00', bearing2: 0, distance2: 5, time2: '12:30' };
        const ownShip = { course: 0, speed: 0 };
        const results = computeResults(target, ownShip);
        const pos2 = polarToCartesian(0, 5);
        const deltaTime = 0.5;
        const expectedX = pos2.x + (results.relative.dx / deltaTime);
        const expectedY = pos2.y + (results.relative.dy / deltaTime);
        assertCloseLoose(results.prediction.x, expectedX, 1e-6, 'prediction.x');
        assertCloseLoose(results.prediction.y, expectedY, 1e-6, 'prediction.y');
    });
});

describe('computeAvoidanceResults timeToManeuverHours', () => {
    const target = { bearing1: 45, distance1: 8, time1: '12:00', bearing2: 50, distance2: 6, time2: '12:12' };
    const ownShip = { course: 0, speed: 12 };

    it('returns timeToManeuverHours as a non-negative number', () => {
        const results = computeResults(target, ownShip);
        const avoid = computeAvoidanceResults(results, 90, 10, 3);
        assert.ok(avoid !== null);
        assert.ok(typeof avoid.timeToManeuverHours === 'number');
        assert.ok(avoid.timeToManeuverHours >= 0, `expected >= 0, got ${avoid.timeToManeuverHours}`);
    });

    it('is less than total TCPA', () => {
        const results = computeResults(target, ownShip);
        const avoid = computeAvoidanceResults(results, 90, 10, 3);
        assert.ok(avoid !== null);
        const totalTcpaHours = avoid.cpa.tcpaMinutes / 60;
        assert.ok(avoid.timeToManeuverHours <= totalTcpaHours,
            `maneuver time (${avoid.timeToManeuverHours}) should be <= total TCPA (${totalTcpaHours})`);
    });

    it('is consistent with maneuverPoint and relative velocity', () => {
        const results = computeResults(target, ownShip);
        const avoid = computeAvoidanceResults(results, 90, 10, 3);
        assert.ok(avoid !== null);

        const dx = avoid.maneuverPoint.x - results.pos2.x;
        const dy = avoid.maneuverPoint.y - results.pos2.y;
        const distFromP2 = Math.sqrt(dx * dx + dy * dy);
        const relSpeed = results.relative.speed;
        const p1p2Dist = Math.sqrt(
            results.relative.dx * results.relative.dx +
            results.relative.dy * results.relative.dy
        );
        const deltaTime = p1p2Dist / relSpeed;
        const expectedTime = (distFromP2 / p1p2Dist) * deltaTime;

        assertCloseLoose(avoid.timeToManeuverHours, expectedTime, 0.01,
            `timeToManeuverHours (${avoid.timeToManeuverHours}) should match geometric derivation (${expectedTime})`);
    });
});
