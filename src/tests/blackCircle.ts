
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

const getBrighterInnerEllipse = (insideBlackCircleGray: cv.Mat, regneratedblackEllipseMask: cv.Mat, scalar = 1) => {
    const insideBlackCircleAverageColor = cv.mean(insideBlackCircleGray, regneratedblackEllipseMask)[0];
    const blackCircleBinary = new cv.Mat();
    cv.threshold(insideBlackCircleGray, blackCircleBinary, insideBlackCircleAverageColor * scalar, 255, cv.THRESH_BINARY_INV);
    appendImage(blackCircleBinary, 'blackCircleBinary')

    const blackCircleBlurred = new cv.Mat();
    cv.GaussianBlur(blackCircleBinary, blackCircleBlurred, new cv.Size(0, 0), 10);
    appendImage(blackCircleBlurred, 'blackCircleBlurred');

    const blackCircleBinary2 = new cv.Mat();
    cv.threshold(blackCircleBlurred, blackCircleBinary2, 255/2, 255, cv.THRESH_BINARY_INV);
    appendImage(blackCircleBinary2)

    let contours2 = new cv.MatVector();
    let hierarchy2 = new cv.Mat();
    cv.findContours(blackCircleBinary2, contours2, hierarchy2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    return cv.fitEllipse(contours2.get(0));
}

const generateMaskForEllipse = (blackEllipse: cv.RotatedRect, src: cv.Mat) => {
    let blackEllipseMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

    // Draw the ellipse on the mask (white color)
    cv.ellipse(
        blackEllipseMask, // Input/output image
        blackEllipse.center, // Center coordinates
        new cv.Size(blackEllipse.size.width / 2, blackEllipse.size.height / 2), // Radii of the ellipse
        blackEllipse.angle, // Rotation angle 
        blackEllipse.angle - 180, // Starting angle (0 degrees)
        blackEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(255, 255, 255, 255),
        -1 // Fill the ellipse
    );

    return blackEllipseMask;
}

const getAverageEllipse = (ellipse1: cv.RotatedRect, ellipse2: cv.RotatedRect) => {
    let avgCenterX = (ellipse1.center.x + ellipse2.center.x) / 2;
    let avgCenterY = (ellipse1.center.y + ellipse2.center.y) / 2;

    // Calculate the average size
    let avgWidth = (ellipse1.size.width + ellipse2.size.width) / 2;
    let avgHeight = (ellipse1.size.height + ellipse2.size.height) / 2;

    // Calculate the average angle
    let angle1 = ellipse1.angle;
    let angle2 = ellipse2.angle;

    // Handle angle wrapping (if angles differ by more than 180°)
    if (Math.abs(angle1 - angle2) > 180) {
        if (angle1 > angle2) {
            angle2 += 360;
        } else {
            angle1 += 360;
        }
    }

    // Compute the average angle
    let avgAngle = (angle1 + angle2) / 2;

    // Normalize the angle back to the range [0, 360)
    avgAngle = avgAngle % 360;
    if (avgAngle < 0) avgAngle += 360;

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
    
    const blackEllipse = cv.fitEllipse(contours.get(closestContourIndex));
    cv.ellipse(
        ellipseVisualisation, // Input/output image
        blackEllipse.center, // Center coordinates
        new cv.Size(blackEllipse.size.width / 2, blackEllipse.size.height / 2), // Radii of the ellipse
        blackEllipse.angle, // Rotation angle 
        blackEllipse.angle - 180, // Starting angle (0 degrees)
        blackEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(0, 0, 255), // Color of the ellipse (red)
        2, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(ellipseVisualisation, new cv.Point(blackEllipse.center.x, blackEllipse.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);
    
    appendImage(ellipseVisualisation)

    let blackEllipseMask = generateMaskForEllipse(blackEllipse, src);

    let insideBlackCircleImage = new cv.Mat();
    cv.bitwise_and(src, src, insideBlackCircleImage, blackEllipseMask);
    appendImage(insideBlackCircleImage)

    const insideBlackCircleGray = new cv.Mat();
    cv.cvtColor(insideBlackCircleImage, insideBlackCircleGray, cv.COLOR_RGBA2GRAY, 0);
    appendImage(insideBlackCircleGray)

    const blueEllipse = getBrighterInnerEllipse(insideBlackCircleGray, blackEllipseMask, 1);
    drawEllipse(blueEllipse, ellipseVisualisation)

    let blueEllipseMask = generateMaskForEllipse(blueEllipse, src);

    const yellowEllipse = getBrighterInnerEllipse(insideBlackCircleGray, blueEllipseMask, 1.5);
    drawEllipse(yellowEllipse, ellipseVisualisation)

    const black2Ellipse = getAverageEllipse(blueEllipse, blackEllipse);
    drawEllipse(black2Ellipse, ellipseVisualisation)
    
    const whiteEllipses = getNextEllipseRecursive(blackEllipse, black2Ellipse, 'out', 2)
    for (let i = 0; i < whiteEllipses.length; i++) drawEllipse(whiteEllipses[i], ellipseVisualisation)
    
    const blueRedEllipses = getNextEllipseRecursive(black2Ellipse, blueEllipse, 'in', 2)
    for (let i = 0; i < blueRedEllipses.length; i++) drawEllipse(blueRedEllipses[i], ellipseVisualisation)

    const red2Ellipse = getAverageEllipse(blueRedEllipses[1], yellowEllipse);
    drawEllipse(red2Ellipse, ellipseVisualisation)

    // // Inner
    // const ellipsesInner = getNextEllipseRecursive(avgEllipse, yellowEllipse, 'in', 3)
    // console.log('ellipsesInner', ellipsesInner)
    // // ellipses.forEach(e => drawEllipse(e, ellipseVisualisation))
    // for (let i = 0; i < ellipsesInner.length; i++) {
    //     const e = ellipsesInner[i]
    //     drawEllipse(e, ellipseVisualisation)
    // }
    appendImage(ellipseVisualisation)
}