const TARGET_FIELDS = ['b1', 'd1', 't1', 'b2', 'd2', 't2'];

const FIELD_MAP = {
    b1: 'bearing1',
    d1: 'distance1',
    t1: 'time1',
    b2: 'bearing2',
    d2: 'distance2',
    t2: 'time2',
};

function timeToHHMM(str) {
    return str ? str.replace(':', '') : '';
}

function hhmmToTime(str) {
    if (!str || str.length !== 4) return null;
    return str.slice(0, 2) + ':' + str.slice(2);
}

function parseFloat_(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

function parseInt_(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

export function applyFragment(model) {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const params = new URLSearchParams(hash.slice(1));

    const oc = parseFloat_(params.get('oc'));
    if (oc !== null) model.ownShip.course = oc;

    const os = parseFloat_(params.get('os'));
    if (os !== null) model.ownShip.speed = os;

    const t = parseInt_(params.get('t'));
    if (t !== null && t >= 1 && t <= model.targets.length) {
        model.currentTargetIndex = t - 1;
    }

    for (let i = 0; i < model.targets.length; i++) {
        const n = i + 1;
        for (const key of TARGET_FIELDS) {
            const raw = params.get(`${n}.${key}`);
            if (raw === null) continue;

            const field = FIELD_MAP[key];
            if (key === 't1' || key === 't2') {
                const time = hhmmToTime(raw);
                if (time) model.targets[i][field] = time;
            } else {
                const n = parseFloat_(raw);
                if (n !== null) model.targets[i][field] = n;
            }
        }
    }

    const ac = parseFloat_(params.get('ac'));
    const as = parseFloat_(params.get('as'));
    if (ac !== null || as !== null) {
        model.avoidance.active = true;
        if (ac !== null) model.avoidance.course = ac;
        if (as !== null) model.avoidance.speed = as;
    }
    const ad = parseFloat_(params.get('ad'));
    if (ad !== null) model.avoidance.distance = ad;
}

export function syncFragmentToModel(model) {
    const params = new URLSearchParams();

    params.set('oc', model.ownShip.course);
    params.set('os', model.ownShip.speed);
    params.set('t', model.currentTargetIndex + 1);

    for (let i = 0; i < model.targets.length; i++) {
        const n = i + 1;
        const tgt = model.targets[i];
        params.set(`${n}.b1`, tgt.bearing1);
        params.set(`${n}.d1`, tgt.distance1);
        params.set(`${n}.t1`, timeToHHMM(tgt.time1));
        params.set(`${n}.b2`, tgt.bearing2);
        params.set(`${n}.d2`, tgt.distance2);
        params.set(`${n}.t2`, timeToHHMM(tgt.time2));
    }

    if (model.avoidance.active) {
        params.set('ac', model.avoidance.course);
        params.set('as', model.avoidance.speed);
        params.set('ad', model.avoidance.distance);
    }

    history.replaceState(null, '', '#' + params.toString());
}
