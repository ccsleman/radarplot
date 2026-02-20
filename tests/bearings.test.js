import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { trueToRelative, relativeToTrue, trueToDisplay, displayToTrue } from '../js/bearings.js';

describe('trueToRelative', () => {
    it('subtracts own course from true bearing', () => {
        assert.strictEqual(trueToRelative(90, 45), 45);
    });

    it('returns 0 when bearing equals course', () => {
        assert.strictEqual(trueToRelative(180, 180), 0);
    });

    it('wraps around when bearing is less than course', () => {
        assert.strictEqual(trueToRelative(10, 350), 20);
    });

    it('handles course of 0', () => {
        assert.strictEqual(trueToRelative(270, 0), 270);
    });
});

describe('relativeToTrue', () => {
    it('adds own course to relative bearing', () => {
        assert.strictEqual(relativeToTrue(45, 45), 90);
    });

    it('wraps past 360', () => {
        assert.strictEqual(relativeToTrue(20, 350), 10);
    });

    it('handles zero relative bearing', () => {
        assert.strictEqual(relativeToTrue(0, 120), 120);
    });
});

describe('trueToRelative and relativeToTrue are inverses', () => {
    const cases = [
        { bearing: 0, course: 0 },
        { bearing: 90, course: 45 },
        { bearing: 10, course: 350 },
        { bearing: 359, course: 1 },
        { bearing: 180, course: 270 },
    ];

    for (const { bearing, course } of cases) {
        it(`round-trips bearing=${bearing}, course=${course}`, () => {
            const relative = trueToRelative(bearing, course);
            assert.strictEqual(relativeToTrue(relative, course), bearing);
        });
    }
});

describe('trueToDisplay', () => {
    it('passes through in north-up mode', () => {
        assert.strictEqual(trueToDisplay(90, 45, 'north-up'), 90);
    });

    it('converts to relative in head-up mode', () => {
        assert.strictEqual(trueToDisplay(90, 45, 'head-up'), 45);
    });
});

describe('displayToTrue', () => {
    it('passes through in north-up mode', () => {
        assert.strictEqual(displayToTrue(90, 45, 'north-up'), 90);
    });

    it('converts from relative in head-up mode', () => {
        assert.strictEqual(displayToTrue(45, 45, 'head-up'), 90);
    });
});

describe('display round-trip', () => {
    const modes = ['north-up', 'head-up'];
    const cases = [
        { bearing: 0, course: 0 },
        { bearing: 45, course: 90 },
        { bearing: 350, course: 20 },
        { bearing: 10, course: 350 },
        { bearing: 180, course: 180 },
    ];

    for (const mode of modes) {
        for (const { bearing, course } of cases) {
            it(`round-trips bearing=${bearing}, course=${course}, mode=${mode}`, () => {
                const display = trueToDisplay(bearing, course, mode);
                assert.strictEqual(displayToTrue(display, course, mode), bearing);
            });
        }
    }
});
