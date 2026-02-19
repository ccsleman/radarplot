import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeOwnPosition,
    computeTargetPosition,
    computeAvoidanceOwnPosition,
    computeTimeline,
    computeBoundingBox
} from '../js/view-animation.js';
import { polarToCartesian, computeResults } from '../js/calculator.js';

const EPSILON = 1e-9;

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, message || `expected ${expected}, got ${actual}`);
}

function assertCloseLoose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, message || `expected ~${expected}, got ${actual}`);
}

describe('computeOwnPosition', () => {
    it('returns origin at t=0', () => {
        const vel = polarToCartesian(45, 10);
        const pos = computeOwnPosition(vel, 0);
        assertClose(pos.x, 0);
        assertClose(pos.y, 0);
    });

    it('returns velocity * t at known time', () => {
        const vel = { x: 3, y: 4 };
        const pos = computeOwnPosition(vel, 2);
        assertClose(pos.x, 6);
        assertClose(pos.y, 8);
    });

    it('handles northward motion', () => {
        const vel = polarToCartesian(0, 12);
        const pos = computeOwnPosition(vel, 0.5);
        assertCloseLoose(pos.x, 0, 1e-6);
        assertCloseLoose(pos.y, 6, 1e-6);
    });

    it('handles eastward motion', () => {
        const vel = polarToCartesian(90, 10);
        const pos = computeOwnPosition(vel, 1);
        assertCloseLoose(pos.x, 10, 1e-6);
        assertCloseLoose(pos.y, 0, 1e-6);
    });
});

describe('computeTargetPosition', () => {
    it('returns pos2 at t=0', () => {
        const pos2 = { x: 5, y: 7 };
        const vel = { x: 1, y: 2 };
        const pos = computeTargetPosition(pos2, vel, 0);
        assertClose(pos.x, 5);
        assertClose(pos.y, 7);
    });

    it('returns pos2 + velocity * t', () => {
        const pos2 = { x: 5, y: 7 };
        const vel = { x: 1, y: 2 };
        const pos = computeTargetPosition(pos2, vel, 3);
        assertClose(pos.x, 8);
        assertClose(pos.y, 13);
    });

    it('handles negative velocity components', () => {
        const pos2 = { x: 10, y: 10 };
        const vel = { x: -2, y: -3 };
        const pos = computeTargetPosition(pos2, vel, 2);
        assertClose(pos.x, 6);
        assertClose(pos.y, 4);
    });
});

describe('computeAvoidanceOwnPosition', () => {
    const ownVel = { x: 0, y: 10 };
    const avoidVel = { x: 5, y: 5 };
    const tManeuver = 1;

    it('matches original course before maneuver time', () => {
        const pos = computeAvoidanceOwnPosition(ownVel, avoidVel, tManeuver, 0.5);
        const regular = computeOwnPosition(ownVel, 0.5);
        assertClose(pos.x, regular.x);
        assertClose(pos.y, regular.y);
    });

    it('matches original course at exactly maneuver time', () => {
        const pos = computeAvoidanceOwnPosition(ownVel, avoidVel, tManeuver, tManeuver);
        const regular = computeOwnPosition(ownVel, tManeuver);
        assertClose(pos.x, regular.x);
        assertClose(pos.y, regular.y);
    });

    it('follows avoidance course after maneuver time', () => {
        const dt = 0.5;
        const pos = computeAvoidanceOwnPosition(ownVel, avoidVel, tManeuver, tManeuver + dt);
        const atManeuver = computeOwnPosition(ownVel, tManeuver);
        assertClose(pos.x, atManeuver.x + avoidVel.x * dt);
        assertClose(pos.y, atManeuver.y + avoidVel.y * dt);
    });

    it('is continuous at maneuver time (no jump)', () => {
        const eps = 1e-10;
        const before = computeAvoidanceOwnPosition(ownVel, avoidVel, tManeuver, tManeuver - eps);
        const after = computeAvoidanceOwnPosition(ownVel, avoidVel, tManeuver, tManeuver + eps);
        assertCloseLoose(before.x, after.x, 1e-6, 'x should be continuous');
        assertCloseLoose(before.y, after.y, 1e-6, 'y should be continuous');
    });

    it('ghost (regular) position ignores avoidance entirely', () => {
        const ghostPos = computeOwnPosition(ownVel, 2);
        assertClose(ghostPos.x, 0);
        assertClose(ghostPos.y, 20);
    });
});

describe('computeTimeline', () => {
    it('tCpa matches tcpaMinutes / 60', () => {
        const { tCpa } = computeTimeline(30);
        assertClose(tCpa, 0.5);
    });

    it('tEnd equals tCpa * 1.25', () => {
        const { tCpa, tEnd } = computeTimeline(30);
        assertClose(tEnd, tCpa * 1.25);
    });

    it('tStart is 0', () => {
        const { tStart } = computeTimeline(60);
        assertClose(tStart, 0);
    });

    it('handles small tcpa', () => {
        const { tCpa, tEnd } = computeTimeline(6);
        assertClose(tCpa, 0.1);
        assertClose(tEnd, 0.125);
    });

    it('extends past avoidance CPA when it is later', () => {
        const { tEnd } = computeTimeline(30, 48);
        const tCpaAvoid = 48 / 60;
        assertClose(tEnd, tCpaAvoid * 1.25);
    });

    it('extends past regular CPA when it is later than avoidance CPA', () => {
        const { tEnd } = computeTimeline(48, 30);
        const tCpa = 48 / 60;
        assertClose(tEnd, tCpa * 1.25);
    });

    it('ignores null avoidance CPA', () => {
        const { tEnd } = computeTimeline(30, null);
        const tCpa = 30 / 60;
        assertClose(tEnd, tCpa * 1.25);
    });
});

describe('computeBoundingBox', () => {
    it('encloses all points', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 5 },
            { x: -3, y: 8 },
            { x: 7, y: -2 }
        ];
        const bbox = computeBoundingBox(points);
        assert.ok(bbox.minX <= -3, 'minX should include -3');
        assert.ok(bbox.maxX >= 10, 'maxX should include 10');
        assert.ok(bbox.minY <= -2, 'minY should include -2');
        assert.ok(bbox.maxY >= 8, 'maxY should include 8');
    });

    it('adds padding beyond raw extents', () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
        const bbox = computeBoundingBox(points);
        assert.ok(bbox.minX < 0, 'minX should have padding');
        assert.ok(bbox.maxX > 10, 'maxX should have padding');
        assert.ok(bbox.minY < 0, 'minY should have padding');
        assert.ok(bbox.maxY > 10, 'maxY should have padding');
    });

    it('handles stationary boats (single point)', () => {
        const points = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
        const bbox = computeBoundingBox(points);
        assert.ok(bbox.maxX > bbox.minX, 'should have nonzero width');
        assert.ok(bbox.maxY > bbox.minY, 'should have nonzero height');
        assert.ok(bbox.minX < 5, 'min should be below point');
        assert.ok(bbox.maxX > 5, 'max should be above point');
    });

    it('handles all identical points', () => {
        const points = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
        const bbox = computeBoundingBox(points);
        assert.ok(isFinite(bbox.minX), 'should be finite');
        assert.ok(isFinite(bbox.maxX), 'should be finite');
        assert.ok(bbox.maxX > bbox.minX, 'should have nonzero width');
        assert.ok(bbox.maxY > bbox.minY, 'should have nonzero height');
    });
});

describe('CPA geometry verification', () => {
    it('distance between boats at tCpa matches results.cpa.distance', () => {
        const target = { bearing1: 45, distance1: 8, time1: '12:00', bearing2: 50, distance2: 6, time2: '12:12' };
        const ownShip = { course: 0, speed: 12 };
        const results = computeResults(target, ownShip);
        assert.ok(results !== null);

        const ownVelocity = polarToCartesian(ownShip.course, ownShip.speed);
        const targetVelocity = polarToCartesian(results.trueTarget.course, results.trueTarget.speed);
        const { tCpa } = computeTimeline(results.cpa.tcpaMinutes);

        const ownAtCpa = computeOwnPosition(ownVelocity, tCpa);
        const targetAtCpa = computeTargetPosition(results.pos2, targetVelocity, tCpa);

        const dx = targetAtCpa.x - ownAtCpa.x;
        const dy = targetAtCpa.y - ownAtCpa.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        assertCloseLoose(dist, results.cpa.distance, 0.01,
            `distance at tCpa (${dist.toFixed(4)}) should match CPA distance (${results.cpa.distance.toFixed(4)})`);
    });
});
