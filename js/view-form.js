import { trueToDisplay } from './bearings.js';

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (document.activeElement === el) return;
    el.value = value;
}

function setResult(id, text) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'result-value';
}

function cpaClass(distance) {
    if (distance < 2) return 'result-value danger';
    if (distance < 5) return 'result-value warning';
    return 'result-value';
}

function tcpaClass(minutes, cpaDistance) {
    if (minutes < 30 && cpaDistance < 2) return 'result-value danger';
    return 'result-value';
}

function renderResults(results) {
    if (!results) {
        setResult('targetCourse', '---');
        setResult('targetSpeed', '---');
        setResult('cpaDistance', '---');
        setResult('tcpaTime', '---');
        setResult('cpaBearing', '---');
        setResult('aspect', '---');
        setResult('targetCourseTrue', '---');
        setResult('targetSpeedTrue', '---');
        return;
    }

    setResult('targetCourse', results.relative.course.toFixed(1) + '\u00B0');
    setResult('targetSpeed', results.relative.speed.toFixed(1) + ' kts');
    setResult('targetCourseTrue', results.trueTarget.course.toFixed(1) + '\u00B0');
    setResult('targetSpeedTrue', results.trueTarget.speed.toFixed(1) + ' kts');

    if (results.relative.speed > 0.1) {
        const cpaEl = document.getElementById('cpaDistance');
        cpaEl.textContent = results.cpa.distance.toFixed(2) + ' NM';
        cpaEl.className = cpaClass(results.cpa.distance);

        const tcpaEl = document.getElementById('tcpaTime');
        const minutes = results.cpa.tcpaMinutes;
        tcpaEl.textContent = minutes.toFixed(1) + ' min';
        tcpaEl.className = tcpaClass(minutes, results.cpa.distance);

        setResult('cpaBearing', results.cpa.bearing.toFixed(1) + '\u00B0');
        setResult('aspect', results.aspectLabel);
    } else {
        setResult('cpaDistance', 'N/A');
        setResult('tcpaTime', 'N/A');
        setResult('cpaBearing', 'N/A');
        setResult('aspect', 'N/A');
    }
}

function renderAvoidanceResults(avoidance, avoidanceResults) {
    if (!avoidance.active || !avoidanceResults) {
        setResult('avoidRelCourse', '---');
        setResult('avoidRelSpeed', '---');
        setResult('avoidCpaDistance', '---');
        setResult('avoidTcpaTime', '---');
        return;
    }

    if (avoidanceResults.maneuverNeeded === false) {
        setResult('avoidRelCourse', 'CPA suffisant');
        setResult('avoidRelSpeed', 'N/A');
        setResult('avoidCpaDistance', 'N/A');
        setResult('avoidTcpaTime', 'N/A');
        return;
    }

    setResult('avoidRelCourse', avoidance.course.toFixed(1) + '\u00B0');
    setResult('avoidRelSpeed', avoidance.speed.toFixed(1) + ' kts');

    const cpaEl = document.getElementById('avoidCpaDistance');
    cpaEl.textContent = avoidanceResults.cpa.distance.toFixed(2) + ' NM';
    cpaEl.className = cpaClass(avoidanceResults.cpa.distance);

    const tcpaEl = document.getElementById('avoidTcpaTime');
    const minutes = avoidanceResults.cpa.tcpaMinutes;
    tcpaEl.textContent = minutes.toFixed(1) + ' min';
    tcpaEl.className = tcpaClass(minutes, avoidanceResults.cpa.distance);
}

export function renderForm(model, results, avoidanceResults) {
    const { ownShip, orientationMode, currentTargetIndex } = model;
    const target = model.currentTarget;

    setInputValue('ownCourse', ownShip.course);
    setInputValue('ownSpeed', ownShip.speed);
    setInputValue('bearing1', trueToDisplay(target.bearing1, ownShip.course, orientationMode));
    setInputValue('distance1', target.distance1);
    setInputValue('time1', target.time1);
    setInputValue('bearing2', trueToDisplay(target.bearing2, ownShip.course, orientationMode));
    setInputValue('distance2', target.distance2);
    setInputValue('time2', target.time2);

    const bearingLabel = orientationMode === 'head-up' ? 'Gisement (\u00B0)' : 'Rel\u00E8vement (\u00B0)';
    document.getElementById('bearing1Label').textContent = bearingLabel;
    document.getElementById('bearing2Label').textContent = bearingLabel;

    document.getElementById('northUpBtn').classList.toggle('active', orientationMode === 'north-up');
    document.getElementById('headUpBtn').classList.toggle('active', orientationMode === 'head-up');

    document.querySelectorAll('.target-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === currentTargetIndex);
    });

    document.getElementById('avoidanceOverlay').style.display = model.avoidance.active ? 'flex' : 'none';
    if (model.avoidance.active) {
        setInputValue('avoidanceDistance', model.avoidance.distance);
    }

    renderResults(results);
    renderAvoidanceResults(model.avoidance, avoidanceResults);
}
