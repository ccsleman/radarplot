export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const MIN_MOVEMENT_SPEED = 0.1;

export function normalizeBearing(deg) {
    return ((deg % 360) + 360) % 360;
}
