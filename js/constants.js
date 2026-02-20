export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const MIN_MOVEMENT_SPEED = 0.1;

export function normalizeBearing(deg) {
    return ((deg % 360) + 360) % 360;
}

export function formatMinutes(minutes) {
    const total = Math.round(minutes);
    if (total >= 60) {
        const h = Math.floor(total / 60);
        const m = total % 60;
        return `${h}h${String(m).padStart(2, '0')}min`;
    }
    return `${total} min`;
}
