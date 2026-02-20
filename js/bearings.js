export function trueToRelative(trueBearing, ownCourse) {
    return (trueBearing - ownCourse + 360) % 360;
}

export function relativeToTrue(relativeBearing, ownCourse) {
    return (relativeBearing + ownCourse) % 360;
}

export function trueToDisplay(trueBearing, ownCourse, orientationMode) {
    if (orientationMode === 'head-up') {
        return trueToRelative(trueBearing, ownCourse);
    }
    return trueBearing;
}

export function displayToTrue(displayBearing, ownCourse, orientationMode) {
    if (orientationMode === 'head-up') {
        return relativeToTrue(displayBearing, ownCourse);
    }
    return displayBearing;
}
