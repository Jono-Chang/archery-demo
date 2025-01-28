
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

const getAverageEllipse = (ellipse1: cv.RotatedRect, ellipse2: cv.RotatedRect) => {
    let avgCenterX = (ellipse1.center.x + ellipse2.center.x) / 2;
    let avgCenterY = (ellipse1.center.y + ellipse2.center.y) / 2;

    // Calculate the average size
    let avgWidth = (ellipse1.size.width + ellipse2.size.width) / 2;
    let avgHeight = (ellipse1.size.height + ellipse2.size.height) / 2;

    // Calculate the average angle
    let avgAngle = (ellipse1.angle + ellipse2.angle) / 2;

    // Create the average ellipse as a new RotatedRect
    let avgEllipse = new cv.RotatedRect();
    avgEllipse.center = new cv.Point(avgCenterX, avgCenterY);
    avgEllipse.size = new cv.Size(avgWidth, avgHeight);
    avgEllipse.angle = avgAngle;

    return avgEllipse;
}

const getNextEllipse = (ellipseOuter: cv.RotatedRect, ellipseInner: cv.RotatedRect, direction: 'out' | 'in') => {
    let diffCenterX = ellipseOuter.center.x - ellipseInner.center.x;
    let diffCenterY = ellipseOuter.center.y - ellipseInner.center.y;

    let diffWidth = ellipseOuter.size.width - ellipseInner.size.width;
    let diffHeight = ellipseOuter.size.height - ellipseInner.size.height;

    let diffAngle = ellipseOuter.angle - ellipseInner.angle;

    // Create the average ellipse as a new RotatedRect
    let diffEllipse = new cv.RotatedRect();

    if (direction === 'out') {
        const avgCenterX = ellipseOuter.center.x + diffCenterX; 
        const avgCenterY = ellipseOuter.center.y + diffCenterY;
        const avgWidth = ellipseOuter.size.width + diffWidth;
        const avgHeight = ellipseOuter.size.height + diffHeight;
        const avgAngle = ellipseOuter.angle + diffAngle;

        diffEllipse.center = new cv.Point(avgCenterX, avgCenterY);
        diffEllipse.size = new cv.Size(avgWidth, avgHeight);
        diffEllipse.angle = avgAngle;
    } else {
        const avgCenterX = ellipseInner.center.x - diffCenterX; 
        const avgCenterY = ellipseInner.center.y - diffCenterY;
        const avgWidth = ellipseInner.size.width - diffWidth;
        const avgHeight = ellipseInner.size.height - diffHeight;
        const avgAngle = ellipseInner.angle - diffAngle;

        diffEllipse.center = new cv.Point(avgCenterX, avgCenterY);
        diffEllipse.size = new cv.Size(avgWidth, avgHeight);
        diffEllipse.angle = avgAngle;
    }

    return diffEllipse;
}

const getNextEllipseRecursive = (
    ellipseOuter: cv.RotatedRect,
    ellipseInner: cv.RotatedRect,
    direction: 'out' | 'in',
    count: number
): Array<cv.RotatedRect> => {
    if (count === 0) return [];
    const next = getNextEllipse(ellipseOuter, ellipseInner, direction);
    if (direction === 'out') {
        return [next ,...getNextEllipseRecursive(next, ellipseOuter, direction, count - 1)]
    }
    return [next ,...getNextEllipseRecursive(ellipseInner, next, direction, count - 1)]
}

const drawEllipse = (ellipse: cv.RotatedRect, src: cv.Mat) => {
    cv.ellipse(
        src, // Input/output image
        ellipse.center, // Center coordinates
        new cv.Size(ellipse.size.width / 2, ellipse.size.height / 2), // Radii of the ellipse
        ellipse.angle, // Rotation angle 
        ellipse.angle - 180, // Starting angle (0 degrees)
        ellipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(255, 0, 0), // Color of the ellipse (red)
        2, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(src, new cv.Point(ellipse.center.x, ellipse.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);
}

export const blackCircle = (src: cv.Mat) => {
    const { width, height } = src.size();
    const smallerSide = Math.min(width, height);
    // appendImage(src);

    const gray = new cv.Mat();

    // Step 1: Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    // appendImage(gray);
    
    // Threshold the image
    const averageColor = cv.mean(gray)[0];
    console.log('averageColor', averageColor)
    const binary = new cv.Mat();
    cv.threshold(gray, binary, averageColor, 255, cv.THRESH_BINARY_INV);
    // appendImage(binary)

    // Step 2: Reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(binary, blurred, new cv.Size(0, 0), 13);
    // appendImage(blurred, 'blurred');

    // Threshold the image again
    const binary2 = new cv.Mat();
    cv.threshold(blurred, binary2, averageColor, 255, cv.THRESH_BINARY);
    // appendImage(binary2)

    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary2, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Get image center
    let centerX = width / 2;
    let centerY = height / 2;

    let minDist = Infinity;
    let closestContourIndex = -1;

    const contourVisualisation = new cv.Mat();
    cv.cvtColor(binary, contourVisualisation, cv.COLOR_GRAY2RGBA);
    // Iterate through contours to find the closest to the center
    for (let i = 0; i < contours.size(); i++) {
        const countour = contours.get(i);
        let moments = cv.moments(countour);
        if (moments.m00 !== 0) {
            let cx = moments.m10 / moments.m00; // Centroid x
            let cy = moments.m01 / moments.m00; // Centroid y
            cv.circle(contourVisualisation, new cv.Point(cx, cy), 5, new cv.Scalar(0, 0, 255, 255), -1);
            cv.drawContours(contourVisualisation, contours, i, new cv.Scalar(255, 0, 0, 255), 2, cv.LINE_AA);
            let dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closestContourIndex = i;
            }
        }
    }
    // appendImage(contourVisualisation, `contourVisualisation (${contours.size()})`);

    let ellipseVisualisation = src.clone();
    
    const fittedEllipse = cv.fitEllipse(contours.get(closestContourIndex));
    cv.ellipse(
        ellipseVisualisation, // Input/output image
        fittedEllipse.center, // Center coordinates
        new cv.Size(fittedEllipse.size.width / 2, fittedEllipse.size.height / 2), // Radii of the ellipse
        fittedEllipse.angle, // Rotation angle 
        fittedEllipse.angle - 180, // Starting angle (0 degrees)
        fittedEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(0, 0, 255), // Color of the ellipse (red)
        2, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(ellipseVisualisation, new cv.Point(fittedEllipse.center.x, fittedEllipse.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);
    
    appendImage(ellipseVisualisation)

    let regneratedBlackCircleMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

    // Draw the ellipse on the mask (white color)
    cv.ellipse(
        regneratedBlackCircleMask, // Input/output image
        fittedEllipse.center, // Center coordinates
        new cv.Size(fittedEllipse.size.width / 2, fittedEllipse.size.height / 2), // Radii of the ellipse
        fittedEllipse.angle, // Rotation angle 
        fittedEllipse.angle - 180, // Starting angle (0 degrees)
        fittedEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(255, 255, 255, 255),
        -1 // Fill the ellipse
    );

    let insideBlackCircleImage = new cv.Mat();
    cv.bitwise_and(src, src, insideBlackCircleImage, regneratedBlackCircleMask);
    appendImage(insideBlackCircleImage)

    const insideBlackCircleGray = new cv.Mat();
    cv.cvtColor(insideBlackCircleImage, insideBlackCircleGray, cv.COLOR_RGBA2GRAY, 0);
    appendImage(insideBlackCircleGray)

    const insideBlackCircleAverageColor = cv.mean(insideBlackCircleGray, regneratedBlackCircleMask)[0];

    const blackCircleBinary = new cv.Mat();
    cv.threshold(insideBlackCircleGray, blackCircleBinary, insideBlackCircleAverageColor, 255, cv.THRESH_BINARY_INV);
    appendImage(blackCircleBinary)

    const blackCircleBlurred = new cv.Mat();
    cv.GaussianBlur(blackCircleBinary, blackCircleBlurred, new cv.Size(0, 0), 20);
    appendImage(blackCircleBlurred, 'blurred');

    const blackCircleBinary2 = new cv.Mat();
    cv.threshold(blackCircleBlurred, blackCircleBinary2, 255/2, 255, cv.THRESH_BINARY_INV);
    appendImage(blackCircleBinary2)

    let contours2 = new cv.MatVector();
    let hierarchy2 = new cv.Mat();
    cv.findContours(blackCircleBinary2, contours2, hierarchy2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const fittedEllipse2 = cv.fitEllipse(contours2.get(0));
    cv.ellipse(
        ellipseVisualisation, // Input/output image
        fittedEllipse2.center, // Center coordinates
        new cv.Size(fittedEllipse2.size.width / 2, fittedEllipse2.size.height / 2), // Radii of the ellipse
        fittedEllipse2.angle, // Rotation angle 
        fittedEllipse2.angle - 180, // Starting angle (0 degrees)
        fittedEllipse2.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(0, 0, 255), // Color of the ellipse (red)
        2, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(ellipseVisualisation, new cv.Point(fittedEllipse2.center.x, fittedEllipse2.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);

    const avgEllipse = getAverageEllipse(fittedEllipse, fittedEllipse2);
    drawEllipse(avgEllipse, ellipseVisualisation)
    // Outer
    const ellipsesOuter = getNextEllipseRecursive(avgEllipse, fittedEllipse2, 'out', 3)
    console.log('ellipsesOuter', ellipsesOuter)
    // ellipses.forEach(e => drawEllipse(e, ellipseVisualisation))
    for (let i = 0; i < ellipsesOuter.length; i++) {
        const e = ellipsesOuter[i]
        drawEllipse(e, ellipseVisualisation)
    }

    // Inner
    const ellipsesInner = getNextEllipseRecursive(avgEllipse, fittedEllipse2, 'in', 3)
    console.log('ellipsesInner', ellipsesInner)
    // ellipses.forEach(e => drawEllipse(e, ellipseVisualisation))
    for (let i = 0; i < ellipsesInner.length; i++) {
        const e = ellipsesInner[i]
        drawEllipse(e, ellipseVisualisation)
    }
    appendImage(ellipseVisualisation)
}