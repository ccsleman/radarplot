import assert from 'node:assert/strict';

const EPSILON = 1e-9;

export function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, message || `expected ${expected}, got ${actual}`);
}

export function assertCloseLoose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, message || `expected ~${expected}, got ${actual}`);
}
